import * as jscodeshift from "jscodeshift";
import type { ASTPath } from "jscodeshift";
import { namedTypes as n } from "ast-types";
import type { I18nConfig } from "../types";
import { StringUtils, Logger } from "../utils/StringUtils";
import { AstUtils } from "../utils/AstUtils";
import * as fs from "fs";

export interface TransformResult {
  key: string;
  text: string;
}

export interface ExistingReference {
  key: string; // I18n Key
  filePath: string; // 文件路径
  lineNumber: number; // 行号
  columnNumber: number; // 列号
  callExpression: string; // 完整的调用表达式 "I18n.t('8a709a33')"
}

export interface FileAnalysisResult {
  existingReferences: ExistingReference[]; // 现有的引用
  newTranslations: TransformResult[]; // 新生成的翻译
  transformedCode: string; // 转换后的代码
}

interface TemplateProcessResult {
  translationResult: TransformResult;
  callExpr: n.CallExpression;
}

// 定义 jscodeshift API 类型
type JSCodeshiftAPI = ReturnType<typeof jscodeshift.withParser>;
type JSCodeshiftCollection = ReturnType<JSCodeshiftAPI>;

/**
 * AST 转换器 - 负责将源码中的文本转换为 I18n 调用
 * 这是一个纯粹的转换逻辑模块，不包含文件 I/O 操作
 */
export class AstTransformer {
  constructor(private config: I18nConfig) {}

  /**
   * 转换源码字符串为包含 I18n 调用的代码
   * @param source - 源码字符串
   * @param filePath - 文件路径（用于生成翻译键）
   * @returns 转换结果和修改后的代码
   */
  public transformSource(
    source: string,
    filePath: string
  ): { results: TransformResult[]; transformedCode: string } {
    const j = jscodeshift.withParser("tsx");
    const root = j(source);
    const results: TransformResult[] = [];

    // 查找需要翻译的字符串字面量（带标记符号）
    this.transformStringLiterals(root, j, filePath, results);

    // 查找需要翻译的模板字符串（带标记符号）
    this.transformTemplateLiterals(root, j, filePath, results);

    // 查找需要翻译的JSX文本节点（纯文本）
    this.transformJSXTextNodes(root, j, filePath, results);

    // 添加 I18n 导入
    if (results.length > 0) {
      this.addI18nImport(j, root);
    }

    const transformedCode = root.toSource();

    return { results, transformedCode };
  }

