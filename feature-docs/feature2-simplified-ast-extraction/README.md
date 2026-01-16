# 简化的 AST 翻译提取功能

## 概述

本文档描述了简化的 AST 翻译提取功能设计。相比旧版本（`src/`），新版本（`src-v2/`）放弃了复杂的 JSX 混合内容提取逻辑，专注于基本的边界情况处理，降低实现复杂度。

---

## 设计目标

1. **简化复杂度**：移除 JSX 混合内容（文本 + 表达式 + 嵌套 JSX 元素）的复杂处理逻辑
2. **保持核心功能**：保留基本的翻译提取场景
3. **降低维护成本**：代码更易理解和维护
4. **提高可靠性**：减少边界情况和潜在 bug

---

## 翻译提取场景

### 场景 1：字符串字面量翻译

**触发条件**：
- 字符串字面量被 `startMarker` 和 `endMarker` 包围（例如：`"~Hello World~"`）

**排除条件**：
- Import 声明中的字符串（如 `import X from "react"`）
- 已在 `I18n.t()` 调用中的字符串（避免重复包装）

**处理逻辑**：
1. 提取并移除标记符号
2. 清理文本（去除首尾空格，规范化内部空白）
3. 生成翻译键（直接使用原文作为 key）
4. 替换为 `I18n.t(key)` 调用
5. 在 JSX 上下文中包装为 `{I18n.t(key)}`

**示例**：
```javascript
// 输入
const message = "~Hello World~";

// 输出
const message = I18n.t("Hello World");
```

---

### 场景 2：模板字符串翻译

**触发条件**：
- 模板字符串被标记符号包围（例如：`` `~Hello ${name}~` ``）

**处理逻辑**：
1. 将模板字符串转换为带占位符的翻译文本（`Hello %{var0}`）
2. 提取所有表达式变量并构建选项对象
3. 生成 `I18n.t(key, { var0: expression })` 调用
4. 支持多个变量插值（`%{var0}`, `%{var1}` ...）

**示例**：
```javascript
// 输入
const message = `~Hello ${name}~`;

// 输出
const message = I18n.t("Hello %{var0}", { var0: name });
```

---

### 场景 3：JSX 纯文本翻译

**触发条件**：
- JSX 中的纯文本节点
- **必须包含英文字符**（`/[a-zA-Z]/.test(text)`）
- **不需要标记符号**

**处理逻辑**：
1. 清理文本（去除空白，规范化空格）
2. 检查是否包含英文字符
3. 替换为 `{I18n.t(key)}` 表达式

**示例**：
```jsx
// 输入
<div>Welcome</div>

// 输出
<div>{I18n.t("Welcome")}</div>
```

**边界情况**：
- 纯空白文本：跳过
- 不含英文字符：跳过
- 混合内容：跳过（不处理）

---

### 场景 4：现有 I18n.t() 调用收集

**触发条件**：
- 检测 `I18n.t()` 调用表达式

**支持形式**：
1. 字符串字面量参数：`I18n.t("key")`
2. 模板字面量参数：`I18n.t(\`key\`)`

**收集信息**：
- Key 值
- 文件路径
- 行号和列号
- 完整调用表达式

**用途**：
- 检测未使用的翻译 key
- 分析文件依赖关系

---

### 场景 5：导入管理

#### 5.1 入口文件导入（page.tsx/layout.tsx）

**功能**：
- 添加 `import { I18nUtil } from "@utils"`
- 添加 `const I18n = I18nUtil.createScoped('路径')` 初始化
- 路径基于文件路径计算，如 `app_home_page`

#### 5.2 非入口文件导入

**功能**：
- 添加 `import { I18nUtil as I18n } from "@utils"`
- 不添加 Scoped 初始化

#### 5.3 路径计算规则

使用 `PathMapper.toFolderName()` 计算：
- `src/app/page.tsx` → `app_page`
- `src/app/home/page.tsx` → `app_home_page`
- `src/app/admin/layout.tsx` → `app_admin_layout`

---

## 与旧版本的区别

