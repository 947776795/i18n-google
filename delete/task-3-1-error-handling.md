# Task 3.1: 完善错误处理机制

我需要为整个删除流程添加完善的错误处理机制，确保在任何异常情况下都能提供良好的用户体验和数据安全保障。

## 当前状况

- 基本的删除功能已实现（TranslationManager.deleteTranslations）
- 用户交互功能已完成（inquirer 集成）
- 缺少完善的错误处理和异常情况处理

## 需求分析

### 1. 错误场景识别

#### 文件系统错误

- 翻译文件读取失败
- 翻译文件写入失败
- 权限不足
- 磁盘空间不足

#### 数据一致性错误

- 完整记录文件损坏或不存在
- 翻译文件格式错误
- Key 引用关系不一致

#### Google Sheets 相关错误

- 网络连接失败
- API 权限不足
- 配置文件缺失或无效
- 同步超时

#### 用户操作错误

- 用户中断操作
- 配置参数无效
- 删除预览文件生成失败

### 2. 错误处理策略

#### 分级错误处理

- **致命错误**：立即终止流程，显示详细错误信息
- **警告错误**：记录警告，继续执行，但提醒用户
- **可恢复错误**：尝试重试或提供替代方案

#### 用户友好的错误信息

- 避免技术性错误堆栈
- 提供具体的解决建议
- 区分用户错误和系统错误

## 实现要求

### 1. 错误类型定义

```typescript
// 定义统一的错误类型
export enum I18nErrorType {
  FILE_READ_ERROR = "FILE_READ_ERROR",
  FILE_WRITE_ERROR = "FILE_WRITE_ERROR",
  PERMISSION_ERROR = "PERMISSION_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  API_ERROR = "API_ERROR",
  DATA_CORRUPTION = "DATA_CORRUPTION",
  USER_CANCELLED = "USER_CANCELLED",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
}

export class I18nError extends Error {
  constructor(
    public type: I18nErrorType,
    public message: string,
    public details?: any,
    public suggestions?: string[]
  ) {
    super(message);
    this.name = "I18nError";
  }
}
```

### 2. 错误处理器

```typescript
export class ErrorHandler {
  static handle(error: Error): void {
    if (error instanceof I18nError) {
      this.handleI18nError(error);
    } else {
      this.handleUnknownError(error);
    }
  }

  private static handleI18nError(error: I18nError): void {
    // 根据错误类型提供不同的处理方式
  }

  private static handleUnknownError(error: Error): void {
    // 处理未知错误
  }
}
```

### 3. 关键方法的错误处理增强

需要在以下方法中添加错误处理：

#### I18nScanner

- `detectAndHandleUnusedKeys()` - 添加完整的 try-catch 包装
- `executeKeyDeletion()` - 处理删除过程中的各种异常
- `generateCompleteRecord()` - 处理文件操作异常

#### TranslationManager

- `deleteTranslations()` - 添加原子性操作保障
- `saveTranslations()` - 处理文件写入异常
- `initialize()` - 处理初始化失败

#### GoogleSheetsSync

- `syncFromSheet()` - 网络和 API 错误处理
- `syncToSheet()` - 同步失败的回滚机制

### 4. 操作安全性增强

#### 原子性操作

```typescript
// 确保删除操作的原子性
async deleteTranslationsAtomically(keysToDelete: string[]): Promise<void> {
  const backup = this.createBackup();
  try {
    this.deleteTranslations(keysToDelete);
    await this.saveTranslations();
  } catch (error) {
    // 恢复备份
    this.restoreFromBackup(backup);
    throw error;
  }
}
```

#### 数据验证

```typescript
// 验证翻译数据的完整性
validateTranslationData(data: any): boolean {
  // 验证数据格式
  // 检查必需字段
  // 验证数据类型
}
```

## 验收标准

### 1. 错误覆盖

- ✅ 所有可能的错误场景都有对应的处理逻辑
- ✅ 错误信息清晰易懂，包含具体的解决建议
- ✅ 不同类型的错误有不同的处理策略

### 2. 用户体验

- ✅ 错误发生时不会丢失用户数据
- ✅ 提供明确的错误恢复指导
- ✅ 避免技术性错误信息暴露给用户

### 3. 系统稳定性

- ✅ 任何单个组件的失败不会导致整个系统崩溃
- ✅ 关键操作具有原子性保障
- ✅ 数据一致性得到保证

### 4. 调试支持

- ✅ 详细的错误日志记录
- ✅ 错误上下文信息保存
- ✅ 支持错误复现和调试

## 实施步骤

1. ✅ **定义错误类型和处理器** - 已完成

   - 创建了 `core/errors/I18nError.ts`
   - 定义了 14 种错误类型
   - 实现了统一的错误处理器
   - 提供了便捷的错误创建方法

2. ✅ **增强 TranslationManager 的错误处理** - 已完成

   - 添加了原子性删除操作 `deleteTranslationsAtomically`
   - 实现了备份和回滚机制
   - 增强了文件读写的错误处理
   - 添加了数据验证功能

3. ✅ **完善 I18nScanner 的异常处理** - 已完成

   - 在 `detectAndHandleUnusedKeys` 中添加了错误处理
   - 在 `executeKeyDeletion` 中使用了原子性删除
   - 统一了错误处理和用户友好的错误信息

4. ✅ **改进 GoogleSheetsSync 的容错能力** - 已完成

   - 添加了网络错误处理
   - 增强了 API 认证错误处理
   - 实现了可恢复错误的重试机制

5. ✅ **添加统一的错误日志和报告** - 已完成

   - 实现了错误日志记录到 `i18n-errors.log`
   - 提供了结构化的错误信息
   - 支持错误上下文记录

6. ✅ **编写错误处理测试用例** - 已完成
   - 创建并运行了错误处理功能测试
   - 验证了错误创建、处理和恢复机制
   - 确保了用户友好的错误信息

## 已实现的关键功能

### 错误类型覆盖

- ✅ 文件系统错误（读取、写入、权限、磁盘空间）
- ✅ 数据一致性错误（格式错误、数据损坏、引用不一致）
- ✅ 网络和 API 错误（连接失败、认证失败、超时）
- ✅ 用户操作错误（取消操作、配置错误、无效输入）
- ✅ 系统错误（未知错误、初始化失败）

### 错误处理策略

- ✅ 分级错误处理（致命、错误、警告）
- ✅ 原子性操作保障（备份-操作-回滚）
- ✅ 用户友好的错误信息
- ✅ 详细的错误日志记录

### 数据安全保障

- ✅ 自动备份机制（MD5 校验和验证）
- ✅ 失败时自动回滚
- ✅ 数据格式验证
- ✅ 操作原子性保证

## 测试结果

✅ **基础功能测试通过**

- 错误类型创建和分类 ✅
- 错误严重程度判断 ✅
- 用户友好消息生成 ✅
- 便捷错误创建方法 ✅

✅ **核心组件集成测试通过**

- TranslationManager 错误处理 ✅
- I18nScanner 错误处理 ✅
- GoogleSheetsSync 错误处理 ✅
- 错误日志记录 ✅
