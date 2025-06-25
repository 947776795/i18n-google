/***
 * 读取指定表格指定列的信息，在谷歌表格中的数据如下
 * en	ko	zh-Hans	zh-Hant	vi	es	tr	fr
 * Download	다운로드	下载	下載	Tải xuống	Descargar	İndir	Télécharger
 * 将读取的数据与i18n-complete-record.json 中数据做对比如果存在英文完全相同的数据，则将其他语言的数据更新到i18n-complete-record.json 中
 * 并重新模块化翻译文件
 * ***/

import { GoogleSheetsSync } from "./core/GoogleSheetsSync";
import {
  TranslationManager,
  type CompleteTranslationRecord,
} from "./core/TranslationManager";
import type { I18nConfig } from "./types";
import { Logger } from "./utils/StringUtils";
import { readFile, writeFile } from "fs/promises";
import * as path from "path";

interface SheetTranslationData {
  [englishText: string]: {
    [language: string]: string;
  };
}

/**
 * 同步服务类 - 负责从Google Sheets同步翻译数据并更新本地文件
 */
class TranslationSyncService {
  private googleSheetsSync: GoogleSheetsSync;
  private translationManager: TranslationManager;
  private config: I18nConfig;

  constructor(config: I18nConfig) {
    this.config = config;
    this.googleSheetsSync = new GoogleSheetsSync(config);
    this.translationManager = new TranslationManager(config);
  }

  /**
   * 主同步方法
   */
  public async syncTranslations(): Promise<void> {
    try {
      Logger.info("🚀 开始同步翻译数据...");

      // 1. 从Google Sheets读取翻译数据
      const sheetData = await this.fetchSheetTranslations();
      Logger.info(
        `📥 从Google Sheets获取了 ${Object.keys(sheetData).length} 条翻译数据`
      );

      // 2. 读取本地完整记录
      const localRecord = await this.loadLocalCompleteRecord();
      Logger.info(
        `📁 读取本地记录，包含 ${Object.keys(localRecord).length} 个模块`
      );

      // 3. 对比并更新本地记录
      const updatedRecord = await this.mergeTranslations(
        sheetData,
        localRecord
      );
      const updateCount = await this.getUpdateCount(localRecord, updatedRecord);
      Logger.info(`🔄 更新了 ${updateCount} 条翻译数据`);

      // 4. 保存更新后的完整记录
      await this.saveUpdatedCompleteRecord(updatedRecord);
      Logger.info("💾 已保存更新后的完整记录");

      // 5. 重新生成模块化翻译文件
      await this.regenerateModularTranslations(updatedRecord);
      Logger.info("🏗️ 已重新生成模块化翻译文件");

      Logger.info("✅ 同步完成！");
    } catch (error) {
      Logger.error("❌ 同步失败:", error);
      throw error;
    }
  }

  /**
   * 从Google Sheets获取翻译数据
   */
  private async fetchSheetTranslations(): Promise<SheetTranslationData> {
    // 使用GoogleSheetsSync的现有方法
    const completeRecord =
      await this.googleSheetsSync.syncCompleteRecordFromSheet();

    // 将CompleteRecord格式转换为以英文文案为key的格式
    const sheetData: SheetTranslationData = {};

    Object.values(completeRecord).forEach((moduleKeys) => {
      Object.entries(
        moduleKeys as Record<string, Record<string, string>>
      ).forEach(([translationKey, translations]) => {
        const englishText = translations.en || translationKey;

        if (!sheetData[englishText]) {
          sheetData[englishText] = {};
        }

        // 合并所有语言的翻译
        Object.entries(translations).forEach(([lang, translation]) => {
          if (translation && translation.trim()) {
            sheetData[englishText][lang] = translation;
          }
        });
      });
    });

    // 调试：输出所有英文翻译内容
    Logger.info("🔍 从Google Sheets获取的所有英文翻译:");
    Object.keys(sheetData).forEach((englishText, index) => {
      Logger.info(`  ${index + 1}. "${englishText}"`);
    });

    // 特别检查是否包含目标文本
    const targetText = "Invalid locale: %{var0}";
    const hasTargetText = Object.keys(sheetData).includes(targetText);
    Logger.info(
      `🎯 是否包含 "${targetText}": ${hasTargetText ? "✅ 是" : "❌ 否"}`
    );

    // 如果包含目标文本，详细输出其翻译内容
    if (hasTargetText) {
      Logger.info(`🔍 "${targetText}" 的详细翻译内容:`);
      Object.entries(sheetData[targetText]).forEach(([lang, translation]) => {
        Logger.info(`    ${lang}: "${translation}"`);
        // 特别检查ko字段是否包含_zhans后缀
        if (lang === "ko" && translation.includes("_zhans")) {
          Logger.info(`    🎯 发现ko字段包含_zhans: "${translation}"`);
        }
      });
    }

    // 额外检查所有包含"Invalid locale"的条目
    const invalidLocaleEntries = Object.keys(sheetData).filter((key) =>
      key.includes("Invalid locale")
    );
    if (invalidLocaleEntries.length > 0) {
      Logger.info(`🔍 所有包含"Invalid locale"的条目:`);
      invalidLocaleEntries.forEach((entry) => {
        Logger.info(`  - "${entry}"`);
        if (sheetData[entry].ko) {
          Logger.info(`    ko: "${sheetData[entry].ko}"`);
        }
      });
    }

    return sheetData;
  }

