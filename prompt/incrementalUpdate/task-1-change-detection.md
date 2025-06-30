# Task 1: 变更检测算法实现

## 目标

实现一个高效的变更检测算法，能够精确识别本地和远端 CompleteRecord 之间的差异。

## 核心数据结构

### 1. 变更集定义

```typescript
interface SheetChangeSet {
  addedRows: SheetRow[]; // 新增的行
  modifiedRows: SheetRow[]; // 修改的行
  deletedKeys: string[]; // 删除的key
}

interface SheetRow {
  key: string; // 组合key: [file][text]
  rowIndex?: number; // 在Google Sheets中的行号
  values: string[]; // 行数据 [key, en, zh-Hans, ko, mark]
}
```

### 2. 变更检测核心算法

```typescript
/**
 * 计算本地和远端记录之间的变更集
 */
private calculateChangeSet(
  remoteRecord: CompleteTranslationRecord,
  localRecord: CompleteTranslationRecord
): SheetChangeSet {
  const changeSet: SheetChangeSet = {
    addedRows: [],
    modifiedRows: [],
    deletedKeys: []
  };

  // 构建远端key映射，便于快速查找
  const remoteKeyMap = this.buildKeyMap(remoteRecord);
  const localKeyMap = this.buildKeyMap(localRecord);

  // 1. 检测新增和修改
  for (const [combinedKey, localTranslations] of localKeyMap) {
    if (!remoteKeyMap.has(combinedKey)) {
      // 新增
      changeSet.addedRows.push({
        key: combinedKey,
        values: this.buildRowValues(combinedKey, localTranslations)
      });
    } else {
      // 检查是否修改
      const remoteTranslations = remoteKeyMap.get(combinedKey)!;
      if (this.hasTranslationChanged(localTranslations, remoteTranslations)) {
        changeSet.modifiedRows.push({
          key: combinedKey,
          values: this.buildRowValues(combinedKey, localTranslations)
        });
      }
    }
  }

  // 2. 检测删除
  for (const [combinedKey] of remoteKeyMap) {
    if (!localKeyMap.has(combinedKey)) {
      changeSet.deletedKeys.push(combinedKey);
    }
  }

  return changeSet;
}
```

### 3. 辅助方法实现

```typescript
/**
 * 构建key映射表，提高查找效率
 */
private buildKeyMap(
  record: CompleteTranslationRecord
): Map<string, any> {
  const keyMap = new Map<string, any>();

  Object.entries(record).forEach(([modulePath, moduleKeys]) => {
    Object.entries(moduleKeys as Record<string, any>).forEach(
      ([translationKey, translations]) => {
        const combinedKey = this.buildCombinedKey(modulePath, translationKey, translations);
        keyMap.set(combinedKey, translations);
      }
    );
  });

  return keyMap;
}

/**
 * 构建组合键，与现有格式保持一致
 */
private buildCombinedKey(
  modulePath: string,
  translationKey: string,
  translations: any
): string {
  const filePath = this.convertModulePathToFilePath(modulePath);
  const enText = translations["en"] || translationKey;
  return `[${filePath}][${enText}]`;
}

/**
 * 检查翻译内容是否发生变更
 */
private hasTranslationChanged(
  localTranslations: any,
  remoteTranslations: any
): boolean {
  // 检查所有语言的翻译
  for (const lang of this.config.languages) {
    if ((localTranslations[lang] || "") !== (remoteTranslations[lang] || "")) {
      return true;
    }
  }

  // 检查mark字段
  const localMark = localTranslations.mark ?? 0;
  const remoteMark = remoteTranslations.mark ?? 0;
  if (localMark !== remoteMark) {
    return true;
  }

  return false;
}

/**
 * 构建行数据数组
 */
private buildRowValues(combinedKey: string, translations: any): string[] {
  const row = [combinedKey];

  // 添加各语言翻译
  this.config.languages.forEach((lang) => {
    row.push(translations[lang] || "");
  });

  // 添加mark值
  row.push((translations.mark ?? 0).toString());

  return row;
}

/**
 * 检查变更集是否为空
 */
private isChangeSetEmpty(changeSet: SheetChangeSet): boolean {
  return (
    changeSet.addedRows.length === 0 &&
    changeSet.modifiedRows.length === 0 &&
    changeSet.deletedKeys.length === 0
  );
}
```

## 性能优化

### 1. 时间复杂度分析

- **构建 key 映射**: O(n) - n 为翻译 key 总数
- **变更检测**: O(n) - 线性扫描
- **总体复杂度**: O(n) - 相比全量同步的 O(n²)有显著提升

### 2. 内存优化

```typescript
/**
 * 内存优化的变更检测（适用于大型项目）
 */
private calculateChangeSetOptimized(
  remoteRecord: CompleteTranslationRecord,
  localRecord: CompleteTranslationRecord
): SheetChangeSet {
  const changeSet: SheetChangeSet = {
    addedRows: [],
    modifiedRows: [],
    deletedKeys: []
  };

  // 使用Set进行快速查找，减少内存占用
  const remoteKeys = new Set<string>();
  const localKeys = new Set<string>();

  // 第一遍：收集所有key
  this.collectKeys(remoteRecord, remoteKeys);
  this.collectKeys(localRecord, localKeys);

  // 第二遍：检测变更（避免同时在内存中保存两个完整映射）
  this.detectChangesStreaming(remoteRecord, localRecord, changeSet);

  return changeSet;
}
```

## 测试用例

### 1. 基本变更检测测试

```typescript
describe("变更检测算法", () => {
  test("检测新增key", () => {
    const remote = {};
    const local = {
      "TestModule.ts": {
        new_key: { en: "New Text", "zh-Hans": "新文本", mark: 0 },
      },
    };

    const changeSet = googleSheetsSync.calculateChangeSet(remote, local);
    expect(changeSet.addedRows).toHaveLength(1);
    expect(changeSet.addedRows[0].key).toBe("[TestModule.ts][New Text]");
  });

  test("检测修改key", () => {
    const remote = {
      "TestModule.ts": {
        existing_key: { en: "Old Text", "zh-Hans": "旧文本", mark: 0 },
      },
    };
    const local = {
      "TestModule.ts": {
        existing_key: { en: "Old Text", "zh-Hans": "新文本", mark: 0 },
      },
    };

    const changeSet = googleSheetsSync.calculateChangeSet(remote, local);
    expect(changeSet.modifiedRows).toHaveLength(1);
  });

  test("检测删除key", () => {
    const remote = {
      "TestModule.ts": {
        old_key: { en: "Old Text", "zh-Hans": "旧文本", mark: 0 },
      },
    };
    const local = {};

    const changeSet = googleSheetsSync.calculateChangeSet(remote, local);
    expect(changeSet.deletedKeys).toHaveLength(1);
    expect(changeSet.deletedKeys[0]).toBe("[TestModule.ts][Old Text]");
  });
});
```

## 实施步骤

1. **第 1 步**：在`GoogleSheetsSync.ts`中添加变更检测相关的接口定义
2. **第 2 步**：实现核心的`calculateChangeSet`方法
3. **第 3 步**：实现所有辅助方法
4. **第 4 步**：添加单元测试验证算法正确性
5. **第 5 步**：性能测试和优化

## 验收标准

- ✅ 能正确识别新增、修改、删除的翻译 key
- ✅ 算法时间复杂度为 O(n)
- ✅ 内存使用合理，不会因大型项目而溢出
- ✅ 单元测试覆盖率达到 95%以上
- ✅ 性能测试：1000 个 key 的变更检测耗时<100ms
