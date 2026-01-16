/**
 * 模板字符串提取器
 * 负责从源码中提取需要翻译的模板字符串
 */

import * as jscodeshift from 'jscodeshift';
import type { ASTPath } from 'jscodeshift';
import { namedTypes as n } from 'ast-types';
import type { ExtractedContent, VariableMapping, Position, ExtractionContext } from '../../types/extraction';
import type { I18nConfig } from '../../types/config';
import { StringUtils } from '../../utils/StringUtils';
import { AstUtils } from '../../utils/AstUtils';

type JSCodeshiftAPI = ReturnType<typeof jscodeshift.withParser>;
type JSCodeshiftCollection = ReturnType<JSCodeshiftAPI>;

/**
 * 模板字符串提取器
 */
export class TemplateExtractor {
  constructor(private config: I18nConfig) {}

  /**
   * 提取源码中的所有标记模板字符串
   */
  extract(source: string, filePath: string): ExtractedContent[] {
    try {
      // 解析源码为AST
      const { root, j } = this.parseSource(source);

      const results: ExtractedContent[] = [];

      // 查找所有模板字符串
      root.find(j.TemplateLiteral).forEach((path: ASTPath<n.TemplateLiteral>) => {
        const content = this.extractFromTemplateLiteral(path, filePath);

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
   * 从模板字符串提取标记内容
   */
  private extractFromTemplateLiteral(
    path: ASTPath<n.TemplateLiteral>,
    filePath: string
  ): ExtractedContent | null {
    const node = path.node;

    // 构建完整文本（包含占位符）
    const fullText = this.buildFullTemplateText(node);

    // 检查是否被标记符号包裹
    if (!StringUtils.isTranslatableString(fullText, this.config)) {
      return null;
    }

    // 跳过 import 语句中的模板字符串
    if (AstUtils.isInImportDeclaration(path)) {
      return null;
    }

    // 跳过 I18n.t() 调用中的模板字符串
    if (AstUtils.isInI18nCall(path)) {
      return null;
    }

    // 检查是否只有变量（没有静态文本）
    if (this.hasOnlyVariables(node)) {
      return null;
    }

    // 构建清理后的翻译文本
    const cleanedText = this.buildCleanedTemplateText(node);

    // 检查是否为空
    if (!cleanedText) {
      return null;
    }

    // 提取变量映射
    const variables = this.extractVariables(node);

    // 获取位置信息
    const position = this.getPosition(path);

    // 创建上下文
    const context = this.createContext(path, filePath);

    // 生成翻译键
    const translationKey = StringUtils.generateTranslationKey(filePath, cleanedText);

    // 检查是否包含英文字符
    const hasEnglish = StringUtils.containsEnglishCharacters(cleanedText);

    return {
      type: 'template',
      originalText: fullText,
      cleanedText,
      translationKey,
      position,
      context,
      variables,
      hasEnglish,
    };
  }

  /**
   * 构建模板字符串的完整文本（包含占位符）
   * 用于检测模板字符串是否包含标记
   */
  private buildFullTemplateText(node: n.TemplateLiteral): string {
    let text = '';
    const quasis = node.quasis || [];
    const expressions = node.expressions || [];

    for (let i = 0; i < quasis.length; i++) {
      text += quasis[i].value.cooked || quasis[i].value.raw;
      if (i < expressions.length) {
        // 用 ${...} 表示变量部分，用于重建原始文本
        text += '${...}';
      }
    }

    return text;
  }

  /**
   * 构建清理后的翻译文本（包含占位符）
   */
  private buildCleanedTemplateText(node: n.TemplateLiteral): string {
    const quasis = node.quasis || [];
    const expressions = node.expressions || [];
    let translationText = '';

    for (let i = 0; i < quasis.length; i++) {
      const quasiText = quasis[i].value.cooked || quasis[i].value.raw;

      // 对每个静态部分应用 format 方法
      const formattedQuasi = StringUtils.formatString(quasiText, this.config);
      translationText += formattedQuasi;

      if (i < expressions.length) {
        // 使用 %{var0} 格式以兼容现有的翻译系统
        translationText += `%{var${i}}`;
      }
    }

    // 对整体翻译文本进行清理
    return StringUtils.cleanExtractedText(translationText);
  }

  /**
   * 提取模板字符串中的变量
   */
  private extractVariables(node: n.TemplateLiteral): VariableMapping[] | undefined {
    const expressions = node.expressions || [];

    if (expressions.length === 0) {
      return undefined;
    }

    const variables: VariableMapping[] = [];

    expressions.forEach((expr: n.Expression, index: number) => {
      const placeholder = `var${index}`;
      const expressionCode = this.getExpressionCode(expr);
      const type = this.getExpressionType(expr);
      const position = this.getPositionFromNode(expr);

      variables.push({
        placeholder,
        expression: expressionCode,
        type,
        position,
      });
    });

    return variables;
  }

  /**
   * 获取表达式的代码字符串
   */
  private getExpressionCode(expr: n.Expression): string {
    if (n.Identifier.check(expr)) {
      return expr.name;
    } else if (n.MemberExpression.check(expr)) {
      const property = expr.property;
      const propertyName = n.Identifier.check(property) ? property.name : 'property';
      return `${this.getExpressionCode(expr.object)}.${propertyName}`;
    } else if (n.BinaryExpression.check(expr)) {
      return `${this.getExpressionCode(expr.left)} ${expr.operator} ${this.getExpressionCode(expr.right)}`;
    }
    // 其他复杂表达式，简单返回 "expression"
    return 'expression';
  }

  /**
   * 获取表达式类型
   */
  private getExpressionType(expr: n.Expression): 'identifier' | 'member' | 'complex' {
    if (n.Identifier.check(expr)) return 'identifier';
    if (n.MemberExpression.check(expr)) return 'member';
    return 'complex';
  }

  /**
   * 从节点获取位置信息
   */
  private getPositionFromNode(node: n.Node): Position {
    const loc = node.loc;
    if (!loc) {
      return { line: 1, column: 0 };
    }

    return {
      line: loc.start.line,
      column: loc.start.column,
    };
  }

  /**
   * 获取节点位置信息
   */
  private getPosition(path: ASTPath<n.TemplateLiteral>): Position {
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
  private createContext(path: ASTPath<n.TemplateLiteral>, filePath: string): ExtractionContext {
    let parentType: string | undefined;
    if (path.parent?.node) {
      parentType = path.parent.node.type;
    }

    return {
      filePath,
      nodeType: 'TemplateLiteral',
      parentType,
      isInJSX: AstUtils.isInJSXContext(path),
      isInExpression: AstUtils.isInExpressionContext(path),
    };
  }

  /**
   * 检查模板字符串是否只包含变量（没有静态文本）
   * 例如：`~${1}~` 或 `${a}${b}` → 只有变量/标记，不提取
   * 例如：`~${a}text~` 或 `text${a}` → 有静态文本，提取
   */
  private hasOnlyVariables(node: n.TemplateLiteral): boolean {
    // 构建清理后的翻译文本
    const cleanedText = this.buildCleanedTemplateText(node);

    // 移除所有占位符 %{var0}, %{var1}, 等等
    const textWithoutPlaceholders = cleanedText.replace(/%\{var\d+\}/g, '').trim();

    // 如果移除占位符后没有剩余文本，说明只有变量（或只有标记）
    return textWithoutPlaceholders.length === 0;
  }
}