  /**
   * 收集源码中现有的 I18n.t() 调用
   * @param source - 源码字符串
   * @param filePath - 文件路径
   * @returns 现有的 I18n 引用列表
   */
  public collectExistingI18nCalls(
    source: string,
    filePath: string
  ): ExistingReference[] {
    Logger.debug(
      `🔍 [DEBUG] AstTransformer.collectExistingI18nCalls: ${filePath}`
    );

    const j = jscodeshift.withParser("tsx");
    const root = j(source);
    const references: ExistingReference[] = [];

    Logger.debug(`📊 [DEBUG] 开始查找 I18n.t() 调用...`);

    // 查找所有 I18n.t() 调用
    root.find(j.CallExpression).forEach((path: ASTPath<n.CallExpression>) => {
      const callExpr = path.node;

      Logger.debug(`🔍 [DEBUG] 检查调用表达式: ${path.node.type}`);

      // 检查是否是 I18n.t() 调用
      if (this.isI18nTCall(callExpr)) {
        Logger.debug(`✅ [DEBUG] 找到 I18n.t() 调用`);

        const keyArg = callExpr.arguments[0];
        Logger.debug(`🔑 [DEBUG] 第一个参数类型: ${keyArg?.type}`);

        // 处理字符串字面量参数
        if (n.Literal.check(keyArg) && typeof keyArg.value === "string") {
          const key = keyArg.value;
          const loc = callExpr.loc;

          Logger.debug(`📝 [DEBUG] 字符串字面量 key: "${key}"`);
          Logger.debug(
            `📍 [DEBUG] 位置信息: ${
              loc ? `${loc.start.line}:${loc.start.column}` : "null"
            }`
          );

          if (loc && loc.start) {
            const ref = {
              key,
              filePath,
              lineNumber: loc.start.line,
              columnNumber: loc.start.column,
              callExpression: `I18n.t("${key}")`,
            };
            references.push(ref);
            Logger.debug(
              `✅ [DEBUG] 添加字符串字面量引用: ${JSON.stringify(ref)}`
            );
          } else {
            Logger.debug(`⚠️  [DEBUG] 字符串字面量缺少位置信息`);
          }
        }
        // 处理模板字面量参数（如果是纯字符串）
        else if (n.TemplateLiteral.check(keyArg)) {
          Logger.debug(
            `📝 [DEBUG] 模板字面量，表达式数量: ${keyArg.expressions.length}, quasis数量: ${keyArg.quasis.length}`
          );

          // 只处理没有表达式的纯字符串模板
          if (keyArg.expressions.length === 0 && keyArg.quasis.length === 1) {
            const key =
              keyArg.quasis[0].value.cooked || keyArg.quasis[0].value.raw;
            const loc = callExpr.loc;

            Logger.debug(`📝 [DEBUG] 纯字符串模板 key: "${key}"`);
            Logger.debug(
              `📍 [DEBUG] 位置信息: ${
                loc ? `${loc.start.line}:${loc.start.column}` : "null"
              }`
            );

            if (loc && loc.start) {
              const ref = {
                key,
                filePath,
                lineNumber: loc.start.line,
                columnNumber: loc.start.column,
                callExpression: `I18n.t(\`${key}\`)`,
              };
              references.push(ref);
              Logger.debug(
                `✅ [DEBUG] 添加模板字面量引用: ${JSON.stringify(ref)}`
              );
            } else {
              Logger.debug(`⚠️  [DEBUG] 模板字面量缺少位置信息`);
            }
          } else {
            Logger.debug(`⚠️  [DEBUG] 跳过复杂模板字面量（有表达式）`);
          }
        } else {
          Logger.debug(
            `⚠️  [DEBUG] 跳过非字符串参数: ${keyArg?.type || "undefined"}`
          );
        }
      } else {
        // 只在找到其他调用表达式时记录（避免太多日志）
        const callee = callExpr.callee;
        if (n.MemberExpression.check(callee)) {
          const objectName = n.Identifier.check(callee.object)
            ? callee.object.name
            : "unknown";
          const propertyName = n.Identifier.check(callee.property)
            ? callee.property.name
            : "unknown";
          if (objectName === "I18n" || propertyName === "t") {
            Logger.debug(
              `🔍 [DEBUG] 跳过非 I18n.t() 调用: ${objectName}.${propertyName}`
            );
          }
        }
      }
    });

    Logger.debug(
      `📊 [DEBUG] 完成扫描，共找到 ${references.length} 个 I18n.t() 引用`
    );
    return references;
  }

  /**
   * 扩展的转换方法，同时返回现有引用和新翻译
   * @param source - 源码字符串
   * @param filePath - 文件路径
   * @returns 完整的文件分析结果
   */
  public analyzeAndTransformSource(
    source: string,
    filePath: string
  ): FileAnalysisResult {
    // 1. 收集现有引用
    const existingReferences = this.collectExistingI18nCalls(source, filePath);

    // 2. 进行转换
    const { results: newTranslations, transformedCode } = this.transformSource(
      source,
      filePath
    );

    return {
      existingReferences,
      newTranslations,
      transformedCode,
    };
  }

