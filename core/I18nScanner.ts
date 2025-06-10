import type { I18nConfig } from '../types';
import { FileScanner } from './FileScanner';
import { AstTransformer } from './AstTransformer';
import { TranslationManager } from './TranslationManager';
import { GoogleSheetsSync } from './GoogleSheetsSync';

export class I18nScanner {
  private fileScanner: FileScanner;
  private astTransformer: AstTransformer;
  private translationManager: TranslationManager;
  private googleSheetsSync: GoogleSheetsSync;

  constructor(private config: I18nConfig) {
    this.fileScanner = new FileScanner(config);
    this.astTransformer = new AstTransformer(config);
    this.translationManager = new TranslationManager(config);
    this.googleSheetsSync = new GoogleSheetsSync(config);
  }

  /**
   * 执行扫描和翻译处理
   */
  public async scan(): Promise<void> {
    try {
      // 1. 初始化翻译管理器
      await this.translationManager.initialize();

      // 2. 扫描文件
      const files = await this.fileScanner.scanFiles();

      // 3. 处理每个文件
      for (const file of files) {
        const results = await this.astTransformer.transformFile(file);
        results.forEach(result => {
          this.translationManager.addTranslation(result);
        });
      }

      // 4. 从 Google Sheets 同步翻译
      const remoteTranslations = await this.googleSheetsSync.syncFromSheet();
      this.translationManager.updateTranslations(remoteTranslations);

      // 5. 保存翻译文件
      await this.translationManager.saveTranslations();

      // 6. 同步到 Google Sheets
      await this.googleSheetsSync.syncToSheet(this.translationManager.getTranslations());
    } catch (error) {
      console.error('扫描过程中发生错误:', error);
      throw error;
    }
  }
} 