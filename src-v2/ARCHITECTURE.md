# I18nScanner V2 架构设计（简化版）

## 概述

本文档描述了 I18nScanner V2 的简化架构设计。相比旧版本（`src/`），新版本（`src-v2/`）放弃了复杂的 JSX 混合内容提取逻辑，专注于基本的边界情况处理，降低实现复杂度。

---

## 目录结构

```
src-v2/
├── types/                      # 类型定义
│   ├── config.ts               # 配置类型
│   ├── record.ts               # 数据结构
│   ├── extraction.ts           # 提取类型（简化版）
│   └── index.ts                # 统一导出
│
├── core/                       # 核心编排层
│   ├── Scanner.ts              # 主编排器（9步流程）
│   └── Workflow.ts             # 流程定义
│
├── domain/                     # 业务逻辑层
│   ├── scan/                   # 扫描模块
│   │   ├── FileScanner.ts      # 文件扫描
│   │   └── PathMapper.ts       # 路径映射
│   │
│   ├── collect/                # 收集模块
│   │   ├── TranslationCollector.ts  # 翻译收集（主编排）
│   │   ├── StringExtractor.ts      # 字符串字面量提取
│   │   ├── TemplateExtractor.ts    # 模板字符串提取
│   │   ├── JSXTextExtractor.ts     # JSX 纯文本提取
│   │   ├── ReferenceCollector.ts   # 现有 I18n 调用收集
│   │   └── DependencyAnalyzer.ts   # 依赖分析
│   │
│   ├── record/                 # 记录模块
│   │   ├── RecordManager.ts    # 记录管理
│   │   └── RecordRepository.ts # 记录存储
│   │
│   ├── translate/              # 翻译模块
│   │   └── LLMTranslator.ts    # LLM翻译
│   │
│   ├── transform/              # 转换模块（新增）
│   │   ├── CodeTransformer.ts # 代码转换器
│   │   └── ImportManager.ts    # 导入管理器
│   │
│   └── analyze/                # 分析模块
│       ├── KeyAnalyzer.ts      # Key分析
│       └── DeleteService.ts    # 删除服务
│
├── infra/                      # 基础设施层
│   ├── sheets/                 # Google Sheets
│   │   └── SheetsSync.ts
│   │
│   └── ast/                    # AST操作（简化版）
│       ├── ASTExtractor.ts     # AST 提取器（通用）
│       └── CodeGenerator.ts    # 代码生成器
│
├── ui/                         # 用户交互
│   ├── UIService.ts
│   ├── InteractiveMode.ts
│   └── AutoMode.ts
│
└── utils/                      # 工具
    ├── Logger.ts
    ├── FileUtil.ts
    ├── StringUtils.ts
    └── PathUtils.ts
```

---

## 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                        core/Scanner.ts                       │
│                      （主编排器 - 9步流程）                   │
└─────────────────────────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
  │   domain/     │    │    infra/     │    │     ui/       │
  │  业务逻辑层   │    │  基础设施层   │    │  用户交互层   │
  ├───────────────┤    ├───────────────┤    ├───────────────┤
  │ • scan/       │    │ • sheets/     │    │ • UIService   │
  │ • collect/    │    │ • ast/        │    │ • Interactive │
  │ • record/     │    │               │    │ • Auto        │
  │ • translate/  │    │               │    │               │
  │ • transform/  │    │               │    │               │
  │ • analyze/    │    │               │    │               │
  └──────────────┘    └───────────────┘    └───────────────┘
          │                     │
          └─────────────────────┴─────────────────────┐
                        │                             │
                        ▼                             ▼
                  ┌─────────────┐              ┌─────────────┐
                  │   types/    │              │   utils/    │
                  │  类型定义   │              │   工具层    │
                  └─────────────┘              └─────────────┘
```

---

## 数据结构

### 三层结构

```
i18n-complete-record.json
│
├── 文件夹名称（路由路径_拼接）
│   ├── en.json
│   │   ├── Key: Value
│   │   └── Key: Value
│   └── es.json
│       ├── Key: Value
│       └── Key: Value
```

### TypeScript 定义

```typescript
interface CompleteTranslationRecord {
  [folderName: string]: FolderTranslations;
}

interface FolderTranslations {
  [languageFile: string]: LanguageTranslations;
}

