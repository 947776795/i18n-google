import * as jscodeshift from "jscodeshift";
import type { ASTPath } from "jscodeshift";
import { namedTypes as n } from "ast-types";
import type { I18nConfig } from "../types";
import { StringUtils } from "./utils/StringUtils";
import { AstUtils } from "./utils/AstUtils";

export interface TransformResult {
  key: string;
  text: string;
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
    root.find(j.JSXText).forEach((path: ASTPath<n.JSXText>) => {
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
    const fs = await import("fs");
    const { promisify } = await import("util");

    const readFile = promisify(fs.readFile);
    const writeFile = promisify(fs.writeFile);

    try {
      const source = await readFile(filePath, "utf-8");
      const { results, transformedCode } = this.transformSource(
        source,
        filePath
      );

      if (results.length > 0) {
        await writeFile(filePath, transformedCode);
      }

      return results;
    } catch (error) {
      console.error(`处理文件 ${filePath} 时发生错误:`, error);
      throw error;
    }
  }
}
