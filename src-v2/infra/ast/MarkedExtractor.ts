
/**
 * 标记内容提取器
 * 使用jscodeshift解析源码，识别和提取标记内容
 */

import * as jscodeshift from "jscodeshift";
import type { ASTPath } from "jscodeshift";
import { namedTypes as n } from "ast-types";
import type { 
  ExtractedContent, 
  ExtractionContext, 
  Position,
  VariableMapping,
  ElementFactory,
  MixedContentParseResult,
  TextFragment
} from "../../types/extraction";
import type { I18nConfig } from "../../types/config";



// 定义 jscodeshift API 类型
type JSCodeshiftAPI = ReturnType<typeof jscodeshift.withParser>;
type JSCodeshiftCollection = ReturnType<JSCodeshiftAPI>;

/**
 * 标记内容提取器
 */
export class MarkedExtractor {
  constructor(private config: I18nConfig) {}

  /**
   * 提取源码中的所有标记内容
   * 分两步：1.正则提取最外层标记范围 2.AST分析内容类型
   */
  extract(source: string, filePath: string): ExtractedContent[] {
    try {
      // 1. 正则提取：找到标记符号中间的内容（最外层匹配）
      const markedTexts = this.extractWithRegex(source);
      
      // 2. AST分析：分析每个提取的内容类型和结构
      return markedTexts.map((text, index) => 
        this.analyzeContent(text, index, filePath)
      );
    } catch (error) {
      console.error(`Failed to extract from ${filePath}:`, error);
      return [];
    }
  }

  /**
   * 正则提取：找到标记符号中间的内容
   * 职责：只负责识别范围，不分析内容
   * 提取从第一个开始标记到最后一个结束标记的完整区域
   */
  private extractWithRegex(source: string): string[] {
    const results: string[] = [];
    let searchStart = 0;
    
    while (true) {
      // 找到第一个开始标记
      const startIndex = source.indexOf(this.config.startMarker, searchStart);
      if (startIndex === -1) break;
      
      // 找到最后一个结束标记（最外层匹配）
      const endIndex = source.lastIndexOf(this.config.endMarker, source.length);
      if (endIndex === -1 || endIndex < startIndex + this.config.startMarker.length) break;
      
      // 提取从第一个开始标记到最后一个结束标记之间的内容（不包含标记符号）
      const extractedText = source.slice(
        startIndex + this.config.startMarker.length, 
        endIndex
      ).replace(new RegExp(`${this.config.endMarker}$`), ''); // 移除结尾的结束标记
      
      if (this.containsEnglish(extractedText)) {
        results.push(extractedText);
      }
      
      // 移动到最后一个匹配之后，寻找下一个可能的匹配
      searchStart = endIndex + this.config.endMarker.length;
    }
    
    return results;
  }

  /**
   * AST分析：分析提取出的内容类型和结构
   * 职责：分析内容，不负责识别范围
   */
  private analyzeContent(text: string, index: number, filePath: string): ExtractedContent {
    const position = { line: 1, column: 0 }; // 简化处理，实际可以更精确
    
    // 检查是否为模板字符串
    if (this.looksLikeTemplateString(text)) {
      return this.analyzeTemplate(text, position);
    }
    
    // 检查是否包含JSX元素
    if (this.containsJSXElements(text)) {
      return this.analyzeJSXMixed(text, position);
    }
    
    // 默认为字符串
    return this.analyzeString(text, position);
  }

  /**
   * 分析模板字符串类型
   */
  private analyzeTemplate(text: string, position: Position): ExtractedContent {
    const variables = this.extractTemplateVariables(text);
    
    return {
      type: 'template',
      originalText: text,
      cleanedText: text.trim(),
      position,
      context: { filePath: '', nodeType: 'TemplateLiteral', parentType: undefined, isInJSX: false, isInExpression: false },
      variables,
      hasEnglish: true
    };
  }

  /**
   * 分析JSX混合内容类型
   */
  private analyzeJSXMixed(text: string, position: Position): ExtractedContent {
    // 解析复杂的JSX混合内容
    const parseResult = this.parseMixedContent(text);
    
    return {
      type: 'jsx-mixed',
      originalText: text,
      cleanedText: parseResult.flattenedContent,
      position,
      context: { filePath: '', nodeType: 'JSXElement', parentType: undefined, isInJSX: false, isInExpression: false },
      variables: [], // 混合内容中的变量在元素中处理
      elements: parseResult.elements,
      hasEnglish: true
    };
  }

