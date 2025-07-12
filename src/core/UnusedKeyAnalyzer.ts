import type { I18nConfig } from "../types";
import type { CompleteTranslationRecord } from "./TranslationManager";
import { ExistingReference } from "./AstTransformer";
import { Logger } from "../utils/StringUtils";
import * as fs from "fs";
import * as path from "path";

// 删除预览数据结构
export interface DeletePreview {
  timestamp: string; // 生成时间
  totalKeysToDelete: number; // 待删除Key数量
  keysToDelete: Array<{
    key: string; // Key值
    translations: Record<string, string>; // 各语言翻译内容
    reason: string; // 删除原因
  }>;
  affectedLanguages: string[]; // 受影响的语言
}

// Key统计信息
export interface KeyStatistics {
  totalKeys: number;
  usedKeys: number;
  unusedKeys: number;
  unusedKeysList: string[];
}

export class UnusedKeyAnalyzer {
  constructor(private config: I18nConfig) {}

  /**
   * 检测无用Key - 支持时间检测
   */
  detectUnusedKeys(
    allDefinedKeys: string[],
    referencesMap: Map<string, ExistingReference[]>
  ): string[] {
    const allReferencedKeys = Array.from(referencesMap.keys());
    const unusedKeys = allDefinedKeys.filter(
      (key) => !allReferencedKeys.includes(key)
    );

    // 过滤掉强制保留的Key
    return unusedKeys.filter((key) => !this.isKeyForceKept(key));
  }

  /**
   * 基于时间的无用Key检测 - 新增方法
   */
  detectTimeBasedUnusedKeys(
    completeRecord: CompleteTranslationRecord,
    referencesMap: Map<string, ExistingReference[]>
  ): string[] {
    if (!this.config.keyExpirationDays) {
      // 没有配置过期时间，使用原有逻辑
      const allKeys = this.extractAllKeysFromCompleteRecord(completeRecord);
      const referencedKeys = new Set(referencesMap.keys());
      return allKeys.filter(key => 
        !referencedKeys.has(key) && 
        !this.isKeyForceKeptInCompleteRecord(key, completeRecord)
      );
    }

    Logger.info(`🕒 使用时间检测逻辑，过期阈值: ${this.config.keyExpirationDays} 天`);

    const currentTime = new Date().getTime();
    const expirationMs = this.config.keyExpirationDays * 24 * 60 * 60 * 1000;
    const expiredKeys: string[] = [];

    // 遍历完整记录中的所有key
    Object.entries(completeRecord).forEach(([modulePath, moduleKeys]) => {
      Object.entries(moduleKeys).forEach(([key, keyData]) => {
        const hasReference = referencesMap.has(key);
        
        if (!hasReference) {
          const lastUsed = keyData._lastUsed;
          
          if (!lastUsed) {
            // 没有lastUsed记录，视为过期
            Logger.debug(`🔍 Key [${key}] 无lastUsed记录，标记为过期`);
            expiredKeys.push(key);
          } else {
            // 检查是否超过过期时间
            const lastUsedTime = typeof lastUsed === 'number' ? lastUsed : new Date(lastUsed).getTime();
            
            // 检查时间是否有效
            if (isNaN(lastUsedTime)) {
              // 无效时间格式，视为过期
              Logger.debug(`🔍 Key [${key}] 时间格式无效，标记为过期`);
              expiredKeys.push(key);
            } else {
              const daysSinceLastUsed = Math.floor((currentTime - lastUsedTime) / (24 * 60 * 60 * 1000));
              
              if (currentTime - lastUsedTime > expirationMs) {
                Logger.debug(`🔍 Key [${key}] 已过期 ${daysSinceLastUsed} 天，标记删除`);
                expiredKeys.push(key);
              } else {
                Logger.debug(`🔍 Key [${key}] 未过期，最后使用: ${daysSinceLastUsed} 天前`);
              }
            }
          }
        } else {
          Logger.debug(`🔍 Key [${key}] 有引用，保留`);
        }
      });
    });

    Logger.info(`🕒 时间检测完成，发现 ${expiredKeys.length} 个过期key`);

    // 过滤掉强制保留的key
    const filteredExpiredKeys = expiredKeys.filter(key => 
      !this.isKeyForceKeptInCompleteRecord(key, completeRecord)
    );

    const forceKeptCount = expiredKeys.length - filteredExpiredKeys.length;
    if (forceKeptCount > 0) {
      Logger.info(`🔒 其中 ${forceKeptCount} 个key被强制保留`);
    }

    return filteredExpiredKeys;
  }

