import type { I18nConfig } from "../types";
import type { ExistingReference } from "./AstTransformer";
import type { CompleteTranslationRecord } from "./TranslationManager";
import { TranslationManager } from "./TranslationManager";
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
  private previewFileService: PreviewFileService;

  constructor(
    private config: I18nConfig,
    translationManager: TranslationManager
  ) {
    this.translationManager = translationManager;
    this.previewFileService = new PreviewFileService(config);
  }

  /**
   * 检查CompleteRecord中的key是否被强制保留
   * 用于无用Key检测时的强制保留检查
   */
  private isKeyForceKeptInCompleteRecord(
    key: string,
    completeRecord: CompleteTranslationRecord
  ): boolean {
    if (!this.config.forceKeepKeys) {
      return false;
    }

    // 在完整记录中查找包含该key的模块
    for (const [modulePath, moduleKeys] of Object.entries(completeRecord)) {
      if (moduleKeys[key]) {
        // 检查该模块是否配置了强制保留该key
        const forceKeepKeys = this.config.forceKeepKeys;
        if (forceKeepKeys && modulePath in forceKeepKeys) {
          const forceKeepList = forceKeepKeys[modulePath];
          if (forceKeepList && forceKeepList.includes(key)) {
            return true;
          }
        }
      }
    }

    return false;
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
    deletedKeys?: string[]; // 新增：返回被删除的key列表
  }> {
    try {
      // 1. 读取现有的完整记录
      const existingCompleteRecord =
        await this.translationManager.loadCompleteRecord();

      Logger.info(`🔍 开始检测无用Key...`);
      // Logger.info(`🔗 当前扫描发现 ${allReferences.size} 个引用Key`);

      // 2. 如果没有现有记录，直接生成新记录
      if (
        !existingCompleteRecord ||
        Object.keys(existingCompleteRecord).length === 0
      ) {
        Logger.info("ℹ️ 暂无现有完整记录，直接生成新记录");
        await this.translationManager.saveCompleteRecord(allReferences);
        const newRecord = await this.translationManager.loadCompleteRecord();
        return {
          totalUnusedKeys: 0,
          processedRecord: newRecord,
          deletedKeys: [],
        };
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
        return {
          totalUnusedKeys: 0,
          processedRecord: updatedRecord,
          deletedKeys: [],
        };
      }

      // 5. 用户选择要删除的Key
      const selectedKeysForDeletion =
        await UserInteraction.selectKeysForDeletion(
          formattedFilteredUnusedKeys
        );

      // 如果用户没有选择任何Key，跳过删除
      if (selectedKeysForDeletion.length === 0) {
        Logger.info("ℹ️ 用户未选择任何Key进行删除，保留所有无用Key");
        const processedRecord = await this.preserveUnusedKeys(allReferences);
        return { totalUnusedKeys, processedRecord, deletedKeys: [] };
      }

      // 6. 根据用户选择过滤要删除的Key
      const { actualKeysToDelete, filteredFormattedKeys } =
        this.filterKeysByUserSelection(
          selectedKeysForDeletion,
          unusedKeysAnalysis.filteredUnusedKeys,
          formattedFilteredUnusedKeys,
          existingCompleteRecord
        );

      // 7. 生成删除预览
      const previewPath = await this.generateDeletePreview(
        filteredFormattedKeys,
        existingCompleteRecord
      );

      // 8. 用户确认删除
      const shouldDelete = await UserInteraction.confirmDeletion(
        filteredFormattedKeys,
        previewPath
      );

      if (shouldDelete) {
        // 9a. 执行删除操作
        const processedRecord = await this.executeKeyDeletion(
          existingCompleteRecord,
          allReferences,
          previewPath
        );
        return {
          totalUnusedKeys: 0,
          processedRecord,
          previewFilePath: previewPath,
          deletedKeys: actualKeysToDelete, // 返回实际删除的key列表
        };
      } else {
        // 9b. 取消删除，保留无用Key
        const processedRecord = await this.preserveUnusedKeys(allReferences);
        return {
          totalUnusedKeys: selectedKeysForDeletion.length,
          processedRecord,
          previewFilePath: previewPath,
          deletedKeys: [], // 取消删除，没有删除任何key
        };
      }
    } catch (error) {
      Logger.error(`检测无用Key时发生错误: ${error}`);
      // 发生错误时，直接生成新记录
      await this.translationManager.saveCompleteRecord(allReferences);
      const errorRecord = await this.translationManager.loadCompleteRecord();
      return {
        totalUnusedKeys: 0,
        processedRecord: errorRecord,
        deletedKeys: [],
      };
    }
  }

  /**
   * 根据用户选择过滤要删除的Key
   * @param selectedFormattedKeys 用户选择的格式化Key列表
   * @param allFilteredUnusedKeys 所有过滤后的无用Key
   * @param allFormattedKeys 所有格式化的Key列表
   * @param existingCompleteRecord 现有完整记录
   * @returns 实际要删除的Key和过滤后的格式化Key
   */
  private filterKeysByUserSelection(
    selectedFormattedKeys: string[],
    allFilteredUnusedKeys: string[],
    allFormattedKeys: string[],
    existingCompleteRecord: CompleteTranslationRecord
  ): {
    actualKeysToDelete: string[];
    filteredFormattedKeys: string[];
  } {
    const selectedSet = new Set(selectedFormattedKeys);
    const actualKeysToDelete: string[] = [];

    // 根据用户选择的格式化Key，提取实际的Key
    Object.entries(existingCompleteRecord).forEach(
      ([modulePath, moduleKeys]) => {
        Object.keys(moduleKeys).forEach((key) => {
          const formattedKey = `[${modulePath}][${key}]`;
          if (
            selectedSet.has(formattedKey) &&
            allFilteredUnusedKeys.includes(key)
          ) {
            actualKeysToDelete.push(key);
          }
        });
      }
    );

    // 过滤格式化Key列表，只保留用户选择的
    const filteredFormattedKeys = allFormattedKeys.filter((key) =>
      selectedSet.has(key)
    );

    return {
      actualKeysToDelete,
      filteredFormattedKeys,
    };
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

    // Logger.info(`📖 完整记录包含 ${existingKeys.size} 个Key`);
    // Logger.info(`🔗 当前扫描发现 ${currentKeys.size} 个Key`);

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
      (key) => !this.isKeyForceKeptInCompleteRecord(key, existingCompleteRecord)
    );
    const forceKeptKeys = unusedKeys.filter((key) =>
      this.isKeyForceKeptInCompleteRecord(key, existingCompleteRecord)
    );

    // 构建带模块路径的Key列表用于显示
    // 注意：这里需要显示实际的key实例数量，包括在多个模块中重复的key
    const formattedFilteredUnusedKeys: string[] = [];
    const actualKeyInstances: string[] = [];

    // 从完整记录中找出所有要删除的key实例
    Object.entries(existingCompleteRecord).forEach(
      ([modulePath, moduleKeys]) => {
        Object.keys(moduleKeys).forEach((key) => {
          if (filteredUnusedKeys.includes(key)) {
            formattedFilteredUnusedKeys.push(`[${modulePath}][${key}]`);
            actualKeyInstances.push(key);
          }
        });
      }
    );
    const formattedForceKeptKeys = forceKeptKeys.map(
      (key) => `[${keyToModuleMap[key]}][${key}]`
    );

    const totalUnusedKeys = formattedFilteredUnusedKeys.length; // 使用实际实例数量

    Logger.info(`🗑️ 发现 ${totalUnusedKeys} 个可删除的无用Key`);

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
   * @param filteredFormattedKeys 过滤后的格式化Key列表，格式为 [modulePath][key]
   * @param existingCompleteRecord 现有完整记录
   * @returns 预览文件路径
   */
  private async generateDeletePreview(
    filteredFormattedKeys: string[],
    existingCompleteRecord: CompleteTranslationRecord
  ): Promise<string> {
    return await this.previewFileService.generateDeletePreviewFromCompleteRecord(
      filteredFormattedKeys,
      existingCompleteRecord
    );
  }

  /**
   * 执行Key删除操作 - 基于预览文件精确删除
   * @param existingCompleteRecord 现有完整记录
   * @param allReferences 当前引用
   * @param previewFilePath 预览文件路径
   * @returns 处理后的记录
   */
  private async executeKeyDeletion(
    existingCompleteRecord: CompleteTranslationRecord,
    allReferences: Map<string, ExistingReference[]>,
    previewFilePath: string
  ): Promise<CompleteTranslationRecord> {
    Logger.info("✅ 用户确认删除无用Key");

    // 读取预览文件内容
    let previewRecord: CompleteTranslationRecord;
    try {
      const previewContent = await fs.promises.readFile(
        previewFilePath,
        "utf-8"
      );
      previewRecord = JSON.parse(previewContent);
    } catch (error) {
      Logger.error(`读取或解析预览文件失败: ${error}`);
      throw new Error(`无法处理预览文件 ${previewFilePath}: ${error}`);
    }

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
