import type { I18nConfig } from "../types";
import { ExistingReference } from "./AstTransformer";
import { TranslationManager } from "./TranslationManager";
import { GoogleSheetsSync } from "./GoogleSheetsSync";
import { RecordManager } from "./RecordManager";
import { UnusedKeyAnalyzer } from "./UnusedKeyAnalyzer";
import { I18nError, I18nErrorType, ErrorHandler } from "./errors/I18nError";
import { DeletionProgressIndicator } from "./ui/ProgressIndicator";
import { UserInteraction } from "./ui/UserInteraction";
import * as fs from "fs";

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
   * 检测无用Key并处理删除
   */
  async detectAndHandleUnusedKeys(
    allDefinedKeys: string[],
    referencesMap: Map<string, ExistingReference[]>
  ): Promise<void> {
    try {
      // 1. 获取真正无用的Key（排除强制保留）
      const unusedKeys = this.unusedKeyAnalyzer.detectUnusedKeys(
        allDefinedKeys,
        referencesMap
      );

      // 2. 获取被强制保留的无用Key
      const forceKeptKeys = this.unusedKeyAnalyzer.getForceKeptUnusedKeys(
        allDefinedKeys,
        referencesMap
      );

      // 3. 显示强制保留信息
      if (forceKeptKeys.length > 0) {
        console.log(`🔒 强制保留 ${forceKeptKeys.length} 个Key (配置指定):`);
        forceKeptKeys.forEach((key) => console.log(`   - ${key}`));
        console.log("");
      }

      if (unusedKeys.length === 0) {
        if (forceKeptKeys.length > 0) {
          console.log("✅ 除强制保留的Key外，没有发现其他无用的翻译Key");
        } else {
          console.log("✅ 没有发现无用的翻译Key");
        }
        return;
      }

      // 2. 展示详细信息并询问用户（会生成预览文件）
      let previewPath: string | null = null;

      try {
        previewPath = await this.unusedKeyAnalyzer.generateDeletePreview(
          unusedKeys,
          this.translationManager.getTranslations()
        );
        const shouldDelete = await this.askUserConfirmation(
          unusedKeys,
          forceKeptKeys
        );

        // 3. 如果用户确认删除，执行删除并重新同步
        if (shouldDelete) {
          await this.executeKeyDeletion(unusedKeys, referencesMap);
          console.log("🔄 正在重新同步删除的Key到远程...");
          await this.googleSheetsSync.syncToSheet(
            this.translationManager.getTranslations()
          );
          console.log("✅ 删除操作完成并已同步到远程");

          // 清理预览文件
          if (previewPath) {
            await this.cleanupPreviewFile(previewPath);
          }
        } else {
          console.log("❌ 用户取消删除操作");
          console.log(`💡 预览文件保留在: ${previewPath}`);
        }
      } catch (error) {
        console.error("❌ 删除流程错误:", error);
        if (previewPath) {
          console.log(`💡 预览文件保留在: ${previewPath}`);
        }
      }
    } catch (error) {
      ErrorHandler.handle(error as Error, "detectAndHandleUnusedKeys");
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
   * 询问用户确认删除操作
   */
  protected async askUserConfirmation(
    unusedKeys: string[],
    forceKeptKeys: string[] = []
  ): Promise<boolean> {
    return await UserInteraction.confirmDeletion(
      unusedKeys,
      () =>
        this.unusedKeyAnalyzer.generateDeletePreview(
          unusedKeys,
          this.translationManager.getTranslations()
        ),
      forceKeptKeys
    );
  }

  /**
   * 清理预览文件
   */
  async cleanupPreviewFile(previewPath: string): Promise<void> {
    try {
      await fs.promises.unlink(previewPath);
      console.log(`🗑️  预览文件已清理: ${previewPath}`);
    } catch (error) {
      console.warn(`⚠️  清理预览文件失败: ${error}`);
    }
  }
}
