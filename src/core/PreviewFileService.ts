import * as fs from "fs";
import * as path from "path";
import type { I18nConfig } from "../types";
import type { CompleteTranslationRecord } from "./TranslationManager";
import { Logger } from "../utils/StringUtils";

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

/**
 * 预览文件服务
 * 专门处理删除预览文件的生成、保存和清理
 */
export class PreviewFileService {
  constructor(private config: I18nConfig) {}

  /**
   * 生成删除预览文件 - 基于 CompleteRecord
   * @param unusedKeys 无用Key列表
   * @param completeRecord 完整翻译记录
   * @returns 预览文件路径
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
   * 生成传统格式的删除预览文件
   * @param unusedKeys 无用Key列表
   * @param translations 传统翻译数据格式
   * @returns 预览文件路径
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
   * 清理指定的预览文件
   * @param filePaths 要清理的文件路径列表
   */
  async cleanupPreviewFiles(filePaths: string[]): Promise<void> {
    if (filePaths.length === 0) {
      return;
    }

    Logger.info(`🧹 清理 ${filePaths.length} 个临时预览文件...`);

    for (const filePath of filePaths) {
      try {
        await fs.promises.unlink(filePath);
        Logger.debug(`🗑️ 已删除预览文件: ${filePath}`);
      } catch (error) {
        // 文件可能已经不存在，忽略错误
        Logger.debug(`⚠️ 清理预览文件失败: ${filePath} - ${error}`);
      }
    }

    Logger.info(`✅ 临时预览文件清理完成`);
  }

  /**
   * 构建删除预览记录，结构与CompleteRecord一致，只包含即将被删除的Key
   * @param unusedKeys 无用Key列表
   * @param completeRecord 完整翻译记录
   * @returns 预览记录
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
   * 格式化删除预览内容 - 传统格式
   * @param unusedKeys 无用Key列表
   * @param translations 翻译数据
   * @returns 预览数据
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
   * @param key 翻译Key
   * @param translations 翻译数据
   * @returns Key的翻译映射
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