interface LanguageTranslations {
  [key: string]: string;
}
```

---

## 主流程（9步）

| 步骤 | 说明 | 模块 |
|------|------|------|
| 1 | ☁️ 远端拉取并合并 | `SheetsSync.pull()` |
| 2 | 🔧 初始化 | `RecordManager.init()` |
| 3 | 📁 扫描文件 | `FileScanner.scan()` |
| 4 | 🔍 收集翻译 | `TranslationCollector.collect()` |
| 5 | 🔍 检测无用 Key | `KeyAnalyzer.detect()` |
| 6 | 🔧 生成记录 | `RecordManager.save()` |
| 7 | 🔧 生成翻译文件 | `RecordManager.generateFiles()` |
| 8 | 🤔 确认远端同步 | `UIService.confirm()` |
| 9 | ☁️ 同步到远端 | `SheetsSync.push()` |

---

## 简化的翻译提取场景

### 支持的场景

#### 1. 字符串字面量翻译
- **触发条件**：字符串字面量被 `startMarker` 和 `endMarker` 包围
- **示例**：`"~Hello World~"` → `I18n.t("Hello World")`
- **模块**：`domain/collect/StringExtractor.ts`

#### 2. 模板字符串翻译
- **触发条件**：模板字符串被标记符号包围，且包含静态文本
- **示例**：`` `~Hello ${name}~` `` → `I18n.t("Hello %{var0}", { var0: name })`
- **特殊规则**：纯变量模板（如 `` `~${1}~` ``）不会被提取
- **模块**：`domain/collect/TemplateExtractor.ts`

#### 3. JSX 纯文本翻译
- **触发条件**：JSX 中的纯文本节点，必须包含英文字符
- **示例**：`<div>Welcome</div>` → `<div>{I18n.t("Welcome")}</div>`
- **支持标记**：`<div>~Welcome~</div>` → `<div>{I18n.t("Welcome")}</div>`
- **模块**：`domain/collect/JSXTextExtractor.ts`

#### 4. 现有 I18n.t() 调用收集
- **触发条件**：检测 `I18n.t()` 调用表达式
- **用途**：检测未使用的翻译 key，分析文件依赖关系
- **模块**：`domain/collect/ReferenceCollector.ts`

### 不支持的场景

- ❌ **JSX 混合内容**：`~Text <El>{var}</El>~` - 不再处理
- ❌ **HTML 标签插值**：`~Click <button>here</button>~` - 不再处理
- ❌ **React 组件插值**：`~Go to <Link>dashboard</Link>~` - 不再处理
- ❌ **嵌套 JSX 元素**：`~<span>text <em>nested</em></span>~` - 不再处理
- ❌ **元素工厂函数**：`el0: text => <strong>{text}</strong>` - 不再生成

---

## 第4步收集流程

```
文件列表
    ↓
[DependencyAnalyzer] 依赖分析
    ↓
[TranslationCollector] 主编排
    ↓
处理每个文件
    ├─ [StringExtractor] 字符串字面量提取
    ├─ [TemplateExtractor] 模板字符串提取
    ├─ [JSXTextExtractor] JSX 纯文本提取
    ├─ [ReferenceCollector] 现有 I18n 调用收集
    └─ [CodeTransformer] 代码转换
    ↓
收集结果
```

---

## 代码转换流程

```
提取内容
    ↓
[CodeTransformer] 主编排
    ↓
处理每种类型的提取项
    ├─ JSX 文本节点
    │   └─ <div>Welcome</div> → <div>{I18n.t("Welcome")}</div>
    ├─ 字符串字面量
    │   └─ "~text~" → I18n.t("text")
    ├─ 模板字符串
    │   └─ `~Hello ${name}~` → I18n.t("Hello %{var0}", { var0: name })
    └─ [ImportManager] 导入管理
        ├─ 添加/修复 I18nUtil 导入
        └─ 添加 Scoped 初始化（入口文件）
    ↓
