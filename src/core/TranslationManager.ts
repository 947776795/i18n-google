import path from "path";
import fs from "fs";
// Prefer fs.promises so tests that mock "fs" intercept correctly
import type { I18nConfig } from "../types";
import type { TransformResult } from "./AstTransformer";
import { GoogleSheetsSync } from "./GoogleSheetsSync";
import { I18nError, I18nErrorType } from "../errors/I18nError";
import { PathUtils } from "../utils/PathUtils";
import { llmTranslate } from "../utils/llmTranslate";
import { Logger } from "../utils/StringUtils";

export interface TranslationMap {
  [key: string]: string;
}

// 新增：模块化翻译相关类型定义
export interface ModuleTranslations {
  [locale: string]: { [key: string]: string };
}

export interface ModularTranslationData {
  [modulePath: string]: ModuleTranslations;
}

// 新的完整记录格式
export interface CompleteTranslationRecord {
  [translationPath: string]: {
    [translationKey: string]: {
      [languageKey: string]: string;
    } & {
      mark?: number; // 添加mark字段，可选，默认为0
    };
  };
}

export class TranslationManager {
  private googleSheetsSync: GoogleSheetsSync;

  constructor(private config: I18nConfig) {
    this.googleSheetsSync = new GoogleSheetsSync(config);
  }

  /**
   * 初始化翻译管理器
   */
  public async initialize(): Promise<void> {
    try {
      await this.checkOutputDir();
    } catch (error) {
      if (error instanceof I18nError) {
        throw error;
      }
      throw new I18nError(
        I18nErrorType.INITIALIZATION_ERROR,
        "翻译管理器初始化失败",
        { originalError: error },
        ["检查配置文件是否正确", "确认输出目录权限", "检查翻译文件格式"]
      );
    }
  }

  /**
   * 保存翻译到文件（已禁用，现在使用模块化翻译文件）
   */
  public async saveTranslations(): Promise<void> {
    // 模块化翻译系统不再需要生成语言JSON文件
    // 翻译文件现在通过 generateModularFilesFromCompleteRecord() 生成
    Logger.info("🔄 使用模块化翻译文件，跳过语言JSON文件生成");
  }

  /**
   * 检查输出目录
   */
  private async checkOutputDir(): Promise<void> {
    const dir = path.join(process.cwd(), this.config.outputDir);
    try {
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
    } catch (error) {
      throw new I18nError(
        I18nErrorType.PERMISSION_ERROR,
        `无法创建输出目录: ${dir}`,
        { directory: dir, originalError: error },
        ["检查目录权限", "确认父目录是否存在", "尝试手动创建目录"]
      );
    }
  }

  // ========== 模块化翻译相关方法 ==========

  /**
   * 按模块路径分组翻译数据
   * 现在基于 CompleteRecord 而不是 TranslationData
   */
  private groupTranslationsByModule(
    allReferences: Map<string, any[]>
  ): ModularTranslationData {
    const modularData: ModularTranslationData = {};

    // 从 CompleteRecord 加载数据而不是从 this.translations
    Logger.info(
      "🔄 模块化翻译数据现在直接基于 CompleteRecord，此方法可能不再需要"
    );

    return modularData;
  }

