import type { I18nConfig } from "../types";
import { ExistingReference } from "./AstTransformer";
import { TranslationManager } from "./TranslationManager";
import { GoogleSheetsSync } from "./GoogleSheetsSync";
import { RecordManager } from "./RecordManager";
import { UnusedKeyAnalyzer } from "./UnusedKeyAnalyzer";
import { I18nError, I18nErrorType, ErrorHandler } from "../errors/I18nError";
import { DeletionProgressIndicator } from "../ui/ProgressIndicator";
import { UserInteraction } from "../ui/UserInteraction";
import * as fs from "fs";
import { Logger } from "../utils/StringUtils";

// 删除结果接口
export interface DeletionResult {
  deletedCount: number;
  affectedLanguages: string[];
  success: boolean;
  error?: string;
}

export class KeyDeletionService {
  private deletionProgress: DeletionProgressIndicator;

  constructor(
    private config: I18nConfig,
    private translationManager: TranslationManager,
    private googleSheetsSync: GoogleSheetsSync,
    private recordManager: RecordManager,
    private unusedKeyAnalyzer: UnusedKeyAnalyzer
  ) {
    this.deletionProgress = new DeletionProgressIndicator();
  }

  /**
   * 检测并处理无用的Key
   */
  async detectAndHandleUnusedKeys(
    allDefinedKeys: string[],
    allReferences: Map<string, ExistingReference[]>
  ): Promise<void> {
    let previewPath: string | null = null;

    try {
      // 1. 分析无用Key
      const unusedKeys = this.unusedKeyAnalyzer.detectUnusedKeys(
        allDefinedKeys,
        allReferences
      );
      const forceKeptKeys = this.unusedKeyAnalyzer.getForceKeptUnusedKeys(
        allDefinedKeys,
        allReferences
      );

      // 2. 显示强制保留的Key信息
      if (forceKeptKeys.length > 0) {
        Logger.info(`🔒 强制保留 ${forceKeptKeys.length} 个Key (配置指定):`);
        forceKeptKeys.forEach((key: string) => Logger.info(`   - ${key}`));
        Logger.info("");
      }

      // 3. 检查是否有可删除的无用Key
      if (unusedKeys.length === 0) {
        if (forceKeptKeys.length > 0) {
          Logger.success("✅ 除强制保留的Key外，没有发现其他无用的翻译Key");
        } else {
          Logger.success("✅ 没有发现无用的翻译Key");
        }
        return;
      }

      // 4. 生成删除预览
      previewPath = await this.unusedKeyAnalyzer.generateDeletePreview(
        unusedKeys,
        this.translationManager.getTranslations()
      );

      // 5. 用户确认
      const shouldDelete = await UserInteraction.confirmDeletion(
        unusedKeys,
        async () => {
          if (!previewPath) {
            previewPath = await this.unusedKeyAnalyzer.generateDeletePreview(
              unusedKeys,
              this.translationManager.getTranslations()
            );
          }
          return previewPath;
        },
        forceKeptKeys
      );

      if (shouldDelete) {
        // 执行删除操作
        await this.executeKeyDeletion(unusedKeys, allReferences);

        // 重新同步到远程
        Logger.info("🔄 正在重新同步删除的Key到远程...");
        await this.googleSheetsSync.syncToSheet(
          this.translationManager.getTranslations()
        );
        Logger.success("✅ 删除操作完成并已同步到远程");

        // 清理预览文件
        if (previewPath) {
          await this.cleanupPreviewFile(previewPath);
        }
      } else {
        Logger.info("❌ 用户取消删除操作");
        if (previewPath) {
          Logger.info(`💡 预览文件保留在: ${previewPath}`);
        }
      }
    } catch (error) {
      Logger.error("❌ 删除流程错误:", error);
      // 保留预览文件以供调试
      if (previewPath) {
        Logger.info(`💡 预览文件保留在: ${previewPath}`);
      }
      throw error;
    }
  }

  /**
   * 执行Key删除操作
   */
  async executeKeyDeletion(
    keysToDelete: string[],
    referencesMap: Map<string, ExistingReference[]>
  ): Promise<void> {
    const startTime = Date.now();

    try {
      await this.deletionProgress.startDeletion(keysToDelete.length);

      // 1. 使用原子性删除（包含备份和回滚机制）
      this.deletionProgress.showBackupProgress();
      const deleteResult =
        await this.translationManager.deleteTranslationsAtomically(
          keysToDelete
        );

      this.deletionProgress.showLocalDeletionProgress(
        deleteResult.deletedCount
      );

      // 2. 更新完整记录（移除已删除的Key）
      this.deletionProgress.showRecordUpdateProgress();
      await this.recordManager.updateRecordAfterDeletion(keysToDelete);

      // 3. 同步到远程
      this.deletionProgress.showRemoteSyncProgress();
      await this.googleSheetsSync.syncToSheet(
        this.translationManager.getTranslations()
      );

      // 4. 从referencesMap中移除
      keysToDelete.forEach((key) => {
        referencesMap.delete(key);
      });

      // 5. 显示删除完成
      const duration = Date.now() - startTime;
      this.deletionProgress.showDeletionComplete({
        deletedKeys: keysToDelete.length,
        affectedLanguages: deleteResult.affectedLanguages,
        duration,
      });

      // 6. 显示详细的删除结果
      UserInteraction.displayDeletionResult({
        deletedKeys: keysToDelete,
        affectedLanguages: deleteResult.affectedLanguages,
        duration,
        success: true,
      });
    } catch (error) {
      const errorMessage =
        error instanceof I18nError
          ? error.getUserMessage()
          : (error as Error).message;

      this.deletionProgress.showDeletionFailed(errorMessage);

      UserInteraction.displayDeletionResult({
        deletedKeys: keysToDelete,
        affectedLanguages: [],
        duration: Date.now() - startTime,
        success: false,
        error: errorMessage,
      });

      if (error instanceof I18nError) {
        ErrorHandler.handle(error, "executeKeyDeletion");
      } else {
        const i18nError = new I18nError(
          I18nErrorType.UNKNOWN_ERROR,
          "删除操作失败",
          { originalError: error, keysToDelete },
          ["检查文件系统权限", "确认磁盘空间充足", "稍后重试操作"]
        );
        ErrorHandler.handle(i18nError, "executeKeyDeletion");
      }
      throw error;
    }
  }

  /**
   * 清理预览文件
   */
  private async cleanupPreviewFile(previewPath: string): Promise<void> {
    try {
      await fs.promises.unlink(previewPath);
      Logger.info(`🗑️  预览文件已清理: ${previewPath}`);
    } catch (error) {
      Logger.warn(`⚠️  清理预览文件失败: ${error}`);
    }
  }
}
