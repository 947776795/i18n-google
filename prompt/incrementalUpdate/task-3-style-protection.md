# Task 3: 样式保护机制

## 目标

确保增量更新过程中完全保护 Google Sheets 的所有样式设置，包括固定表头、固定列、过滤器、格式等。

## 样式保护原理

### 1. 问题根源分析

**全量同步的样式破坏原因**：

- 使用 `values.update` 覆盖整个范围
- 重新写入所有数据，清除格式设置
- 没有区分数据内容和样式格式

**增量同步的保护机制**：

- 只操作特定的数据单元格
- 使用精确的 API 方法
- 避免触及格式相关的属性

### 2. API 方法选择策略

```typescript
/**
 * 样式安全的 API 方法映射
 */
const STYLE_SAFE_OPERATIONS = {
  // 新增数据：使用 append API
  ADD_ROWS: {
    method: "values.append",
    options: {
      insertDataOption: "INSERT_ROWS", // 插入新行，不覆盖
      valueInputOption: "RAW", // 只更新值，不影响格式
    },
  },

  // 更新数据：使用精确范围的 update
  UPDATE_ROWS: {
    method: "values.update",
    options: {
      valueInputOption: "RAW", // 只更新值
      range: "SPECIFIC_CELL_RANGE", // 精确到单元格范围
    },
  },

  // 删除数据：使用 batchUpdate 的 deleteDimension
  DELETE_ROWS: {
    method: "batchUpdate",
    options: {
      requests: [
        {
          deleteDimension: {
            range: {
              dimension: "ROWS",
              startIndex: "ROW_INDEX",
              endIndex: "ROW_INDEX + 1",
            },
          },
        },
      ],
    },
  },
};
```

## 受保护的样式类型

### 1. 固定设置（Frozen Panes）

```typescript
/**
 * 固定表头和固定列保护
 */
interface FrozenProtection {
  frozenRows: number;     // 固定的行数
  frozenColumns: number;  // 固定的列数

  // 保护机制：
  // - 不使用全范围更新
  // - 避免操作冻结区域的格式
  // - 只更新数据内容
}

// 实现示例
private async protectFrozenPanes(): Promise<void> {
  // 获取当前的冻结设置
  const sheetProperties = await this.getSheetProperties();
  const frozenRows = sheetProperties.gridProperties?.frozenRowCount || 0;
  const frozenColumns = sheetProperties.gridProperties?.frozenColumnCount || 0;

  Logger.info(`🧊 检测到冻结设置: ${frozenRows} 行, ${frozenColumns} 列`);

  // 确保操作不影响冻结区域
  this.ensureOperationsAvoidFrozenArea(frozenRows, frozenColumns);
}
```

### 2. 过滤器（Filters）

```typescript
/**
 * 过滤器保护机制
 */
interface FilterProtection {
  autoFilter: boolean;        // 自动筛选
  filterViews: FilterView[];  // 筛选视图

  // 保护策略：
  // - 使用 values API 而非 batchUpdate 的 updateCells
  // - 避免重新设置表头范围
  // - 保持筛选器的列范围不变
}

// 检测和保护过滤器
private async protectFilters(): Promise<void> {
  try {
    const sheet = await this.getSheetMetadata();

    if (sheet.basicFilter) {
      Logger.info("🔍 检测到自动筛选器，将使用保护模式");
      this.filterProtectionEnabled = true;
    }

    if (sheet.filterViews && sheet.filterViews.length > 0) {
      Logger.info(`🔍 检测到 ${sheet.filterViews.length} 个筛选视图`);
      this.filterViewsProtectionEnabled = true;
    }
  } catch (error) {
    Logger.warn("⚠️ 无法检测过滤器设置，将使用默认保护模式");
    this.filterProtectionEnabled = true;
  }
}
```

### 3. 单元格格式（Cell Formatting）

```typescript
/**
 * 单元格格式保护
 */
interface CellFormatProtection {
  textFormat: {
    fontSize: number;
    fontFamily: string;
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    foregroundColor: Color;
  };
  backgroundColor: Color;
  borders: Borders;
  numberFormat: NumberFormat;

  // 保护机制：
  // - 使用 valueInputOption: 'RAW'
  // - 避免使用 'USER_ENTERED' 模式
  // - 不使用 updateCells 请求
}

// 格式保护实现
private async updateCellValuesSafely(
  range: string,
  values: any[][]
): Promise<void> {
  await this.googleSheets.spreadsheets.values.update({
    spreadsheetId: this.config.spreadsheetId,
    range: range,
    valueInputOption: 'RAW', // 关键：只更新值，不影响格式
    resource: { values }
  });
}
```

