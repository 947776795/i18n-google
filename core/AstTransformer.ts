import * as fs from "fs";
import { promisify } from "util";
import crypto from "crypto";
import * as jscodeshift from "jscodeshift";
import type { API, Transform } from "jscodeshift";
import type { I18nConfig } from "../types";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

export interface TransformResult {
  key: string;
  text: string;
}

interface TemplateProcessResult {
  translationResult: TransformResult;
  callExpr: any;
}

export class AstTransformer {
  constructor(private config: I18nConfig) {}

  /**
   * 处理单个文件的转换
   */
  public async transformFile(filePath: string): Promise<TransformResult[]> {
    try {
      const source = await readFile(filePath, "utf-8");
      const j = jscodeshift.withParser("tsx") as API;
      const root = j(source);
      const results: TransformResult[] = [];

      // 查找需要翻译的字符串字面量
      root.find(j.Literal).forEach((path: any) => {
        const value = path.node.value;
        if (typeof value === "string" && this.config.check.test(value)) {
          const text = this.config.format(value);
          const key = this.generateTranslationKey(filePath, text);
          results.push({ key, text });

          // 创建 I18n.t 调用表达式
          const callExpr = j.callExpression(
            j.memberExpression(j.identifier("I18n"), j.identifier("t")),
            [j.literal(key)]
          );

          // 替换节点
          this.replaceWithI18nCall(path, callExpr, j);
        }
      });

      // 查找需要翻译的模板字符串
      root.find("TemplateLiteral").forEach((path: any) => {
        const templateResult = this.handleTemplateLiteral(path, filePath, j);
        if (templateResult) {
          results.push(templateResult.translationResult);
          this.replaceWithI18nCall(path, templateResult.callExpr, j);
        }
      });

      // 添加 I18n 导入
      if (results.length > 0) {
        this.addI18nImport(j, root);
      }

      // 写入修改后的文件
      await writeFile(filePath, root.toSource());

      return results;
    } catch (error) {
      console.error(`处理文件 ${filePath} 时发生错误:`, error);
      throw error;
    }
  }

  /**
   * 统一的节点替换逻辑
   */
  private replaceWithI18nCall(path: any, callExpr: any, j: API): void {
    const isInJSX = this.isInJSXContext(path);

    if (isInJSX) {
      // 检查当前节点的父节点类型
      const parentType = path.parent?.node?.type;

      if (parentType === "JSXExpressionContainer") {
        // 如果已经在JSX表达式容器中，直接替换表达式内容
        path.replace(callExpr);
      } else if (parentType === "JSXAttribute") {
        // 如果在JSX属性中，需要包装为表达式容器
        const jsxExpr = {
          type: "JSXExpressionContainer",
          expression: callExpr,
        };
        path.replace(jsxExpr);
      } else {
        // 在JSX文本位置，需要包装为表达式容器
        const jsxExpr = {
          type: "JSXExpressionContainer",
          expression: callExpr,
        };
        path.replace(jsxExpr);
      }
    } else {
      // 在普通JavaScript中，直接替换
      path.replace(callExpr);
    }
  }

  /**
   * 处理模板字符串
   */
  private handleTemplateLiteral(
    path: any,
    filePath: string,
    j: API
  ): TemplateProcessResult | null {
    const node = path.node;

    // 构建模板字符串的完整文本
    const fullTemplateText = this.buildTemplateText(node);

    // 检查是否需要翻译
    if (!this.config.check.test(fullTemplateText)) {
      return null;
    }

    // 使用配置的 format 方法处理文本
    const formattedText = this.config.format(fullTemplateText);

    // 构建带占位符的翻译文本
    const translationText = this.buildTranslationText(node, formattedText);
    const key = this.generateTranslationKey(filePath, translationText);

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
  private buildTemplateText(node: any): string {
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
  private buildTranslationText(node: any, baseText: string): string {
    const expressions = node.expressions || [];
    const quasis = node.quasis || [];
    let translationText = "";

    for (let i = 0; i < quasis.length; i++) {
      const quasiText = quasis[i].value.cooked || quasis[i].value.raw;

      // 对每个静态部分应用 format 方法
      const formattedQuasi = this.config.format(quasiText);
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
  private buildI18nCall(node: any, key: string, j: API): any {
    const expressions = node.expressions || [];

    // 构建选项对象，包含所有表达式变量
    let optionsObj = null;
    if (expressions.length > 0) {
      const properties = expressions.map((expr: any, index: number) => {
        return {
          type: "Property",
          kind: "init",
          key: j.identifier(`var${index}`),
          value: expr,
          method: false,
          shorthand: false,
          computed: false,
        };
      });
      optionsObj = {
        type: "ObjectExpression",
        properties: properties,
      };
    }

    // 创建 I18n.t 调用
    const callArgs = optionsObj
      ? [j.literal(key), optionsObj]
      : [j.literal(key)];

    return j.callExpression(
      j.memberExpression(j.identifier("I18n"), j.identifier("t")),
      callArgs
    );
  }

  /**
   * 检查节点是否在JSX上下文中
   */
  private isInJSXContext(path: any): boolean {
    let parent = path.parent;
    while (parent) {
      if (
        parent.node?.type === "JSXElement" ||
        parent.node?.type === "JSXFragment" ||
        parent.node?.type === "JSXAttribute"
      ) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * 生成翻译键
   * @param filePath - 文件路径
   * @param text - 待翻译文本
   */
  private generateTranslationKey(filePath: string, text: string): string {
    const locationString = JSON.stringify({ path: filePath, text });
    const hash = crypto
      .createHash("md5")
      .update(locationString)
      .digest("hex")
      .slice(0, 8);

    return hash;
  }

  /**
   * 添加 I18n 导入
   */
  private addI18nImport(j: API, root: any): void {
    const hasI18nImport = root
      .find(j.ImportDeclaration)
      .some(
        (path: any) =>
          path.node.source?.value === "@utils" &&
          path.node.specifiers?.some(
            (spec: { type: string; imported: { name: string } }) =>
              spec.type === "ImportSpecifier" && spec.imported.name === "I18n"
          )
      );

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
}
