import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import type { I18nConfig } from '../types';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export class FileScanner {
  constructor(private config: I18nConfig) {}

  /**
   * 扫描指定目录下的所有符合条件的文件
   */
  public async scanFiles(): Promise<string[]> {
    return this.scanDirectory(path.join(process.cwd(), this.config.rootDir));
  }

  /**
   * 递归扫描目录
   */
  private async scanDirectory(dir: string): Promise<string[]> {
    const entries = await readdir(dir);
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        if (!this.config.ignore.some(pattern => fullPath.includes(pattern))) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        }
      } else {
        const ext = path.extname(fullPath).slice(1);
        if (this.config.include.includes(ext) && !this.config.ignore.some(pattern => fullPath.includes(pattern))) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }
} 