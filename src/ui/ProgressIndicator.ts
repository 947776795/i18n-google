/**
 * 进度提示器，提供优雅的加载动画和状态提示 - 简化版本
 */
import { Logger } from "../utils/StringUtils";

export class ProgressIndicator {
  protected spinner: any = null;
  private oraModule: any = null;

  /**
   * 动态导入 ora 模块
   */
  private async loadOra(): Promise<any> {
    if (!this.oraModule) {
      try {
        // 测试环境降级为 no-op，避免 teardown 后动态 import 异常
        if (process.env.JEST_WORKER_ID || process.env.NODE_ENV === "test") {
          this.oraModule = null;
          return null;
        }
        this.oraModule = await import("ora");
        return this.oraModule.default || this.oraModule;
      } catch (error) {
        Logger.debug("无法加载 ora 模块，将使用降级日志");
        this.oraModule = null;
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
}

// 保留专用类并添加专用方法以保持向后兼容
export class DeletionProgressIndicator extends ProgressIndicator {}

export class ScanProgressIndicator extends ProgressIndicator {
  async startScan(): Promise<void> {
    await this.start("🔍 开始扫描项目文件...");
  }

  showReferenceCollection(): void {
    this.update("🔗 收集翻译引用...");
  }

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