  /**
   * 辅助方法：从完整记录中提取所有key
   */
  private extractAllKeysFromCompleteRecord(
    completeRecord: CompleteTranslationRecord
  ): string[] {
    const allKeys = new Set<string>();
    Object.values(completeRecord).forEach(moduleKeys => {
      Object.keys(moduleKeys).forEach(key => allKeys.add(key));
    });
    return Array.from(allKeys);
  }

  /**
   * 检查Key是否被配置为强制保留
   * 新逻辑：需要根据key的来源文件路径判断是否被强制保留
   */
  public isKeyForceKept(
    key: string,
    referencesMap?: Map<string, ExistingReference[]>
  ): boolean {
    if (!this.config.forceKeepKeys) {
      return false;
    }

    // 如果提供了referencesMap，使用它来查找key的引用
    if (referencesMap) {
      const references = referencesMap.get(key);
      if (references && references.length > 0) {
        for (const ref of references) {
          const modulePath = this.convertFilePathToModulePath(ref.filePath);
          const forceKeepKeys = this.config.forceKeepKeys;
          if (forceKeepKeys && modulePath in forceKeepKeys) {
            const forceKeepList = (
              forceKeepKeys as unknown as Record<string, string[]>
            )[modulePath];
            if (forceKeepList && forceKeepList.includes(key)) {
              return true;
            }
          }
        }
      }
    }

    // 回退：检查所有模块中是否有该key被强制保留
    for (const [filePath, keys] of Object.entries(this.config.forceKeepKeys)) {
      if (keys.includes(key)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查CompleteRecord中的key是否被强制保留
   * 用于无用Key检测时的强制保留检查
   */
  public isKeyForceKeptInCompleteRecord(
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
          const forceKeepList = (
            forceKeepKeys as unknown as Record<string, string[]>
          )[modulePath];
          if (forceKeepList && forceKeepList.includes(key)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 获取被强制保留的无用Key列表
   */
  getForceKeptUnusedKeys(
    allDefinedKeys: string[],
    referencesMap: Map<string, ExistingReference[]>
  ): string[] {
    const allReferencedKeys = Array.from(referencesMap.keys());
    const allUnusedKeys = allDefinedKeys.filter(
      (key) => !allReferencedKeys.includes(key)
    );
    return allUnusedKeys.filter((key) =>
      this.isKeyForceKept(key, referencesMap)
    );
  }

  /**
   * 获取Key统计信息
   */
  getKeyStatistics(
    allDefinedKeys: string[],
    referencesMap: Map<string, ExistingReference[]>
  ): KeyStatistics {
    const unusedKeysList = this.detectUnusedKeys(allDefinedKeys, referencesMap);

    return {
      totalKeys: allDefinedKeys.length,
      usedKeys: allDefinedKeys.length - unusedKeysList.length,
      unusedKeys: unusedKeysList.length,
      unusedKeysList,
    };
  }

  /**
   * 生成删除预览文件
   */
  async generateDeletePreview(
    unusedKeys: string[],
    translations: any
  ): Promise<string> {
    const preview = this.formatDeletePreview(unusedKeys, translations);

    // 生成预览文件路径
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const previewPath = path.join(
      this.config.outputDir,
      `delete-preview-${timestamp}.json`
    );

    // 确保输出目录存在
    await fs.promises.mkdir(this.config.outputDir, { recursive: true });

    // 保存预览文件
    await fs.promises.writeFile(previewPath, JSON.stringify(preview, null, 2));

    Logger.info(`\n📄 删除预览已生成: ${previewPath}`);
    Logger.info(`   请查看文件以确认删除内容`);

    return previewPath;
  }

  /**
   * 格式化删除预览内容
   */
  private formatDeletePreview(
    unusedKeys: string[],
    translations: any
  ): DeletePreview {
    const timestamp = new Date().toISOString();

    const keysToDelete = unusedKeys.map((key) => ({
      key,
      translations: this.getKeyTranslations(key, translations),
      reason: "未在代码中找到引用",
    }));

    const affectedLanguages = Object.keys(translations);

    return {
      timestamp,
      totalKeysToDelete: unusedKeys.length,
      keysToDelete,
      affectedLanguages,
    };
  }

  /**
   * 获取指定Key在各语言中的翻译
   */
  private getKeyTranslations(
    key: string,
    translations: any
  ): Record<string, string> {
    const keyTranslations: Record<string, string> = {};

    Object.entries(translations).forEach(
      ([lang, langTranslations]: [string, any]) => {
        if (langTranslations[key]) {
          keyTranslations[lang] = langTranslations[key];
        }
      }
    );

    return keyTranslations;
  }

  /**
   * 生成删除预览文件 - 基于 CompleteRecord，数据结构与完整记录一致
   */
  async generateDeletePreviewFromCompleteRecord(
    unusedKeys: string[],
    completeRecord: CompleteTranslationRecord
  ): Promise<string> {
    const previewRecord = this.buildDeletePreviewRecord(
      unusedKeys,
      completeRecord
    );

    // 生成预览文件路径
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const previewPath = path.join(
      this.config.outputDir,
      `delete-preview-${timestamp}.json`
    );

    // 确保输出目录存在
    await fs.promises.mkdir(this.config.outputDir, { recursive: true });

    // 保存预览文件（与完整记录格式一致）
    await fs.promises.writeFile(
      previewPath,
      JSON.stringify(previewRecord, null, 2)
    );

    Logger.info(`\n📄 删除预览已生成 (CompleteRecord): ${previewPath}`);
    Logger.info(`   请查看文件以确认删除内容`);

    return previewPath;
  }

  /**
   * 构建删除预览记录，结构与CompleteRecord一致，只包含即将被删除的Key
   */
  private buildDeletePreviewRecord(
    unusedKeys: string[],
    completeRecord: CompleteTranslationRecord
  ): CompleteTranslationRecord {
    const previewRecord: CompleteTranslationRecord = {};
    const unusedKeySet = new Set(unusedKeys);

    // 遍历完整记录，只保留即将被删除的Key
    Object.entries(completeRecord).forEach(([modulePath, moduleKeys]) => {
      const moduleUnusedKeys: { [key: string]: { [lang: string]: string } } =
        {};

      Object.entries(moduleKeys).forEach(([key, translations]) => {
        if (unusedKeySet.has(key)) {
          moduleUnusedKeys[key] = translations;
        }
      });

      // 只有当模块中有无用Key时才添加到预览记录中
      if (Object.keys(moduleUnusedKeys).length > 0) {
        previewRecord[modulePath] = moduleUnusedKeys;
      }
    });

    return previewRecord;
  }

  /**
   * 检测模块级别的无用Keys
   * 某个key在模块中存在，但在该模块对应的文件中没有被引用
   */
  detectModuleLevelUnusedKeys(
    completeRecord: CompleteTranslationRecord,
    referencesMap: Map<string, ExistingReference[]>
  ): { [modulePath: string]: string[] } {
    const moduleLevelUnusedKeys: { [modulePath: string]: string[] } = {};

    // 构建模块路径到引用的映射
    const moduleToReferencedKeys: { [modulePath: string]: Set<string> } = {};

    // 从引用映射中构建每个模块实际引用的keys
    referencesMap.forEach((refs, key) => {
      refs.forEach((ref) => {
        const modulePath = this.convertFilePathToModulePath(ref.filePath);
        if (!moduleToReferencedKeys[modulePath]) {
          moduleToReferencedKeys[modulePath] = new Set();
        }
        moduleToReferencedKeys[modulePath].add(key);
      });
    });

    // 检查每个模块中的keys是否都被该模块的文件引用
    Object.keys(completeRecord).forEach((modulePath) => {
      const moduleKeys = Object.keys(completeRecord[modulePath]);
      const referencedKeys = moduleToReferencedKeys[modulePath] || new Set();

      const unusedKeysInModule = moduleKeys.filter((key) => {
        // 如果这个key在该模块中存在，但没有被该模块的文件引用
        const isUnusedInModule = !referencedKeys.has(key);
        const isForceKept = this.isKeyForceKept(key, referencesMap);

        return isUnusedInModule && !isForceKept;
      });

      if (unusedKeysInModule.length > 0) {
        moduleLevelUnusedKeys[modulePath] = unusedKeysInModule;
      }
    });

    return moduleLevelUnusedKeys;
  }

  /**
   * 将文件路径转换为模块路径
   */
  private convertFilePathToModulePath(filePath: string): string {
    // 移除项目根目录路径
    const rootDir = this.config.rootDir || "./demo/src";
    let relativePath = filePath;

    // 处理绝对路径
    if (filePath.startsWith("/")) {
      const processedRootDir = rootDir.startsWith("./")
        ? rootDir.slice(2)
        : rootDir;
      const rootDirIndex = filePath.indexOf(processedRootDir);
      if (rootDirIndex !== -1) {
        relativePath = filePath.substring(
          rootDirIndex + processedRootDir.length + 1
        );
      }
    } else {
      // 处理相对路径，移除 rootDir 前缀
      const processedRootDir = rootDir.startsWith("./")
        ? rootDir.slice(2) + "/"
        : rootDir + "/";
      if (relativePath.startsWith(processedRootDir)) {
        relativePath = relativePath.substring(processedRootDir.length);
      }
    }

    // 转换文件扩展名为 .ts
    return relativePath.replace(/\.(tsx|jsx|js|ts)$/, ".ts");
  }
}
