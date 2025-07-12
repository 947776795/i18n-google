/**
 * 进度提示器，提供优雅的加载动画和状态提示
 */
import { Logger } from "../utils/StringUtils";

export class ProgressIndicator {
  private spinner: any = null;
  private oraModule: any = null;

  /**
   * 动态导入 ora 模块
   */
  private async loadOra(): Promise<any> {
    if (!this.oraModule) {
      try {
        this.oraModule = await import("ora");
        return this.oraModule.default || this.oraModule;
      } catch (error) {
        Logger.debug("无法加载 ora 模块，将使用降级日志");
        return null;
      }
    }
    return this.oraModule.default || this.oraModule;
  }

  /**
   * 启动进度指示器
   */
  async start(text: string): Promise<void> {
    try {
      const ora = await this.loadOra();
      if (ora) {
        this.spinner = ora(text).start();
      } else {
        Logger.info(`🔄 ${text}`);
      }
    } catch (error) {
      // 如果 ora 不可用，降级到普通日志
      Logger.info(`🔄 ${text}`);
    }
  }

  /**
   * 停止进度指示器
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * 更新进度文本
   */
  update(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    } else {
      Logger.info(`🔄 ${text}`);
    }
  }

  /**
   * 显示成功状态并停止
   */
  succeed(text?: string): void {
    if (this.spinner) {
      this.spinner.succeed(text);
      this.spinner = null;
    } else {
      Logger.success(`✅ ${text || "操作完成"}`);
    }
  }

  /**
   * 显示失败状态并停止
   */
  fail(text?: string): void {
    if (this.spinner) {
      this.spinner.fail(text);
      this.spinner = null;
    } else {
      Logger.error(`❌ ${text || "操作失败"}`);
    }
  }

  /**
   * 显示警告状态并停止
   */
  warn(text?: string): void {
    if (this.spinner) {
      this.spinner.warn(text);
      this.spinner = null;
    } else {
      Logger.warn(`⚠️  ${text || "警告"}`);
    }
  }

  /**
   * 显示信息状态并停止
   */
  info(text?: string): void {
    if (this.spinner) {
      this.spinner.info(text);
      this.spinner = null;
    } else {
      Logger.info(`ℹ️  ${text || "信息"}`);
    }
  }

  /**
   * 暂停进度指示器以便进行用户交互
   * 返回恢复函数
   */
  pauseForInteraction(message?: string): () => Promise<void> {
    const wasRunning = !!this.spinner;
    const currentText = this.spinner?.text || "";
    
    if (wasRunning) {
      this.info(message || "等待用户交互...");
    }
    
    // 返回恢复函数
    return async () => {
      if (wasRunning && currentText) {
        await this.start(currentText);
      }
    };
  }

  /**
   * 执行异步操作并显示进度
   */
  async withProgress<T>(
    text: string,
    operation: () => Promise<T>,
    successText?: string,
    failText?: string
  ): Promise<T> {
    await this.start(text);

    try {
      const result = await operation();
      this.succeed(successText || `${text} 完成`);
      return result;
    } catch (error) {
      this.fail(failText || `${text} 失败`);
      throw error;
    }
  }

  /**
   * 执行一系列步骤，每个步骤都有进度提示
   */
  async executeSteps(
    steps: Array<{
      text: string;
      operation: () => Promise<any>;
      successText?: string;
      failText?: string;
    }>
  ): Promise<any[]> {
    const results: any[] = [];

    for (const step of steps) {
      const result = await this.withProgress(
        step.text,
        step.operation,
        step.successText,
        step.failText
      );
      results.push(result);
    }

    return results;
  }
}

/**
 * 删除操作的专用进度提示器
 */
export class DeletionProgressIndicator extends ProgressIndicator {
  /**
   * 显示删除操作的开始
   */
  async startDeletion(keysCount: number): Promise<void> {
    await this.start(`🗑️  准备删除 ${keysCount} 个无用的翻译Key...`);
  }

  /**
   * 显示备份创建进度
   */
  showBackupProgress(): void {
    this.update("💾 正在创建数据备份...");
  }

  /**
   * 显示本地删除进度
   */
  showLocalDeletionProgress(deletedCount: number): void {
    this.update(`🗂️  正在删除本地翻译文件... (已删除 ${deletedCount} 个)`);
  }

  /**
   * 显示记录更新进度
   */
  showRecordUpdateProgress(): void {
    this.update("📝 正在更新引用记录...");
  }

  /**
   * 显示远程同步进度
   */
  showRemoteSyncProgress(): void {
    this.update("🌐 正在同步到 Google Sheets...");
  }

  /**
   * 显示删除完成
   */
  showDeletionComplete(summary: {
    deletedKeys: number;
    affectedLanguages: string[];
    duration: number;
  }): void {
    const languages = summary.affectedLanguages.join(", ");
    const durationText =
      summary.duration < 1000
        ? `${summary.duration}ms`
        : `${(summary.duration / 1000).toFixed(1)}s`;

    this.succeed(
      `✨ 删除完成！已删除 ${summary.deletedKeys} 个Key，影响语言: ${languages}，耗时: ${durationText}`
    );
  }

  /**
   * 显示删除失败
   */
  showDeletionFailed(error: string): void {
    this.fail(`❌ 删除失败: ${error}`);
  }
}

/**
 * 扫描操作的专用进度提示器
 */
export class ScanProgressIndicator extends ProgressIndicator {
  /**
   * 显示扫描开始
   */
  async startScan(): Promise<void> {
    await this.start("🔍 开始扫描项目文件...");
  }

  /**
   * 显示文件扫描进度
   */
  showFilesScanProgress(scannedFiles: number, totalFiles: number): void {
    this.update(`📁 扫描文件中... (${scannedFiles}/${totalFiles})`);
  }

  /**
   * 显示引用收集进度
   */
  showReferenceCollection(): void {
    this.update("🔗 收集翻译引用...");
  }

  /**
   * 显示翻译处理进度
   */
  showTranslationProcessing(processedCount: number): void {
    this.update(`🌐 处理翻译内容... (已处理 ${processedCount} 个)`);
  }

  /**
   * 显示Google Sheets同步
   */
  showGoogleSheetsSync(): void {
    this.update("☁️  与 Google Sheets 同步...");
  }

  /**
   * 显示扫描完成
   */
  showScanComplete(summary: {
    totalFiles: number;
    totalKeys: number;
    newKeys: number;
    unusedKeys: number;
    duration: number;
  }): void {
    const durationText =
      summary.duration < 1000
        ? `${summary.duration}ms`
        : `${(summary.duration / 1000).toFixed(1)}s`;

    this.succeed(
      `🎉 扫描完成！处理 ${summary.totalFiles} 个文件，发现 ${summary.totalKeys} 个翻译Key，新增 ${summary.newKeys} 个，无用 ${summary.unusedKeys} 个，耗时: ${durationText}`
    );
  }
}
