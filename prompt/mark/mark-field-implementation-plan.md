# Mark 字段添加实施方案

## 概述

为 i18n-complete-record.json 添加 mark 字段，用于外部人员标记翻译状态。新的数据结构如下：

```json
{
  "文件夹": {
    "英文翻译": {
      "en": "English text",
      "zh-CN": "中文翻译",
      "mark": 0
    }
  }
}
```

对于新扫描出的翻译，mark 字段默认为 0。

## 需要修改的文件和位置

### 1. 类型定义修改

#### 1.1 core/TranslationManager.ts

- **位置**: 第 23-30 行的 CompleteTranslationRecord 接口
- **修改内容**:
  ```typescript
  export interface CompleteTranslationRecord {
    [translationPath: string]: {
      [translationKey: string]: {
        [languageKey: string]: string;
        mark?: number; // 添加mark字段，可选，默认为0
      };
    };
  }
  ```

### 2. 数据构建和处理逻辑修改

#### 2.1 core/TranslationManager.ts - buildCompleteRecord 方法

- **位置**: 第 204-293 行
- **修改内容**: 在构建翻译记录时，为新的 key 添加默认 mark 值
- **具体修改**:

  ```typescript
  // 在设置翻译值的循环中添加mark字段
  this.config.languages.forEach((lang) => {
    if (existingTranslations && existingTranslations[lang]) {
      record[modulePath][key][lang] = existingTranslations[lang];
    } else {
      record[modulePath][key][lang] = key;
    }
  });

  // 添加mark字段处理
  if (existingTranslations && typeof existingTranslations.mark === "number") {
    // 保留现有的mark值
    record[modulePath][key].mark = existingTranslations.mark;
  } else {
    // 新key设置默认mark值为0
    record[modulePath][key].mark = 0;
  }
  ```

#### 2.2 core/TranslationManager.ts - mergeWithExistingRecord 方法

- **位置**: 第 153-199 行
- **修改内容**: 在合并记录时保留 mark 字段
- **具体修改**:
  ```typescript
  // 在合并翻译的逻辑中保留mark字段
  mergedRecord[modulePath][key] = {
    ...mergedRecord[modulePath][key],
    ...translations,
    // 保留现有的mark值，如果没有则设为0
    mark: mergedRecord[modulePath][key].mark ?? translations.mark ?? 0,
  };
  ```

### 3. Google Sheets 同步修改

#### 3.1 core/GoogleSheetsSync.ts - syncCompleteRecordFromSheet 方法

- **位置**: 第 130-229 行
- **修改内容**: 从 Google Sheets 读取时处理 mark 字段
- **重要考虑**: 如果远端先创建了 mark 字段并填入值，需要正确同步到本地
- **具体修改**:

  ```typescript
  // 在处理表头时，检查是否存在 mark 列
  const markColumnIndex = headers.indexOf("mark");
  const hasMarkColumn = markColumnIndex !== -1;

  if (hasMarkColumn) {
    Logger.info(`🏷️ 检测到远端已存在 mark 列，位置: ${markColumnIndex}`);
  }

  // 在处理每一行数据的循环中，添加 mark 字段的处理
  langIndices.forEach((index, lang) => {
    if (row[index]) {
      completeRecord[modulePath][translationKey][lang] = row[index];
    }
  });

  // 处理 mark 字段 - 优先使用远端的 mark 值
  if (
    hasMarkColumn &&
    row[markColumnIndex] !== undefined &&
    row[markColumnIndex] !== ""
  ) {
    const markValue = parseInt(row[markColumnIndex]) || 0;
    completeRecord[modulePath][translationKey].mark = markValue;
    Logger.debug(`📝 从远端同步 mark 值: ${translationKey} = ${markValue}`);
  } else {
    // 如果远端没有 mark 值或为空，设置默认值 0
    completeRecord[modulePath][translationKey].mark = 0;
  }
  ```

#### 3.2 core/GoogleSheetsSync.ts - syncCompleteRecordToSheet 方法

