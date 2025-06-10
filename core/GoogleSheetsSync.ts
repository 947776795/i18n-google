import { google } from 'googleapis';
import type { I18nConfig } from '../types';
import type { TranslationData } from './TranslationManager';

export class GoogleSheetsSync {
  private googleSheets: any;

  constructor(private config: I18nConfig) {
    this.initGoogleSheets();
  }

  /**
   * 初始化 Google Sheets API
   */
  private async initGoogleSheets() {
    const auth = new google.auth.GoogleAuth({
      keyFile: this.config.keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    this.googleSheets = google.sheets({ version: 'v4', auth: authClient });
  }

  /**
   * 从 Google Sheets 同步翻译
   */
  public async syncFromSheet(): Promise<TranslationData> {
    const response = await this.googleSheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: `${this.config.sheetName}!A1:Z1000`,
    });

    const rows = response.data.values || [];
    const headers = rows[0];
    const langIndices = new Map<string, number>();
    const translations: TranslationData = {};

    headers.forEach((header: string, index: number) => {
      if (this.config.languages.includes(header)) {
        langIndices.set(header, index);
      }
    });

    // 更新翻译
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const key = row[0];

      langIndices.forEach((index, lang) => {
        if (row[index]) {
          if (!translations[lang]) {
            translations[lang] = {};
          }
          translations[lang][key] = row[index];
        }
      });
    }

    return translations;
  }

  /**
   * 将翻译同步到 Google Sheets
   */
  public async syncToSheet(translations: TranslationData): Promise<void> {
    const headers = ['key', ...this.config.languages];
    const values = [headers];

    // 构建数据行
    const keys = new Set<string>();
    Object.values(translations).forEach(langTranslations => {
      Object.keys(langTranslations).forEach(key => keys.add(key));
    });

    keys.forEach(key => {
      const row = [key];
      this.config.languages.forEach(lang => {
        row.push(translations[lang]?.[key] || '');
      });
      values.push(row);
    });

    // 更新 Google Sheets
    await this.googleSheets.spreadsheets.values.update({
      spreadsheetId: this.config.spreadsheetId,
      range: `${this.config.sheetName}!A1:${String.fromCharCode(65 + headers.length)}${values.length}`,
      valueInputOption: 'RAW',
      resource: { values },
    });
  }
} 