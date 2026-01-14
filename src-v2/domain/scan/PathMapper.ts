/**
 * Domain - Scan Module
 * 路径映射器 - 计算文件对应的 folderName
 *
 * 新规则：每个 page.tsx 和 layout.tsx 视为独立的平级模块
 */

import * as path from 'path';
import { I18nConfig } from '../../types/config';

/**
 * 扫描结果
 */
export interface ScanResult {
  /** 文件完整路径 */
  filePath: string;
  /** 文件名 */
  fileName: string;
  /** 是否为入口文件 */
  isEntry: boolean;
}

/**
 * 路径映射器
 *
 * 规则：每个 page.tsx 和 layout.tsx 视为独立的平级模块
 *
 * 示例:
 * - src/app/page.tsx → "app_page"
 * - src/app/layout.tsx → "app_layout"
 * - src/app/sub1/page.tsx → "app_sub1_page"
 * - src/app/sub1/layout.tsx → "app_sub1_layout"
 */
export class PathMapper {
  /**
   * 基础前缀
   */
  private static readonly BASE_PREFIX = 'app';

  /**
   * 文件路径 → folderName
   *
   * @param filePath 文件完整路径
   * @param baseDir 基础目录
   * @returns folderName
   */
  toFolderName(filePath: string, baseDir: string): string {
    // 1. 规范化路径（统一处理 ./ 前缀）
    const normalizedBase = baseDir.replace(/^\.\//, '');
    const normalizedFile = filePath.replace(/^\.\//, '');

    // 2. 计算相对路径
    let relative = normalizedFile.replace(normalizedBase, '');
    relative = relative.replace(/^\//, ''); // 移除开头的 /

    // 3. 获取文件名（不含扩展名）
    const fileName = path.basename(relative, path.extname(relative));

    // 4. 移除文件名，只保留目录部分
    const pathWithoutFile = path.dirname(relative);

    // 5. 构建基础路径（目录部分）
    let basePath = '';
    if (pathWithoutFile === '.' || pathWithoutFile === '') {
      basePath = PathMapper.BASE_PREFIX;
    } else {
      // 直接使用目录路径替换 / 为 _
      // "app" → "app", "app/sub1" → "app_sub1"
      basePath = pathWithoutFile.replace(/\//g, '_');
    }

    // 6. 添加文件名（page/layout）
    // 这样每个 page.tsx 和 layout.tsx 都是独立的模块
    return `${basePath}_${fileName}`;
  }

  /**
   * 批量转换文件路径为 folderName
   *
   * @param filePaths 文件路径数组
   * @param baseDir 基础目录
   * @returns folderName 数组
   */
  batchToFolderNames(filePaths: string[], baseDir: string): string[] {
    return filePaths.map(p => this.toFolderName(p, baseDir));
  }

  /**
   * 从 folderName 还原路径
   *
   * @param folderName 文件夹名称
   * @returns 相对路径（不含基础目录）
   */
  fromFolderName(folderName: string): string {
    // 分割基础前缀和文件名
    // 例: "app_sub1_page" → ["app", "sub1", "page"]
    const parts = folderName.split('_');

    // 第一部分是 "app"，最后一部分是文件名（page/layout）
    if (parts.length < 2) {
      return '';
    }

    const fileName = parts.pop()!; // 移除文件名
    parts.shift(); // 移除 "app" 前缀

    // 重建路径
    if (parts.length === 0) {
      return fileName; // 根目录，如 "page" → ""
    }

    return parts.join('/') + '/' + fileName;
  }
}
