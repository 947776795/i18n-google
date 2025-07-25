import type { I18nConfig } from "../types";
import { FileScanner } from "./FileScanner";
import { FileTransformer } from "./FileTransformer";
import { TranslationManager } from "./TranslationManager";
import { GoogleSheetsSync } from "./GoogleSheetsSync";
import { DeleteService } from "./DeleteService";
import { ExistingReference, TransformResult } from "./AstTransformer";
import { ErrorHandler } from "../errors/I18nError";
import { ScanProgressIndicator } from "../ui/ProgressIndicator";
import { UserInteraction } from "../ui/UserInteraction";
import { Logger } from "../utils/StringUtils";

export class I18nScanner {
  private fileScanner: FileScanner;
  private fileTransformer: FileTransformer;
  private translationManager: TranslationManager;
  private googleSheetsSync: GoogleSheetsSync;
  private deleteService: DeleteService;
  private referencesMap: Map<string, ExistingReference[]> = new Map();
  private scanProgress: ScanProgressIndicator;
  private previewFilesToCleanup: string[] = []; // 跟踪需要清理的预览文件

  constructor(private config: I18nConfig) {
    // 设置日志级别
    Logger.setLogLevel(config.logLevel || "normal");

    this.fileScanner = new FileScanner(config);
    this.fileTransformer = new FileTransformer(config);
    this.translationManager = new TranslationManager(config);
    this.googleSheetsSync = new GoogleSheetsSync(config);
    this.deleteService = new DeleteService(config, this.translationManager);
    this.scanProgress = new ScanProgressIndicator();
  }

  /**
   * 执行扫描和翻译处理
   */
  public async scan(): Promise<void> {
    const startTime = Date.now();

    try {
      await this.scanProgress.startScan();

      // 1. 从远端拉取数据并增量合并到本地完整记录（如果有数据的话）
      this.scanProgress.update("☁️ 从远端拉取翻译数据...");
      const remoteCompleteRecord =
        await this.googleSheetsSync.syncCompleteRecordFromSheet();
      if (
        remoteCompleteRecord &&
        Object.keys(remoteCompleteRecord).length > 0
      ) {
        // 增量合并远端数据到本地
        await this.translationManager.mergeRemoteCompleteRecord(
          remoteCompleteRecord
        );
        Logger.info("✅ 已从远端增量合并数据到本地完整记录");
      } else {
        Logger.info("ℹ️ 远端暂无数据，跳过同步");
      }

      // 2. 初始化翻译管理器
      this.scanProgress.update("🔧 初始化翻译管理器...");
      await this.translationManager.initialize();

      // 3. 扫描文件
      this.scanProgress.update("📁 扫描项目文件...");
      const files = await this.fileScanner.scanFiles();

      // 4. 并行处理：收集引用 + 转换翻译 + 检查导入路径
      this.scanProgress.showReferenceCollection();
      const { allReferences, newTranslations } = await this.processFiles(files);

      // 4.5. 如果没有新翻译但检测到了路径变更，记录相关信息
      if (newTranslations.length === 0 && allReferences.size > 0) {
        Logger.info("🔍 没有发现新翻译，但已检查并更新了导入路径（如果需要）");
      }

      // 5&6. 检测无用Key、确认删除并生成处理后的完整记录
      this.scanProgress.info("🔍 检测无用Key并等待用户确认...");
      const { totalUnusedKeys, processedRecord, previewFilePath } =
        await this.deleteService.detectUnusedKeysAndGenerateRecord(
          allReferences
        );

      // 重新启动进度条
      await this.scanProgress.start("🔄 处理删除结果...");
      // 记录预览文件用于清理
      if (previewFilePath) {
        this.previewFilesToCleanup.push(previewFilePath);
      }

      // 7. 基于处理后的完整记录生成模块化翻译文件
      this.scanProgress.update("🔧 生成模块化翻译文件...");
      await this.translationManager.generateModularFilesFromCompleteRecord();

      // 8. 用户确认是否同步到远端
      const resumeProgress =
        this.scanProgress.pauseForInteraction("🤔 等待用户确认远端同步...");
      const shouldSyncToRemote = await UserInteraction.confirmRemoteSync();
      await resumeProgress();

      if (shouldSyncToRemote) {
        // 9. 同步到远端 (Google Sheets) - 基于处理后的 CompleteRecord
        this.scanProgress.update("☁️ 同步到 Google Sheets...");
        const finalCompleteRecord =
          await this.translationManager.loadCompleteRecord();
        await this.googleSheetsSync.syncCompleteRecordToSheet(
          finalCompleteRecord
        );
      } else {
        this.scanProgress.update("⏭️ 跳过远端同步");
        Logger.info("⏭️ 用户选择跳过远端同步");
      }

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      this.scanProgress.showScanComplete({
        totalFiles: files.length,
        totalKeys: allReferences.size,
        newKeys: newTranslations.length,
        unusedKeys: totalUnusedKeys,
        duration: endTime - startTime,
      });

      // 清理预览文件
      await this.deleteService.cleanupPreviewFiles(this.previewFilesToCleanup);
      this.previewFilesToCleanup = [];
    } catch (error) {
      this.scanProgress.fail("❌ 扫描过程中发生错误");
      throw error;
    }
  }

