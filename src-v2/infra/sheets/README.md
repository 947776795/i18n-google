# Sheets 同步模块 (Sheets Sync Module)

## 职责

与 Google Sheets 进行双向同步：拉取远端翻译数据、推送本地更新到远端。

## 模块组成

```
sheets/
└── SheetsSync.ts    # Google Sheets 同步器
```

---

## SheetsSync.ts

### 职责
封装 Google Sheets API 操作，实现翻译数据的双向同步

### 核心方法
```typescript
class SheetsSync {
  // 从远端拉取并合并到本地
  async pull(): Promise<void>

  // 推送本地数据到远端
  async push(deletedKeys?: string[]): Promise<void>

  // 仅读取远端数据（不合并）
  async fetch(): Promise<CompleteTranslationRecord>

  // 写入数据到远端
  async upload(record: CompleteTranslationRecord): Promise<void>

  // 合并远端和本地记录
  async merge(
    local: CompleteTranslationRecord,
    remote: CompleteTranslationRecord
  ): Promise<CompleteTranslationRecord>
}
```

---

## 配置选项

```typescript
interface I18nConfig {
  // Google Sheets ID
  spreadsheetId: string

  // Sheet 名称
  sheetName: string

  // 服务账号密钥文件路径
  keyFile: string

  // 读取范围（默认 "A1:Z10000"）
  sheetsReadRange?: string

  // 最大行数（默认 10000）
  sheetsMaxRows?: number
}
```

---

## Google Sheets 格式

### 表格结构

| | A | B | C | D | E |
|---|---|---|---|---|---|
| **1** | FolderName | LanguageFile | Key | Value | |
| **2** | pages_login | en.json | Welcome | Welcome | |
| **3** | pages_login | en.json | Login | Login | |
| **4** | pages_login | es.json | Welcome | Bienvenido | |
| **5** | pages_login | es.json | Login | Iniciar sesión | |

### 转换为数据结构

```typescript
// 从 Sheets 读取 → 数据结构
{
  "pages_login": {
    "en.json": {
      "Welcome": "Welcome",
      "Login": "Login"
    },
    "es.json": {
      "Welcome": "Bienvenido",
      "Login": "Iniciar sesión"
    }
  }
}
```

---

## 同步策略

### Pull（拉取）：远端优先
```typescript
// 远端数据覆盖本地
merged[key] = {
  ...local[key],   // 本地作为基础
  ...remote[key]   // 远端覆盖
}
```

### Push（推送）：全量同步
```typescript
// 1. 先拉取远端数据
const remote = await fetch()

// 2. 合并（本地优先）
const merged = {
  ...remote,
  ...local
}

// 3. 上传合并后的数据
await upload(merged)

// 4. 删除远端已删除的 key（如果提供）
if (deletedKeys.length > 0) {
  await deleteKeysFromSheets(deletedKeys)
}
```

---

## 数据转换

### Sheets → Record
```typescript
function sheetsToRecord(rows: Row[][]): CompleteTranslationRecord {
  const record: CompleteTranslationRecord = {}

  for (const row of rows) {
    const [folderName, languageFile, key, value] = row

    if (!record[folderName]) {
      record[folderName] = {}
    }
    if (!record[folderName][languageFile]) {
      record[folderName][languageFile] = {}
    }

    record[folderName][languageFile][key] = value
  }

  return record
}
```

### Record → Sheets
```typescript
function recordToSheets(record: CompleteTranslationRecord): Row[][] {
  const rows: Row[][] = []

  // 表头
  rows.push([["FolderName", "LanguageFile", "Key", "Value"]])

  // 数据行
  for (const [folderName, languages] of Object.entries(record)) {
    for (const [languageFile, translations] of Object.entries(languages)) {
      for (const [key, value] of Object.entries(translations)) {
        rows.push([folderName, languageFile, key, value])
      }
    }
  }

  return rows
}
```

---

## 错误处理

```typescript
// API 调用失败
try {
  await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${sheetsReadRange}`
  })
} catch (error) {
  if (error.code === 403) {
    throw new Error("没有访问权限，请检查服务账号配置")
  }
  if (error.code === 404) {
    throw new Error("Spreadsheet 不存在")
  }
  throw error
}
```

---

## 使用示例

```typescript
const sync = new SheetsSync(config)

// 拉取远端数据并合并
await sync.pull()

// 推送本地数据到远端
await sync.push(["DeletedKey1", "DeletedKey2"])

// 仅读取远端数据（不修改本地）
const remoteData = await sync.fetch()
```

## 依赖

- `googleapis` - Google Sheets API
- `types/record` - 数据结构定义
- `utils/Logger` - 日志输出
- `utils/FileUtil` - 读取服务账号密钥

## 认证

使用服务账号认证：
1. 在 Google Cloud 创建服务账号
2. 下载 JSON 密钥文件
3. 在 Sheet 中共享给服务账号邮箱
4. 配置 `keyFile` 指向密钥文件
