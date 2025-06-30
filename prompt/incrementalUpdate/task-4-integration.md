# Task 4: 与现有系统集成

## 目标

将增量同步功能集成到现有的 I18nScanner 系统中，完全替换全量同步机制，专注于增量更新的实现。

## 集成策略

### 1. 增量同步专用设计

```typescript
/**
 * 重构的 GoogleSheetsSync 类 - 专注于增量同步
 */
export class GoogleSheetsSync {
  private styleProtection: boolean = true; // 默认启用样式保护

  /**
   * 主要同步方法 - 直接使用增量同步
   */
  public async syncCompleteRecordToSheet(
    completeRecord: CompleteTranslationRecord,
    options?: SyncOptions
  ): Promise<void> {
    const syncOptions = {
      enableStyleProtection: true,
      maxRetries: 3,
      batchSize: 100,
      retryDelay: 1000,
      ...options,
    };

    Logger.info("⚡ 使用增量同步模式");
    await this.incrementalSyncToSheet(completeRecord, syncOptions);
  }

  /**
   * 增量同步核心实现
   */
  public async incrementalSyncToSheet(
    completeRecord: CompleteTranslationRecord,
    options?: SyncOptions
  ): Promise<void> {
    await this.ensureInitialized();

    if (!this.isInitialized) {
      Logger.info("🔄 Google Sheets 未初始化，跳过同步");
      return;
    }

    try {
      Logger.info("🔍 开始增量同步分析...");

      // 1. 获取远端当前数据
      const remoteRecord = await this.syncCompleteRecordFromSheet();

      // 2. 计算变更集
      const changeSet = this.calculateChangeSet(remoteRecord, completeRecord);

      // 3. 如果没有变更，直接返回
      if (this.isChangeSetEmpty(changeSet)) {
        Logger.info("📋 没有检测到变更，跳过同步");
        return;
      }

      // 4. 显示变更摘要
      this.logChangeSetSummary(changeSet);

      // 5. 执行增量更新
      await this.applyIncrementalChanges(changeSet, options);

      Logger.info("✅ 增量同步完成");
    } catch (error) {
      this.handleSyncError(error, "增量同步到 Google Sheets");
    }
  }
}

interface SyncOptions {
  enableStyleProtection?: boolean; // 启用样式保护
  maxRetries?: number; // 最大重试次数
  batchSize?: number; // 批处理大小
  retryDelay?: number; // 重试延迟(ms)
  concurrencyControl?: boolean; // 启用并发控制
}
```

### 2. I18nScanner 集成

```typescript
/**
 * 更新 I18nScanner 以使用增量同步
 */
export class I18nScanner {
  // ... 现有属性 ...

  /**
   * 扫描方法 - 默认使用增量同步
   */
  public async scan(options?: ScanOptions): Promise<void> {
    const scanOptions = {
      enableStyleProtection: true,
      concurrencyControl: true, // 默认启用并发控制
      logLevel: "normal" as LogLevel,
      ...options,
    };

    // ... 现有扫描逻辑 ...

    // 8. 用户确认是否同步到远端
    this.scanProgress.update("🤔 等待用户确认远端同步...");
    const shouldSyncToRemote = await UserInteraction.confirmRemoteSync();

    if (shouldSyncToRemote) {
      // 9. 增量同步到远端
      this.scanProgress.update("☁️ 增量同步到 Google Sheets...");
      await this.performIncrementalSync(processedRecord, scanOptions);
    } else {
      this.scanProgress.update("⏭️ 跳过远端同步");
      Logger.info("⏭️ 用户选择跳过远端同步");
    }

    // ... 其余逻辑 ...
  }

  /**
   * 执行增量同步
   */
  private async performIncrementalSync(
    processedRecord: CompleteTranslationRecord,
    scanOptions: ScanOptions
  ): Promise<void> {
    const syncOptions: SyncOptions = {
      enableStyleProtection: scanOptions.enableStyleProtection,
      concurrencyControl: scanOptions.concurrencyControl,
      maxRetries: 3,
      batchSize: 100,
      retryDelay: 1000,
    };

    try {
      await this.googleSheetsSync.syncCompleteRecordToSheet(
        processedRecord,
        syncOptions
      );
      Logger.info("✅ 增量同步成功完成");
    } catch (error) {
      if (this.isConcurrencyError(error)) {
        Logger.error("❌ 并发冲突导致同步失败，请稍后重试:", error);
      } else {
        Logger.error("❌ 增量同步失败:", error);
      }
      throw error;
    }
  }

  /**
   * 检查是否为并发错误
   */
  private isConcurrencyError(error: Error): boolean {
    return (
      error.name === "ConcurrencyError" ||
      error.message.includes("并发冲突") ||
      error.message.includes("版本冲突") ||
      error.message.includes("已被锁定")
    );
  }
}

interface ScanOptions {
  enableStyleProtection?: boolean; // 样式保护
  concurrencyControl?: boolean; // 并发控制
  logLevel?: LogLevel; // 日志级别
  maxRetries?: number; // 最大重试次数
  batchSize?: number; // 批处理大小
}

type LogLevel = "verbose" | "normal" | "quiet";
```

