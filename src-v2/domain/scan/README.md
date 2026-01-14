# 扫描模块 (Scan Module)

## 职责

负责扫描项目文件，找出需要处理的源码文件，并将文件路径转换为数据结构所需的文件夹名称。

## 模块组成

```
scan/
├── FileScanner.ts      # 文件扫描
└── PathMapper.ts       # 路径映射
```

---

## FileScanner.ts

### 职责
扫描项目目录，找出所有路由入口文件（page.tsx, layout.tsx）

### 配置来源
配置从项目根目录的 `i18n.config.js` 读取：

```javascript
// i18n.config.js
module.exports = {
  rootDir: "./src",                    // 扫描根目录
  outputDir: "./src/translate",        // 输出目录
  languages: ["en", "ko", "zh-Hans"],  // 支持的语言
  ignore: ["**/test/**", "**/node_modules/**"],  // 忽略目录
  include: ["js", "jsx", "ts", "tsx"], // 包含的文件类型
};
```

### 输入输出
```typescript
// 输入：配置
{ rootDir, ignore }

// 输出：文件路径列表
[
  { filePath: "src/app/page.tsx", fileName: "page.tsx", isEntry: true },
  { filePath: "src/app/layout.tsx", fileName: "layout.tsx", isEntry: true },
  { filePath: "src/app/sub1/page.tsx", fileName: "page.tsx", isEntry: true }
]
```

### 核心方法
```typescript
class FileScanner {
  // 扫描路由入口文件
  scan(config: I18nConfig): ScanResult[]

  // 检查文件是否应该被忽略
  shouldIgnore(filePath: string, ignore: string[]): boolean

  // 检查是否为入口文件
  static isEntryFile(fileName: string): boolean
}
```

### 扫描规则
1. 扫描 `rootDir` 目录
2. 查找 `page.tsx` 和 `layout.tsx` 文件
3. 根据 `ignore` 配置跳过指定文件/目录
4. 递归扫描子目录

### 路由入口文件
- Next.js App Router: `page.tsx`, `layout.tsx`

---

## PathMapper.ts

### 职责
将文件路径转换为文件夹名称（下划线拼接）

### 输入输出
```typescript
// 输入：文件路径
"src/app/page.tsx"
"src/app/sub1/page.tsx"
"src/app/sub1/deep/page.tsx"

// 输出：文件夹名称
"app"
"app_sub1"
"app_sub1_deep"
```

### 核心方法
```typescript
class PathMapper {
  // 文件路径 → 文件夹名称
  toFolderName(filePath: string, baseDir: string): string

  // 批量转换
  batchToFolderNames(filePaths: string[], baseDir: string): string[]
}
```

### 映射规则

> 每个 page.tsx 和 layout.tsx 视为独立的平级模块

| 源文件 | folderName | 计算方式 |
|--------|-----------|---------|
| src/app/page.tsx | `app_page` | `app` + `_` + `page` |
| src/app/layout.tsx | `app_layout` | `app` + `_` + `layout` |
| src/app/sub1/page.tsx | `app_sub1_page` | `app` + `_` + `sub1` + `_` + `page` |
| src/app/sub1/layout.tsx | `app_sub1_layout` | `app` + `_` + `sub1` + `_` + `layout` |

---

## 依赖

- `fs` - 文件系统操作
- `path` - 路径解析