- **位置**: 第 231-315 行
- **修改内容**: 向 Google Sheets 写入时包含 mark 字段
- **重要考虑**: 需要检查远端是否已存在 mark 列，避免重复创建
- **具体修改**:

  ```typescript
  // 检查远端是否已存在 mark 列
  const existingHeaders = await this.getExistingHeaders();
  const hasMarkColumn = existingHeaders.includes('mark');

  // 构建表头 - 如果远端没有 mark 列才添加
  const headers = hasMarkColumn
    ? ["key", ...this.config.languages, "mark"]
    : ["key", ...this.config.languages, "mark"]; // 始终包含 mark 列

  // 在构建数据行时添加 mark 值
  Object.entries(completeRecord).forEach(([modulePath, moduleKeys]) => {
    Object.entries(moduleKeys as Record<string, any>).forEach(
      ([translationKey, translations]) => {
        const filePath = this.convertModulePathToFilePath(modulePath);
        const enText = translations["en"] || translationKey;
        const uploadKey = `[${filePath}][${enText}]`;

        const row = [uploadKey];

        // 添加各语言翻译
        this.config.languages.forEach((lang) => {
          row.push(translations[lang] || "");
        });

        // 添加 mark 值 - 保留现有值或使用默认值 0
        row.push((translations.mark ?? 0).toString());

        values.push(row);
      }
    );
  });

  // 添加辅助方法获取现有表头
  private async getExistingHeaders(): Promise<string[]> {
    try {
      const response = await this.googleSheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!1:1`, // 只读取第一行
      });
      return response.data.values?.[0] || [];
    } catch (error) {
      Logger.warn("获取现有表头失败，将创建新表头:", error);
      return [];
    }
  }
  ```

### 4. 删除服务修改

#### 4.1 core/DeleteService.ts

- **位置**: 需要检查所有处理 CompleteTranslationRecord 的方法
- **修改内容**: 确保删除操作时正确处理 mark 字段
- **具体位置**:
  - `deleteKeysWithPreview`方法
  - `createPreviewRecord`方法
  - 任何复制或操作翻译记录的地方

### 5. 预览服务修改

#### 5.1 core/PreviewFileService.ts

- **位置**: 所有处理 CompleteTranslationRecord 的方法
- **修改内容**: 在生成预览时保留 mark 字段
- **具体方法**:
  - `generatePreviewFiles`方法
  - `createPreviewRecord`方法

### 6. 未使用 Key 分析器修改

#### 6.1 core/UnusedKeyAnalyzer.ts

- **位置**: 所有处理 CompleteTranslationRecord 的方法
- **修改内容**: 在分析未使用 key 时考虑 mark 字段
- **具体方法**:
  - `analyzeUnusedKeys`方法
  - `createPreviewRecord`方法

### 7. 同步服务修改

#### 7.1 sync.ts

- **位置**: 所有处理 CompleteTranslationRecord 的方法
- **修改内容**: 确保同步时正确处理 mark 字段
- **具体方法**:
  - `loadLocalCompleteRecord`方法
  - `mergeRecords`方法
  - `saveUpdatedCompleteRecord`方法

### 8. 测试文件修改

#### 8.1 **tests**/core/PreviewFileService.test.ts

- **位置**: 所有使用 CompleteTranslationRecord 的测试用例
- **修改内容**: 更新测试数据，添加 mark 字段

#### 8.2 **tests**/core/DeleteService.test.ts

- **位置**: 所有使用 CompleteTranslationRecord 的测试用例
- **修改内容**: 更新测试数据，添加 mark 字段

## 实施步骤

### 标准实施流程

1. **第一步**: 修改类型定义（TranslationManager.ts 中的接口）
2. **第二步**: 修改核心数据构建逻辑（buildCompleteRecord 等方法）
3. **第三步**: 修改 Google Sheets 同步逻辑（重点：表头检测和远端优先）
4. **第四步**: 修改其他服务类（DeleteService, PreviewFileService 等）
5. **第五步**: 修改同步服务
6. **第六步**: 更新测试用例
7. **第七步**: 测试验证

### 远端先创建 mark 字段的实施流程

1. **第一步**: 修改类型定义和 Google Sheets 同步逻辑（优先实施）
2. **第二步**: 测试从远端同步 mark 字段到本地
3. **第三步**: 修改核心数据构建逻辑，确保保留远端同步的 mark 值
4. **第四步**: 修改其他服务类
5. **第五步**: 全面测试双向同步

## 特殊场景处理

### 场景 1: 远端先创建 mark 字段

**情况**: Google Sheets 中已经存在 mark 列并填入了值，本地首次同步
**处理策略**:

1. 检测远端是否存在 mark 列
2. 优先使用远端的 mark 值
3. 本地文件自动添加 mark 字段并同步远端值
4. 记录同步日志便于追踪

### 场景 2: 本地先实施 mark 字段

**情况**: 本地代码已支持 mark 字段，向远端同步时创建 mark 列
**处理策略**:

1. 检查远端表头是否包含 mark 列
2. 如果不存在，在同步时自动添加 mark 列
3. 将本地的 mark 值同步到远端

### 场景 3: 双向都有 mark 字段但值不同

**情况**: 本地和远端都有 mark 字段，但某些 key 的 mark 值不同
**处理策略**:

1. 从远端同步时，远端值优先（覆盖本地值）
2. 记录值变更日志
3. 可选：提供冲突解决机制

## 注意事项

1. **向后兼容性**: 确保现有的 i18n-complete-record.json 文件在没有 mark 字段时仍能正常工作
2. **默认值处理**: 新扫描的翻译默认 mark 值为 0
3. **Google Sheets 格式**: 需要在 Google Sheets 中添加 mark 列
4. **类型安全**: 使用可选字段`mark?: number`确保类型安全
5. **数据迁移**: 现有文件在第一次读取时会自动添加默认 mark 值
6. **远端优先原则**: 当远端已存在 mark 值时，优先使用远端的值
7. **表头检测**: 每次同步前检测远端表头结构，避免重复创建列

## 详细实施指南

### 阶段 1: 类型定义更新

```typescript
// 在 core/TranslationManager.ts 中更新接口
export interface CompleteTranslationRecord {
  [translationPath: string]: {
    [translationKey: string]: {
      [languageKey: string]: string;
      mark?: number; // 新增：标记字段，可选
    };
  };
}
```

### 阶段 2: 核心逻辑更新

在 `buildCompleteRecord` 方法中添加 mark 字段处理：

```typescript
// 为每种语言设置翻译值
this.config.languages.forEach((lang) => {
  if (existingTranslations && existingTranslations[lang]) {
    record[modulePath][key][lang] = existingTranslations[lang];
  } else {
    record[modulePath][key][lang] = key;
  }
});

