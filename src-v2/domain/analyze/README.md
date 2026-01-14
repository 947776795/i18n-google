# 分析模块 (Analyze Module)

## 职责

分析翻译记录，检测未被使用的无用 key，并提供安全的删除机制。

## 模块组成

```
analyze/
├── KeyAnalyzer.ts      # Key 分析器
└── DeleteService.ts    # 删除服务
```

---

## KeyAnalyzer.ts

### 职责
对比翻译记录和代码引用，找出未被使用的 key

### 核心方法
```typescript
class KeyAnalyzer {
  // 分析无用 key
  async detectUnusedKeys(
    record: CompleteTranslationRecord,
    references: Map<string, FileReference[]>
  ): Promise<UnusedKeyResult>

  // 检查 key 是否被引用
  isKeyReferenced(key: string, references: Map<string, FileReference[]>): boolean

  // 过滤强制保留的 key
  filterForceKeptKeys(
    keys: string[],
    forceKeepConfig: Record<string, string[]>
  ): string[]
}
```

### 检测逻辑

```
翻译记录           代码引用
    ↓                    ↓
{                    {
  "Welcome": {...},     "Welcome": [...], ✓ 被引用
  "Login": {...},       "Login": [...],    ✓ 被引用
  "OldKey": {...}       (没有)              ✗ 未被引用
}                    }
    ↓                    ↓
    └────── [对比] ──────┘
              ↓
        无用 key: ["OldKey"]
```

### 输出结果
```typescript
interface UnusedKeyResult {
  /** 无用 key 列表 */
  unusedKeys: string[]

  /** 按文件夹分组的无用 key */
  byFolder: Record<string, string[]>

  /** 统计信息 */
  stats: {
    totalKeys: number
    unusedCount: number
    affectedFolders: string[]
  }
}
```

---

## DeleteService.ts

### 职责
处理无用 key 的删除，包括用户确认、预览、备份、回退

### 核心方法
```typescript
class DeleteService {
  // 检测无用 key 并生成处理后的记录
  async detectUnusedKeysAndGenerateRecord(
    references: Map<string, FileReference[]>
  ): Promise<DeleteResult>

  // 执行删除
  async executeKeyDeletion(
    keysToDelete: string[],
    references: Map<string, FileReference[]>
  ): Promise<DeleteResult>

  // 保留无用 key（用户选择不删除）
  async preserveUnusedKeys(
    unusedKeys: string[],
    references: Map<string, FileReference[]>
  ): Promise<void>

  // 生成删除预览文件
  async generatePreview(
    keysToDelete: string[],
    record: CompleteTranslationRecord
  ): Promise<string>

  // 清理预览文件
  async cleanupPreviewFiles(filePaths: string[]): Promise<void>
}
```

---

## 删除流程

```
[KeyAnalyzer] 检测无用 key
    ↓
生成预览文件（删除前预览）
    ↓
[UIService] 用户确认
    ↓
    ├─ 取消 → 保留 key，结束
    │
    └─ 确认 → [备份当前记录]
              ↓
              [从记录中删除 key]
              ↓
              [保存新记录]
              ↓
              [生成新的翻译文件]
              ↓
              完成
```

---

## 预览文件格式

```
outputDir/
└── delete-preview-YYYYMMDD-HHMMSS.json
```

```json
{
  "previewAt": "2024-01-15T10:30:00Z",
  "keysToDelete": ["OldKey", "UnusedKey"],
  "affectedFolders": ["pages_login", "components_header"],
  "preview": {
    "pages_login": {
      "en.json": {
        "OldKey": "This will be deleted"
      }
    }
  },
  "backupPath": "outputDir/backups/i18n-complete-record-20240115-103000.json"
}
```

---

## 强制保留配置

```javascript
// i18n.config.js
module.exports = {
  forceKeepKeys: {
    "pages_login": ["SpecialKey"],  // 该文件夹下的 key 永不删除
    "common": ["*"]                 // common 下所有 key 不删除
  }
}
```

---

## 安全机制

1. **备份**：删除前自动备份当前记录
2. **预览**：生成预览文件供用户审查
3. **二次确认**：大量删除时需要二次确认
4. **强制保留**：可配置永不删除的 key
5. **回退**：使用备份文件可恢复

---

## 数据流转

```
代码引用 (references)
    ↓
[KeyAnalyzer.detectUnusedKeys]
    ↓
无用 key 列表
    ↓
[DeleteService.generatePreview]
    ↓
预览文件
    ↓
[用户确认]
    ↓
[DeleteService.executeKeyDeletion]
    ↓
删除后的记录
```

## 依赖

- `types/record` - 数据结构定义
- `domain/record/RecordManager` - 记录操作
- `ui/UIService` - 用户交互
- `utils/FileUtil` - 文件操作（备份）
