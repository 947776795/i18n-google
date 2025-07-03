import type { I18nConfig } from "../types";
import { FileScanner } from "./FileScanner";
import { FileTransformer } from "./FileTransformer";
import { TranslationManager } from "./TranslationManager";
import { GoogleSheetsSync } from "./GoogleSheetsSync";
import { UnusedKeyAnalyzer } from "./UnusedKeyAnalyzer";
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
  private unusedKeyAnalyzer: UnusedKeyAnalyzer;
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
    this.unusedKeyAnalyzer = new UnusedKeyAnalyzer(config);
    this.deleteService = new DeleteService(
      config,
      this.translationManager,
      this.unusedKeyAnalyzer
    );
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

      // 4. 并行处理：收集引用 + 转换翻译
      this.scanProgress.showReferenceCollection();
      const { allReferences, newTranslations } = await this.processFiles(files);

      // 5&6. 检测无用Key、确认删除并生成处理后的完整记录
      this.scanProgress.update("🔍 检测无用Key并生成完整记录...");
      const { totalUnusedKeys, processedRecord, previewFilePath } =
        await this.deleteService.detectUnusedKeysAndGenerateRecord(
          allReferences
        );

      // 记录预览文件用于清理
      if (previewFilePath) {
        this.previewFilesToCleanup.push(previewFilePath);
      }

      // 7. 基于处理后的完整记录生成模块化翻译文件
      this.scanProgress.update("🔧 生成模块化翻译文件...");
      await this.translationManager.generateModularFilesFromCompleteRecord();

      // 8. 用户确认是否同步到远端
      this.scanProgress.update("🤔 等待用户确认远端同步...");
      const shouldSyncToRemote = await UserInteraction.confirmRemoteSync();

      if (shouldSyncToRemote) {
        // 9. 同步到远端 (Google Sheets) - 基于处理后的 CompleteRecord
        this.scanProgress.update("☁️ 同步到 Google Sheets...");
        await this.googleSheetsSync.syncCompleteRecordToSheet(processedRecord);
      } else {
        this.scanProgress.update("⏭️ 跳过远端同步");
        Logger.info("⏭️ 用户选择跳过远端同步");
      }

      // 完成主要扫描流程
      const duration = Date.now() - startTime;

      this.scanProgress.showScanComplete({
        totalFiles: files.length,
        totalKeys: this.referencesMap.size,
        newKeys: newTranslations.length,
        unusedKeys: totalUnusedKeys,
        duration,
      });

      // 显示扫描摘要
      UserInteraction.displayScanSummary({
        totalFiles: files.length,
        totalKeys: this.referencesMap.size,
        newKeys: newTranslations.length,
        unusedKeys: totalUnusedKeys,
        duration,
      });
    } catch (error) {
      this.scanProgress.fail("❌ 扫描过程中发生错误");
      ErrorHandler.handle(error as Error, "scan");
      throw error;
    } finally {
      // 清理临时的delete-preview文件
      await this.deleteService.cleanupPreviewFiles(this.previewFilesToCleanup);
      this.previewFilesToCleanup = [];
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
      Logger.debug(`📂 处理文件: ${file}`);

      // 使用扩展的分析方法，同时获取现有引用和新翻译
      const analysisResult = await this.fileTransformer.analyzeAndTransformFile(
        file
      );

      // 收集现有引用
      analysisResult.existingReferences.forEach((ref) => {
        if (!allReferences.has(ref.key)) {
          allReferences.set(ref.key, []);
        }
        allReferences.get(ref.key)!.push(ref);
      });

      // 收集新翻译
      analysisResult.newTranslations.forEach((result) => {
        newTranslations.push(result);
      });

      // 如果有新翻译，收集新生成的引用位置
      if (analysisResult.newTranslations.length > 0) {
        Logger.info(
          `📝 在 ${file} 中发现 ${analysisResult.newTranslations.length} 个新翻译`
        );

        // 重新扫描文件获取新的引用位置
        const newRefs = await this.fileTransformer.collectFileReferences(file);

        // 只添加新翻译对应的引用
        const newTranslationKeys = new Set(
          analysisResult.newTranslations.map((t) => t.key)
        );

        newRefs.forEach((ref) => {
          if (newTranslationKeys.has(ref.key)) {
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
          }
        });
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
