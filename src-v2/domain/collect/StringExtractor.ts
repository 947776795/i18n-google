/**
 * 字符串字面量提取器
 * 负责从源码中提取需要翻译的字符串字面量
 */

import * as jscodeshift from 'jscodeshift';
import type { ASTPath } from 'jscodeshift';
import { namedTypes as n } from 'ast-types';
import type { ExtractedContent, Position, ExtractionContext } from '../../types/extraction';
import type { I18nConfig } from '../../types/config';
import { StringUtils } from '../../utils/StringUtils';
import { AstUtils } from '../../utils/AstUtils';

type JSCodeshiftAPI = ReturnType<typeof jscodeshift.withParser>;
type JSCodeshiftCollection = ReturnType<JSCodeshiftAPI>;

/**
 * 字符串字面量提取器
 */
export class StringExtractor {
  constructor(private config: I18nConfig) {}

  /**
   * 提取源码中的所有标记字符串
   */
  extract(source: string, filePath: string): ExtractedContent[] {
    try {
      // 解析源码为AST
      const { root, j } = this.parseSource(source);

      const results: ExtractedContent[] = [];

      // 查找所有字符串字面量
      root.find(j.Literal).forEach((path: ASTPath<n.Literal>) => {
        const content = this.extractFromStringLiteral(path, filePath);

        if (content) {
          results.push(content);
        }
      });

      return results;
    } catch (error) {
      console.error(`Failed to extract from ${filePath}:`, error);
      return [];
    }
  }

  /**
   * 解析源码为AST
   */
  private parseSource(source: string): {
    root: JSCodeshiftCollection;
    j: JSCodeshiftAPI;
  } {
    const j = jscodeshift.withParser('tsx');
    const root = j(source);
    return { root, j };
  }

  /**
   * 从字符串字面量提取标记内容
   */
  private extractFromStringLiteral(
    path: ASTPath<n.Literal>,
    filePath: string
  ): ExtractedContent | null {
    // 检查是否为字符串字面量
    if (!AstUtils.isStringLiteral(path.node)) {
      return null;
    }

    const value = path.node.value;

    // 检查是否被标记符号包裹
    if (!StringUtils.isTranslatableString(value, this.config)) {
      return null;
    }

    // 跳过 import 语句中的字符串
    if (AstUtils.isInImportDeclaration(path)) {
      return null;
    }

    // 跳过 I18n.t() 调用中的字符串
    if (AstUtils.isInI18nCall(path)) {
      return null;
    }

    // 清理文本
    const cleanedText = StringUtils.cleanExtractedText(
      StringUtils.formatString(value, this.config)
    );

    // 检查是否为空
    if (!cleanedText) {
      return null;
    }

    // 获取位置信息
    const position = this.getPosition(path);

    // 创建上下文
    const context = this.createContext(path, filePath);

    // 生成翻译键
    const translationKey = StringUtils.generateTranslationKey(filePath, cleanedText);

    // 检查是否包含英文字符
    const hasEnglish = StringUtils.containsEnglishCharacters(cleanedText);

    return {
      type: 'string',
      originalText: value,
      cleanedText,
      translationKey,
      position,
      context,
      hasEnglish,
    };
  }

  /**
   * 获取节点位置信息
   */
  private getPosition(path: ASTPath<n.Literal>): Position {
    const loc = path.node.loc;

    if (!loc) {
      return { line: 1, column: 0 };
    }

    return {
      line: loc.start.line,
      column: loc.start.column,
    };
  }

  /**
   * 创建提取上下文
   */
  private createContext(path: ASTPath<n.Literal>, filePath: string): ExtractionContext {
    let parentType: string | undefined;
    if (path.parent?.node) {
      parentType = path.parent.node.type;
    }

    return {
      filePath,
      nodeType: 'StringLiteral',
      parentType,
      isInJSX: AstUtils.isInJSXContext(path),
      isInExpression: false,
    };
  }
}
