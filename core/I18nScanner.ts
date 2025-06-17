import type { I18nConfig } from "../types";
import { FileScanner } from "./FileScanner";
import { FileTransformer } from "./FileTransformer";
import { TranslationManager } from "./TranslationManager";
import { GoogleSheetsSync } from "./GoogleSheetsSync";
import { RecordManager } from "./RecordManager";
import { UnusedKeyAnalyzer } from "./UnusedKeyAnalyzer";
import { KeyDeletionService } from "./KeyDeletionService";
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
  private recordManager: RecordManager;
  private unusedKeyAnalyzer: UnusedKeyAnalyzer;
  private keyDeletionService: KeyDeletionService;
  private referencesMap: Map<string, ExistingReference[]> = new Map();
  private scanProgress: ScanProgressIndicator;

  constructor(private config: I18nConfig) {
    // 设置日志级别
    Logger.setLogLevel(config.logLevel || "normal");

    this.fileScanner = new FileScanner(config);
    this.fileTransformer = new FileTransformer(config);
    this.translationManager = new TranslationManager(config);
    this.googleSheetsSync = new GoogleSheetsSync(config);
    this.recordManager = new RecordManager(config);
    this.unusedKeyAnalyzer = new UnusedKeyAnalyzer(config);
    this.keyDeletionService = new KeyDeletionService(
      config,
      this.translationManager,
      this.googleSheetsSync,
      this.recordManager,
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

      // 1. 初始化翻译管理器
      this.scanProgress.update("🔧 初始化翻译管理器...");
      await this.translationManager.initialize();

      // 2. 扫描文件
      this.scanProgress.update("📁 扫描项目文件...");
      const files = await this.fileScanner.scanFiles();

      // 3. 并行处理：收集引用 + 转换翻译
      this.scanProgress.showReferenceCollection();
      const { allReferences, newTranslations } = await this.processFiles(files);

      // 4. 生成完整记录
      this.scanProgress.update("📝 生成完整记录...");
      await this.recordManager.generateCompleteRecord(
        allReferences,
        newTranslations,
        this.translationManager.getTranslations()
      );

      // 5. 从 Google Sheets 同步翻译
      this.scanProgress.showGoogleSheetsSync();
      const remoteTranslations = await this.googleSheetsSync.syncFromSheet();
      this.translationManager.updateTranslations(remoteTranslations);

      // 6. 保存翻译文件
      this.scanProgress.update("💾 保存翻译文件...");
      await this.translationManager.saveTranslations();

      // 7. 同步到 Google Sheets
      this.scanProgress.update("☁️  同步到 Google Sheets...");
      await this.googleSheetsSync.syncToSheet(
        this.translationManager.getTranslations()
      );

      // 完成主要扫描流程
      const duration = Date.now() - startTime;
      const allDefinedKeys = this.getAllDefinedKeys();
      const keyStats = this.unusedKeyAnalyzer.getKeyStatistics(
        allDefinedKeys,
        allReferences
      );

      this.scanProgress.showScanComplete({
        totalFiles: files.length,
        totalKeys: keyStats.totalKeys,
        newKeys: newTranslations.length,
        unusedKeys: keyStats.unusedKeys,
        duration,
      });

      // 显示扫描摘要
      UserInteraction.displayScanSummary({
        totalFiles: files.length,
        totalKeys: keyStats.totalKeys,
        newKeys: newTranslations.length,
        unusedKeys: keyStats.unusedKeys,
        duration,
      });

      // 8. 检测无用Key并提供删除选项
      if (keyStats.unusedKeys > 0) {
        await this.keyDeletionService.detectAndHandleUnusedKeys(
          allDefinedKeys,
          allReferences
        );
      }
    } catch (error) {
      this.scanProgress.fail("❌ 扫描过程中发生错误");
      ErrorHandler.handle(error as Error, "scan");
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
      Logger.debug("\n📂 [DEBUG] 处理文件:", file);

      // 使用扩展的分析方法，同时获取现有引用和新翻译
      const analysisResult = await this.fileTransformer.analyzeAndTransformFile(
        file
      );

      Logger.debug("📊 [DEBUG] 分析结果:");
      Logger.debug("  - 现有引用数:", analysisResult.existingReferences.length);
      Logger.debug("  - 新翻译数:", analysisResult.newTranslations.length);

      if (analysisResult.existingReferences.length > 0) {
        Logger.debug(
          "  - 现有引用keys:",
          analysisResult.existingReferences.map((r) => r.key)
        );
      }

      if (analysisResult.newTranslations.length > 0) {
        Logger.info(
          `📝 在 ${file} 中发现 ${analysisResult.newTranslations.length} 个新翻译`
        );
        Logger.debug(
          "  - 新翻译keys:",
          analysisResult.newTranslations.map((t) => t.key)
        );
      }

      // 1. 收集现有引用
      analysisResult.existingReferences.forEach((ref) => {
        if (!allReferences.has(ref.key)) {
          allReferences.set(ref.key, []);
        }
        allReferences.get(ref.key)!.push(ref);
        Logger.debug(
          `  ✅ [DEBUG] 添加现有引用: ${ref.key} -> ${ref.filePath}:${ref.lineNumber}`
        );
      });

      // 2. 处理新翻译
      analysisResult.newTranslations.forEach((result) => {
        this.translationManager.addTranslation(result);
        newTranslations.push(result);
        Logger.debug(
          `  📝 [DEBUG] 添加新翻译: ${result.key} -> "${result.text}"`
        );
      });

      // 3. 收集新翻译的引用位置（通过重新分析转换后的代码）
      if (analysisResult.newTranslations.length > 0) {
        Logger.debug("🔄 [DEBUG] 开始收集新翻译的引用位置...");

        // 添加小延迟确保文件写入完成
        await new Promise((resolve) => setTimeout(resolve, 50));

        const newRefs = await this.fileTransformer.collectFileReferences(file);
        Logger.debug("📋 [DEBUG] 重新扫描文件得到的引用数:", newRefs.length);

        if (newRefs.length > 0) {
          Logger.debug(
            "📋 [DEBUG] 重新扫描得到的所有keys:",
            newRefs.map((r) => r.key)
          );
        }

        newRefs.forEach((ref) => {
          Logger.debug(
            `🔍 [DEBUG] 检查引用: ${ref.key} -> ${ref.filePath}:${ref.lineNumber}`
          );

          // 只添加新生成的引用（通过检查是否在新翻译列表中）
          const isNewTranslation = analysisResult.newTranslations.some(
            (newTrans) => newTrans.key === ref.key
          );

          Logger.debug(`  📌 [DEBUG] 是否为新翻译: ${isNewTranslation}`);

          if (isNewTranslation) {
            if (!allReferences.has(ref.key)) {
              allReferences.set(ref.key, []);
              Logger.debug(`  🆕 [DEBUG] 为key创建新的引用数组: ${ref.key}`);
            }
            // 检查是否已经存在相同的引用
            const existingRefs = allReferences.get(ref.key)!;
            const isDuplicate = existingRefs.some(
              (existingRef) =>
                existingRef.filePath === ref.filePath &&
                existingRef.lineNumber === ref.lineNumber &&
                existingRef.columnNumber === ref.columnNumber
            );

            Logger.debug(`  🔄 [DEBUG] 是否重复引用: ${isDuplicate}`);

            if (!isDuplicate) {
              existingRefs.push(ref);
              Logger.debug(
                `  ✅ [DEBUG] 成功添加新引用: ${ref.key} -> ${ref.filePath}:${ref.lineNumber}`
              );
              Logger.debug(
                `  📊 [DEBUG] 该key当前引用数: ${existingRefs.length}`
              );
            }
          }
        });
      }

      Logger.debug(
        `📈 [DEBUG] 文件 ${file} 处理完成，当前总引用数: ${allReferences.size}`
      );
    }

    // 保存到实例变量供后续使用
    this.referencesMap = allReferences;

    Logger.info(`✅ 文件处理完成，共处理 ${files.length} 个文件`);
    Logger.debug("\n🎯 [DEBUG] 所有文件处理完成:");
    Logger.debug("  - 总引用map大小:", allReferences.size);
    Logger.debug("  - 总新翻译数:", newTranslations.length);

    // 打印每个key的引用情况
    Logger.debug("\n📋 [DEBUG] 最终引用统计:");
    allReferences.forEach((refs, key) => {
      Logger.debug(
        `  ${key}: ${refs.length} 个引用 -> [${refs
          .map((r) => `${r.filePath}:${r.lineNumber}`)
          .join(", ")}]`
      );
    });

    // 检查新翻译的引用情况
    Logger.debug("\n🆕 [DEBUG] 新翻译引用检查:");
    newTranslations.forEach((newTrans) => {
      const refs = allReferences.get(newTrans.key) || [];
      Logger.debug(
        `  ${newTrans.key} ("${newTrans.text}"): ${refs.length} 个引用`
      );
      if (refs.length === 0) {
        Logger.warn(`  ⚠️  新翻译 ${newTrans.key} 没有找到引用！`);
      }
    });

    return { allReferences, newTranslations };
  }

  /**
   * 获取所有定义的Key
   */
  private getAllDefinedKeys(): string[] {
    const translations = this.translationManager.getTranslations();
    const allKeys = new Set<string>();

    // 从所有语言的翻译文件中收集Key
    Object.values(translations).forEach((langTranslations: any) => {
      Object.keys(langTranslations).forEach((key) => allKeys.add(key));
    });

    return Array.from(allKeys);
  }
}
