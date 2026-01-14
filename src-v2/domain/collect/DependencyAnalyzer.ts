/**
 * Domain - Collect Module
 * 依赖分析器 - 递归分析文件的 import 依赖
 */

import * as fs from 'fs';
import * as path from 'path';
import { I18nConfig } from '../../types/config';

/**
 * Import 信息
 */
export interface ImportInfo {
  /** 原始 import 语句 */
  raw: string;
  /** 导入路径 */
  path: string;
  /** 是否为默认导入 */
  isDefault: boolean;
  /** 导入的名称 */
  names: string[];
}

/**
 * 依赖分析器
 *
 * 职责：递归分析文件的 import 依赖
 */
export class DependencyAnalyzer {
  /**
   * 已访问文件集合（避免循环依赖）
   */
  private visited: Set<string> = new Set();

  /**
   * 路径别名映射（从 tsconfig.json 读取）
   */
  private pathAliases: Map<string, string> = new Map();

  constructor() {
    this.loadPathAliases();
  }

  /**
   * 递归分析文件依赖
   *
   * @param entryFile 入口文件路径
   * @param config 配置
   * @returns 所有相关文件列表
   */
  analyze(entryFile: string, config: I18nConfig): string[] {
    this.visited.clear();
    return this.analyzeRecursive(entryFile, config);
  }

  /**
   * 递归分析内部实现
   *
   * @param filePath 文件路径
   * @param config 配置
   * @returns 所有相关文件列表
   */
  private analyzeRecursive(filePath: string, config: I18nConfig): string[] {
    // 规范化路径
    const normalizedPath = path.normalize(filePath);

    // 检查是否已访问
    if (this.visited.has(normalizedPath)) {
      return [];
    }
    this.visited.add(normalizedPath);

    // 检查文件是否存在
    if (!fs.existsSync(normalizedPath)) {
      return [];
    }

    // 检查是否应该忽略
    if (this.shouldIgnore(normalizedPath, config)) {
      return [];
    }

    const results: string[] = [normalizedPath];

    // 读取文件内容
    const content = fs.readFileSync(normalizedPath, 'utf-8');

    // 提取 import 语句
    const imports = this.extractImports(content);

    // 递归分析每个导入
    for (const imp of imports) {
      const resolvedPath = this.resolveImportPath(imp.path, normalizedPath, config.rootDir);

      if (resolvedPath && fs.existsSync(resolvedPath)) {
        const dependencies = this.analyzeRecursive(resolvedPath, config);
        results.push(...dependencies);
      }
    }

    return results;
  }

  /**
   * 解析 import 语句
   *
   * @param content 源码内容
   * @returns Import 信息数组
   */
  extractImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];

    // 匹配 import 语句的正则
    // 支持:
    // - import Xxx from 'path'
    // - import { Xxx, Yyy } from 'path'
    // - import * as Xxx from 'path'
    // - import 'path' (side effect import)
    const importRegex = /import\s+(?:(?:(\w+)|(?:\*\s+as\s+(\w+))|(?:\{([^}]+)\}))\s+from\s+)?['"`]([^'"`]+)['"`]/g;

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const fullPath = match[4];
      const defaultImport = match[1];
      const starImport = match[2];
      const namedImports = match[3];

      const names: string[] = [];
      if (defaultImport) names.push(defaultImport);
      if (starImport) names.push(starImport);
      if (namedImports) {
        names.push(...namedImports.split(',').map(s => s.trim()));
      }

      imports.push({
        raw: match[0],
        path: fullPath,
        isDefault: !!defaultImport || !!starImport,
        names,
      });
    }

    return imports;
  }

  /**
   * 解析导入路径为绝对路径
   *
   * @param importPath 导入路径
   * @param currentFile 当前文件路径
   * @param rootDir 根目录
   * @returns 解析后的绝对路径，未找到返回 null
   */
  resolveImportPath(importPath: string, currentFile: string, rootDir: string): string | null {
    // 1. 处理路径别名 (如 @/)
    if (importPath.startsWith('@/')) {
      const aliasPath = this.resolveAlias(importPath, rootDir);
      if (aliasPath) return aliasPath;
    }

    // 2. 处理相对路径
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const currentDir = path.dirname(currentFile);
      let resolvedPath = path.join(currentDir, importPath);

      // 移除可能的扩展名（如 .tsx, .ts 等）
      resolvedPath = this.resolveExtension(resolvedPath);

      return resolvedPath;
    }

    // 3. 处理 node_modules 包（暂不处理）
    if (!importPath.startsWith('.')) {
      return null;
    }

    return null;
  }

  /**
   * 解析路径别名
   *
   * @param importPath 导入路径
   * @param rootDir 根目录
   * @returns 解析后的路径
   */
  private resolveAlias(importPath: string, rootDir: string): string | null {
    // 简单处理 @/ 别名
    if (importPath.startsWith('@/')) {
      const relativePath = importPath.slice(2);
      let fullPath = path.join(rootDir, relativePath);
      fullPath = this.resolveExtension(fullPath);
      return fullPath;
    }
    return null;
  }

  /**
   * 解析文件扩展名
   *
   * @param filePath 文件路径（可能不含扩展名）
   * @returns 带扩展名的文件路径
   */
  private resolveExtension(filePath: string): string {
    // 如果已有扩展名，直接返回
    const ext = path.extname(filePath);
    if (ext && ['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      return filePath;
    }

    // 尝试添加扩展名
    const extensions = ['.tsx', '.ts', '.jsx', '.js'];
    for (const ext of extensions) {
      if (fs.existsSync(filePath + ext)) {
        return filePath + ext;
      }
    }

    // 假设是 .tsx
    return filePath + '.tsx';
  }

  /**
   * 检查文件是否应该被忽略
   *
   * @param filePath 文件路径
   * @param config 配置
   * @returns 是否应该忽略
   */
  shouldIgnore(filePath: string, config: I18nConfig): boolean {
    // 检查 ignore 规则
    for (const pattern of config.ignore) {
      if (this.matchPattern(filePath, pattern)) {
        return true;
      }
    }

    // 检查 include 规则
    const ext = path.extname(filePath);
    const extWithoutDot = ext.slice(1);
    return !config.include.includes(extWithoutDot);
  }

  /**
   * 匹配 glob 模式
   *
   * @param filePath 文件路径
   * @param pattern glob 模式
   * @returns 是否匹配
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    // 简单实现，生产环境应使用 minimatch
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
    );
    return regex.test(filePath);
  }

  /**
   * 加载路径别名（从 tsconfig.json）
   */
  private loadPathAliases(): void {
    // 简化实现，生产环境应读取 tsconfig.json
    this.pathAliases.set('@/*', './src/*');
  }
}
