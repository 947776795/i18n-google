/**
 * Glob 模式匹配工具类
 */

/**
 * Glob 模式匹配工具
 */
export class GlobUtils {
  /**
   * 检查文件路径是否匹配 glob 模式
   *
   * @param filePath 文件路径
   * @param pattern glob 模式（支持 ** 和 * 通配符）
   * @returns 是否匹配
   */
  static matchPattern(filePath: string, pattern: string): boolean {
    // 简单实现，将 glob 模式转换为正则表达式
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
    );
    return regex.test(filePath);
  }
}
