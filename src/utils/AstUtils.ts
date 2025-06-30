import { namedTypes as n, builders as b } from "ast-types";
import type { ASTPath } from "jscodeshift";

/**
 * AST 工具类 - 包含类型守卫和节点构建工具
 */
export class AstUtils {
  /**
   * 类型守卫：检查是否为字符串字面量
   */
  static isStringLiteral(node: n.Node): node is n.Literal & { value: string } {
    return n.Literal.check(node) && typeof node.value === "string";
  }

  /**
   * 类型守卫：检查是否为模板字符串
   */
  static isTemplateLiteral(node: n.Node): node is n.TemplateLiteral {
    return n.TemplateLiteral.check(node);
  }

  /**
   * 类型守卫：检查是否为 JSX 文本节点
   */
  static isJSXText(node: n.Node): node is n.JSXText {
    return n.JSXText.check(node);
  }

  /**
   * 检查节点是否在JSX上下文中
   */
  static isInJSXContext(path: ASTPath<n.Node>): boolean {
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
   * 创建 I18n.t 调用表达式
   */
  static createI18nCall(
    key: string,
    options?: n.ObjectExpression
  ): n.CallExpression {
    const callArgs: (n.Expression | n.SpreadElement)[] = options
      ? [b.literal(key), options]
      : [b.literal(key)];

    return b.callExpression(
      b.memberExpression(b.identifier("I18n"), b.identifier("t")),
      callArgs as any
    );
  }

  /**
   * 创建 JSX 表达式容器
   */
  static createJSXExpressionContainer(
    expression: n.Expression
  ): n.JSXExpressionContainer {
    return b.jsxExpressionContainer(expression as any);
  }

  /**
   * 创建对象属性
   */
  static createProperty(key: string, value: n.Expression): n.Property {
    return b.property("init", b.identifier(key), value as any);
  }

  /**
   * 创建对象表达式
   */
  static createObjectExpression(properties: n.Property[]): n.ObjectExpression {
    return b.objectExpression(properties);
  }
}