### 3. 用户交互简化

```typescript
/**
 * 简化的用户交互 - 专注于增量同步
 */
export class UserInteraction {
  /**
   * 确认远端同步 - 简化为是否同步的选择
   */
  public static async confirmRemoteSync(): Promise<boolean> {
    console.log("\n" + "=".repeat(60));
    console.log("⚡ Google Sheets 增量同步确认");
    console.log("=".repeat(60));

    console.log("📋 同步特性:");
    console.log("  ⚡ 增量更新 - 只同步变更的内容");
    console.log("  🎨 样式保护 - 保持表格格式不变");
    console.log("  🚀 高性能 - 快速完成同步");

    const choice = await this.promptUser(
      "是否同步到 Google Sheets? (y/n):",
      ["y", "n", "yes", "no"],
      "y" // 默认选择同步
    );

    return choice.toLowerCase() === "y" || choice.toLowerCase() === "yes";
  }

  /**
   * 显示同步结果摘要
   */
  public static displaySyncSummary(summary: SyncSummary): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 同步结果摘要");
    console.log("=".repeat(60));

    console.log(`🔄 同步模式: ${summary.syncMode}`);
    console.log(`⏱️ 同步耗时: ${summary.duration}ms`);
    console.log(
      `📈 数据变更: +${summary.added} ~${summary.modified} -${summary.deleted}`
    );

    if (summary.styleProtected) {
      console.log("🎨 样式保护: ✅ 已启用");
    } else {
      console.log("🎨 样式保护: ❌ 未启用");
    }

    if (summary.errors.length > 0) {
      console.log("❌ 同步错误:");
      summary.errors.forEach((error) => {
        console.log(`  - ${error}`);
      });
    }

    console.log("=".repeat(60));
  }
}

interface SyncSummary {
  syncMode: string;
  duration: number;
  added: number;
  modified: number;
  deleted: number;
  styleProtected: boolean;
  errors: string[];
}
```

### 4. 配置系统集成

```typescript
/**
 * 扩展 I18nConfig 以支持增量同步配置
 */
interface I18nConfig {
  // ... 现有配置 ...

  // 新增的增量同步配置
  incrementalSync?: {
    styleProtection: boolean; // 是否启用样式保护
    batchSize: number; // 批处理大小
    maxRetries: number; // 最大重试次数
    retryDelay: number; // 重试延迟(ms)
  };
}

/**
 * 默认配置
 */
const DEFAULT_INCREMENTAL_CONFIG = {
  styleProtection: true,
  batchSize: 100,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * 配置加载和验证
 */
export class ConfigManager {
  /**
   * 加载并验证配置
   */
  public static loadConfig(configPath: string): I18nConfig {
    const config = this.loadRawConfig(configPath);

    // 合并默认的增量同步配置
    config.incrementalSync = {
      ...DEFAULT_INCREMENTAL_CONFIG,
      ...config.incrementalSync,
    };

    // 验证配置
    this.validateConfig(config);

    return config;
  }

  /**
   * 验证增量同步配置
   */
  private static validateIncrementalConfig(
    config: I18nConfig["incrementalSync"]
  ): void {
    if (!config) return;

    if (config.batchSize <= 0) {
      throw new Error("增量同步批处理大小必须大于 0");
    }

    if (config.maxRetries < 0) {
      throw new Error("最大重试次数不能为负数");
    }

    if (config.retryDelay < 0) {
      throw new Error("重试延迟不能为负数");
    }
  }
}
```

### 5. 错误处理机制

