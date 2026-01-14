# 记录模块 (Record Module)

## 职责

管理翻译记录的完整生命周期：读取、写入、合并、删除，以及生成分模块的翻译文件。

## 模块组成

```
record/
├── RecordRepository.ts    # 记录仓储（数据访问层）
└── RecordManager.ts       # 记录管理（业务逻辑层）
```

---

## RecordRepository.ts

### 职责
封装 `i18n-complete-record.json` 文件的读写操作

### 核心方法
```typescript
class RecordRepository {
  // 读取完整记录
  load(): Promise<CompleteTranslationRecord>

  // 保存完整记录
  save(record: CompleteTranslationRecord): Promise<void>

  // 检查记录文件是否存在
  exists(): boolean

  // 备份当前记录
  backup(): Promise<string>
}
```

### 文件路径
```
{outputDir}/i18n-complete-record.json
```

### 数据格式
```json
{
  "pages_login": {
    "en.json": { "Welcome": "Welcome" },
    "es.json": { "Welcome": "Bienvenido" }
  }
}
```

---

## RecordManager.ts

### 职责
翻译记录的业务逻辑：合并新旧数据、添加新翻译、删除无用 key

### 核心方法
```typescript
class RecordManager {
  // 初始化
  async init(config: I18nConfig): Promise<void>

  // 合并远端记录
  async mergeRemote(remoteRecord: CompleteTranslationRecord): Promise<void>

  // 添加新翻译
  async addTranslations(
    folderName: string,
    translations: TranslationEntry[]
  ): Promise<void>

  // 批量添加翻译
  async addBatch(entries: TranslationEntry[]): Promise<void>

  // 删除指定的 keys
  async deleteKeys(keysToDelete: string[]): Promise<DeleteResult>

  // 检查 key 是否存在
  hasKey(key: string): boolean

  // 获取指定文件夹的所有翻译
  getFolderTranslations(folderName: string): FolderTranslations | null

  // 生成分模块翻译文件
  async generateModularFiles(): Promise<void>
}
```

---

## 合并策略

### 合并远端记录（远端优先）
```typescript
// 远端记录覆盖本地
localRecord[folder][key] = {
  ...localRecord[folder][key],  // 本地作为基础
  ...remoteRecord[folder][key]  // 远端覆盖
}
```

### 合并新翻译（本地优先）
```typescript
// 新收集的翻译合并到记录
for (const newKey of newTranslations) {
  if (!record[folder][key]) {
    // 新 key，直接添加
    record[folder][key] = newKey
  } else {
    // 已存在，本地翻译优先
    record[folder][key] = {
      ...record[folder][key],
      ...newKey
    }
  }
}
```

---

## 生成分模块文件

### 输入
```json
// i18n-complete-record.json
{
  "pages_login": {
    "en.json": { "Welcome": "Welcome" },
    "es.json": { "Welcome": "Bienvenido" }
  }
}
```

### 输出
```
outputDir/
└── pages_login/
    ├── en.json
    └── es.json
```

### 文件内容
```json
// pages_login/en.json
{
  "Welcome": "Welcome"
}
```

---

## 数据流转

```
收集结果
    ↓
[RecordManager.addBatch]
    ↓
合并到完整记录
    ↓
[RecordManager.generateModularFiles]
    ↓
分模块 JSON 文件
```

## 依赖

- `types/record` - 数据结构定义
- `utils/FileUtil` - 文件操作
- `domain/translate/LLMTranslator` - 新 key 翻译