// 处理 mark 字段
if (existingTranslations && typeof existingTranslations.mark === "number") {
  record[modulePath][key].mark = existingTranslations.mark;
} else {
  record[modulePath][key].mark = 0; // 新 key 默认 mark 为 0
}
```

### 阶段 3: Google Sheets 集成

更新同步逻辑以支持 mark 列：

```typescript
// 读取时处理 mark 列
const markColumnIndex = headers.indexOf("mark");
if (markColumnIndex !== -1 && row[markColumnIndex] !== undefined) {
  completeRecord[modulePath][translationKey].mark =
    parseInt(row[markColumnIndex]) || 0;
} else {
  completeRecord[modulePath][translationKey].mark = 0;
}

// 写入时添加 mark 列
const headers = ["key", ...this.config.languages, "mark"];
// ... 在构建行数据时添加 mark 值
row.push((translations.mark ?? 0).toString());
```

## 验证清单

### 基础功能验证

- [ ] CompleteTranslationRecord 接口已更新
- [ ] buildCompleteRecord 方法正确处理 mark 字段
- [ ] mergeWithExistingRecord 方法保留 mark 字段
- [ ] 删除、预览、分析等服务正确处理 mark 字段
- [ ] 同步服务正确处理 mark 字段
- [ ] 测试用例已更新
- [ ] 现有数据文件兼容性测试通过
- [ ] 新扫描的翻译正确设置 mark=0
- [ ] JSON 深拷贝操作保留 mark 字段

### Google Sheets 同步验证

- [ ] 能检测远端是否存在 mark 列
- [ ] 从远端正确读取 mark 值
- [ ] 远端 mark 值优先覆盖本地值
- [ ] 向远端写入时正确包含 mark 列
- [ ] 表头检测逻辑正确工作
- [ ] 同步日志记录完整

### 特殊场景验证

- [ ] **场景 1**: 远端先创建 mark 字段，本地能正确同步
- [ ] **场景 2**: 本地先支持 mark 字段，能向远端创建列
- [ ] **场景 3**: 双向冲突时远端值优先
- [ ] 空值和无效值的处理正确
- [ ] 大量数据同步时性能正常

## 风险评估

### 低风险

- 类型定义更新（使用可选字段）
- 测试用例更新

### 中风险

- Google Sheets 同步逻辑（需要确保表头正确）
- 数据合并逻辑（需要正确处理 mark 字段优先级）

### 高风险

- 现有数据兼容性（需要充分测试现有文件的读取）
- 深拷贝操作（确保所有地方都正确保留 mark 字段）

## 回滚计划

如果实施过程中出现问题，可以：

1. 回滚类型定义，移除 mark 字段
2. 恢复原有的数据处理逻辑
3. 保留现有的 i18n-complete-record.json 文件不变
4. Google Sheets 可以选择性移除 mark 列
