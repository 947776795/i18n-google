# Feature 1: Next.js App Router 扫描转换（最小闭环）

## 功能目标

> **本 feature 与主流程 9 步对齐**（参见 `src-v2/core/README.md`）

| 步骤 | 主流程 | Feature 1 实现 | 状态 |
|:----:|--------|----------------|:----:|
| 2 | 🔧 初始化 | `ConfigLoader.load()` | ✅ |
| 3 | 📁 扫描文件 | `FileScanner.scan()` | ✅ |
| 4 | 🔍 收集翻译 | `MarkExtractor.extract()` + `DependencyAnalyzer.analyze()` | ✅ |
| 6 | 🔧 生成记录 | `RecordGenerator.save()` | ✅ |
| 7 | 🔧 生成翻译文件 | `LangFileGenerator.generate()` | ✅ |

> 注：其他步骤暂不涉及，后续 feature 扩展

---

## 核心流程

```
输入：项目根目录的 i18n.config.js 配置文件

流程：
  2️⃣ 加载配置 → 3️⃣ 扫描路由文件 → 4️⃣ 递归分析依赖 + 收集翻译
       → 6️⃣ 生成记录 → 7️⃣ 生成翻译文件

输出：
  1. 转换后的源码文件（~text~ → I18n.t("key")）
  2. i18n-complete-record.json（中间记录）
  3. translate/ 目录下的语言文件（最终产物）
```

---

## 配置文件

### 配置来源

从项目根目录读取 `i18n.config.js`：

```javascript
// i18n.config.js
module.exports = {
  rootDir: "./src",                    // 扫描根目录
  outputDir: "./src/translate",        // 输出目录
  languages: ["en", "ko", "zh-Hans"],  // 支持的语言
  ignore: ["**/test/**", "**/node_modules/**"],  // 忽略目录
  include: ["js", "jsx", "ts", "tsx"], // 包含的文件类型
  startMarker: "~",                    // 开始标记
  endMarker: "~",                      // 结束标记
};
```

### 配置结构

```typescript
interface I18nConfig {
  /** 扫描根目录 */
  rootDir: string;
  /** 输出目录 */
  outputDir: string;
  /** 支持的语言列表 */
  languages: string[];
  /** 忽略的目录/文件 */
  ignore: string[];
  /** 包含的文件扩展名 */
  include: string[];
  /** 开始标记符号 */
  startMarker: string;
  /** 结束标记符号 */
  endMarker: string;
}
```

---

## 扫描与依赖分析

### 路由入口扫描

扫描 `rootDir` 下的所有路由入口文件：
- Next.js App Router: `page.tsx`, `layout.tsx`

### 递归依赖分析

**重要**：除了扫描路由入口文件，还需要递归分析每个入口文件导入的模块。

```
page.tsx (入口)
  ├── import Header from "@/components/Header"     ← 需要分析
  ├── import Footer from "../components/Footer"    ← 需要分析
  └── import { Button } from "@/components/ui"    ← 需要分析
```

**分析规则**：
1. 解析 `import` 语句
2. 支持相对路径 `./` `../`
3. 支持路径别名 `@/` 等
4. 跟踪已访问文件，避免循环依赖
5. 根据 `ignore` 配置跳过不需要的文件

---

## 最终产物结构

### translate 目录结构

```
src/translate/
├── i18n-complete-record.json    # 中间记录（所有翻译）
├── app_page/
│   ├── en.json
│   ├── ko.json
│   └── zh-Hans.json
├── app_layout/
│   ├── en.json
│   ├── ko.json
│   └── zh-Hans.json
├── app_sub1_page/
│   ├── en.json
│   ├── ko.json
│   └── zh-Hans.json
├── app_sub1_layout/
│   ├── en.json
│   ├── ko.json
│   └── zh-Hans.json
└── app_sub1_deep_page/
    ├── en.json
    ├── ko.json
    └── zh-Hans.json
```

### 语言文件内容

```json
// src/translate/app/en.json
{
  "Home Page": "Home Page",
  "Welcome": "Welcome to our app"
}
```

---

## Import 规则

### 入口文件（page.tsx/layout.tsx）

```typescript
// 在文件顶部添加
import { I18nUtil } from "@utils";

const I18n = I18nUtil.createScoped('app');  // folderName
```

### 子模块文件

```typescript
// 子模块不需要 createScoped，直接使用
import { I18nUtil as I18n } from "@utils";
```

### 判断逻辑

```typescript
// 如果文件是 page.tsx 或 layout.tsx → 入口文件
if (fileName === 'page.tsx' || fileName === 'layout.tsx') {
  // 添加 I18nUtil.createScoped 导入
} else {
  // 添加普通 I18nUtil 导入
}
```

---

## 路径映射规则

> 每个 page.tsx 和 layout.tsx 视为独立的平级模块

| 源文件 | folderName | 计算方式 |
|--------|-----------|---------|
| src/app/page.tsx | `app_page` | `app` + `_` + `page` |
| src/app/layout.tsx | `app_layout` | `app` + `_` + `layout` |
| src/app/sub1/page.tsx | `app_sub1_page` | `app` + `_` + `sub1` + `_` + `page` |
| src/app/sub1/layout.tsx | `app_sub1_layout` | `app` + `_` + `sub1` + `_` + `layout` |
| src/app/sub1/deep/page.tsx | `app_sub1_deep_page` | `app` + `_` + `sub1` + `_` + `deep` + `_` + `page` |