  /**
   * 并行处理文件：收集引用 + 转换翻译
   */
  private async processFiles(files: string[]): Promise<{
    allReferences: Map<string, ExistingReference[]>;
    newTranslations: TransformResult[];
  }> {
    const allReferences = new Map<string, ExistingReference[]>();
    const newTranslations: TransformResult[] = [];

    Logger.info(`🔍 开始处理 ${files.length} 个文件...`);

    for (const file of files) {
      Logger.debug(`📁 [DEBUG] 正在处理文件: ${file}`);

      // 使用新的分析和转换方法，包含导入路径验证
      const analysisResult = await this.fileTransformer.analyzeAndTransformFile(
        file
      );

      Logger.debug(`📋 [DEBUG] 文件分析结果:`);
      Logger.debug(`  - 现有引用: ${analysisResult.existingReferences.length}`);
      Logger.debug(`  - 新翻译: ${analysisResult.newTranslations.length}`);

      // 收集现有引用
      analysisResult.existingReferences.forEach((ref) => {
        if (!allReferences.has(ref.key)) {
          allReferences.set(ref.key, []);
        }

        // 检查重复引用
        const existingRefs = allReferences.get(ref.key)!;
        const isDuplicate = existingRefs.some(
          (existingRef) =>
            existingRef.filePath === ref.filePath &&
            existingRef.lineNumber === ref.lineNumber &&
            existingRef.columnNumber === ref.columnNumber
        );

        if (!isDuplicate) {
          existingRefs.push(ref);
        }
      });

      // 收集新翻译
      newTranslations.push(...analysisResult.newTranslations);

      // 记录处理结果
      if (analysisResult.newTranslations.length > 0) {
        Logger.info(
          `📝 在 ${file} 中发现 ${analysisResult.newTranslations.length} 个新翻译`
        );
      }

      // 如果有现有引用但没有新翻译，可能是路径更新场景
      if (
        analysisResult.existingReferences.length > 0 &&
        analysisResult.newTranslations.length === 0
      ) {
        Logger.debug(`🔧 文件 ${file} 包含现有翻译引用，已检查导入路径`);
      }
    }

    // 保存到实例变量供后续使用
    this.referencesMap = allReferences;

    Logger.info(`✅ 文件处理完成，共处理 ${files.length} 个文件`);
    Logger.info(
      `📊 统计: ${allReferences.size} 个引用keys, ${newTranslations.length} 个新翻译`
    );

    return { allReferences, newTranslations };
  }
}
