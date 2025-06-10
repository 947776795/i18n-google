import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import type { I18nConfig } from '../types';
import type { TransformResult } from './AstTransformer';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

export interface TranslationMap {
  [key: string]: string;
}

export interface TranslationData {
  [language: string]: TranslationMap;
}

export class TranslationManager {
  private translations: TranslationData = {};

  constructor(private config: I18nConfig) {}

  /**
   * 初始化翻译管理器
   */
  public async initialize(): Promise<void> {
    await this.checkOutputDir();
    await this.loadExistingTranslations();
  }

  /**
   * 添加新的翻译项
   */
  public addTranslation(result: TransformResult): void {
    this.config.languages.forEach((lang) => {
      if (!this.translations[lang]) {
        this.translations[lang] = {};
      }
      if (!this.translations[lang][result.key]) {
        this.translations[lang][result.key] = result.text;
      }
    });
  }

  /**
   * 获取所有翻译
   */
  public getTranslations(): TranslationData {
    return this.translations;
  }

  /**
   * 更新翻译
   */
  public updateTranslations(translations: TranslationData): void {
    this.translations = translations;
  }

  /**
   * 保存翻译到文件
   */
  public async saveTranslations(): Promise<void> {
    await Promise.all(
      Object.entries(this.translations).map(([lang, translations]) => {
        const filePath = path.join(this.config.outputDir, `${lang}.json`);
        return writeFile(filePath, JSON.stringify(translations, null, 2));
      }),
    );
  }

  /**
   * 检查输出目录
   */
  private async checkOutputDir(): Promise<void> {
    const dir = path.join(process.cwd(), this.config.outputDir);
    if (!fs.existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  /**
   * 加载已存在的翻译
   */
  private async loadExistingTranslations(): Promise<void> {
    await Promise.all(
      this.config.languages.map(async (lang) => {
        const filePath = path.join(this.config.outputDir, `${lang}.json`);
        try {
          const content = await readFile(filePath, 'utf-8');
          this.translations[lang] = JSON.parse(content);
        } catch (error) {
          this.translations[lang] = {};
        }
      }),
    );
  }
} 