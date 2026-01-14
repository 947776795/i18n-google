# 收集模块 (Collect Module)

## 职责

从源码文件中收集翻译信息：提取标记文本，并递归分析文件依赖链以确保收集完整。

## 模块组成

```
collect/
├── MarkExtractor.ts       # 标记提取
└── DependencyAnalyzer.ts  # 依赖分析
```

---

## MarkExtractor.ts

### 职责
从源码内容中提取标记文本（如 ~text~）

### 输入输出
```typescript
// 输入：源码文件内容 + 标记配置
const code = `
  <h1>~Home Page~</h1>
  <p>~Welcome to our app~</p>
`
const startMarker = "~"
const endMarker = "~"

// 输出：提取的标记文本
["Home Page", "Welcome to our app"]
```

### 核心方法
```typescript
class MarkExtractor {
  // 从源码提取所有标记文本
  extract(source: string, startMarker: string, endMarker: string): string[]

  // 检查是否包含标记
  hasMarks(source: string): boolean

  // 统计标记数量
  countMarks(source: string): number
}
```

### 提取规则
```typescript
// 匹配 ~text~ 格式
const regex = new RegExp(`${startMarker}([^${endMarker}]+)${endMarker}`, 'g')
```

---

## DependencyAnalyzer.ts

### 职责
递归分析文件的 import 依赖，确保收集完整的翻译信息

**重要**：路由入口文件（page.tsx/layout.tsx）通常会导入组件和工具模块，这些模块也可能包含需要翻译的文本，必须递归分析。

### 输入输出
```typescript
// 输入：入口文件 + 配置
entryFile: "src/app/page.tsx"
config: { rootDir, ignore, include }

// 输出：所有相关文件（包含依赖）
[
  "src/app/page.tsx",           // 入口文件
  "src/components/Header.tsx",  // import Header from '@/components/Header'
  "src/components/Footer.tsx",  // import Footer from '../components/Footer'
  "src/utils/i18n.ts"            // import { t } from '@/utils/i18n'
]
```

### 核心方法
```typescript
class DependencyAnalyzer {
  // 递归分析文件依赖
  analyze(entryFile: string, config: I18nConfig): string[]

  // 解析 import 语句
  extractImports(content: string): ImportInfo[]

  // 解析导入路径为绝对路径
  resolveImportPath(importPath: string, currentFile: string, rootDir: string): string | null

  // 检查文件是否应该被忽略
  shouldIgnore(filePath: string, config: I18nConfig): boolean
}
```

### 分析规则
1. 遍历所有 `import` 语句
2. 跟踪已访问文件，避免循环依赖
3. 支持相对路径 `./` 和 `../`
4. 支持路径别名 `@/` 等（需 tsconfig.json 配置）
5. 根据 `ignore` 配置跳过不需要的文件
6. 根据 `include` 配置只处理指定扩展名

### 分析流程
```
page.tsx (入口)
  ↓ 解析 import
  ├── @/components/Header
  │   ↓ 跟踪
  │   ├── components/Button
  │   └── utils/format
  ├── ../components/Footer
  │   ↓ 跟踪
  │   └── components/Social
  └── utils/helpers
    ↓ 跟踪
    └── (已访问，跳过)
  ↓
所有相关文件列表（去重）
```

### Import 解析
```typescript
interface ImportInfo {
  /** 原始 import 语句 */
  raw: string;
  /** 导入路径 */
  path: string;
  /** 是否为默认导入 */
  isDefault: boolean;
  /** 导入的名称 */
  names: string[];
}
```

---

## 数据流转

```
路由入口文件
    ↓
[DependencyAnalyzer] ← 解析依赖链
    ↓
所有相关文件（去重）
    ↓
[MarkExtractor] ← 逐个提取标记
    ↓
标记文本集合 {
  file: "src/app/page.tsx",
  marks: ["Home Page", "Welcome"]
}
```

---

## 依赖

- `fs` - 文件读取
- `path` - 路径解析
- `domain/scan/PathMapper` - 路径映射
