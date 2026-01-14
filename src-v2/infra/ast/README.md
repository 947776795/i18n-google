# AST 转换模块 (AST Transform Module)

## 职责

使用 AST（抽象语法树）操作将源码中的文本字面量转换为 I18n.t() 调用。

## 模块组成

```
ast/
└── CodeTransformer.ts    # 代码转换器
```

---

## CodeTransformer.ts

### 职责
解析源码为 AST，转换文本节点为 I18n.t() 调用，再生成代码

### 核心方法
```typescript
class CodeTransformer {
  // 转换单个文件
  async transformFile(filePath: string): Promise<TransformResult>

  // 转换源码内容
  transformSource(source: string, filePath: string): TransformedSource

  // 分析文件（不修改）
  analyzeFile(filePath: string): AnalyzeResult
}
```

### 转换结果
```typescript
interface TransformResult {
  /** 转换后的代码 */
  code: string

  /** 转换的文件路径 */
  filePath: string

  /** 新增的翻译 key */
  newTranslations: string[]

  /** 是否有修改 */
  hasChanges: boolean
}
```

---

## 转换场景

### 1. 字符串字面量 → I18n.t()

```typescript
// 转换前
const message = "Welcome to our app"

// 转换后
import { I18n } from "@/utils/i18n"
const message = I18n.t("Welcome to our app")
```

### 2. 模板字符串 → I18n.t()

```typescript
// 转换前
const greeting = `Hello, ${userName}!`

// 转换后
import { I18n } from "@/utils/i18n"
const greeting = I18n.t("Hello, %{userName}!", { userName })
```

### 3. JSX 文本 → I18n.t()

```typescript
// 转换前
function Header() {
  return <h1>Welcome</h1>
}

// 转换后
import { I18n } from "@/utils/i18n"
function Header() {
  return <h1>{I18n.t("Welcome")}</h1>
}
```

### 4. 已有 I18n.t() - 保持不变

```typescript
// 不转换
I18n.t("Already translated")
```

---

## 标记模式

支持使用标记包裹需要翻译的文本：

```typescript
// 配置
{ startMarker: "~", endMarker: "~" }

// 转换前
const title = ~Translate this text~

// 转换后
import { I18n } from "@/utils/i18n"
const title = I18n.t("Translate this text")
```

---

## 导入管理

### 自动添加导入

```typescript
// 检测是否需要导入
if (hasI18nTCalls && !hasI18nImport) {
  // 在文件顶部添加导入
  ast.program.body.unshift(
    t.importDeclaration(
      [t.importSpecifier(t.identifier("I18n"), t.identifier("I18n"))],
      t.stringLiteral("~/i18n")
    )
  )
}
```

### 导入路径配置

```typescript
interface I18nConfig {
  // I18n 导入路径
  i18nImportPath?: string  // 默认 "~/i18n"
}
```

---

## AST 操作流程

```
源码字符串
    ↓
[解析] parser.parse()
    ↓
AST (抽象语法树)
    ↓
[遍历] ast.traverse()
    ↓
    ├─ 找到 StringLiteral
    ├─ 找到 TemplateLiteral
    └─ 找到 JSXText
    ↓
[判断] 是否需要转换？
    ├─ 有标记 → 转换
    ├─ JSX文本 → 转换
    └─ 已是 I18n.t() → 跳过
    ↓
[转换] 替换为 I18n.t() 调用
    ↓
[生成导入] 添加 import 语句
    ↓
[生成代码] generator.generate()
    ↓
转换后的源码
```

---

## jscodeshift 使用

```typescript
import { parse } from "@babel/parser"
import traverse from "@babel/traverse"
import generate from "@babel/generator"
import * as t from "@babel/types"

// 解析
const ast = parse(sourceCode, {
  sourceType: "module",
  plugins: ["jsx", "typescript"]
})

// 遍历和转换
traverse(ast, {
  StringLiteral(path) {
    if (shouldTransform(path)) {
      // 替换为 I18n.t() 调用
      path.replaceWith(
        t.callExpression(
          t.memberExpression(
            t.identifier("I18n"),
            t.identifier("t")
          ),
          [t.stringLiteral(path.node.value)]
        )
      )
    }
  }
})

// 生成代码
const { code } = generate(ast)
```

---

## 安全措施

1. **备份原文件**：转换前自动备份
2. **仅转换标记内容**：默认不转换普通字符串
3. **保留注释**：AST 转换保留注释
4. **格式化**：使用 prettier 保持格式

---

## 使用示例

```typescript
const transformer = new CodeTransformer(config)

// 转换单个文件
const result = await transformer.transformFile("src/pages/login.tsx")

if (result.hasChanges) {
  console.log(`转换了 ${result.newTranslations.length} 个新翻译`)
  // 写入文件
  await fs.writeFile(result.filePath, result.code)
}
```

## 依赖

- `@babel/parser` - AST 解析
- `@babel/traverse` - AST 遍历
- `@babel/generator` - 代码生成
- `@babel/types` - AST 节点类型
- `jscodeshift` - 代码转换框架
