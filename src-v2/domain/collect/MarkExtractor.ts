/**
 * Domain - Collect Module
 * 标记提取器 - 从源码中提取标记文本
 */

import { I18nConfig } from '../../types/config';

/**
 * 标记信息
 */
export interface MarkInfo {
  /** 标记文本内容（包含 ~ 符号） */
  text: string;
  /** 清理后的文本（不包含 ~ 符号） */
  cleanedText: string;
  /** 在源码中的位置 */
  index: number;
}

/**
 * 标记提取器
 *
 * 职责：从源码中提取标记文本（如 ~text~）
 */
export class MarkExtractor {
  /**
   * 从源码提取所有标记文本
   *
   * @param source 源码字符串
   * @param config 配置（包含 startMarker 和 endMarker）
   * @returns 提取的标记文本数组（去重）
   */
  extract(source: string, config: I18nConfig): string[] {
    const marks = this.extractWithInfo(source, config.startMarker, config.endMarker);
    // 返回去重的完整标记列表（带 ~ 符号）
    const uniqueTexts = new Set(marks.map(m => m.text));
    return Array.from(uniqueTexts);
  }

  /**
   * 从源码提取所有标记文本（带位置信息）
   *
   * @param source 源码字符串
   * @param startMarker 开始标记
   * @param endMarker 结束标记
   * @returns 标记信息数组
   */
  extractWithInfo(source: string, startMarker: string, endMarker: string): MarkInfo[] {
    const results: MarkInfo[] = [];

    // 转义特殊字符
    const escapedStart = this.escapeRegExp(startMarker);
    const escapedEnd = this.escapeRegExp(endMarker);

    // 构建正则：匹配 ~text~ 格式，捕获整个标记
    const regex = new RegExp(`${escapedStart}([^${escapedEnd}]+)${escapedEnd}`, 'g');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      const cleanedText = match[1]; // 去掉标记符号的文本

      // 跳过包含 JSX 标签的内容（简化版不支持混合内容）
      if (this.containsJSXTags(cleanedText)) {
        continue;
      }

      // 跳过包含变量表达式的标记（如 ${1}）
      if (this.containsVariableExpression(cleanedText)) {
        continue;
      }

      const fullMark = match[0]; // 完整标记（带 ~ 符号）
      results.push({
        text: fullMark,
        cleanedText,
        index: match.index,
      });
    }

    return results;
  }

  /**
   * 检查文本是否包含变量表达式（如 ${1}）
   * 这种情况不应该被提取
   */
  private containsVariableExpression(text: string): boolean {
    return /\$\{.+\}/.test(text);
  }

  /**
   * 检查文本是否包含 JSX 标签
   * 简化版不支持混合内容，需要跳过
   */
  private containsJSXTags(text: string): boolean {
    // 检测是否包含 HTML/JSX 标签
    return /<\/?[a-zA-Z][a-zA-Z0-9]*/.test(text);
  }

  /**
   * 检查源码是否包含标记
   *
   * @param source 源码字符串
   * @param config 配置
   * @returns 是否包含标记
   */
  hasMarks(source: string, config: I18nConfig): boolean {
    const marks = this.extractWithInfo(source, config.startMarker, config.endMarker);
    return marks.length > 0;
  }

  /**
   * 统计源码中的标记数量（去重前）
   *
   * @param source 源码字符串
   * @param config 配置
   * @returns 标记数量
   */
  countMarks(source: string, config: I18nConfig): number {
    return this.extractWithInfo(source, config.startMarker, config.endMarker).length;
  }

  /**
   * 转义正则表达式特殊字符
   *
   * @param str 输入字符串
   * @returns 转义后的字符串
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