### 4. 条件格式（Conditional Formatting）

```typescript
/**
 * 条件格式保护
 */
interface ConditionalFormatProtection {
  rules: ConditionalFormatRule[];

  // 保护策略：
  // - 不使用 batchUpdate 的 addConditionalFormatRule
  // - 不修改单元格的格式属性
  // - 只更新数据值，让条件格式自动应用
}

// 条件格式兼容性检查
private async ensureConditionalFormatCompatibility(): Promise<void> {
  Logger.info("🎨 启用条件格式保护模式");

  // 确保所有更新操作都使用 values API
  this.useValuesApiOnly = true;

  // 避免任何可能影响格式的操作
  this.avoidFormatOperations = true;
}
```

### 5. 数据验证（Data Validation）

```typescript
/**
 * 数据验证保护
 */
interface DataValidationProtection {
  validationRules: DataValidationRule[];

  // 保护机制：
  // - 不修改单元格的 dataValidation 属性
  // - 确保新数据符合现有验证规则
  // - 在更新前进行验证检查
}

// 数据验证兼容性
private async validateDataBeforeUpdate(
  values: any[][]
): Promise<boolean> {
  // 检查数据是否符合现有验证规则
  // 如果不符合，提供警告但继续更新

  try {
    // 获取验证规则
    const validationRules = await this.getDataValidationRules();

    // 验证数据
    const isValid = this.validateAgainstRules(values, validationRules);

    if (!isValid) {
      Logger.warn("⚠️ 部分数据可能不符合现有验证规则");
    }

    return true; // 总是允许更新，让用户决定
  } catch (error) {
    Logger.warn("⚠️ 无法验证数据，将直接更新");
    return true;
  }
}
```

## 样式保护实现

### 1. 保护模式检测

```typescript
/**
 * 自动检测并启用相应的保护模式
 */
public async enableStyleProtection(): Promise<void> {
  Logger.info("🛡️ 启动样式保护检测...");

  try {
    // 检测各种样式设置
    await Promise.all([
      this.protectFrozenPanes(),
      this.protectFilters(),
      this.ensureConditionalFormatCompatibility(),
      this.detectDataValidation(),
      this.checkMergedCells()
    ]);

    Logger.info("✅ 样式保护模式已启用");
  } catch (error) {
    Logger.warn("⚠️ 样式检测失败，将使用最高级别保护模式");
    this.enableMaximumProtection();
  }
}

/**
 * 启用最高级别保护（当检测失败时的后备方案）
 */
private enableMaximumProtection(): void {
  this.filterProtectionEnabled = true;
  this.filterViewsProtectionEnabled = true;
  this.useValuesApiOnly = true;
  this.avoidFormatOperations = true;

  Logger.info("🛡️ 已启用最高级别样式保护");
}
```

### 2. 安全操作包装器

```typescript
/**
 * 样式安全的操作包装器
 */
class StyleSafeOperations {
  /**
   * 安全的行更新
   */
  async safeUpdateRows(
    rowUpdates: Array<{ rowIndex: number; values: string[] }>
  ): Promise<void> {
    for (const update of rowUpdates) {
      await this.safeUpdateSingleRow(update.rowIndex, update.values);

      // 添加延迟，避免 API 限制
      await this.delay(100);
    }
  }

  /**
   * 安全的单行更新
   */
  private async safeUpdateSingleRow(
    rowIndex: number,
    values: string[]
  ): Promise<void> {
    const columnCount = values.length;
    const lastColumn = this.getColumnLetter(columnCount - 1);
    const range = `${this.config.sheetName}!A${rowIndex}:${lastColumn}${rowIndex}`;

    await this.googleSheets.spreadsheets.values.update({
      spreadsheetId: this.config.spreadsheetId,
      range: range,
      valueInputOption: "RAW", // 关键：保护格式
      resource: { values: [values] },
    });
  }

  /**
   * 安全的行追加
   */
  async safeAppendRows(values: string[][]): Promise<void> {
    await this.googleSheets.spreadsheets.values.append({
      spreadsheetId: this.config.spreadsheetId,
      range: `${this.config.sheetName}!A:A`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS", // 关键：插入而非覆盖
      resource: { values },
    });
  }

  /**
   * 安全的行删除
   */
  async safeDeleteRows(rowIndices: number[]): Promise<void> {
    // 从后往前删除，避免索引偏移
    const sortedIndices = rowIndices.sort((a, b) => b - a);

    for (const rowIndex of sortedIndices) {
      await this.safeDeleteSingleRow(rowIndex);
      await this.delay(100);
    }
  }

  private async safeDeleteSingleRow(rowIndex: number): Promise<void> {
    const requests = [
      {
        deleteDimension: {
          range: {
            sheetId: 0,
            dimension: "ROWS",
            startIndex: rowIndex - 1, // 0-based index
            endIndex: rowIndex,
          },
        },
      },
    ];

    await this.googleSheets.spreadsheets.batchUpdate({
      spreadsheetId: this.config.spreadsheetId,
      resource: { requests },
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 3. 样式验证和恢复

```typescript
/**
 * 样式验证和恢复机制
 */