  /**
   * 解析复杂的混合内容（支持嵌套HTML和边界文本）
   * 输入: "~<strong>text<strong>inner</strong></strong>ddd~"
   */
  private parseMixedContent(text: string): MixedContentParseResult {
    const elements: ElementFactory[] = [];
    const textFragments: TextFragment[] = [];
    let placeholderIndex = 0;

    // 字符级解析以正确处理嵌套
    let result = '';
    let currentIndex = 0;
    const tagStack: Array<{
      tagName: string;
      placeholder: string;
      startPos: number;
      startPosInResult: number;
    }> = [];

    while (currentIndex < text.length) {
      const nextTagStart = text.indexOf('<', currentIndex);

      if (nextTagStart === -1) {
        // 没有更多标签，添加剩余文本
        const remainingText = text.slice(currentIndex);
        if (remainingText.trim()) {
          textFragments.push({
            content: remainingText,
            position: { line: 1, column: currentIndex },
            isEmpty: false
          });
          result += remainingText;
        }
        break;
      }

      // 添加标签前的文本
      const beforeText = text.slice(currentIndex, nextTagStart);
      if (beforeText.trim()) {
        textFragments.push({
          content: beforeText,
          position: { line: 1, column: currentIndex },
          isEmpty: false
        });
        result += beforeText;
      }

      // 解析标签
      const tagEnd = text.indexOf('>', nextTagStart);
      if (tagEnd === -1) {
        // 标签格式错误，跳过
        currentIndex = nextTagStart + 1;
        continue;
      }

      const tagContent = text.slice(nextTagStart, tagEnd + 1);

      // 检查是否为自闭合标签
      if (tagContent.endsWith('/>')) {
        const tagNameMatch = tagContent.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
        if (tagNameMatch) {
          const placeholder = `el${placeholderIndex++}`;
          elements.push({
            placeholder,
            elementType: tagNameMatch[1],
            hasTextContent: false,
            position: { line: 1, column: nextTagStart },
            attributes: {},
            isNested: tagStack.length > 0,
            parentPlaceholder: tagStack.length > 0 ? tagStack[tagStack.length - 1].placeholder : undefined
          });
          result += `<${placeholder}/>`;
        }
        currentIndex = tagEnd + 1;
      }
      // 检查是否为闭合标签
      else if (tagContent.startsWith('</')) {
        const tagNameMatch = tagContent.match(/^<\/([a-zA-Z][a-zA-Z0-9]*)>$/);
        if (tagNameMatch && tagStack.length > 0) {
          const openingTag = tagStack.pop();
          if (openingTag && openingTag.tagName === tagNameMatch[1]) {
            // 找到匹配的闭合标签
            const innerContent = text.slice(openingTag.startPos, nextTagStart);
            const placeholder = openingTag.placeholder;
            const startPosInResult = openingTag.startPosInResult;
            
            // 递归解析内部内容
            const innerParseResult = this.parseMixedContent(innerContent);
            
            // 合并解析结果
            elements.push({
              placeholder,
              elementType: openingTag.tagName,
              hasTextContent: !!innerParseResult.flattenedContent.trim(),
              position: { line: 1, column: openingTag.startPos },
              attributes: {},
              isNested: tagStack.length > 0,
              parentPlaceholder: tagStack.length > 0 ? tagStack[tagStack.length - 1]?.placeholder : undefined
            });
            
            // 更新结果字符串
            result = result.slice(0, startPosInResult) + 
                    `<${placeholder}>${innerParseResult.flattenedContent}</${placeholder}>`;
          }
        }
        currentIndex = tagEnd + 1;
      }
      // 检查是否为开始标签
      else {
        const tagNameMatch = tagContent.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
        if (tagNameMatch) {
          const placeholder = `el${placeholderIndex++}`;
          tagStack.push({
            tagName: tagNameMatch[1],
            placeholder,
            startPos: tagEnd + 1,
            startPosInResult: result.length
          });
        }
        currentIndex = tagEnd + 1;
      }
    }

    return {
      elements,
      textFragments,
      flattenedContent: result,
      hasNestedElements: elements.some(el => el.isNested)
    };
  }

  /**
   * 分析字符串类型
   */
  private analyzeString(text: string, position: Position): ExtractedContent {
    return {
      type: 'string',
      originalText: text,
      cleanedText: text.trim(),
      position,
      context: { filePath: '', nodeType: 'StringLiteral', parentType: undefined, isInJSX: false, isInExpression: false },
      hasEnglish: true
    };
  }

  /**
   * 检查是否像模板字符串
   */
  private looksLikeTemplateString(text: string): boolean {
    return text.includes('${') && text.includes('}');
  }

  /**
   * 检查是否包含JSX元素
   */
  private containsJSXElements(text: string): boolean {
    return /<\w+[^>]*>/.test(text);
  }

  /**
   * 提取模板字符串中的变量
   */
  private extractTemplateVariables(text: string): VariableMapping[] {
    const variables: VariableMapping[] = [];
    const varRegex = /\$\{([^}]+)\}/g;
    let match;
    let index = 0;
    
