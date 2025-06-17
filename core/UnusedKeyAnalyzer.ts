import type { I18nConfig } from "../types";
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
   * 检测无用Key
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
   * 检查Key是否被配置为强制保留
   */
  private isKeyForceKept(key: string): boolean {
    return this.config.forceKeepKeys?.includes(key) ?? false;
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
    return allUnusedKeys.filter((key) => this.isKeyForceKept(key));
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
}
