/***
 * 简单格式翻译同步脚本
 *
 * 专门处理简单表格格式：
 * Key | en | ko | zh-Hans | zh-Hant | vi | es | tr
 * 1   | Invalid locale: %{var0} | Invalid locale: %{var0}_zhans | ...
 *
 * 功能说明：
 * 1. 读取简单格式的Google表格（ID, 英文, 其他语言）
 * 2. 基于英文文案匹配本地i18n-complete-record.json中的翻译
 * 3. 用远程翻译更新本地翻译
 * 4. 重新生成模块化翻译文件
 ***/

import { google } from "googleapis";
import {
  TranslationManager,
  type CompleteTranslationRecord,
} from "./core/TranslationManager";
import type { I18nConfig } from "./types";
import { Logger } from "./utils/StringUtils";
import { readFile, writeFile } from "fs/promises";
import * as path from "path";

interface SimpleSheetRow {
  key: string;
  en: string;
  [language: string]: string;
}

/**
 * 简单格式同步服务类
 */
class SimpleFormatSyncService {
  private googleSheets: any;
  private translationManager: TranslationManager;
  private config: I18nConfig;

  constructor(config: I18nConfig) {
    this.config = config;
    this.translationManager = new TranslationManager(config);
  }

  /**
   * 初始化 Google Sheets API
   */
  private async initGoogleSheets(): Promise<void> {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: this.config.keyFile,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const authClient = await auth.getClient();
      this.googleSheets = google.sheets({
        version: "v4",
        auth: authClient as any,
      });

      Logger.info("✅ Google Sheets API 初始化成功");
    } catch (error) {
      Logger.error("❌ Google Sheets API 初始化失败:", error);
      throw error;
    }
  }

  /**
   * 从Google Sheets读取简单格式数据
   */
  private async fetchSimpleSheetData(): Promise<SimpleSheetRow[]> {
    await this.initGoogleSheets();

    const response = await this.googleSheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: `${this.config.sheetName}!A1:Z1000`,
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];

    Logger.info(`📊 从Google Sheets获取到 ${rows.length - 1} 行数据`);
    Logger.info(`📋 表头: ${JSON.stringify(headers)}`);

    const sheetData: SimpleSheetRow[] = [];

    // 处理每一行数据
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;

      const rowData: SimpleSheetRow = {
        key: row[0],
        en: row[1] || "",
      };

      // 添加其他语言的翻译
      headers.forEach((header: string, index: number) => {
        if (index > 1 && this.config.languages.includes(header)) {
          rowData[header] = row[index] || "";
        }
      });

      if (rowData.en) {
        sheetData.push(rowData);
      }
    }

    Logger.info(`✅ 成功解析 ${sheetData.length} 条有效翻译数据`);
    return sheetData;
  }

  /**
   * 主同步方法
   */
  public async syncTranslations(): Promise<void> {
    try {
      Logger.info("🚀 开始简单格式翻译同步...");

      // 1. 从Google Sheets读取数据
      const sheetData = await this.fetchSimpleSheetData();

      // 2. 输出远程数据详情
      this.logSheetData(sheetData);

      // 3. 读取本地完整记录
      const localRecord = await this.loadLocalCompleteRecord();
      Logger.info(
        `📁 读取本地记录，包含 ${Object.keys(localRecord).length} 个模块`
      );

      // 4. 基于英文文案匹配并更新翻译
      const updatedRecord = await this.mergeTranslations(
        sheetData,
        localRecord
      );

      // 5. 保存更新后的完整记录
      await this.saveUpdatedCompleteRecord(updatedRecord);
      Logger.info("💾 已保存更新后的完整记录");

      // 6. 重新生成模块化翻译文件
      await this.regenerateModularTranslations(updatedRecord);
      Logger.info("🏗️ 已重新生成模块化翻译文件");

      Logger.info("✅ 简单格式同步完成！");
    } catch (error) {
      Logger.error("❌ 同步失败:", error);
      throw error;
    }
  }

  /**
   * 输出远程数据详情
   */
  private logSheetData(sheetData: SimpleSheetRow[]): void {
    Logger.info("\n📋 ===== 远程Google表格完整数据 =====");
    sheetData.forEach((row, index) => {
      Logger.info(`\n${index + 1}. 英文原文: "${row.en}"`);
      Logger.info("   各语言翻译:");
      Object.entries(row).forEach(([lang, translation]) => {
        if (lang !== "key" && lang !== "en") {
          Logger.info(`     ${lang}: "${translation}"`);
        }
      });
    });
    Logger.info("===== 远程数据输出完毕 =====\n");
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
   * 基于英文文案匹配并合并翻译数据
   */
  private async mergeTranslations(
    sheetData: SimpleSheetRow[],
    localRecord: CompleteTranslationRecord
  ): Promise<CompleteTranslationRecord> {
    const updatedRecord = JSON.parse(JSON.stringify(localRecord)); // 深拷贝
    let updateCount = 0;

    // 创建英文文案到远程翻译的映射
    const englishToRemoteMap = new Map<string, SimpleSheetRow>();
    sheetData.forEach((row) => {
      if (row.en) {
        englishToRemoteMap.set(row.en, row);
      }
    });

    // 遍历本地记录中的每个模块
    Object.entries(updatedRecord).forEach(([modulePath, moduleKeys]) => {
      Object.entries(
        moduleKeys as Record<string, Record<string, string>>
      ).forEach(([translationKey, translations]) => {
        const englishText = translations.en || translationKey;

        // 基于英文文案匹配：如果远程数据中存在相同的英文文案
        if (englishToRemoteMap.has(englishText)) {
          const remoteRow = englishToRemoteMap.get(englishText)!;

          Logger.info(
            `🔍 正在处理翻译: "${englishText}" (模块: ${modulePath})`
          );

          // 使用远程的所有语言翻译更新本地记录
          Object.entries(remoteRow).forEach(([lang, remoteTranslation]) => {
            if (
              lang !== "key" &&
              remoteTranslation &&
              remoteTranslation.trim()
            ) {
              const currentTranslation = translations[lang];

              // 直接使用远程翻译更新本地记录
              updatedRecord[modulePath][translationKey][lang] =
                remoteTranslation;

              // 只在值确实发生变化时记录更新日志和计数
              if (currentTranslation !== remoteTranslation) {
                updateCount++;
                Logger.info(
                  `🔄 更新翻译 [${modulePath}][${translationKey}][${lang}]: "${currentTranslation}" -> "${remoteTranslation}"`
                );
              }
            }
          });
        }
      });
    });

    Logger.info(`📊 总共更新了 ${updateCount} 条翻译`);
    return updatedRecord;
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
    await this.translationManager.generateModularFilesFromCompleteRecord();
  }
}

/**
 * 主函数 - 执行简单格式同步操作
 */
async function main() {
  try {
    // 从当前工作目录加载配置文件
    const configPath = path.join(process.cwd(), "i18n.config.js");
    Logger.info(`📄 正在加载配置文件: ${configPath}`);

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

    // 创建简单格式同步服务并执行同步
    const syncService = new SimpleFormatSyncService(resolvedConfig);
    await syncService.syncTranslations();
  } catch (error) {
    Logger.error("❌ 主函数执行失败:", error);
    process.exit(1);
  }
}

// 如果直接运行此脚本，则执行主函数
if (require.main === module) {
  main();
}
