# Task 1.4: 实现完整翻译记录 JSON 生成

我需要实现生成包含翻译内容和引用信息的完整 JSON 记录文件的功能。

## 核心思路

基于前面任务收集的引用信息和翻译数据，生成一个统一的记录文件：

1. **整合翻译数据**：从 TranslationManager 获取所有语言的翻译内容
2. **整合引用数据**：从前面步骤收集的引用信息
3. **生成完整记录**：合并为包含翻译和引用的完整 JSON 文件
4. **支持增量更新**：后续扫描时能够更新现有记录

## 当前状态

- 引用信息收集功能已在 Task 1.2 中实现
- 翻译数据已由 TranslationManager 管理
- 缺少统一的记录生成和持久化机制

## 期望实现

### 1. 数据结构定义

```typescript
export interface CompleteTranslationRecord {
  [key: string]: {
    files: string[]; // 引用该key的文件路径列表
    lastScanTime: string; // 最后扫描时间
  };
}

export interface RecordMetadata {
  scanTime: string; // 本次扫描时间
  totalKeys: number; // 总Key数量
  usedKeys: number; // 已使用Key数量
  unusedKeys: number; // 无用Key数量
  newKeysAdded: number; // 本次新增Key数量
}

export interface CompleteRecordFile {
  metadata: RecordMetadata;
  records: CompleteTranslationRecord;
}
```

### 2. 核心实现方法

在 I18nScanner 中添加：

```typescript
// 生成完整记录
private async generateCompleteRecord(
  references: Map<string, ExistingReference[]>,
  newTranslations: TransformResult[]
): Promise<void>;

// 加载现有记录
private async loadExistingRecord(): Promise<CompleteRecordFile | null>;

// 合并记录数据
private mergeRecordData(
  existing: CompleteRecordFile | null,
  currentTranslations: any,
  currentReferences: Map<string, ExistingReference[]>,
  newTranslations: TransformResult[]
): CompleteRecordFile;

// 保存记录文件
private async saveCompleteRecord(record: CompleteRecordFile): Promise<void>;
```

### 3. 记录生成逻辑

```typescript
private async generateCompleteRecord(
  references: Map<string, ExistingReference[]>,
  newTranslations: TransformResult[]
): Promise<void> {
  // 1. 加载现有记录
  const existingRecord = await this.loadExistingRecord();

  // 2. 获取当前翻译数据
  const currentTranslations = this.translationManager.getTranslations();

  // 3. 合并数据
  const completeRecord = this.mergeRecordData(
    existingRecord,
    currentTranslations,
    references,
    newTranslations
  );

  // 4. 保存记录
  await this.saveCompleteRecord(completeRecord);

  console.log(`完整记录已保存，包含 ${Object.keys(completeRecord.records).length} 个Key`);
}
```

## 实现要点

### 数据合并策略

```typescript
private mergeRecordData(
  existing: CompleteRecordFile | null,
  currentTranslations: any,
  currentReferences: Map<string, ExistingReference[]>,
  newTranslations: TransformResult[]
): CompleteRecordFile {
  const records: CompleteTranslationRecord = {};
  const scanTime = new Date().toISOString();

  // 获取所有Key（来自翻译文件和引用）
  const allKeys = new Set([
    ...Object.keys(currentTranslations?.zh || {}),
    ...Object.keys(currentTranslations?.en || {}),
    ...currentReferences.keys(),
    ...newTranslations.map(t => t.key)
  ]);

  allKeys.forEach(key => {
    // 获取引用的文件列表（去重）
    const refs = currentReferences.get(key) || [];
    const files = [...new Set(refs.map(r => r.filePath))];

    records[key] = {
      files,
      lastScanTime: scanTime
    };
  });

  return {
    metadata: this.generateMetadata(records, newTranslations.length),
    records
  };
}
```

### 增量更新支持

- **更新引用信息**：每次扫描更新文件列表
- **统计信息更新**：重新计算各种统计数据

### 文件持久化

```typescript
private async saveCompleteRecord(record: CompleteRecordFile): Promise<void> {
  const filePath = path.join(this.config.outputDir, 'i18n-complete-record.json');

  const jsonContent = JSON.stringify(record, null, 2);

  await fs.promises.writeFile(filePath, jsonContent, 'utf-8');

  console.log(`完整记录已保存到: ${filePath}`);
}
```

## 请提供

1. CompleteTranslationRecord 等接口的完整定义
2. generateCompleteRecord 方法的实现
3. loadExistingRecord 和 saveCompleteRecord 方法
4. mergeRecordData 方法的实现
5. generateMetadata 辅助方法
6. 必要的导入语句和类型定义

## 验收标准

- 能够生成包含完整翻译和引用信息的 JSON 文件
- 支持增量更新
- JSON 格式清晰，便于人工查看
- 统计信息准确，便于分析翻译使用情况
- 文件读写操作安全，包含适当的错误处理
- 性能优化，处理大量 Key 时不会出现性能问题
- 数据完整性验证，确保记录的准确性

## 使用场景

生成的完整记录文件将用于：

1. **删除检测**：识别无用的翻译 Key
2. **使用分析**：分析翻译 Key 的使用情况
3. **维护工具**：为其他维护工具提供数据源
4. **团队协作**：让团队成员了解翻译的使用情况

## 输出示例

```json
{
  "metadata": {
    "scanTime": "2024-01-01T12:00:00.000Z",
    "totalKeys": 150,
    "usedKeys": 148,
    "unusedKeys": 2,
    "newKeysAdded": 5
  },
  "records": {
    "8a709a33": {
      "files": ["src/App.tsx", "src/components/Button.tsx"],
      "lastScanTime": "2024-01-01T12:00:00.000Z"
    },
    "bf3c2d4e": {
      "files": ["src/pages/Home.tsx"],
      "lastScanTime": "2024-01-01T12:00:00.000Z"
    }
  }
}
```
