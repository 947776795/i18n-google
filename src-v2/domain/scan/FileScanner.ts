/**
 * Domain - Scan Module
 * 文件扫描器 - 递归扫描目录，找到所有 page.tsx 和 layout.tsx
 */

import * as fs from 'fs';
import * as path from 'path';
import { I18nConfig } from '../../types/config';
import { ScanResult } from './PathMapper';
import { GlobUtils } from '../../utils/GlobUtils';

/**
 * 文件扫描器
 */
export class FileScanner {
  /**
   * 入口文件名列表
   */
  private static readonly ENTRY_FILES = ['page.tsx', 'layout.tsx'];

  /**
   * 递归扫描目录，返回所有 page.tsx/layout.tsx 的完整路径
   *
   * @param dir 要扫描的目录
   * @param config 配置
   * @returns 扫描结果数组
   */
  scan(dir: string, config: I18nConfig): ScanResult[] {
    const results: ScanResult[] = [];

    if (!fs.existsSync(dir)) {
      throw new Error(`目录不存在: ${dir}`);
    }

    this.scanRecursive(dir, results, config);
    return results;
  }

  /**
   * 递归扫描内部实现
   *
   * @param currentDir 当前目录
   * @param results 结果收集器
   * @param config 配置
   */
  private scanRecursive(currentDir: string, results: ScanResult[], config: I18nConfig): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // 检查是否应该忽略此目录
        if (this.shouldIgnore(fullPath, config)) {
          continue;
        }
        this.scanRecursive(fullPath, results, config);
      } else if (entry.isFile()) {
        // 检查是否为入口文件
        if (FileScanner.ENTRY_FILES.includes(entry.name)) {
          results.push({
            filePath: fullPath,
            fileName: entry.name,
            isEntry: true,
          });
        }
      }
    }
  }

  /**
   * 检查文件/目录是否应该被忽略
   *
   * @param filePath 文件路径
   * @param config 配置
   * @returns 是否应该忽略
   */
  private shouldIgnore(filePath: string, config: I18nConfig): boolean {
    // 检查 ignore 规则
    for (const pattern of config.ignore) {
      if (GlobUtils.matchPattern(filePath, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 判断文件是否为入口文件
   *
   * @param fileName 文件名
   * @returns 是否为入口文件
   */
  static isEntryFile(fileName: string): boolean {
    return FileScanner.ENTRY_FILES.includes(fileName);
  }
}