转换后的代码
```

---

## 渐进式开发计划

### 阶段1：基础骨架 ✅
- 创建目录结构
- 类型定义
- 工具类

### 阶段2：扫描模块
- `domain/scan/PathMapper.ts` - 路径映射
- `domain/scan/FileScanner.ts` - 文件扫描

### 阶段3：收集模块（简化版）
- `domain/collect/TranslationCollector.ts` - 翻译收集主编排器
- `domain/collect/StringExtractor.ts` - 字符串字面量提取
- `domain/collect/TemplateExtractor.ts` - 模板字符串提取
- `domain/collect/JSXTextExtractor.ts` - JSX 纯文本提取
- `domain/collect/ReferenceCollector.ts` - 现有 I18n 调用收集
- `domain/collect/DependencyAnalyzer.ts` - 依赖分析

### 阶段4：转换模块（新增）
- `domain/transform/CodeTransformer.ts` - 代码转换器
- `domain/transform/ImportManager.ts` - 导入管理器

### 阶段5：记录模块
- `domain/record/RecordRepository.ts` - 记录仓储
- `domain/record/RecordManager.ts` - 记录管理

### 阶段6：翻译模块
- `domain/translate/LLMTranslator.ts` - LLM翻译

### 阶段7：分析模块
- `domain/analyze/KeyAnalyzer.ts` - Key分析
- `domain/analyze/DeleteService.ts` - 删除服务

### 阶段8：基础设施（简化）
- `infra/sheets/SheetsSync.ts` - Sheets同步
- `infra/ast/ASTExtractor.ts` - AST 提取器（通用）
- `infra/ast/CodeGenerator.ts` - 代码生成器

### 阶段9：用户交互
- `ui/UIService.ts` - UI服务
- `ui/InteractiveMode.ts` - 交互模式
- `ui/AutoMode.ts` - 自动模式

### 阶段10：主编排
- `core/Workflow.ts` - 流程定义
- `core/Scanner.ts` - 主编排器

---

## 关键设计决策

1. **完全重新开发**：在 `src-v2/` 目录，不影响现有代码
2. **移除术语表**：简化翻译逻辑，纯 LLM 翻译
3. **三层数据结构**：文件夹 → 语言文件 → Key-Value
4. **分层架构**：业务逻辑与基础设施分离
5. **渐进式开发**：每阶段可独立验证
6. **简化提取逻辑**：只处理基本场景，放弃复杂的 JSX 混合内容
7. **降低复杂度**：代码更易理解和维护
8. **提高可靠性**：减少边界情况和潜在 bug

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
| **实现复杂度** | 高（~1100 行） | **低（~400 行）** |
| **可维护性** | 中等 | **高** |

---

## 类型定义

### 提取内容

```typescript
interface ExtractedContent {
  type: ExtractionType; // 'string' | 'template' | 'jsx-text'
  originalText: string;
  cleanedText: string;
  translationKey: string;
  position: Position;
  context: ExtractionContext;
  variables?: VariableMapping[];
  hasEnglish: boolean;
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

### 现有引用

```typescript
interface ExistingReference {
  key: string;
  filePath: string;
  lineNumber: number;
  columnNumber: number;
  callExpression: string;
}
```

---

## 工具类

### StringUtils

```typescript
class StringUtils {
  static isTranslatableString(value: string, config: I18nConfig): boolean;
  static formatString(value: string, config: I18nConfig): string;
  static cleanExtractedText(text: string): string;
  static containsEnglishCharacters(text: string): boolean;
  static generateTranslationKey(filePath: string, text: string): string;
}
```

### AstUtils

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

### PathUtils

```typescript
class PathUtils {
  static getTranslationImportPath(filePath: string, config: I18nConfig): string;
}
```

---

## TDD 开发计划

### 阶段 1：字符串字面量提取
- [ ] 编写测试用例
- [ ] 实现 `StringExtractor`
- [ ] 运行测试验证

### 阶段 2：模板字符串提取 ✅
- [x] 编写测试用例
- [x] 实现 `TemplateExtractor`
- [x] 运行测试验证
- [x] 支持纯变量检测（`hasOnlyVariables`）

### 阶段 3：JSX 纯文本提取 ✅
- [x] 编写测试用例
- [x] 实现 `JSXTextExtractor`
- [x] 运行测试验证
- [x] 支持标记文本处理

### 阶段 4：现有 I18n 调用收集
- [ ] 编写测试用例
- [ ] 实现 `ReferenceCollector`
- [ ] 运行测试验证

### 阶段 5：导入管理
- [x] 编写测试用例
- [x] 实现 `ImportManager`
- [x] 运行测试验证

### 阶段 6：代码转换 ✅
- [x] 编写测试用例
- [x] 实现 `CodeTransformer`
- [x] 运行测试验证
- [x] 支持 JSX 文本节点转换
- [x] 支持模板字符串转换

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
4. 但当前版本明确不支持，以降低复杂度
