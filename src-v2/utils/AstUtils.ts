/**
 * AST 工具类 - 包含类型守卫和节点构建工具
 */

import { namedTypes as n, builders as b } from 'ast-types';
import type { ASTPath } from 'jscodeshift';

/**
 * AST 工具类
 */
export class AstUtils {
  /**
   * 类型守卫：检查是否为字符串字面量
   */
  static isStringLiteral(node: n.Node): node is n.Literal & { value: string } {
    return n.Literal.check(node) && typeof node.value === 'string';
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
        parent.node?.type === 'JSXElement' ||
        parent.node?.type === 'JSXFragment' ||
        parent.node?.type === 'JSXAttribute'
      ) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * 检查节点是否在 Import 声明中
   */
  static isInImportDeclaration(path: ASTPath<n.Node>): boolean {
    let parent = path.parent;
    while (parent) {
      if (parent.node?.type === 'ImportDeclaration') {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * 检查节点是否在 I18n.t() 调用中
   */
  static isInI18nCall(path: ASTPath<n.Node>): boolean {
    let parent = path.parent;
    while (parent) {
      if (parent.node?.type === 'CallExpression') {
        const callExpr = parent.node as n.CallExpression;
        if (this.isI18nTCall(callExpr)) {
          return true;
        }
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * 检查调用表达式是否是 I18n.t() 调用
   */
  static isI18nTCall(callExpr: n.CallExpression): boolean {
    const callee = callExpr.callee;

    // 检查是否是成员表达式 (I18n.t)
    if (n.MemberExpression.check(callee)) {
      const object = callee.object;
      const property = callee.property;

      // 检查对象是否是 I18n
      if (n.Identifier.check(object) && object.name === 'I18n') {
        // 检查属性是否是 t
        if (n.Identifier.check(property) && property.name === 't') {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 从节点获取位置信息
   */
  static getPositionFromNode(node: n.Node): { line: number; column: number } {
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
      b.memberExpression(b.identifier('I18n'), b.identifier('t')),
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
    return b.property('init', b.identifier(key), value as any);
  }

  /**
   * 创建对象表达式
   */
  static createObjectExpression(
    properties: n.Property[]
  ): n.ObjectExpression {
    return b.objectExpression(properties);
  }

  /**
   * 检查节点是否在表达式上下文中
   */
  static isInExpressionContext(path: ASTPath<n.Node>): boolean {
    let parent = path.parent;
    while (parent) {
      if (parent.node?.type === 'JSXExpressionContainer') {
        return true;
      }
      if (
        parent.node?.type === 'JSXElement' ||
        parent.node?.type === 'JSXFragment'
      ) {
        return false;
      }
      parent = parent.parent;
    }
    return false;
  }
}
