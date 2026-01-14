/**
 * Domain - Collect Module
 * 配置加载器 - 读取并解析 i18n.config.js
 */

import * as fs from 'fs';
import * as path from 'path';
import { I18nConfig } from '../../types/config';

/**
 * Import 信息
 */
interface ImportInfo {
  /** 导入路径 */
  path: string;
  /** 是否为默认导入 */
  isDefault: boolean;
  /** 导入的名称 */
  names: string[];
}

/**
 * 配置加载器
 *
 * 职责：从项目根目录加载 i18n.config.js
 */
export class ConfigLoader {
  /**
   * 配置文件名
   */
  private static readonly CONFIG_FILE = 'i18n.config.js';

  /**
   * 从项目根目录加载配置
   *
   * @param projectRoot 项目根目录
   * @returns 配置对象
   */
  async load(projectRoot: string): Promise<I18nConfig> {
    const configPath = path.join(projectRoot, ConfigLoader.CONFIG_FILE);

    if (!fs.existsSync(configPath)) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }

    return this.parseConfig(configPath);
  }

  /**
   * 解析配置文件
   *
   * @param configPath 配置文件路径
   * @returns 配置对象
   */
  private parseConfig(configPath: string): I18nConfig {
    // 读取配置文件内容
    const content = fs.readFileSync(configPath, 'utf-8');

    // 使用 eval 解析 CommonJS module.exports（生产环境应使用更安全的方式）
    // 注意：这里假设配置文件是纯对象，不包含复杂逻辑
    const exports: { [key: string]: any } = {};
    const module = { exports };

    // 创建一个安全的执行环境来解析配置
    const configContent = content
      .replace(/module\.exports\s*=/, 'return')
      .replace(/export\s/, '');

    const configFn = new Function(configContent);
    const config = configFn();

    return this.normalizeConfig(config);
  }

  /**
   * 规范化配置，填充默认值
   *
   * @param config 原始配置
   * @returns 规范化后的配置
   */
  private normalizeConfig(config: any): I18nConfig {
    return {
      rootDir: config.rootDir || './src',
      outputDir: config.outputDir || './src/translate',
      languages: config.languages || ['en', 'ko', 'zh-Hans'],
      ignore: config.ignore || ['**/node_modules/**', '**/test/**', '**/*.test.ts', '**/*.test.tsx'],
      spreadsheetId: config.spreadsheetId || '',
      sheetName: config.sheetName || 'i18n',
      keyFile: config.keyFile || '',
      startMarker: config.startMarker || '~',
      endMarker: config.endMarker || '~',
      include: config.include || ['js', 'jsx', 'ts', 'tsx'],
      logLevel: config.logLevel || 'normal',
      sheetsReadRange: config.sheetsReadRange || 'A1:Z10000',
      apiKey: config.apiKey || '',
      sheetsMaxRows: config.sheetsMaxRows || 10000,
      testMode: config.testMode || false,
      llmRetries: config.llmRetries || 3,
      llmTimeout: config.llmTimeout || 30000,
      llmTemperature: config.llmTemperature || 0.3,
      llmModel: config.llmModel || 'gpt-3.5-turbo',
    };
  }

  /**
   * 在指定目录中查找配置文件
   *
   * @param startDir 开始查找的目录
   * @returns 配置文件路径，未找到返回 null
   */
  static findConfigFile(startDir: string): string | null {
    let currentDir = path.resolve(startDir);

    while (currentDir !== path.parse(currentDir).root) {
      const configPath = path.join(currentDir, ConfigLoader.CONFIG_FILE);
      if (fs.existsSync(configPath)) {
        return configPath;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    return null;
  }
}
