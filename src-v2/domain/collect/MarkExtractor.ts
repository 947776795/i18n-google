/**
 * Domain - Collect Module
 * 标记提取器 - 从源码中提取标记文本
 */

import { I18nConfig } from '../../types/config';

/**
 * 标记信息
 */
export interface MarkInfo {
  /** 标记文本内容 */
  text: string;
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
    // 返回去重的文本列表
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

    // 构建正则：匹配 ~text~ 格式
    const regex = new RegExp(`${escapedStart}([^${escapedEnd}]+)${escapedEnd}`, 'g');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      results.push({
        text: match[1],
        index: match.index,
      });
    }

    return results;
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