  /**
   * 检查调用表达式是否是 I18n.t() 调用
   */
  private isI18nTCall(callExpr: n.CallExpression): boolean {
    const callee = callExpr.callee;

    // 检查是否是成员表达式 (I18n.t)
    if (n.MemberExpression.check(callee)) {
      const object = callee.object;
      const property = callee.property;

      // 检查对象是否是 I18n
      if (n.Identifier.check(object) && object.name === "I18n") {
        // 检查属性是否是 t
        if (n.Identifier.check(property) && property.name === "t") {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 转换字符串字面量
   */
  private transformStringLiterals(
    root: JSCodeshiftCollection,
    j: JSCodeshiftAPI,
    filePath: string,
    results: TransformResult[]
  ): void {
    root.find(j.Literal).forEach((path: ASTPath<n.Literal>) => {
      if (
        AstUtils.isStringLiteral(path.node) &&
        StringUtils.isTranslatableString(path.node.value, this.config)
      ) {
        const text = StringUtils.formatString(path.node.value, this.config);
        const key = StringUtils.generateTranslationKey(filePath, text);
        results.push({ key, text });

        // 创建 I18n.t 调用表达式
        const callExpr = AstUtils.createI18nCall(key);

        // 替换节点
        this.replaceWithI18nCall(path, callExpr, j);
      }
    });
  }

  /**
   * 转换模板字符串
   */
  private transformTemplateLiterals(
    root: JSCodeshiftCollection,
    j: JSCodeshiftAPI,
    filePath: string,
    results: TransformResult[]
  ): void {
    root.find(j.TemplateLiteral).forEach((path: ASTPath<n.TemplateLiteral>) => {
      const templateResult = this.handleTemplateLiteral(path, filePath, j);
      if (templateResult) {
        results.push(templateResult.translationResult);
        this.replaceWithI18nCall(path, templateResult.callExpr, j);
      }
    });
  }

  /**
   * 转换 JSX 文本节点
   */
  private transformJSXTextNodes(
    root: JSCodeshiftCollection,
    j: JSCodeshiftAPI,
    filePath: string,
    results: TransformResult[]
  ): void {
    // 首先处理包含混合内容的JSX元素
    const processedElements = new Set<n.JSXElement>();

    root.find(j.JSXElement).forEach((path: ASTPath<n.JSXElement>) => {
      const mixedResult = this.handleJSXMixedContent(path, filePath, j);
      if (mixedResult) {
        results.push(mixedResult.translationResult);
        // 替换整个元素的children为单个I18n调用
        const jsxExpr = AstUtils.createJSXExpressionContainer(
          mixedResult.callExpr
        );
        path.node.children = [jsxExpr];
        processedElements.add(path.node);
      }
    });

    // 然后处理纯文本节点（跳过已经处理过的元素中的文本）
    root.find(j.JSXText).forEach((path: ASTPath<n.JSXText>) => {
      // 检查是否在已处理的元素中
      let parentElement = path.parent;
      while (parentElement && !n.JSXElement.check(parentElement.node)) {
        parentElement = parentElement.parent;
      }

      if (
        parentElement &&
        processedElements.has(parentElement.node as n.JSXElement)
      ) {
        return; // 跳过已处理的元素中的文本
      }

      const textResult = this.handleJSXText(path, filePath, j);
      if (textResult) {
        results.push(textResult.translationResult);
        this.replaceWithI18nCall(path, textResult.callExpr, j);
      }
    });
  }

  /**
   * 统一的节点替换逻辑
   */
  private replaceWithI18nCall(
    path: ASTPath<n.Node>,
    callExpr: n.CallExpression,
    j: JSCodeshiftAPI
  ): void {
    const isInJSX = AstUtils.isInJSXContext(path);

    if (isInJSX) {
      // 检查当前节点的父节点类型
      const parentType = path.parent?.node?.type;

      if (parentType === "JSXExpressionContainer") {
        // 如果已经在JSX表达式容器中，直接替换表达式内容
        path.replace(callExpr);
      } else {
        // 在JSX属性或文本位置，需要包装为表达式容器
        const jsxExpr = AstUtils.createJSXExpressionContainer(callExpr);
        path.replace(jsxExpr);
      }
    } else {
      // 在普通JavaScript中，直接替换
      path.replace(callExpr);
    }
  }

  /**
   * 处理JSX文本节点（纯文本，不需要标记符号）
   */
  private handleJSXText(
    path: ASTPath<n.JSXText>,
    filePath: string,
    j: JSCodeshiftAPI
  ): TemplateProcessResult | null {
    const node = path.node;
    const textValue = node.value;

    // 去除前后空白字符，但保留内部空格
    const trimmedText = textValue.trim();

    // 如果是空字符串或只有空白字符，跳过
    if (!trimmedText) {
      return null;
    }

    // 检查是否包含英文字符，如果不包含则跳过
    if (!StringUtils.containsEnglishCharacters(trimmedText)) {
      return null;
    }

    // JSX文本节点直接处理，不需要检查标记符号
    const key = StringUtils.generateTranslationKey(filePath, trimmedText);

    // 创建 I18n.t 调用
    const callExpr = AstUtils.createI18nCall(key);

    return {
      translationResult: { key, text: trimmedText },
      callExpr,
    };
  }

  /**
   * 处理包含混合内容的JSX元素（文本 + 表达式）
   * 示例：<div>Hello {name}, welcome!</div>
   */
  private handleJSXMixedContent(
    path: ASTPath<n.JSXElement>,
    filePath: string,
    j: JSCodeshiftAPI
  ): TemplateProcessResult | null {
    const element = path.node;
    const children = element.children || [];

    // 检查是否包含混合内容（至少有一个文本节点和一个表达式）
    const hasText = children.some(
      (child) => n.JSXText.check(child) && child.value.trim()
    );
    const hasExpression = children.some((child) =>
      n.JSXExpressionContainer.check(child)
    );

    if (!hasText || !hasExpression) {
      return null;
    }

    // 构建翻译文本和表达式列表
    let translationText = "";
    const expressions: n.Expression[] = [];
    let hasEnglishContent = false;

    for (const child of children) {
      if (n.JSXText.check(child)) {
        const textValue = child.value;
        // 检查文本是否包含英文字符
        if (StringUtils.containsEnglishCharacters(textValue)) {
          hasEnglishContent = true;
        }
        translationText += textValue;
      } else if (
        n.JSXExpressionContainer.check(child) &&
        child.expression &&
        !n.JSXEmptyExpression.check(child.expression)
      ) {
        // 添加占位符
        translationText += `%{var${expressions.length}}`;
        expressions.push(child.expression as n.Expression);
      }
    }

    // 如果没有英文内容，跳过
    if (!hasEnglishContent) {
      return null;
    }

    // 清理翻译文本（去除多余空白）
    translationText = translationText.replace(/\s+/g, " ").trim();

    if (!translationText) {
      return null;
    }

    const key = StringUtils.generateTranslationKey(filePath, translationText);

    // 构建 I18n.t 调用
    let optionsObj: n.ObjectExpression | undefined;
    if (expressions.length > 0) {
      const properties = expressions.map((expr, index) =>
        AstUtils.createProperty(`var${index}`, expr)
      );
      optionsObj = AstUtils.createObjectExpression(properties);
    }

    const callExpr = AstUtils.createI18nCall(key, optionsObj);

    return {
      translationResult: { key, text: translationText },
      callExpr,
    };
  }

  /**
   * 处理模板字符串（带标记符号）
   */
  private handleTemplateLiteral(
    path: ASTPath<n.TemplateLiteral>,
    filePath: string,
    j: JSCodeshiftAPI
  ): TemplateProcessResult | null {
    const node = path.node;

    // 构建模板字符串的完整文本
    const fullTemplateText = this.buildTemplateText(node);

    // 检查是否需要翻译
    if (!StringUtils.isTranslatableString(fullTemplateText, this.config)) {
      return null;
    }

    // 构建带占位符的翻译文本
    const translationText = this.buildTranslationText(node);
    const key = StringUtils.generateTranslationKey(filePath, translationText);

    // 构建 I18n.t 调用
    const callExpr = this.buildI18nCall(node, key, j);

    return {
      translationResult: { key, text: translationText },
      callExpr,
    };
  }

  /**
   * 构建模板字符串的完整文本（包含变量部分）
   */
  private buildTemplateText(node: n.TemplateLiteral): string {
    let templateText = "";
    const expressions = node.expressions || [];
    const quasis = node.quasis || [];

    for (let i = 0; i < quasis.length; i++) {
      templateText += quasis[i].value.cooked || quasis[i].value.raw;
      if (i < expressions.length) {
        // 用简单的占位符表示变量部分，用于检查是否需要翻译
        templateText += "${var}";
      }
    }

    return templateText;
  }

  /**
   * 构建用于翻译的文本（静态部分 + %{var0} 占位符）
   */
  private buildTranslationText(node: n.TemplateLiteral): string {
    const expressions = node.expressions || [];
    const quasis = node.quasis || [];
    let translationText = "";

    for (let i = 0; i < quasis.length; i++) {
      const quasiText = quasis[i].value.cooked || quasis[i].value.raw;

      // 对每个静态部分应用 format 方法
      const formattedQuasi = StringUtils.formatString(quasiText, this.config);
      translationText += formattedQuasi;

      if (i < expressions.length) {
        // 使用 %{var0} 格式以兼容现有的 handleMsg 函数
        translationText += `%{var${i}}`;
      }
    }

    return translationText;
  }

  /**
   * 构建 I18n.t 调用表达式
   */
  private buildI18nCall(
    node: n.TemplateLiteral,
    key: string,
    j: JSCodeshiftAPI
  ): n.CallExpression {
    const expressions = node.expressions || [];

    // 构建选项对象，包含所有表达式变量
    let optionsObj: n.ObjectExpression | null = null;
    if (expressions.length > 0) {
      const properties = expressions.map(
        (expr: n.Expression, index: number) => {
          return AstUtils.createProperty(`var${index}`, expr);
        }
      );
      optionsObj = AstUtils.createObjectExpression(properties);
    }

    // 创建 I18n.t 调用
    return AstUtils.createI18nCall(key, optionsObj || undefined);
  }

  /**
   * 添加 I18n 导入
   */
  private addI18nImport(j: JSCodeshiftAPI, root: JSCodeshiftCollection): void {
    const hasI18nImport = root
      .find(j.ImportDeclaration)
      .some((path: ASTPath<n.ImportDeclaration>) => {
        const nodeSource = path.node.source;
        const nodeSpecs = path.node.specifiers;

        return !!(
          nodeSource?.value === "@utils" &&
          nodeSpecs?.some(
            (
              spec:
                | n.ImportSpecifier
                | n.ImportDefaultSpecifier
                | n.ImportNamespaceSpecifier
            ) => n.ImportSpecifier.check(spec) && spec.imported.name === "I18n"
          )
        );
      });

    if (!hasI18nImport) {
      root
        .get()
        .node.program.body.unshift(
          j.importDeclaration(
            [j.importSpecifier(j.identifier("I18n"), j.identifier("I18n"))],
            j.literal("@utils")
          )
        );
    }
  }

  // ===========================================
  // 向后兼容的方法（为了不破坏现有测试）
  // 将来应该使用 FileTransformer 代替
  // ===========================================

  /**
   * @deprecated 使用 FileTransformer.transformFile() 代替
   * 这个方法保留用于向后兼容
   */
  public async transformFile(filePath: string): Promise<TransformResult[]> {
    try {
      const source = await fs.promises.readFile(filePath, "utf-8");
      const { results } = this.transformSource(source, filePath);

      if (results.length > 0) {
        // 重新生成修改后的代码
        const { transformedCode } = this.transformSource(source, filePath);
        await fs.promises.writeFile(filePath, transformedCode);
      }

      return results;
    } catch (error) {
      Logger.error(`❌ 处理文件 ${filePath} 时发生错误:`, error);
      throw error;
    }
  }
}
