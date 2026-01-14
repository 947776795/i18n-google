# 收集模块

## 模块职责

从源码文件中收集翻译信息，包括依赖分析和基于标记符号的内容提取。

## 模块组成

```
collect/
├── TranslationCollector.ts    # 翻译收集主编排器（新增）
├── MarkExtractor.ts          # 标记文本提取
└── DependencyAnalyzer.ts     # 依赖分析器
```

---

## TranslationCollector.ts

### 职责
- 整合依赖分析和内容提取流程
- 协调AST级标记提取
- 提供统一的收集接口

### 核心方法
```typescript
class TranslationCollector {
  // 主收集方法
  collect(entryFiles: string[], config: I18nConfig): Promise<CollectionResult>
  
  // 处理单个文件
  processFile(filePath: string, config: I18nConfig): Promise<FileResult>
  
  // 整合收集结果
  aggregateResults(fileResults: FileResult[]): CollectionResult
}
```

### 处理流程
```
入口文件列表
    ↓
[DependencyAnalyzer] 递归分析依赖
    ↓
所有相关文件
    ↓
[TranslationCollector] 逐文件处理
    ├─ [MarkExtractor] 检测是否包含标记
    ├─ 有标记 → [MarkedExtractor] AST精确提取
    └─ 无标记 → 跳过
    ↓
收集结果
```

---

## MarkExtractor.ts

### 职责
- 使用正则表达式快速检测标记文本
- 作为降级方案和快速筛选工具

### 核心方法
```typescript
class MarkExtractor {
  // 提取标记文本
  extract(source: string, config: I18nConfig): string[]
  
  // 检测是否包含标记
  hasMarks(source: string, config: I18nConfig): boolean
  
  // 统计标记数量
  countMarks(source: string, config: I18nConfig): number
}
```

### 提取规则
- 匹配 `~text~` 格式
- 返回去重的文本列表
- 支持任意标记符号配置

---

## DependencyAnalyzer.ts

### 职责
- 递归分析文件的import依赖
- 确保翻译收集的完整性

### 核心方法
```typescript
class DependencyAnalyzer {
  // 主分析方法
  analyze(entryFile: string, config: I18nConfig): string[]
  
  // 递归分析实现
  private analyzeRecursive(filePath: string): string[]
  
  // 解析import语句
  extractImports(content: string): ImportInfo[]
  
  // 解析导入路径
  resolveImportPath(importPath: string, currentFile: string): string | null
}
```

---

## 数据结构

### 收集结果
```typescript
interface CollectionResult {
  // 所有处理的文件
  filesProcessed: string[];
  
  // 包含标记的文件
  filesWithMarks: string[];
  
  // 文件结果映射
  fileResults: Map<string, FileResult>;
  
  // 全局摘要
  summary: CollectionSummary;
}

interface FileResult {
  filePath: string;
  extractions: ExtractedContent[];
  hasMarkedContent: boolean;
}

interface CollectionSummary {
  totalFiles: number;
  filesWithMarks: number;
  totalExtractions: number;
  extractionTypes: Record<string, number>;
}
```

### Import信息
```typescript
interface ImportInfo {
  raw: string;           // 原始import语句
  path: string;          // 导入路径
  isDefault: boolean;    // 是否默认导入
  names: string[];       // 导入名称
}
```

---

## 与其他模块的集成

### 与infra/ast模块
- 使用MarkedExtractor进行AST级提取
- 复用提取结果数据结构

### 与domain/record模块
- 提供标准化收集结果
- 支持记录生成

### 与core模块
- 实现主编排器接口
- 支持流程编排