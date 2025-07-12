import type { I18nConfig } from "../types";
import type { ExistingReference } from "./AstTransformer";
import type { CompleteTranslationRecord } from "./TranslationManager";
import { TranslationManager } from "./TranslationManager";
import { UnusedKeyAnalyzer } from "./UnusedKeyAnalyzer";
import { PreviewFileService } from "./PreviewFileService";
import { UserInteraction } from "../ui/UserInteraction";
import { Logger } from "../utils/StringUtils";
import * as fs from "fs";

/**
 * 删除服务
 * 专门处理无用翻译Key的检测、删除和记录更新
 */
export class DeleteService {
  private translationManager: TranslationManager;
  private unusedKeyAnalyzer: UnusedKeyAnalyzer;
  private previewFileService: PreviewFileService;

  constructor(
    private config: I18nConfig,
    translationManager: TranslationManager,
    unusedKeyAnalyzer: UnusedKeyAnalyzer
  ) {
    this.translationManager = translationManager;
    this.unusedKeyAnalyzer = unusedKeyAnalyzer;
    this.previewFileService = new PreviewFileService(config);
  }

  /**
   * 检测无用Key、确认删除并生成处理后的完整记录
   * @param allReferences 当前扫描发现的所有引用
   * @returns 处理结果
   */
  async detectUnusedKeysAndGenerateRecord(
    allReferences: Map<string, ExistingReference[]>
  ): Promise<{
    totalUnusedKeys: number;
    processedRecord: any;
    previewFilePath?: string;
  }> {
    try {
      // 1. 读取现有的完整记录
      const existingCompleteRecord =
        await this.translationManager.loadCompleteRecord();

      Logger.info(`🔍 开始检测无用Key...`);
      Logger.info(`🔗 当前扫描发现 ${allReferences.size} 个引用Key`);

      // 2. 如果没有现有记录，直接生成新记录
      if (
        !existingCompleteRecord ||
        Object.keys(existingCompleteRecord).length === 0
      ) {
        Logger.info("ℹ️ 暂无现有完整记录，直接生成新记录");
        await this.translationManager.saveCompleteRecord(allReferences);
        const newRecord = await this.translationManager.loadCompleteRecord();
        return { totalUnusedKeys: 0, processedRecord: newRecord };
      }

      // 3. 分析无用Key
      const unusedKeysAnalysis = this.analyzeUnusedKeys(
        existingCompleteRecord,
        allReferences
      );

      const { totalUnusedKeys, formattedFilteredUnusedKeys } =
        unusedKeysAnalysis;

      // 4. 如果没有无用Key，直接更新记录
      if (totalUnusedKeys === 0) {
        Logger.info("✅ 所有翻译Key都在使用中，无需清理");
        await this.translationManager.saveCompleteRecord(allReferences);
        const updatedRecord =
          await this.translationManager.loadCompleteRecord();
        return { totalUnusedKeys: 0, processedRecord: updatedRecord };
      }

      // 5. 生成删除预览
      const previewPath = await this.generateDeletePreview(
        unusedKeysAnalysis.filteredUnusedKeys,
        existingCompleteRecord
      );

      // 6. 用户确认删除
      const shouldDelete = await UserInteraction.confirmDeletion(
        formattedFilteredUnusedKeys,
        previewPath
      );

      if (shouldDelete) {
        // 7a. 执行删除操作
        const processedRecord = await this.executeKeyDeletion(
          existingCompleteRecord,
          unusedKeysAnalysis.filteredUnusedKeys,
          allReferences,
          previewPath
        );
        return {
          totalUnusedKeys: 0,
          processedRecord,
          previewFilePath: previewPath,
        };
      } else {
        // 7b. 取消删除，保留无用Key
        const processedRecord = await this.preserveUnusedKeys(allReferences);
        return {
          totalUnusedKeys,
          processedRecord,
          previewFilePath: previewPath,
        };
      }
    } catch (error) {
      Logger.error(`检测无用Key时发生错误: ${error}`);
      // 发生错误时，直接生成新记录
      await this.translationManager.saveCompleteRecord(allReferences);
      const errorRecord = await this.translationManager.loadCompleteRecord();
      return { totalUnusedKeys: 0, processedRecord: errorRecord };
    }
  }