```typescript
/**
 * 增量同步错误处理
 */
export class SyncErrorHandler {
  /**
   * 处理增量同步错误
   */
  public static async handleIncrementalSyncError(
    error: Error,
    config: I18nConfig
  ): Promise<void> {
    Logger.error("❌ 增量同步失败:", error);

    // 分析错误类型
    const errorType = this.analyzeError(error);

    switch (errorType) {
      case "NETWORK_ERROR":
        await this.handleNetworkError(error, config);
        break;

      case "API_RATE_LIMIT":
        await this.handleRateLimitError(error, config);
        break;

      case "AUTHENTICATION_ERROR":
        this.handleAuthenticationError(error);
        break;

      case "SHEET_STRUCTURE_CHANGED":
        this.handleStructureChangeError(error);
        break;

      case "CONCURRENCY_ERROR":
        await this.handleConcurrencyError(error, config);
        break;

      case "VERSION_CONFLICT":
        await this.handleVersionConflictError(error, config);
        break;

      default:
        this.handleUnknownError(error);
    }
  }

  /**
   * 处理网络错误
   */
  private static async handleNetworkError(
    error: Error,
    config: I18nConfig
  ): Promise<void> {
    const retries = config.incrementalSync?.maxRetries || 3;
    const delay = config.incrementalSync?.retryDelay || 1000;

    Logger.warn(`🔄 网络错误，将在 ${delay}ms 后重试 (剩余 ${retries} 次)`);

    // 实现重试逻辑
    await this.delay(delay);
    throw error; // 重新抛出以触发重试
  }

  /**
   * 处理并发错误
   */
  private static async handleConcurrencyError(
    error: Error,
    config: I18nConfig
  ): Promise<void> {
    const retries = config.incrementalSync?.maxRetries || 3;
    const baseDelay = config.incrementalSync?.retryDelay || 1000;

    // 使用指数退避策略
    const delay = Math.min(baseDelay * Math.pow(2, retries), 10000);

    Logger.warn(`🔒 检测到并发冲突，将在 ${delay}ms 后重试`);
    Logger.info("💡 提示：多用户同时编辑时可能出现此情况，系统会自动重试");

    await this.delay(delay);
    throw error; // 重新抛出以触发重试机制
  }

  /**
   * 处理版本冲突错误
   */
  private static async handleVersionConflictError(
    error: Error,
    config: I18nConfig
  ): Promise<void> {
    Logger.warn("📊 远端数据版本已变更，正在重新同步...");
    Logger.info("💡 这通常是因为其他用户修改了数据，系统会自动获取最新数据");

    const delay = config.incrementalSync?.retryDelay || 1000;
    await this.delay(delay);
    throw error; // 重新抛出以触发重新获取远端数据
  }

  /**
   * 处理认证错误
   */
  private static handleAuthenticationError(error: Error): void {
    Logger.error("🔐 认证失败，请检查 Google Sheets API 配置");
    throw error;
  }

  /**
   * 处理表格结构变更错误
   */
  private static handleStructureChangeError(error: Error): void {
    Logger.error("📋 表格结构已变更，请重新初始化 Google Sheets");
    throw error;
  }

  /**
   * 处理未知错误
   */
  private static handleUnknownError(error: Error): void {
    Logger.error("❓ 未知错误，增量同步失败");
    throw error;
  }

  /**
   * 分析错误类型
   */
  private static analyzeError(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    if (message.includes("network") || message.includes("enotfound")) {
      return "NETWORK_ERROR";
    }

    if (message.includes("rate limit") || message.includes("quota")) {
      return "API_RATE_LIMIT";
    }

    if (
      message.includes("authentication") ||
      message.includes("unauthorized")
    ) {
      return "AUTHENTICATION_ERROR";
    }

    if (message.includes("range") || message.includes("sheet not found")) {
      return "SHEET_STRUCTURE_CHANGED";
    }

    if (
      error.name === "ConcurrencyError" ||
      message.includes("已被锁定") ||
      message.includes("并发冲突")
    ) {
      return "CONCURRENCY_ERROR";
    }

    if (message.includes("版本冲突") || message.includes("数据已被修改")) {
      return "VERSION_CONFLICT";
    }

    return "UNKNOWN_ERROR";
  }

  /**
   * 延迟工具方法
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

type ErrorType =
  | "NETWORK_ERROR"
  | "API_RATE_LIMIT"
  | "AUTHENTICATION_ERROR"
  | "SHEET_STRUCTURE_CHANGED"
  | "CONCURRENCY_ERROR"
  | "VERSION_CONFLICT"
  | "UNKNOWN_ERROR";

/**
 * 并发安全配置接口
 */
interface ConcurrencySafetyConfig {
  enableVersionControl: boolean; // 启用版本控制
  enableRowLocking: boolean; // 启用行锁
  lockTimeout: number; // 锁超时时间(ms)
  maxConcurrentUsers: number; // 最大并发用户数
  conflictResolutionStrategy: "retry" | "merge" | "abort"; // 冲突解决策略
}

/**
 * 增强的同步选项
 */
interface EnhancedSyncOptions extends SyncOptions {
  concurrencySafety?: ConcurrencySafetyConfig;
}
```

