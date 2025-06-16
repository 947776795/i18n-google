import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import type { I18nConfig } from "../types";
import type { TransformResult } from "./AstTransformer";
import { I18nError, I18nErrorType, ErrorHandler } from "./errors/I18nError";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

export interface TranslationMap {
  [key: string]: string;
}

export interface TranslationData {
  [language: string]: TranslationMap;
}

export interface TranslationBackup {
  timestamp: string;
  data: TranslationData;
  checksum: string;
}

export class TranslationManager {
  private translations: TranslationData = {};

  constructor(private config: I18nConfig) {}

  /**
   * 初始化翻译管理器
   */
  public async initialize(): Promise<void> {
    try {
      await this.checkOutputDir();
      await this.loadExistingTranslations();
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
   * 更新翻译 - 合并远程翻译到本地翻译
   */
  public updateTranslations(remoteTranslations: TranslationData): void {
    // 合并远程翻译到本地翻译，而不是覆盖
    Object.entries(remoteTranslations).forEach(([lang, translations]) => {
      if (!this.translations[lang]) {
        this.translations[lang] = {};
      }
      // 远程翻译优先，但保留本地新增的翻译
      Object.assign(this.translations[lang], translations);
    });
  }

  /**
   * 保存翻译到文件
   */
  public async saveTranslations(): Promise<void> {
    try {
      await Promise.all(
        Object.entries(this.translations).map(async ([lang, translations]) => {
          const filePath = path.join(this.config.outputDir, `${lang}.json`);
          try {
            await writeFile(filePath, JSON.stringify(translations, null, 2));
          } catch (error) {
            throw ErrorHandler.createFileWriteError(filePath, error as Error);
          }
        })
      );
    } catch (error) {
      if (error instanceof I18nError) {
        throw error;
      }
      throw new I18nError(
        I18nErrorType.FILE_WRITE_ERROR,
        "保存翻译文件失败",
        { originalError: error },
        ["检查输出目录权限", "确认磁盘空间是否充足"]
      );
    }
  }

  /**
   * 检查输出目录
   */
  private async checkOutputDir(): Promise<void> {
    const dir = path.join(process.cwd(), this.config.outputDir);
    try {
      if (!fs.existsSync(dir)) {
        await mkdir(dir, { recursive: true });
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

  /**
   * 加载已存在的翻译
   */
  private async loadExistingTranslations(): Promise<void> {
    await Promise.all(
      this.config.languages.map(async (lang) => {
        const filePath = path.join(this.config.outputDir, `${lang}.json`);
        try {
          const content = await readFile(filePath, "utf-8");
          try {
            this.translations[lang] = JSON.parse(content);
            this.validateTranslationData(this.translations[lang], lang);
          } catch (parseError) {
            throw ErrorHandler.createDataCorruptionError(
              `翻译文件 ${lang}.json`,
              { filePath, parseError: (parseError as Error).message }
            );
          }
        } catch (error) {
          if (error instanceof I18nError) {
            throw error;
          }
          // 文件不存在时创建空的翻译对象
          this.translations[lang] = {};
        }
      })
    );
  }

  /**
   * 删除指定的翻译Key
   */
  public deleteTranslations(keysToDelete: string[]): {
    deletedCount: number;
    affectedLanguages: string[];
  } {
    const affectedLanguages: string[] = [];
    let deletedCount = 0;

    keysToDelete.forEach((key) => {
      Object.keys(this.translations).forEach((lang) => {
        if (this.translations[lang][key]) {
          delete this.translations[lang][key];
          if (!affectedLanguages.includes(lang)) {
            affectedLanguages.push(lang);
          }
          deletedCount++;
        }
      });
    });

    return { deletedCount, affectedLanguages };
  }

  /**
   * 原子性删除翻译Key并保存
   */
  public async deleteTranslationsAtomically(keysToDelete: string[]): Promise<{
    deletedCount: number;
    affectedLanguages: string[];
  }> {
    // 创建备份
    const backup = this.createBackup();

    try {
      // 执行删除
      const result = this.deleteTranslations(keysToDelete);

      // 保存到文件
      await this.saveTranslations();

      return result;
    } catch (error) {
      // 恢复备份
      this.restoreFromBackup(backup);

      if (error instanceof I18nError) {
        throw error;
      }
      throw new I18nError(
        I18nErrorType.DATA_CORRUPTION,
        "删除翻译时发生错误，已恢复到删除前状态",
        { originalError: error, keysToDelete },
        ["检查文件系统权限", "确认磁盘空间充足", "稍后重试操作"]
      );
    }
  }

  /**
   * 创建翻译数据备份
   */
  public createBackup(): TranslationBackup {
    const data = JSON.parse(JSON.stringify(this.translations));
    const checksum = this.calculateChecksum(data);
    return {
      timestamp: new Date().toISOString(),
      data,
      checksum,
    };
  }

  /**
   * 从备份恢复翻译数据
   */
  public restoreFromBackup(backup: TranslationBackup): void {
    // 验证备份完整性
    const currentChecksum = this.calculateChecksum(backup.data);
    if (currentChecksum !== backup.checksum) {
      throw new I18nError(
        I18nErrorType.DATA_CORRUPTION,
        "备份数据校验失败",
        { backup },
        ["重新创建备份", "检查数据完整性"]
      );
    }

    this.translations = JSON.parse(JSON.stringify(backup.data));
  }

  /**
   * 验证翻译数据格式
   */
  private validateTranslationData(data: any, language: string): void {
    if (!data || typeof data !== "object") {
      throw new I18nError(
        I18nErrorType.INVALID_FORMAT,
        `翻译文件格式错误: ${language}`,
        { data, language },
        ["检查JSON格式是否正确", "确认文件编码为UTF-8", "重新生成翻译文件"]
      );
    }

    // 检查键值对格式
    for (const [key, value] of Object.entries(data)) {
      if (typeof key !== "string" || typeof value !== "string") {
        throw new I18nError(
          I18nErrorType.INVALID_FORMAT,
          `翻译数据格式错误: ${language}中的键值对格式不正确`,
          { key, value, language },
          ["确保所有键和值都是字符串", "检查特殊字符是否正确转义"]
        );
      }
    }
  }

  /**
   * 计算数据校验和
   */
  private calculateChecksum(data: TranslationData): string {
    const crypto = require("crypto");
    const content = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash("md5").update(content).digest("hex");
  }
}
