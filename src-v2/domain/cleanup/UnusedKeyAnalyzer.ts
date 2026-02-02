/**
 * Domain - Cleanup Module
 * 无用 Key 分析器 - 检测翻译记录中未被使用的 keys
 */

import { TranslationRecord } from '../../types/record';
import { CodeReference, UnusedKeyAnalysis } from '../../types/sync';

/**
 * 无用 Key 分析器
 *
 * 职责：检测翻译记录中未被代码引用的 keys
 *
 * 检测逻辑：
 * - 记录中的 keys - 当前引用的 keys = 无用的 keys
 *
 * 匹配规则：
 * - 精确匹配：folderName 和 key 完全相同
 * - 后缀匹配：引用路径后缀等于记录 folderName
 * - 同名文件：文件名相同
 */
export class UnusedKeyAnalyzer {
  /**
   * 分析无用的 keys
   *
   * @param record 翻译记录
   * @param references 当前代码引用
   * @returns 分析结果
   */
  analyze(record: TranslationRecord, references: Set<CodeReference>): UnusedKeyAnalysis {
    const unusedKeys: string[] = [];
    const formattedUnusedKeys: string[] = [];

    // 遍历记录中的所有 keys
    for (const [folderName, localeMap] of Object.entries(record)) {
      // 获取该文件夹下的所有唯一 keys
      const allKeys = new Set<string>();
      for (const localeFile of Object.keys(localeMap)) {
        Object.keys(localeMap[localeFile]).forEach(key => allKeys.add(key));
      }

      // 检查每个 key 是否被使用
      for (const key of allKeys) {
        if (!this.isKeyUsed(folderName, key, references)) {
          unusedKeys.push(key);
          formattedUnusedKeys.push(`[${folderName}][${key}]`);
        }
      }
    }

    return {
      unusedKeys,
      formattedUnusedKeys,
      total: unusedKeys.length,
    };
  }

  /**
   * 检查 key 是否被使用
   *
   * @param folderName 文件夹名称
   * @param key 翻译键
   * @param references 当前代码引用
   * @returns 是否被使用
   */
  isKeyUsed(
    folderName: string,
    key: string,
    references: Set<CodeReference>
  ): boolean {
    for (const ref of references) {
      // 1. 精确匹配
      if (ref.folderName === folderName && ref.key === key) {
        return true;
      }

      // 2. 后缀匹配：引用路径后缀等于记录 folderName
      if (ref.key === key && ref.folderName.endsWith(folderName)) {
        return true;
      }

      // 3. 同名文件匹配：文件名相同
      const refBaseName = ref.folderName.split('_').pop();
      const recordBaseName = folderName.split('_').pop();
      if (ref.key === key && refBaseName && refBaseName === recordBaseName) {
        return true;
      }
    }

    return false;
  }
}
