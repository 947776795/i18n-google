# 翻译模块 (Translate Module)

## 职责

为新发现的翻译 key 生成各语言的翻译内容，使用 LLM API 进行自动翻译。

## 模块组成

```
translate/
└── LLMTranslator.ts    # LLM 翻译器
```

---

## LLMTranslator.ts

### 职责
调用 LLM API 为新 key 生成多语言翻译

### 核心方法
```typescript
class LLMTranslator {
  // 翻译单个 key
  async translate(
    key: string,
    fromLang: string,
    toLang: string
  ): Promise<string>

  // 批量翻译
  async translateBatch(
    keys: string[],
    fromLang: string,
    toLangs: string[]
  ): Promise<Map<string, Record<string, string>>>

  // 为新 key 生成所有配置语言的翻译
  async translateForAllLanguages(
    key: string,
    baseLang: string = "en"
  ): Promise<Record<string, string>>
}
```

---

## 配置选项

```typescript
interface I18nConfig {
  // LLM API Key
  apiKey: string

  // 重试次数（默认 3）
  llmRetries?: number

  // 超时时间毫秒（默认 30000）
  llmTimeout?: number

  // 温度参数（默认 0.2，越低越稳定）
  llmTemperature?: number

  // 模型名称（默认 qwen-turbo）
  llmModel?: string
}
```

---

## 翻译流程

```
新 key: "Welcome"
    ↓
[检查是否为英文]
    ↓ 是
[直接使用原文作为 en 翻译]
    ↓
[遍历其他语言 ko, es, zh-CN...]
    ↓
[调用 LLM API]
    ↓
{
  "en": "Welcome",
  "ko": "환영합니다",
  "es": "Bienvenido",
  "zh-CN": "欢迎"
}
```

---

## 错误处理

### 翻译失败降级
```typescript
try {
  const translated = await llmTranslate(key, "en", "ko")
  return translated
} catch (error) {
  // 降级：使用原文
  Logger.warn(`翻译失败，使用原文: ${key}`)
  return key
}
```

### 重试机制
```typescript
async translateWithRetry(key: string, toLang: string): Promise<string> {
  const maxRetries = config.llmRetries ?? 3
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await this.callLLM(key, toLang)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await this.delay(1000 * (i + 1))  // 指数退避
    }
  }
}
```

---

## LLM API 调用

### 请求格式
```typescript
{
  model: config.llmModel ?? "qwen-turbo",
  messages: [
    {
      role: "system",
      content: "You are a professional translator."
    },
    {
      role: "user",
      content: `Translate "${key}" from English to ${toLang}. Return only the translation.`
    }
  ],
  temperature: config.llmTemperature ?? 0.2
}
```

### 响应处理
```typescript
{
  "choices": [
    {
      "message": {
        "content": "환영합니다"
      }
    }
  ]
}
```

---

## 使用示例

```typescript
const translator = new LLMTranslator(config)

// 单个翻译
const ko = await translator.translate("Welcome", "en", "ko")
// → "환영합니다"

// 批量翻译
const results = await translator.translateBatch(
  ["Welcome", "Login", "Logout"],
  "en",
  ["ko", "es", "zh-CN"]
)
// → Map {
//   "Welcome" => { ko: "환영합니다", es: "Bienvenido", zh-CN: "欢迎" },
//   "Login" => { ko: "로그인", es: "Iniciar sesión", zh-CN: "登录" },
//   ...
// }
```

## 依赖

- `types/config` - 配置定义
- `utils/Logger` - 日志输出
- HTTPS/Fetch API - LLM API 调用

## 注意事项

1. **已移除术语表**：不再使用 Glossary，纯 LLM 翻译
2. **英文作为源语言**：假设 key 是英文，翻译到其他语言
3. **原文作为后备**：翻译失败时使用原文