class StyleValidator {
  /**
   * 操作前的样式快照
   */
  async captureStyleSnapshot(): Promise<StyleSnapshot> {
    const sheet = await this.getSheetMetadata();

    return {
      frozenRowCount: sheet.gridProperties?.frozenRowCount || 0,
      frozenColumnCount: sheet.gridProperties?.frozenColumnCount || 0,
      hasAutoFilter: !!sheet.basicFilter,
      filterViewCount: sheet.filterViews?.length || 0,
      conditionalFormatRuleCount: sheet.conditionalFormats?.length || 0,
    };
  }

  /**
   * 操作后的样式验证
   */
  async validateStyleIntegrity(
    beforeSnapshot: StyleSnapshot
  ): Promise<StyleValidationResult> {
    const afterSnapshot = await this.captureStyleSnapshot();

    const issues: string[] = [];

    if (beforeSnapshot.frozenRowCount !== afterSnapshot.frozenRowCount) {
      issues.push(
        `固定行数变化: ${beforeSnapshot.frozenRowCount} -> ${afterSnapshot.frozenRowCount}`
      );
    }

    if (beforeSnapshot.frozenColumnCount !== afterSnapshot.frozenColumnCount) {
      issues.push(
        `固定列数变化: ${beforeSnapshot.frozenColumnCount} -> ${afterSnapshot.frozenColumnCount}`
      );
    }

    if (beforeSnapshot.hasAutoFilter !== afterSnapshot.hasAutoFilter) {
      issues.push(`自动筛选器状态变化`);
    }

    if (beforeSnapshot.filterViewCount !== afterSnapshot.filterViewCount) {
      issues.push(
        `筛选视图数量变化: ${beforeSnapshot.filterViewCount} -> ${afterSnapshot.filterViewCount}`
      );
    }

    return {
      isValid: issues.length === 0,
      issues: issues,
    };
  }
}

interface StyleSnapshot {
  frozenRowCount: number;
  frozenColumnCount: number;
  hasAutoFilter: boolean;
  filterViewCount: number;
  conditionalFormatRuleCount: number;
}

interface StyleValidationResult {
  isValid: boolean;
  issues: string[];
}
```

## 测试用例

### 1. 样式保护测试

```typescript
describe('样式保护机制', () => {
  test('保护固定表头', async () => {
    // 设置固定表头
    await setupFrozenRows(2);

    // 执行增量更新
    await incrementalSync.updateRows([...]);

    // 验证固定表头仍然存在
    const frozenRows = await getFrozenRowCount();
    expect(frozenRows).toBe(2);
  });

  test('保护过滤器', async () => {
    // 设置自动筛选
    await setupAutoFilter();

    // 执行增量更新
    await incrementalSync.addRows([...]);

    // 验证过滤器仍然存在
    const hasFilter = await hasAutoFilter();
    expect(hasFilter).toBe(true);
  });

  test('保护条件格式', async () => {
    // 设置条件格式
    const ruleCount = await getConditionalFormatRuleCount();

    // 执行增量更新
    await incrementalSync.deleteRows([...]);

    // 验证条件格式规则数量不变
    const newRuleCount = await getConditionalFormatRuleCount();
    expect(newRuleCount).toBe(ruleCount);
  });
});
```

## 实施步骤

1. **第 1 步**：实现样式检测机制
2. **第 2 步**：创建安全操作包装器
3. **第 3 步**：添加样式验证功能
4. **第 4 步**：集成到增量同步流程
5. **第 5 步**：添加全面的测试用例

## 验收标准

- ✅ 100% 保护固定表头和固定列设置
- ✅ 完全保护所有类型的过滤器
- ✅ 条件格式规则完全不受影响
- ✅ 单元格格式（字体、颜色、边框等）完全保留
- ✅ 数据验证规则保持有效
- ✅ 合并单元格设置不被破坏
- ✅ 样式验证测试覆盖率达到 100%