| 特性 | 旧版本 (src/) | 新版本 (src-v2/) |
|------|--------------|------------------|
| 字符串字面量 | ✅ 支持 | ✅ 支持 |
| 模板字符串 | ✅ 支持 | ✅ 支持 |
| JSX 纯文本 | ✅ 支持（英文检测） | ✅ 支持（英文检测） |
| **JSX 混合内容** | ✅ 支持（复杂） | ❌ **不支持** |
| 变量插值 | ✅ 支持 | ✅ 支持 |
| 元素插值 | ✅ 支持（工厂函数） | ❌ **不支持** |
| 现有 I18n 调用收集 | ✅ 支持 | ✅ 支持 |
| 导入管理 | ✅ 支持 | ✅ 支持 |

---

## 不支持的场景（相比旧版本）

1. **JSX 混合内容**：`~Text <El>{var}</El>~` - 不再处理
2. **HTML 标签插值**：`~Click <button>here</button>~` - 不再处理
3. **React 组件插值**：`~Go to <Link>dashboard</Link>~` - 不再处理
4. **嵌套 JSX 元素**：`~<span>text <em>nested</em></span>~` - 不再处理
5. **元素工厂函数**：`el0: text => <strong>{text}</strong>` - 不再生成
6. **平铺策略**：嵌套元素的平铺处理 - 不再处理

---

## 边界情况处理

### 跳过的场景

1. Import 声明中的字符串
2. 已在 `I18n.t()` 中的字符串
3. 纯空白文本
4. 不含英文字符的 JSX 文本
5. JSX 混合内容（文本 + 表达式 + 嵌套元素）

### 特殊节点类型

1. 自闭合标签：`<input />` - 不处理混合内容
2. 布尔属性：`disabled` - 不处理混合内容
3. 扩展属性：`{...props}` - 不处理混合内容

---

## 辅助工具

### StringUtils（字符串处理）

```typescript
class StringUtils {
  static isTranslatableString(value: string, config: I18nConfig): boolean;
  static formatString(value: string, config: I18nConfig): string;
  static cleanExtractedText(text: string): string;
  static containsEnglishCharacters(text: string): boolean;
  static generateTranslationKey(filePath: string, text: string): string;
}
```

### AstUtils（AST 操作）

```typescript
class AstUtils {
  static isStringLiteral(node: n.Node): boolean;
  static isTemplateLiteral(node: n.Node): boolean;
  static isJSXText(node: n.Node): boolean;
  static isInJSXContext(path: ASTPath<n.Node>): boolean;
  static createI18nCall(key: string, options?: n.ObjectExpression): n.CallExpression;
  static createJSXExpressionContainer(expression: n.Expression): n.JSXExpressionContainer;
}
```

---

## 数据结构

### 提取内容

```typescript
interface ExtractedContent {
  type: ExtractionType; // 'string' | 'template' | 'jsx-text'
  originalText: string;
  cleanedText: string;
  translationKey: string;
  position: Position;
  variables?: VariableMapping[];
}
```

### 变量映射

```typescript
interface VariableMapping {
  placeholder: string; // 'var0', 'var1', ...
  expression: string;
  type: 'identifier' | 'member' | 'complex';
  position: Position;
}
```

### 位置信息

```typescript
interface Position {
  line: number; // 从 1 开始
  column: number; // 从 0 开始
}
```

---

## TDD 开发计划

### 阶段 1：字符串字面量翻译
- [x] 编写测试用例（正向、负向、边界情况）
- [x] 实现提取逻辑
- [x] 运行测试验证

### 阶段 2：模板字符串翻译
- [x] 编写测试用例
- [x] 实现提取逻辑
- [x] 运行测试验证

### 阶段 3：JSX 纯文本翻译
- [x] 编写测试用例
- [x] 实现提取逻辑
- [x] 运行测试验证

### 阶段 4：现有 I18n.t() 调用收集
- [x] 编写测试用例
- [x] 实现收集逻辑
- [x] 运行测试验证

### 阶段 5：导入管理
- [x] 编写测试用例
- [x] 实现导入管理逻辑
- [x] 运行测试验证

---

## 验收标准

1. 所有测试用例通过
2. 代码覆盖率 > 80%
3. 无 lint 错误
4. 无 TypeScript 类型错误
5. 与旧版本（`src/`）在支持的场景上行为一致

---

## 后续优化方向

如果将来需要支持 JSX 混合内容提取，可以考虑：
1. 单独开发一个插件系统
2. 使用配置化的转换规则
3. 引入模板引擎（如 mustache、handlebars）
