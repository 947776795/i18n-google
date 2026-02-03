/**
 * JSX 文本提取器
 * 负责从 JSX 中提取纯文本节点
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
 * JSX 文本提取器
 */
export class JSXTextExtractor {
  constructor(private config: I18nConfig) {}

  /**
   * 提取源码中的 JSX 纯文本
   */
  extract(source: string, filePath: string): ExtractedContent[] {
    try {
      // 解析源码为AST
      const { root, j } = this.parseSource(source);

      const results: ExtractedContent[] = [];

      // 查找所有 JSX 文本节点
      root.find(j.JSXText).forEach((path: ASTPath<n.JSXText>) => {
        const content = this.extractFromJSXText(path, filePath);

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
   * 从 JSX 文本节点提取内容
   */
  private extractFromJSXText(
    path: ASTPath<n.JSXText>,
    filePath: string
  ): ExtractedContent | null {
    const node = path.node;
    const textValue = node.value;

    // 清理文本：去除前后空白字符（包括换行符），规范化内部空白
    let cleanedText = StringUtils.cleanExtractedText(textValue);

    // 如果是空字符串或只有空白字符，跳过
    if (!cleanedText) {
      return null;
    }

    // 🔧 关键修复：保留不完整标记的符号作为 key 的一部分
    // 检查是否有标记符号
    const hasStartMarker = cleanedText.startsWith(this.config.startMarker);
    const hasEndMarker = cleanedText.endsWith(this.config.endMarker);

    if (hasStartMarker && hasEndMarker) {
      // 完整的标记（如 ~text~），去掉标记符号
      cleanedText = StringUtils.formatString(cleanedText, this.config);
      cleanedText = StringUtils.cleanExtractedText(cleanedText);
    }
    // 注意：不完整的标记（如 "sdsd~" 或 "~asd"）保留原样，不处理
    // 这样 key 会是 "sdsd~" 或 "~asd"，在翻译文件中会有这些 keys

    // 如果去除标记后为空，跳过
    if (!cleanedText) {
      return null;
    }

    // 检查是否包含英文字符
    if (!StringUtils.containsEnglishCharacters(cleanedText)) {
      return null;
    }

    // 获取位置信息
    const position = this.getPosition(path);

    // 创建上下文
    const context = this.createContext(path, filePath);

    // 生成翻译键
    const translationKey = StringUtils.generateTranslationKey(filePath, cleanedText);

    return {
      type: 'jsx-text',
      originalText: textValue,
      cleanedText,
      translationKey,
      position,
      context,
      hasEnglish: true,
    };
  }

  /**
   * 获取节点位置信息
   */
  private getPosition(path: ASTPath<n.JSXText>): Position {
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
  private createContext(path: ASTPath<n.JSXText>, filePath: string): ExtractionContext {
    let parentType: string | undefined;
    if (path.parent?.node) {
      parentType = path.parent.node.type;
    }

    return {
      filePath,
      nodeType: 'JSXText',
      parentType,
      isInJSX: AstUtils.isInJSXContext(path),
      isInExpression: AstUtils.isInExpressionContext(path),
    };
  }
}