### 6. 部署指南

```typescript
/**
 * 增量同步部署工具
 */
export class DeploymentTool {
  /**
   * 检查系统是否准备好使用增量同步
   */
  public static async checkDeploymentReadiness(
    config: I18nConfig
  ): Promise<DeploymentReport> {
    const report: DeploymentReport = {
      ready: true,
      issues: [],
      recommendations: [],
    };

    // 检查 Google Sheets 连接
    try {
      const googleSheetsSync = new GoogleSheetsSync(config);
      await googleSheetsSync.syncCompleteRecordFromSheet();
      report.recommendations.push("✅ Google Sheets 连接正常");
    } catch (error) {
      report.ready = false;
      report.issues.push("❌ Google Sheets 连接失败");
    }

    // 检查表格结构
    const structureValid = await this.validateSheetStructure(config);
    if (!structureValid) {
      report.ready = false;
      report.issues.push("❌ 表格结构不兼容");
      report.recommendations.push("请确保表格包含正确的列头");
    }

    // 检查数据量
    const dataSize = await this.estimateDataSize(config);
    if (dataSize > 10000) {
      report.recommendations.push("⚠️ 数据量较大，首次同步可能较慢");
    }

    return report;
  }

  /**
   * 执行部署
   */
  public static async performDeployment(config: I18nConfig): Promise<void> {
    Logger.info("🚀 开始部署增量同步模式");

    // 1. 备份当前配置
    await this.backupCurrentConfig(config);

    // 2. 配置增量同步
    const newConfig = this.configureIncrementalSync(config);

    // 3. 执行测试同步
    await this.performTestSync(newConfig);

    // 4. 验证结果
    await this.validateDeploymentResult(newConfig);

    Logger.info("✅ 部署完成，增量同步已启用");
  }
}

interface DeploymentReport {
  ready: boolean;
  issues: string[];
  recommendations: string[];
}
```

## 测试集成

### 1. 集成测试

```typescript
describe("增量同步集成测试", () => {
  test("I18nScanner 集成增量同步", async () => {
    const scanner = new I18nScanner(testConfig);

    // 模拟扫描和同步
    await scanner.scan({
      enableStyleProtection: true,
    });

    // 验证同步结果
    const remoteData = await googleSheetsSync.syncCompleteRecordFromSheet();
    expect(Object.keys(remoteData)).toHaveLength(expectedKeyCount);
  });

  test("错误处理测试", async () => {
    // 模拟增量同步失败
    jest
      .spyOn(googleSheetsSync, "incrementalSyncToSheet")
      .mockRejectedValue(new Error("Network error"));

    const scanner = new I18nScanner(testConfig);

    // 应该正确处理错误
    await expect(scanner.scan()).rejects.toThrow("Network error");
  });
});
```

## 实施步骤

1. **第 1 步**：重构 GoogleSheetsSync 类，实现增量同步
2. **第 2 步**：更新 I18nScanner 使用增量同步
3. **第 3 步**：简化用户交互界面
4. **第 4 步**：扩展配置系统
5. **第 5 步**：实现错误处理机制
6. **第 6 步**：添加部署工具和指南
7. **第 7 步**：完善集成测试

## 验收标准

- ✅ 完全替换全量同步为增量同步
- ✅ 用户界面简化，专注增量同步
- ✅ 错误处理机制完善
- ✅ 配置系统支持增量同步选项
- ✅ 提供完整的部署指南
- ✅ 集成测试覆盖率达到 90% 以上
- ✅ 性能提升 5-10 倍