  /**
   * 读取本地完整记录文件
   */
  private async loadLocalCompleteRecord(): Promise<CompleteTranslationRecord> {
    const recordPath = path.join(
      this.config.outputDir,
      "i18n-complete-record.json"
    );

    try {
      const content = await readFile(recordPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      Logger.warn("⚠️ 无法读取本地记录文件，返回空记录:", error);
      return {};
    }
  }

  /**
   * 对比并合并翻译数据
   */
  private async mergeTranslations(
    sheetData: SheetTranslationData,
    localRecord: CompleteTranslationRecord
  ): Promise<CompleteTranslationRecord> {
    const updatedRecord = JSON.parse(JSON.stringify(localRecord)); // 深拷贝
    let updateCount = 0;

    // 遍历本地记录中的每个模块
    Object.entries(updatedRecord).forEach(([modulePath, moduleKeys]) => {
      Object.entries(
        moduleKeys as Record<string, Record<string, string>>
      ).forEach(([translationKey, translations]) => {
        const englishText = translations.en || translationKey;

        // 检查Sheet数据中是否有对应的英文文案
        if (sheetData[englishText]) {
          const sheetTranslations = sheetData[englishText];

          // 特别追踪Invalid locale相关的更新
          if (englishText.includes("Invalid locale")) {
            Logger.info(`🔍 正在处理Invalid locale相关翻译: "${englishText}"`);
            Logger.info(`  模块: ${modulePath}`);
            Logger.info(`  翻译键: ${translationKey}`);
          }

          // 更新每种语言的翻译（如果Sheet中有更新的版本）
          Object.entries(sheetTranslations).forEach(
            ([lang, sheetTranslation]) => {
              if (sheetTranslation && sheetTranslation.trim()) {
                const currentTranslation = translations[lang];

                // 如果Sheet中的翻译与本地不同，则更新
                if (currentTranslation !== sheetTranslation) {
                  updatedRecord[modulePath][translationKey][lang] =
                    sheetTranslation;
                  updateCount++;

                  // 特别标记Invalid locale的更新
                  const isInvalidLocale =
                    englishText.includes("Invalid locale");
                  const logPrefix = isInvalidLocale ? "🎯🔄" : "🔄";

                  Logger.info(
                    `${logPrefix} 更新翻译 [${modulePath}][${translationKey}][${lang}]: "${currentTranslation}" -> "${sheetTranslation}"`
                  );

                  // 特别关注ko字段的_zhans更新
                  if (lang === "ko" && sheetTranslation.includes("_zhans")) {
                    Logger.info(
                      `    🎯 检测到ko字段更新为包含_zhans的值: "${sheetTranslation}"`
                    );
                  }
                }
              }
            }
          );
        }
      });
    });

    Logger.info(`📊 总共更新了 ${updateCount} 条翻译`);
    return updatedRecord;
  }

  /**
   * 计算更新数量
   */
  private async getUpdateCount(
    oldRecord: CompleteTranslationRecord,
    newRecord: CompleteTranslationRecord
  ): Promise<number> {
    let count = 0;

    Object.keys(newRecord).forEach((modulePath) => {
      if (!oldRecord[modulePath]) return;

      Object.keys(newRecord[modulePath]).forEach((translationKey) => {
        if (!oldRecord[modulePath][translationKey]) return;

        Object.keys(newRecord[modulePath][translationKey]).forEach((lang) => {
          const oldValue = oldRecord[modulePath][translationKey][lang];
          const newValue = newRecord[modulePath][translationKey][lang];

          if (oldValue !== newValue) {
            count++;
          }
        });
      });
    });

    return count;
  }

  /**
   * 保存更新后的完整记录
   */
  private async saveUpdatedCompleteRecord(
    updatedRecord: CompleteTranslationRecord
  ): Promise<void> {
    const recordPath = path.join(
      this.config.outputDir,
      "i18n-complete-record.json"
    );
    const content = JSON.stringify(updatedRecord, null, 2);

    await writeFile(recordPath, content, "utf-8");
    Logger.info(`💾 已保存更新后的记录到: ${recordPath}`);
  }

  /**
   * 重新生成模块化翻译文件
   */
  private async regenerateModularTranslations(
    updatedRecord: CompleteTranslationRecord
  ): Promise<void> {
    // 使用TranslationManager的现有方法生成模块化文件
    const manager = new TranslationManager(this.config);

    // 先保存完整记录到manager内部状态
    await this.saveUpdatedCompleteRecord(updatedRecord);

    // 然后调用生成方法
    await manager.generateModularFilesFromCompleteRecord();

    Logger.info("🏗️ 已重新生成所有模块化翻译文件");
  }
}

/**
 * 主函数 - 执行同步操作
 */
async function main() {
  try {
    // 从当前工作目录加载配置文件
    const configPath = path.join(process.cwd(), "i18n.config.js");
    Logger.info(`📄 正在加载配置文件: ${configPath}`);

    // 检查配置文件是否存在
    const fs = require("fs");
    if (!fs.existsSync(configPath)) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }

    const config: I18nConfig = require(configPath);
    Logger.info(`✅ 配置文件加载成功`);

    // 将相对路径转换为绝对路径，基于当前工作目录
    const resolvedConfig: I18nConfig = {
      ...config,
      rootDir: path.resolve(process.cwd(), config.rootDir),
      outputDir: path.resolve(process.cwd(), config.outputDir),
      keyFile: path.resolve(process.cwd(), config.keyFile),
    };

    Logger.info(`🔧 解析后的配置:`);
    Logger.info(`   rootDir: ${resolvedConfig.rootDir}`);
    Logger.info(`   outputDir: ${resolvedConfig.outputDir}`);
    Logger.info(`   keyFile: ${resolvedConfig.keyFile}`);
    Logger.info(`   spreadsheetId: ${resolvedConfig.spreadsheetId}`);
    Logger.info(`   sheetName: ${resolvedConfig.sheetName}`);

    // 验证必要的配置
    if (!resolvedConfig.spreadsheetId) {
      Logger.error("❌ 配置文件中缺少 spreadsheetId");
      process.exit(1);
    }

    // 验证输出目录是否存在
    if (!fs.existsSync(resolvedConfig.outputDir)) {
      throw new Error(`输出目录不存在: ${resolvedConfig.outputDir}`);
    }

    // 验证i18n-complete-record.json是否存在
    const recordPath = path.join(
      resolvedConfig.outputDir,
      "i18n-complete-record.json"
    );
    if (!fs.existsSync(recordPath)) {
      throw new Error(
        `翻译记录文件不存在: ${recordPath}。请先运行主扫描流程生成此文件。`
      );
    }

    Logger.info(`📁 翻译记录文件: ${recordPath}`);

    const syncService = new TranslationSyncService(resolvedConfig);
    await syncService.syncTranslations();
    process.exit(0);
  } catch (error) {
    Logger.error("❌ 同步失败:", error);
    Logger.info("💡 提示:");
    Logger.info("   1. 确保在项目根目录下运行此脚本");
    Logger.info("   2. 确保i18n.config.js配置文件存在");
    Logger.info("   3. 确保已运行主扫描流程生成i18n-complete-record.json");
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
  main();
}

export { TranslationSyncService };
