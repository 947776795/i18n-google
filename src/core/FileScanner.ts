import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { minimatch } from "minimatch";
import type { I18nConfig } from "../types";

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
   * 检查路径是否应该被忽略
   */
  protected shouldIgnore(filePath: string): boolean {
    return this.config.ignore.some((pattern) => {
      // 对于简单的目录名匹配
      if (!pattern.includes("*") && !pattern.includes("?")) {
        return filePath.includes(pattern);
      }
      // 对于 glob 模式，使用相对于根目录的路径进行匹配
      const rootDir = path.join(process.cwd(), this.config.rootDir);
      const relativePath = path.relative(rootDir, filePath);
      return minimatch(relativePath, pattern);
    });
  }

  /**
   * 递归扫描目录
   */
  protected async scanDirectory(dir: string): Promise<string[]> {
    const entries = await readdir(dir);
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        if (!this.shouldIgnore(fullPath)) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        }
      } else {
        const ext = path.extname(fullPath).slice(1);
        if (this.config.include.includes(ext) && !this.shouldIgnore(fullPath)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }
}
