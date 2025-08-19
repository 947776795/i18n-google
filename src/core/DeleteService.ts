import type { I18nConfig } from "../types";
import type { ExistingReference } from "./AstTransformer";
import type { CompleteTranslationRecord } from "./TranslationManager";
import { TranslationManager } from "./TranslationManager";
import { PreviewFileService } from "./PreviewFileService";
import type { IUserInteraction } from "../ui/IUserInteraction";
import { InquirerInteractionAdapter } from "../ui/InquirerInteractionAdapter";
import { Logger } from "../utils/StringUtils";
import { PathUtils } from "../utils/PathUtils";

/**
 * 删除服务
 * 专门处理无用翻译Key的检测、删除和记录更新
 */
export class DeleteService {
  private translationManager: TranslationManager;
  private previewFileService: PreviewFileService;

  constructor(
    private config: I18nConfig,
    translationManager: TranslationManager,
    private userInteraction: IUserInteraction = new InquirerInteractionAdapter()
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

      // 5. 用户选择要删除的Key（通过注入的 IUserInteraction 控制交互/非交互行为）
      const selectedKeysForDeletion =
        await this.userInteraction.selectKeysForDeletion(
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

      // 8. 用户确认删除（交互方式由 IUserInteraction 决定）
      const shouldDelete = await this.userInteraction.confirmDeletion(
        filteredFormattedKeys,
        previewPath,
        [],
        { testMode: this.config.testMode }
      );

      if (shouldDelete) {
        // 9a. 执行删除操作
        const processedRecord = await this.executeKeyDeletion(
          existingCompleteRecord,
          allReferences,
          actualKeysToDelete
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

    // 现在 allFilteredUnusedKeys 与 allFormattedKeys 都是 [modulePath][key] 形式
    // 过滤格式化Key列表，只保留用户选择的
    const filteredFormattedKeys = allFormattedKeys.filter((key) =>
      selectedSet.has(key)
    );

    // 实际要删除的列表与格式化列表一致，使用 [modulePath][key] 形式
    const actualKeysToDelete = [...filteredFormattedKeys];

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
    // 1) 提取完整记录中的所有 (modulePath, key) 对
    const allExistingPairs: Array<{ modulePath: string; key: string }> = [];
    Object.entries(existingCompleteRecord).forEach(
      ([modulePath, moduleKeys]) => {
        Object.keys(moduleKeys).forEach((key) => {
          allExistingPairs.push({ modulePath, key });
        });
      }
    );

    // 2) 提取当前扫描到的所有 (modulePath, key) 对
    // 为适配不同来源的路径格式（含/不含 rootDir、不同扩展名），
    // 我们使用两种策略：
    //  - A) 基于 PathUtils 转换
    //  - B) 基于 existingCompleteRecord 中的模块路径做 endsWith 匹配
    const usedPairSet = new Set<string>(); // 使用格式: [modulePath][key]

    // 建立 key -> 模块路径列表 的索引，便于快速匹配
    const keyToModulePaths = new Map<string, string[]>();
    Object.entries(existingCompleteRecord).forEach(
      ([modulePath, moduleKeys]) => {
        Object.keys(moduleKeys).forEach((key) => {
          if (!keyToModulePaths.has(key)) keyToModulePaths.set(key, []);
          keyToModulePaths.get(key)!.push(modulePath);
        });
      }
    );

    // 收集“已使用”的 (modulePath,key) 对：先精确匹配，再 endsWith，最后按同名文件兜底
    allReferences.forEach((refs, key) => {
      const candidates = keyToModulePaths.get(key) || [];
      refs.forEach((ref) => {
        const normalizedRef = ref.filePath.replace(/\.(tsx?|jsx?)$/, ".ts");
        const converted = PathUtils.convertFilePathToModulePath(
          ref.filePath,
          this.config
        );

        let matched = false;

        // 1) 精确匹配：转换后的模块路径直接在候选中
        if (candidates.includes(converted)) {
          usedPairSet.add(`[${converted}][${key}]`);
          matched = true;
        }

        // 2) endsWith 兼容匹配
        if (!matched) {
          candidates.forEach((modulePath) => {
            if (normalizedRef.endsWith(modulePath)) {
              usedPairSet.add(`[${modulePath}][${key}]`);
              matched = true;
            }
          });
        }

        // 3) 同名文件兜底：仅当文件名一致时，标记该候选为已用
        if (!matched) {
          const refBase = normalizedRef.split("/").pop();
          candidates.forEach((modulePath) => {
            const modBase = modulePath.split("/").pop();
            if (refBase && modBase && refBase === modBase) {
              usedPairSet.add(`[${modulePath}][${key}]`);
              matched = true;
            }
          });
        }

        // 4) 最终兜底：仍未匹配上时，将候选模块全部视为已用（测试场景下路径可能无法对应）
        if (!matched && candidates.length > 0) {
          candidates.forEach((modulePath) => {
            usedPairSet.add(`[${modulePath}][${key}]`);
          });
        }
      });
    });

    // 3) 找出无用的 (modulePath, key) 对（在完整记录中但不在当前扫描中）
    const unusedPairs: Array<{ modulePath: string; key: string }> = [];
    allExistingPairs.forEach(({ modulePath, key }) => {
      const formatted = `[${modulePath}][${key}]`;
      if (!usedPairSet.has(formatted)) {
        unusedPairs.push({ modulePath, key });
      }
    });

    // 4) 过滤掉强制保留的 (modulePath, key) 对
    const isForceKept = (modulePath: string, key: string): boolean => {
      const forceKeep = this.config.forceKeepKeys || {};
      const list = forceKeep[modulePath] || [];
      return list.includes(key);
    };

    const filteredUnusedPairs = unusedPairs.filter(
      ({ modulePath, key }) => !isForceKept(modulePath, key)
    );
    const forceKeptPairs = unusedPairs.filter(({ modulePath, key }) =>
      isForceKept(modulePath, key)
    );

    // 5) 构建用于展示的格式化列表
    const formattedFilteredUnusedKeys: string[] = filteredUnusedPairs.map(
      ({ modulePath, key }) => `[${modulePath}][${key}]`
    );
    const formattedForceKeptKeys: string[] = forceKeptPairs.map(
      ({ modulePath, key }) => `[${modulePath}][${key}]`
    );

    const totalUnusedKeys = formattedFilteredUnusedKeys.length;

    Logger.info(`🗑️ 发现 ${totalUnusedKeys} 个可删除的无用Key`);

    if (formattedForceKeptKeys.length > 0) {
      Logger.info(`🔒 强制保留的Key: ${formattedForceKeptKeys.join(", ")}`);
    }

    return {
      // 为兼容后续使用，保留字段名，但内容改为“格式化后的 (modulePath,key) 列表或其派生”
      unusedKeys: unusedPairs.map((p) => p.key),
      filteredUnusedKeys: formattedFilteredUnusedKeys, // 注意：现在是格式化后的 [module][key]
      forceKeptKeys: formattedForceKeptKeys,
      formattedFilteredUnusedKeys,
      formattedForceKeptKeys,
      totalUnusedKeys,
      keyToModuleMap: {},
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
    formattedKeysToDelete: string[]
  ): Promise<CompleteTranslationRecord> {
    Logger.info("✅ 用户确认删除无用Key");

    // 创建副本进行删除操作
    const recordCopy = JSON.parse(JSON.stringify(existingCompleteRecord));

    // 基于用户选择的格式化 keys 精确删除
    let deletedCount = 0;
    formattedKeysToDelete.forEach((formatted) => {
      // 解析 "[modulePath][key]"
      if (!formatted.startsWith("[")) return;
      const sep = formatted.indexOf("][");
      if (sep === -1 || !formatted.endsWith("]")) return;
      const modulePath = formatted.substring(1, sep);
      const key = formatted.substring(sep + 2, formatted.length - 1);
      if (recordCopy[modulePath] && recordCopy[modulePath][key]) {
        delete recordCopy[modulePath][key];
        deletedCount++;
        Logger.debug(`🗑️ 删除 [${modulePath}][${key}]`);
        if (Object.keys(recordCopy[modulePath]).length === 0) {
          delete recordCopy[modulePath];
          Logger.debug(`📂 删除空模块: ${modulePath}`);
        }
      }
    });

    Logger.info(`🗑️ 已删除 ${deletedCount} 个无用Key`);

    // 保存删除后的记录，然后合并新的引用（使用内存中的最新记录作为基准，避免测试桩读取旧数据）
    await this.translationManager.saveCompleteRecordDirect(recordCopy);
    const merged = await this.translationManager.mergeWithExistingRecord(
      allReferences,
      recordCopy
    );

    return merged;
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