  /**
   * 保存新格式的完整记录
   */
  async saveCompleteRecord(allReferences: Map<string, any[]>): Promise<void> {
    const completeRecord = await this.buildCompleteRecord(allReferences);

    // 确保输出目录存在
    await fs.promises.mkdir(this.config.outputDir, { recursive: true });

    const outputPath = path.join(
      this.config.outputDir,
      "i18n-complete-record.json"
    );
    const normalized = this.normalizeCompleteRecord(completeRecord);
    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(normalized, null, 2),
      "utf-8"
    );
  }

  /**
   * 合并新引用与现有记录，保留用户选择不删除的无用Key
   */
  async mergeWithExistingRecord(
    allReferences: Map<string, any[]>,
    existingRecordOverride?: CompleteTranslationRecord
  ): Promise<CompleteTranslationRecord> {
    try {
      // 1. 加载现有的完整记录（允许调用方提供内存覆盖，以避免测试环境下磁盘桩读取旧数据）
      const existingRecord =
        existingRecordOverride ?? (await this.loadCompleteRecord());

      // 2. 构建基于新引用的记录
      const newRecord = await this.buildCompleteRecord(allReferences);

      // 3. 合并记录：现有记录优先（保留无用Key），新记录补充
      const mergedRecord: CompleteTranslationRecord = { ...existingRecord };

      // 遍历新记录，添加或更新翻译
      Object.entries(newRecord).forEach(([modulePath, moduleKeys]) => {
        if (!mergedRecord[modulePath]) {
          // 新模块，直接添加
          mergedRecord[modulePath] = moduleKeys;
        } else {
          // 现有模块，合并Key
          Object.entries(moduleKeys).forEach(([key, translations]) => {
            if (!mergedRecord[modulePath][key]) {
              // 新Key，直接添加
              mergedRecord[modulePath][key] = translations;
            } else {
              // 现有Key，合并翻译（新翻译优先）
              mergedRecord[modulePath][key] = {
                ...mergedRecord[modulePath][key],
                ...translations,
              };
            }
          });
        }
      });

      // 4. 保存并返回合并后的记录
      await this.saveCompleteRecordDirect(mergedRecord);

      Logger.debug(
        "✅ [DEBUG] TranslationManager.mergeWithExistingRecord 完成"
      );
      return mergedRecord;
    } catch (error) {
      Logger.error(
        "❌ [DEBUG] TranslationManager.mergeWithExistingRecord 失败:",
        error
      );
      // 如果合并失败，回退到直接保存新记录
      await this.saveCompleteRecord(allReferences);
      throw error;
    }
  }

  /**
   * 合并远端完整记录到本地（专门用于远端数据合并） todo 后续优化
   */
  async mergeRemoteCompleteRecord(
    remoteRecord: CompleteTranslationRecord
  ): Promise<void> {
    try {
      // 1. 加载现有的完整记录
      const existingRecord = await this.loadCompleteRecord();

      // 2. 合并记录：远端记录优先，本地记录补充缺失数据
      const mergedRecord: CompleteTranslationRecord = { ...existingRecord };

      // 遍历远端记录，添加或更新翻译
      Object.entries(remoteRecord).forEach(([modulePath, moduleKeys]) => {
        if (!mergedRecord[modulePath]) {
          // 新模块，直接添加
          mergedRecord[modulePath] = moduleKeys;
        } else {
          // 现有模块，合并Key
          Object.entries(moduleKeys).forEach(([key, translations]) => {
            if (!mergedRecord[modulePath][key]) {
              // 新Key，直接添加
              mergedRecord[modulePath][key] = translations;
            } else {
              // 现有Key，合并翻译（远端优先，本地补充）
              mergedRecord[modulePath][key] = {
                ...mergedRecord[modulePath][key], // 本地翻译作为基础
                ...translations, // 远端翻译覆盖（优先级更高）
              };
            }
          });
        }
      });

      // 3. 保存合并后的记录
      await this.saveCompleteRecordDirect(mergedRecord);

      Logger.debug(
        "✅ [DEBUG] TranslationManager.mergeRemoteCompleteRecord 完成"
      );
    } catch (error) {
      Logger.error(
        "❌ [DEBUG] TranslationManager.mergeRemoteCompleteRecord 失败:",
        error
      );
      // 如果合并失败，回退到直接保存远端记录
      await this.saveCompleteRecordDirect(remoteRecord);
      throw error;
    }
  }

  /**
   * 构建新格式的完整记录 - 智能合并版本
   * 1. 先加载现有完整记录（包含远程翻译数据）
   * 2. 分类所有翻译key到对应路径
   * 3. 构建完整的翻译记录，优先保留现有翻译，新key使用原文案
   * 4. 检测和处理文件移动导致的路径变更
   */
  private async buildCompleteRecord(
    allReferences: Map<string, any[]>
  ): Promise<CompleteTranslationRecord> {
    Logger.debug("🏗️ [DEBUG] 开始构建完整记录（智能合并模式）...");

    // 第一步：加载现有的完整记录（包含远程翻译数据）
    const existingRecord = await this.loadCompleteRecord();
    Logger.debug(
      `📖 [DEBUG] 加载现有记录，包含 ${
        Object.keys(existingRecord).length
      } 个模块`
    );

    // 第二步：按路径分类所有翻译key
    const pathClassification = this.classifyKeysByPath(allReferences);
    Logger.debug(
      `🔍 [DEBUG] 按路径分类完成，共 ${
        Object.keys(pathClassification).length
      } 个模块路径`
    );

    // 第三步：检测文件移动并创建迁移映射
    const migrationMap = this.detectFileMigrations(
      existingRecord,
      pathClassification
    );

    // 第四步：构建新的完整记录，智能合并翻译数据
    const record: CompleteTranslationRecord = {};

    for (const [classifiedModulePath, keys] of Object.entries(
      pathClassification
    )) {
      Logger.debug(
        `📁 [DEBUG] 处理模块路径: "${classifiedModulePath}" (${keys.length} 个keys)`
      );

      // 在保持“原始模块路径优先”的策略下，暂不预初始化 classifiedModulePath

      for (const key of keys) {
        Logger.debug(`🔑 [DEBUG] 处理key: "${key}"`);

        // 检查现有记录中是否有这个key的翻译数据
        let existingTranslations: any = null;
        let originalModulePathForKey: string | null = null;

        // 首先在与分类模块路径相同的模块中查找（若存在）
        if (
          existingRecord[classifiedModulePath] &&
          existingRecord[classifiedModulePath][key]
        ) {
          existingTranslations = existingRecord[classifiedModulePath][key];
          originalModulePathForKey = classifiedModulePath;
          Logger.debug(
            `✅ [DEBUG] 在分类模块 "${classifiedModulePath}" 中找到key "${key}" 的现有翻译`
          );
        } else {
          // 检查是否有迁移映射
          const oldModulePath = migrationMap.get(classifiedModulePath);
          if (
            oldModulePath &&
            existingRecord[oldModulePath] &&
            existingRecord[oldModulePath][key]
          ) {
            existingTranslations = existingRecord[oldModulePath][key];
            originalModulePathForKey = oldModulePath;
            Logger.info(
              `🔄 [MIGRATION] 发现旧路径 "${oldModulePath}" 中存在 key "${key}"`
            );
          } else {
            // 在现有记录的所有模块中查找这个key（兼容旧逻辑）
            for (const [
              existingModulePath,
              existingModuleKeys,
            ] of Object.entries(existingRecord)) {
              if (existingModuleKeys[key]) {
                existingTranslations = existingModuleKeys[key];
                originalModulePathForKey = existingModulePath;
                Logger.debug(
                  `✅ [DEBUG] 在模块 "${existingModulePath}" 中找到key "${key}" 的现有翻译`
                );
                break;
              }
            }
          }
        }

        if (existingTranslations && originalModulePathForKey) {
          // 如果检测到该模块发生迁移，则将旧数据归并到新路径（classifiedModulePath）
          const migratedFrom = migrationMap.get(classifiedModulePath);
          const targetModulePath =
            migratedFrom && migratedFrom === originalModulePathForKey
              ? classifiedModulePath
              : originalModulePathForKey;

          if (!record[targetModulePath]) {
            record[targetModulePath] = {};
          }
          record[targetModulePath][key] = { ...existingTranslations };
        } else {
          // 新 key：落在“分类模块路径”下
          if (!record[classifiedModulePath]) {
            record[classifiedModulePath] = {};
          }
          record[classifiedModulePath][key] = {} as any;
          // 为每种语言设置默认翻译值（集成大模型翻译）
          for (const lang of this.config.languages) {
            if (lang === "en") {
              (record[classifiedModulePath][key] as any)[lang] = key;
            } else {
              try {
                const translated = await llmTranslate(
                  key,
                  "en",
                  lang,
                  this.config.apiKey
                );
                (record[classifiedModulePath][key] as any)[lang] =
                  translated || key;
              } catch (e) {
                (record[classifiedModulePath][key] as any)[lang] = key; // 降级
              }
            }
          }
          (record[classifiedModulePath][key] as any).mark = 0;
        }
      }
    }

    // 第五步：清理迁移后的旧数据
    await this.cleanupMigratedData(record, existingRecord, migrationMap);

    return record;
  }

  /**
   * 检测文件移动，创建迁移映射
   */
  private detectFileMigrations(
    existingRecord: CompleteTranslationRecord,
    pathClassification: Record<string, string[]>
  ): Map<string, string> {
    const migrationMap = new Map<string, string>();

    // 当前引用中的模块路径
    const currentModulePaths = new Set(Object.keys(pathClassification));
    // 现有记录中的模块路径
    const existingModulePaths = new Set(Object.keys(existingRecord));

    // 寻找可能的文件移动
    for (const currentPath of currentModulePaths) {
      if (!existingModulePaths.has(currentPath)) {
        // 新路径不在现有记录中，可能是文件移动
        const keys = pathClassification[currentPath];

        // 寻找包含相同keys的旧路径
        for (const existingPath of existingModulePaths) {
          if (!currentModulePaths.has(existingPath)) {
            // 旧路径不在当前引用中，可能是被移动的路径
            const existingKeys = Object.keys(existingRecord[existingPath]);

            // 检查 key 的重叠度：以“旧路径的键集合”为分母更合理
            const overlappingKeys = keys.filter((key) =>
              existingKeys.includes(key)
            );

            // 判断条件：
            // - 重叠键数量占旧路径键总数的比例 >= 0.8（大部分旧键都在新路径中出现）
            // - 或者旧路径键数量较少（<= 2）且全部出现在新路径中（便于小集合迁移）
            const overlapByOld =
              existingKeys.length > 0
                ? overlappingKeys.length / existingKeys.length
                : 0;

            const isSmallSetFullyCovered =
              existingKeys.length <= 2 &&
              overlappingKeys.length === existingKeys.length;

            if (
              overlappingKeys.length > 0 &&
              (overlapByOld >= 0.8 || isSmallSetFullyCovered)
            ) {
              migrationMap.set(currentPath, existingPath);
              Logger.info(
                `🔍 [MIGRATION] 检测到文件移动: "${existingPath}" -> "${currentPath}" (${overlappingKeys.length}/${keys.length} keys匹配)`
              );
              break;
            }
          }
        }
      }
    }

    return migrationMap;
  }

  /**
   * 清理迁移后的旧数据
   */
  private async cleanupMigratedData(
    newRecord: CompleteTranslationRecord,
    existingRecord: CompleteTranslationRecord,
    migrationMap: Map<string, string>
  ): Promise<void> {
    // 这里可以选择是否删除旧的模块数据
    // 为了安全起见，暂时不自动删除，只记录日志
    for (const [newPath, oldPath] of migrationMap.entries()) {
      Logger.debug(
        `📝 [CLEANUP] 可清理的旧路径: "${oldPath}" (已迁移到 "${newPath}")`
      );
      // 未来可以添加自动清理逻辑
      // delete existingRecord[oldPath];
    }
  }

  /**
   * 按路径分类所有翻译key - 每个文件夹管理自己的翻译
   * 允许翻译在多个文件夹中重复存在
   */
  private classifyKeysByPath(
    allReferences: Map<string, any[]>
  ): Record<string, string[]> {
    Logger.debug(
      "🔍 [DEBUG] 开始按文件夹级别分类翻译key（每个文件夹管理自己的翻译）..."
    );

    const classification: Record<string, string[]> = {};

    allReferences.forEach((references, key) => {
      if (references.length === 0) {
        if (!classification["common"]) classification["common"] = [];
        classification["common"].push(key);
        return;
      }

      // 按文件夹级别分类：每个引用的文件夹都会包含这个翻译
      const folderPaths = new Set<string>();

      references.forEach((ref, index) => {
        const modulePath = PathUtils.convertFilePathToModulePath(
          ref.filePath,
          this.config
        );
        folderPaths.add(modulePath);
      });

      // 将翻译key添加到所有相关的文件夹模块中
      folderPaths.forEach((modulePath) => {
        if (!classification[modulePath]) {
          classification[modulePath] = [];
        }

        // 避免重复添加
        if (!classification[modulePath].includes(key)) {
          classification[modulePath].push(key);
        }
      });
    });

    return classification;
  }

  /**
   * 基于完整记录生成模块化翻译文件
   */
  async generateModularFilesFromCompleteRecord(): Promise<void> {
    // 读取完整记录
    const completeRecord = await this.loadCompleteRecord();

    // 生成模块文件
    await this.generateModuleFilesFromRecord(completeRecord);
  }

  /**
   * 加载完整记录文件
   */
  public async loadCompleteRecord(): Promise<CompleteTranslationRecord> {
    const filePath = path.join(
      this.config.outputDir,
      "i18n-complete-record.json"
    );

    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      Logger.warn("完整记录文件不存在或读取失败，返回空记录");
      return {};
    }
  }

  /**
   * 从完整记录生成模块文件 - 优化版本
   * 递归生成各个翻译文件夹
   */
  private async generateModuleFilesFromRecord(
    completeRecord: CompleteTranslationRecord
  ): Promise<void> {
    Logger.debug("🏗️ [DEBUG] 开始递归生成翻译文件夹...");

    // 按模块路径排序，确保根目录优先处理
    const sortedModules = Object.entries(completeRecord).sort(([a], [b]) => {
      if (a === "") return -1; // 根目录优先
      if (b === "") return 1;
      return a.localeCompare(b);
    });

    for (const [modulePath, moduleKeys] of sortedModules) {
      // 确定目标目录和文件路径
      const { targetDir, filePath } = this.resolveModulePaths(modulePath);

      // 创建目录（递归）
      await this.ensureDirectoryExists(targetDir);

      // 构建模块翻译数据
      const moduleTranslations = this.buildModuleTranslations(moduleKeys);

      // 生成翻译文件内容（统一交给translate处理）
      const content = this.generateModuleFileContent(moduleTranslations);

      // 写入文件
      await fs.promises.writeFile(filePath, content, "utf-8");
    }
  }

  /**
   * 解析模块路径，返回目标目录和文件路径
   * 与组件文件结构一一对应
   */
  private resolveModulePaths(modulePath: string): {
    targetDir: string;
    filePath: string;
  } {
    // modulePath 现在是完整的文件路径，如 "TestModular.ts" 或 "components/Header2.ts"
    const fullFilePath = path.join(this.config.outputDir, modulePath);
    const targetDir = path.dirname(fullFilePath);
    const filePath = fullFilePath;

    return { targetDir, filePath };
  }

  /**
   * 确保目录存在（递归创建）
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
      Logger.debug(`  📂 [DEBUG] 目录创建成功: ${dirPath}`);
    } catch (error) {
      Logger.error(`  ❌ [DEBUG] 目录创建失败: ${dirPath}`, error);
      throw error;
    }
  }

  /**
   * 构建模块翻译数据
   */
  private buildModuleTranslations(
    moduleKeys: Record<string, Record<string, string>>
  ): ModuleTranslations {
    const result: ModuleTranslations = {};

    // 初始化所有语言
    this.config.languages.forEach((lang) => {
      result[lang] = {};
    });

    // 填充翻译数据
    Object.entries(moduleKeys).forEach(([key, translations]) => {
      Object.entries(translations).forEach(([lang, translation]) => {
        if (result[lang]) {
          result[lang][key] = translation;
        }
      });
    });

    return result;
  }

  /**
   * 生成模块文件内容（简化版本，统一交给translate处理）
   */
  private generateModuleFileContent(
    moduleTranslations: ModuleTranslations
  ): string {
    const jsonContent = JSON.stringify(moduleTranslations, null, 2);
    return `const translations = ${jsonContent};\n\nexport default translations;\n`;
  }

  /**
   * 直接保存完整记录（用于删除操作后）
   */
  async saveCompleteRecordDirect(
    completeRecord: CompleteTranslationRecord
  ): Promise<void> {
    const outputPath = path.join(
      this.config.outputDir,
      "i18n-complete-record.json"
    );
    const normalized = this.normalizeCompleteRecord(completeRecord);
    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(normalized, null, 2),
      "utf-8"
    );
  }

  /**
   * 规范化完整记录中每个翻译条目的键顺序：
   * - 按 config.languages 顺序输出语言字段
   * - 其他非语言字段（不含 mark）跟随其后
   * - 最后输出 mark 字段（如果存在）
   */
  private normalizeCompleteRecord(
    record: CompleteTranslationRecord
  ): CompleteTranslationRecord {
    const normalized: CompleteTranslationRecord = {};

    // 稳定排序模块路径，确保跨次运行顺序一致
    const sortedModulePaths = Object.keys(record).sort((a, b) =>
      a.localeCompare(b)
    );

    sortedModulePaths.forEach((modulePath) => {
      const moduleKeys = record[modulePath];
      (normalized as any)[modulePath] = {} as any;

      // 稳定排序每个模块下的翻译key
      const sortedKeys = Object.keys(moduleKeys).sort((a, b) =>
        a.localeCompare(b)
      );

      sortedKeys.forEach((key) => {
        const translations = (moduleKeys as any)[key];
        const ordered: Record<string, any> = {};

        // 语言字段按配置顺序
        this.config.languages.forEach((lang) => {
          if (translations[lang] !== undefined) {
            ordered[lang] = translations[lang];
          }
        });

        // 追加其他非语言字段（排除 mark）
        Object.keys(translations).forEach((k) => {
          if (k !== "mark" && !this.config.languages.includes(k)) {
            ordered[k] = translations[k];
          }
        });

        // 最后追加 mark（如果存在）
        if (translations.mark !== undefined) {
          (ordered as any).mark = translations.mark;
        }

        (normalized[modulePath] as any)[key] = ordered as any;
      });
    });

    return normalized;
  }

  /**
   * 从完整记录中删除指定的keys
   */
  async deleteKeysFromCompleteRecord(
    keysToDelete: string[],
    allReferences: Map<string, any[]>
  ): Promise<{ deletedCount: number; affectedLanguages: string[] }> {
    // 1. 读取完整记录
    const completeRecord = await this.loadCompleteRecord();

    let deletedCount = 0;
    const affectedLanguages = new Set<string>();

    // 2. 从完整记录中删除指定的keys
    Object.keys(completeRecord).forEach((modulePath) => {
      keysToDelete.forEach((keyToDelete) => {
        if (completeRecord[modulePath][keyToDelete]) {
          // 记录受影响的语言
          Object.keys(completeRecord[modulePath][keyToDelete]).forEach(
            (lang) => {
              affectedLanguages.add(lang);
            }
          );

          delete completeRecord[modulePath][keyToDelete];
          deletedCount++;
        }
      });
    });

    // 3. 保存更新后的完整记录
    await this.saveCompleteRecordDirect(completeRecord);

    // 4. 从引用Map中移除
    keysToDelete.forEach((key) => {
      allReferences.delete(key);
    });

    return {
      deletedCount,
      affectedLanguages: Array.from(affectedLanguages).sort(),
    };
  }
}
