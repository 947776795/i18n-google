# 多语言切换功能使用指南（简化版）

## 功能概述

我已经为你的 NextJS 项目添加了简化的多语言切换功能，包括：

1. **页面跳转语言切换**：通过页面刷新来切换语言，简单可靠
2. **语言持久化**：语言设置会保存在 localStorage 和 URL 参数中
3. **优雅的 UI 组件**：美观的下拉式语言选择器
4. **模块化翻译**：按组件/页面组织翻译文件

## 核心组件

### 1. I18nUtil 工具类

位置：`src/utils/i18n.ts`

主要功能：

- `getCurrentLocale()`: 获取当前语言
- `switchLocale(locale)`: 切换语言（通过页面跳转）
- `createScoped(translations)`: 创建作用域翻译实例

### 2. LanguageSwitcher 组件

位置：`src/components/LanguageSwitcher.tsx`

用法：

```tsx
import LanguageSwitcher from "@/components/LanguageSwitcher";

function App() {
  return (
    <div>
      <LanguageSwitcher className="my-custom-class" />
    </div>
  );
}
```

## 支持的语言

- 🇺🇸 English (en)
- 🇨🇳 中文（简体）(zh-CN)
- 🇹🇼 中文（繁體）(zh-TC)
- 🇰🇷 한국어 (ko)
- 🇪🇸 Español (es)
- 🇹🇷 Türkçe (tr)
- 🇩🇪 Deutsch (de)
- 🇻🇳 Tiếng Việt (vi)

## 翻译文件结构

翻译文件位于 `src/translate/` 目录下，按模块组织：

```
src/translate/
├── app/
│   └── page.ts          # 主页翻译
├── components/
│   └── LanguageSwitcher.ts  # 语言切换器翻译
└── const/
    └── const.ts         # 常量翻译
```

翻译文件格式：

```typescript
const translations = {
  en: {
    "Hello World": "Hello World",
    "Welcome %{var0}": "Welcome %{var0}",
  },
  "zh-CN": {
    "Hello World": "你好世界",
    "Welcome %{var0}": "欢迎 %{var0}",
  },
  // ... 其他语言
};

export default translations;
```

## 使用示例

### 1. 基本翻译

```typescript
// 在组件中
import { I18nUtil } from "@utils";
import translations from "@translate/your-module";

const I18n = I18nUtil.createScoped(translations);

function MyComponent() {
  return <h1>{I18n.t("Hello World")}</h1>;
}
```

### 2. 带变量插值的翻译

```typescript
const I18n = I18nUtil.createScoped(translations);
const userName = "Alice";

return <p>{I18n.t("Welcome %{var0}", { var0: userName })}</p>;
```

### 3. 获取当前语言

```typescript
const currentLocale = I18nUtil.getCurrentLocale();
console.log(`当前语言: ${currentLocale}`);
```

## 测试功能

1. 启动开发服务器：

   ```bash
   npm run dev
   ```

2. 打开浏览器访问 `http://localhost:3000`

3. 点击右上角的语言切换器（🌐 图标）

4. 选择不同的语言，观察页面内容的实时变化

## 特性说明

### 页面跳转切换

- 语言切换通过页面跳转实现，简单可靠
- 切换语言时页面会刷新，确保所有内容都更新
- URL 参数会同步更新（如：`?lang=zh-CN`）

### 语言回退

- 如果当前语言没有翻译，会回退到英文
- 如果英文也没有翻译，会显示原始的 key（通常是英文原文）

### 持久化

- 语言选择会保存在 `localStorage` 中
- URL 参数 `lang` 会同步更新
- 刷新页面后语言设置会保持

## 扩展指南

### 添加新语言

1. 在 `src/utils/i18n.types.ts` 中添加新的语言常量
2. 在 `languageOptions` 数组中添加新语言选项
3. 在所有翻译文件中添加新语言的翻译

### 添加新的翻译模块

1. 在 `src/translate/` 下创建新的翻译文件
2. 在组件中导入翻译文件
3. 使用 `I18nUtil.createScoped(translations)` 创建翻译实例

### 自定义语言切换器

你可以创建自己的语言切换器组件：

```typescript
import { I18nUtil, languageOptions } from "@utils";

function CustomLanguageSwitcher() {
  const handleChange = (event) => {
    I18nUtil.switchLocale(event.target.value);
  };

  return (
    <select onChange={handleChange} value={I18nUtil.getCurrentLocale()}>
      {languageOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
```

## 注意事项

1. **SSR 支持**：`I18nUtil.getCurrentLocale()` 在服务端会返回默认语言 "en"
2. **简化实现**：通过页面跳转切换语言，避免了复杂的状态管理
3. **类型安全**：所有翻译相关的函数都有完整的 TypeScript 类型支持
4. **页面刷新**：语言切换会刷新页面，确保所有组件都使用新语言

现在你可以在项目中享受简单可靠的多语言切换体验了！🌍
