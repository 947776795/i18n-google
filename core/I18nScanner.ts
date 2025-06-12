import type { I18nConfig } from "../types";
import { FileScanner } from "./FileScanner";
import { FileTransformer } from "./FileTransformer";
import { TranslationManager } from "./TranslationManager";
import { GoogleSheetsSync } from "./GoogleSheetsSync";

export class I18nScanner {
  private fileScanner: FileScanner;
  private fileTransformer: FileTransformer;
  private translationManager: TranslationManager;
  private googleSheetsSync: GoogleSheetsSync;

  constructor(private config: I18nConfig) {
    this.fileScanner = new FileScanner(config);
    this.fileTransformer = new FileTransformer(config);
    this.translationManager = new TranslationManager(config);
    this.googleSheetsSync = new GoogleSheetsSync(config);
  }

  /**
   * 执行扫描和翻译处理
   */
  public async scan(): Promise<void> {
    try {
      console.log("开始扫描流程...");

      // 1. 初始化翻译管理器
      console.log("1. 初始化翻译管理器...");
      await this.translationManager.initialize();

      // 2. 扫描文件
      console.log("2. 扫描文件...");
      const files = await this.fileScanner.scanFiles();
      console.log(`发现 ${files.length} 个文件:`);

      // 3. 处理每个文件
      console.log("3. 处理每个文件...");
      let totalResults = 0;
      for (const file of files) {
        const results = await this.fileTransformer.transformFile(file);
        results.forEach((result) => {
          this.translationManager.addTranslation(result);
          totalResults++;
        });
      }
      console.log(`总共收集到 ${totalResults} 个翻译项`);

      // 4. 从 Google Sheets 同步翻译
      console.log("4. 从 Google Sheets 同步翻译...");
      const remoteTranslations = await this.googleSheetsSync.syncFromSheet();
      this.translationManager.updateTranslations(remoteTranslations);

      // 5. 保存翻译文件
      console.log("5. 保存翻译文件...");
      await this.translationManager.saveTranslations();

      // 6. 同步到 Google Sheets
      console.log("6. 同步到 Google Sheets...");
      await this.googleSheetsSync.syncToSheet(
        this.translationManager.getTranslations()
      );

      console.log("扫描流程完成！");
    } catch (error) {
      console.error("扫描过程中发生错误:", error);
      throw error;
    }
  }
}