    while ((match = varRegex.exec(text)) !== null) {
      variables.push({
        placeholder: `var${index}`,
        expression: match[1],
        type: match[1].includes('.') ? 'member' : 'identifier',
        position: { line: 1, column: 0 }
      });
      index++;
    }
    
    return variables;
  }

  /**
   * 检查源码是否包含标记内容
   */
  hasMarkedContent(source: string): boolean {
    const { startMarker, endMarker } = this.config;
    return source.includes(startMarker) && source.includes(endMarker);
  }

  /**
   * 解析源码为AST
   */
  private parseSource(source: string): { root: JSCodeshiftCollection; j: JSCodeshiftAPI } {
    const j = jscodeshift.withParser("tsx");
    const root = j(source);
    return { root, j };
  }

  /**
   * 从字符串字面量提取标记内容
   */
  private extractFromStringLiteral(
    path: ASTPath<n.StringLiteral>, 
    filePath: string
  ): ExtractedContent | null {
    const node = path.node;
    const value = node.value;

    if (!value || !this.isMarkedString(value)) {
      return null;
    }

    const position = this.getPositionFromNode(node);
    const context = this.createContext(path, filePath, 'StringLiteral');
    
    return {
      type: 'string',
      originalText: value,
      cleanedText: this.cleanText(value),
      position,
      context,
      hasEnglish: this.containsEnglish(value),
    };
  }

  /**
   * 从模板字符串提取标记内容
   */
  private extractFromTemplateLiteral(
    path: ASTPath<n.TemplateLiteral>,
    filePath: string
  ): ExtractedContent | null {
    const node = path.node;
    const fullText = this.buildFullTemplateText(node);

    if (!this.isMarkedString(fullText)) {
      return null;
    }

    const position = this.getPositionFromNode(node);
    const context = this.createContext(path, filePath, 'TemplateLiteral');
    const variables = this.extractVariables(node);
    
    return {
      type: 'template',
      originalText: fullText,
      cleanedText: this.buildCleanedTemplateText(node),
      position,
      context,
      variables,
      hasEnglish: this.containsEnglish(fullText),
    };
  }

  /**
   * 从JSX元素提取混合标记内容
   */
  private extractFromJSXElement(
    path: ASTPath<n.JSXElement>,
    filePath: string
  ): ExtractedContent | null {
    const element = path.node;
    const fullText = this.buildJSXFullText(element);

    if (!this.isMarkedString(fullText)) {
      return null;
    }

    const position = this.getPositionFromNode(element);
    const context = this.createContext(path, filePath, 'JSXElement');
    const { variables, elements } = this.extractJSXContent(element);
    
    return {
      type: 'jsx-mixed',
      originalText: fullText,
      cleanedText: this.cleanJSXText(fullText),
      position,
      context,
      variables,
      elements,
      hasEnglish: this.containsEnglish(fullText),
    };
  }

  /**
   * 检查字符串是否被标记符号包裹
   */
  private isMarkedString(text: string): boolean {
    const { startMarker, endMarker } = this.config;
    const startIndex = text.indexOf(startMarker);
    const endIndex = text.lastIndexOf(endMarker);
    
    return (
      startIndex !== -1 &&
      endIndex !== -1 &&
      endIndex > startIndex + startMarker.length
    );
  }

  /**
   * 清理标记文本
   */
  private cleanText(text: string): string {
    const { startMarker, endMarker } = this.config;
    const startIndex = text.indexOf(startMarker);
    const endIndex = text.lastIndexOf(endMarker);
    
    // 提取从第一个开始标记到最后一个结束标记之间的内容
    let cleaned = text.slice(startIndex + startMarker.length, endIndex);
    
    // 清理空白字符
    cleaned = cleaned
      .replace(/^\s+/, "")
      .replace(/\s+$/, "")
      .replace(/\s+/g, " ");

    return cleaned;
  }

  /**
   * 构建模板字符串的完整文本
   */
  private buildFullTemplateText(node: n.TemplateLiteral): string {
    let text = "";
    const quasis = node.quasis || [];
    const expressions = node.expressions || [];

    for (let i = 0; i < quasis.length; i++) {
      text += quasis[i].value.cooked || quasis[i].value.raw;
      if (i < expressions.length) {
        text += "${var}"; // 占位符
      }
    }
    return text;
  }

  /**
   * 构建清理后的模板文本
   */
  private buildCleanedTemplateText(node: n.TemplateLiteral): string {
    const { startMarker, endMarker } = this.config;
    const fullText = this.buildFullTemplateText(node);
    let cleaned = fullText.slice(startMarker.length, fullText.length - endMarker.length);
    
    // 清理空白字符
    cleaned = cleaned
      .replace(/^\s+/, "")
      .replace(/\s+$/, "")
      .replace(/\s+/g, " ");

    return cleaned;
  }

  /**
   * 提取模板字符串中的变量
   */
  private extractVariables(node: n.TemplateLiteral): VariableMapping[] {
    const variables: VariableMapping[] = [];
    const expressions = node.expressions || [];

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
   * 构建JSX元素的完整文本
   */
  private buildJSXFullText(element: n.JSXElement): string {
    let text = "";
    const children = element.children || [];

    for (const child of children) {
      if (n.JSXText.check(child)) {
        text += child.value;
      } else if (n.JSXExpressionContainer.check(child)) {
        text += "${var}";
      } else if (n.JSXElement.check(child)) {
        text += "<element>";
      }
    }
    return text;
  }

  /**
   * 提取JSX内容
   */
  private extractJSXContent(element: n.JSXElement): { variables: VariableMapping[], elements: ElementFactory[] } {
    const variables: VariableMapping[] = [];
    const elements: ElementFactory[] = [];
    let varIndex = 0;
    let elementIndex = 0;

    const children = element.children || [];
    for (const child of children) {
      if (n.JSXExpressionContainer.check(child) && child.expression) {
        variables.push({
          placeholder: `var${varIndex++}`,
          expression: this.getExpressionCode(child.expression),
          type: this.getExpressionType(child.expression),
          position: this.getPositionFromNode(child.expression),
        });
      } else if (n.JSXElement.check(child)) {
        elements.push({
          placeholder: `el${elementIndex++}`,
          elementType: this.getElementName(child),
          hasTextContent: this.hasTextChildren(child),
          position: this.getPositionFromNode(child),
          attributes: this.extractAttributes(child),
        });
      }
    }

    return { variables, elements };
  }

  /**
   * 清理JSX文本
   */
  private cleanJSXText(text: string): string {
    const { startMarker, endMarker } = this.config;
    let cleaned = text.slice(startMarker.length, text.length - endMarker.length);
    
    // 移除标记符号
    cleaned = text.replace(new RegExp(this.escapeRegExp(startMarker), 'g'), '');
    cleaned = cleaned.replace(new RegExp(this.escapeRegExp(endMarker), 'g'), '');
    
    // 清理空白字符
    cleaned = cleaned
      .replace(/^\s+/, "")
      .replace(/\s+$/, "")
      .replace(/\s+/g, " ");

    return cleaned;
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
    }
    return "expression";
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
   * 获取元素名称
   */
  private getElementName(element: n.JSXElement): string {
    const name = element.openingElement.name;
    if (n.JSXIdentifier.check(name)) {
      return name.name;
    }
    return 'component';
  }

  /**
   * 检查元素是否有文本子节点
   */
  private hasTextChildren(element: n.JSXElement): boolean {
    const children = element.children || [];
    return children.some(child => 
      (n.JSXText.check(child) && child.value.trim()) ||
      n.JSXExpressionContainer.check(child)
    );
  }

  /**
   * 提取元素属性
   */
  private extractAttributes(element: n.JSXElement): Record<string, any> {
    const attributes: Record<string, any> = {};
    const attrs = element.openingElement.attributes || [];

    for (const attr of attrs) {
      if (n.JSXAttribute.check(attr)) {
        const nameNode = attr.name;
        const value = attr.value;
        
        let attrName: string;
        if (n.JSXIdentifier.check(nameNode)) {
          attrName = nameNode.name;
        } else {
          continue;
        }
        
        if (n.StringLiteral.check(value)) {
          attributes[attrName] = value.value;
        } else if (n.JSXExpressionContainer.check(value) && value.expression) {
          attributes[attrName] = this.getExpressionCode(value.expression);
        }
      }
    }

    return attributes;
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
   * 创建提取上下文
   */
  private createContext(path: ASTPath<any>, filePath: string, nodeType: string): ExtractionContext {
    return {
      filePath,
      nodeType,
      parentType: path.parent?.node?.type,
      isInJSX: this.isInJSXContext(path),
      isInExpression: this.isInExpressionContext(path),
    };
  }

  /**
   * 检查是否在JSX上下文中
   */
  private isInJSXContext(path: ASTPath<any>): boolean {
    let current = path.parent;
    while (current) {
      if (current.node?.type === "JSXElement" || 
          current.node?.type === "JSXFragment") {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 检查是否在表达式上下文中
   */
  private isInExpressionContext(path: ASTPath<any>): boolean {
    let current = path.parent;
    while (current) {
      if (current.node?.type === "JSXExpressionContainer") {
        return true;
      }
      if (current.node?.type === "JSXElement" || 
          current.node?.type === "JSXFragment") {
        return false;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 检查文本是否包含英文字符
   */
  private containsEnglish(text: string): boolean {
    return /[a-zA-Z]/.test(text);
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}