  /**
   * 分析无用Key
   * @param existingCompleteRecord 现有完整记录
   * @param allReferences 当前引用
   * @returns 分析结果
   */
  private analyzeUnusedKeys(
    existingCompleteRecord: CompleteTranslationRecord,
    allReferences: Map<string, ExistingReference[]>
  ) {
    // 提取完整记录中的所有Key
    const existingKeys = new Set<string>();
    Object.values(existingCompleteRecord).forEach((moduleKeys) => {
      Object.keys(moduleKeys).forEach((key) => {
        existingKeys.add(key);
      });
    });

    // 提取当前扫描到的所有Key
    const currentKeys = new Set(allReferences.keys());

    Logger.info(`📖 完整记录包含 ${existingKeys.size} 个Key`);
    Logger.info(`🔗 当前扫描发现 ${currentKeys.size} 个Key`);

    // 找出无用的Key（在完整记录中但不在当前扫描中）
    const unusedKeys = Array.from(existingKeys).filter(
      (key) => !currentKeys.has(key)
    );

    // 构建Key到模块路径的映射
    const keyToModuleMap: { [key: string]: string } = {};
    Object.entries(existingCompleteRecord).forEach(
      ([modulePath, moduleKeys]) => {
        Object.keys(moduleKeys).forEach((key) => {
          keyToModuleMap[key] = modulePath;
        });
      }
    );

    // 过滤掉强制保留的Key
    const filteredUnusedKeys = unusedKeys.filter(
      (key) =>
        !this.unusedKeyAnalyzer.isKeyForceKeptInCompleteRecord(
          key,
          existingCompleteRecord
        )
    );
    const forceKeptKeys = unusedKeys.filter((key) =>
      this.unusedKeyAnalyzer.isKeyForceKeptInCompleteRecord(
        key,
        existingCompleteRecord
      )
    );

    // 构建带模块路径的Key列表用于显示
    const formattedFilteredUnusedKeys = filteredUnusedKeys.map(
      (key) => `[${keyToModuleMap[key]}][${key}]`
    );
    const formattedForceKeptKeys = forceKeptKeys.map(
      (key) => `[${keyToModuleMap[key]}][${key}]`
    );

    const totalUnusedKeys = filteredUnusedKeys.length;

    Logger.info(
      `🗑️ 发现 ${unusedKeys.length} 个无用Key，其中 ${totalUnusedKeys} 个可删除，${forceKeptKeys.length} 个强制保留`
    );
    Logger.info(
      `📝 可删除的无用Key: ${formattedFilteredUnusedKeys.join(", ")}`
    );

    if (forceKeptKeys.length > 0) {
      Logger.info(`🔒 强制保留的Key: ${formattedForceKeptKeys.join(", ")}`);
    }

    return {
      unusedKeys,
      filteredUnusedKeys,
      forceKeptKeys,
      formattedFilteredUnusedKeys,
      formattedForceKeptKeys,
      totalUnusedKeys,
      keyToModuleMap,
    };
  }

  /**
   * 生成删除预览文件
   * @param filteredUnusedKeys 过滤后的无用Key列表
   * @param existingCompleteRecord 现有完整记录
   * @returns 预览文件路径
   */
  private async generateDeletePreview(
    filteredUnusedKeys: string[],
    existingCompleteRecord: CompleteTranslationRecord
  ): Promise<string> {
    return await this.previewFileService.generateDeletePreviewFromCompleteRecord(
      filteredUnusedKeys,
      existingCompleteRecord
    );
  }

  /**
   * 执行Key删除操作 - 基于预览文件精确删除
   * @param existingCompleteRecord 现有完整记录
   * @param filteredUnusedKeys 要删除的Key列表（已废弃）
   * @param allReferences 当前引用
   * @param previewFilePath 预览文件路径
   * @returns 处理后的记录
   */
  private async executeKeyDeletion(
    existingCompleteRecord: CompleteTranslationRecord,
    filteredUnusedKeys: string[],
    allReferences: Map<string, ExistingReference[]>,
    previewFilePath: string
  ): Promise<CompleteTranslationRecord> {
    Logger.info("✅ 用户确认删除无用Key");

    // 读取预览文件内容
    const previewContent = await fs.promises.readFile(previewFilePath, "utf-8");
    const previewRecord: CompleteTranslationRecord = JSON.parse(previewContent);

    Logger.info(`📄 从预览文件读取删除指令: ${previewFilePath}`);

    // 创建副本进行删除操作
    const recordCopy = JSON.parse(JSON.stringify(existingCompleteRecord));

    // 基于预览文件精确删除keys
    let deletedCount = 0;
    Object.entries(previewRecord).forEach(([modulePath, keysToDelete]) => {
      if (recordCopy[modulePath]) {
        Object.keys(keysToDelete).forEach((keyToDelete) => {
          if (recordCopy[modulePath][keyToDelete]) {
            delete recordCopy[modulePath][keyToDelete];
            deletedCount++;
            Logger.debug(`🗑️ 删除 [${modulePath}][${keyToDelete}]`);
          }
        });

        // 如果模块中没有剩余的key，删除整个模块
        if (Object.keys(recordCopy[modulePath]).length === 0) {
          delete recordCopy[modulePath];
          Logger.debug(`📂 删除空模块: ${modulePath}`);
        }
      }
    });

    Logger.info(`🗑️ 已删除 ${deletedCount} 个无用Key`);

    // 保存删除后的记录，然后合并新的引用
    await this.translationManager.saveCompleteRecordDirect(recordCopy);
    await this.translationManager.mergeWithExistingRecord(allReferences);

    return await this.translationManager.loadCompleteRecord();
  }

  /**
   * 保留无用Key，仅合并新引用
   * @param allReferences 当前引用
   * @returns 处理后的记录
   */
  private async preserveUnusedKeys(
    allReferences: Map<string, ExistingReference[]>
  ): Promise<CompleteTranslationRecord> {
    Logger.info("🚫 用户取消删除操作，保留无用Key");

    // 直接合并现有记录和新引用，保留无用keys
    await this.translationManager.mergeWithExistingRecord(allReferences);

    return await this.translationManager.loadCompleteRecord();
  }

  /**
   * 清理预览文件
   * @param previewFilePaths 预览文件路径列表
   */
  async cleanupPreviewFiles(previewFilePaths: string[]): Promise<void> {
    await this.previewFileService.cleanupPreviewFiles(previewFilePaths);
  }
}