---

## 模块设计

### 1. 配置加载器 (ConfigLoader)

**职责**：读取并解析 i18n.config.js

```typescript
class ConfigLoader {
  // 从项目根目录加载配置
  async load(projectRoot: string): Promise<I18nConfig>

  // 解析配置文件
  private parseConfig(configPath: string): I18nConfig
}
```

---

### 2. 文件扫描器 (FileScanner)

**职责**：扫描路由入口文件

```typescript
class FileScanner {
  // 扫描路由入口文件
  scan(config: I18nConfig): ScanResult[]

  // 检查文件是否应该被忽略
  shouldIgnore(filePath: string, ignore: string[]): boolean
}
```

---

### 3. 依赖分析器 (DependencyAnalyzer)

**职责**：递归分析文件的 import 依赖

```typescript
class DependencyAnalyzer {
  // 递归分析文件依赖
  analyze(entryFile: string, config: I18nConfig): string[]

  // 解析 import 语句
  extractImports(content: string): string[]

  // 解析导入路径为绝对路径
  resolveImportPath(importPath: string, currentFile: string): string | null
}
```

**分析流程**：
```
page.tsx
  ↓ 解析 import
  ↓ 跟踪依赖
  ↓ 避免循环
所有相关文件列表
```

---

### 4. 标记提取器 (MarkExtractor)

**职责**：从源码中提取 ~text~ 标记

```typescript
class MarkExtractor {
  // 从源码提取所有标记文本
  extract(source: string, startMarker: string, endMarker: string): string[]
}
```

---

### 5. 代码转换器 (CodeTransformer)

**职责**：替换标记为 I18n.t()，添加导入

```typescript
class CodeTransformer {
  // 转换源码
  transform(source: string, keys: string[], isEntry: boolean, folderName: string): TransformResult
}
```

---

### 6. 记录生成器 (RecordGenerator)

**职责**：收集翻译，生成 i18n-complete-record.json

```typescript
class RecordGenerator {
  // 添加翻译
  add(folderName: string, locale: string, key: string, value: string): void

  // 保存记录
  async saveCompleteRecord(filePath: string): Promise<void>
}
```

---

### 7. 语言文件生成器 (LangFileGenerator)

**职责**：生成各语言文件

```typescript
class LangFileGenerator {
  // 生成语言文件
  async generate(record: TranslationRecord, outputDir: string, languages: string[]): Promise<void>
}
```

---

### 8. 主流程 (Scanner)

**职责**：编排所有模块

```typescript
class Scanner {
  async run(projectRoot: string): Promise<ScanResult> {
    // 2️⃣ 加载配置
    const config = await ConfigLoader.load(projectRoot)

    // 3️⃣ 扫描路由入口
    const entryFiles = FileScanner.scan(config)

    // 4️⃣ 递归分析依赖 + 收集翻译
    for (const entry of entryFiles) {
      // 递归获取所有相关文件
      const allFiles = DependencyAnalyzer.analyze(entry.filePath, config)

      // 对每个文件提取标记并转换
      for (const file of allFiles) {
        const keys = MarkExtractor.extract(source, config.startMarker, config.endMarker)
        // ... 转换和记录
      }
    }

    // 6️⃣ 生成记录
    // 7️⃣ 生成语言文件
  }
}
```

---

## 文件结构

```
src-v2/
├── types/
│   └── config.ts              # 配置结构定义
├── domain/
│   ├── scan/
│   │   ├── FileScanner.ts      # 文件扫描
│   │   └── PathMapper.ts       # 路径映射
│   ├── collect/
│   │   ├── MarkExtractor.ts    # 标记提取
│   │   └── DependencyAnalyzer.ts  # 依赖分析 ⭐ 新增
│   └── record/
│       ├── RecordGenerator.ts  # 记录生成
│       └── LangFileGenerator.ts # 语言文件生成
├── infra/
│   └── ast/
│       └── CodeTransformer.ts  # 代码转换
└── core/
    └── Scanner.ts              # 主流程编排
```

---

## 实现顺序

| 步骤 | 模块 | 验证方式 |
|------|------|----------|
| 1 | types/config.ts | 配置类型定义 |
| 2 | ConfigLoader | 能读取 demo/nextjs/i18n.config.js |
| 3 | FileScanner.ts | 能扫描出路由入口文件 |
| 4 | DependencyAnalyzer.ts | 能递归分析依赖 |
| 5 | PathMapper.ts | 路径转换正确 |
| 6 | MarkExtractor.ts | 能提取 ~text~ 标记 |
| 7 | CodeTransformer.ts | 能替换并添加导入 |
| 8 | RecordGenerator.ts | 能生成记录文件 |
| 9 | LangFileGenerator.ts | 能生成语言文件 |
| 10 | Scanner.ts | 完整流程跑通 |

---

## 验证计划

### 测试环境
```bash
cd demo/nextjs
```

### 运行命令
```bash
npx ts-node ../../src-v2/bin/scan.ts
```

### 预期结果
```bash
✅ 加载配置: i18n.config.js
✅ 扫描到 6 个路由入口文件
✅ 递归分析到 X 个依赖文件
✅ 提取到 X 个标记文本
✅ 转换了 X 个文件
✅ 生成 i18n-complete-record.json
✅ 生成语言文件
```

### 检查点
1. 配置正确加载
2. 递归分析依赖完整
3. 源码文件正确转换
4. 记录和语言文件正确生成
