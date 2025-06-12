import {
  namedTypes as n,
  builders as b,
  ASTPath,
  Collection as AstTypesCollection,
} from "ast-types";

declare module "jscodeshift" {
  export interface API {
    (source: string | n.Node): Collection;

    // 使用 ast-types 的构建器函数，提供强类型
    importDeclaration: typeof b.importDeclaration;
    importSpecifier: typeof b.importSpecifier;
    identifier: typeof b.identifier;
    stringLiteral: typeof b.stringLiteral;
    literal: typeof b.literal;
    memberExpression: typeof b.memberExpression;
    callExpression: typeof b.callExpression;
    binaryExpression: typeof b.binaryExpression;
    objectExpression: typeof b.objectExpression;
    property: typeof b.property;
    jsxExpressionContainer: typeof b.jsxExpressionContainer;

    // 使用 ast-types 的节点类型
    Literal: n.Literal;
    Identifier: n.Identifier;
    ImportDeclaration: n.ImportDeclaration;
    TemplateLiteral: n.TemplateLiteral;
    JSXText: n.JSXText;
    JSXElement: n.JSXElement;
    JSXFragment: n.JSXFragment;
    JSXAttribute: n.JSXAttribute;
    JSXExpressionContainer: n.JSXExpressionContainer;
    BinaryExpression: n.BinaryExpression;
    ObjectExpression: n.ObjectExpression;
    Property: n.Property;
    Expression: n.Expression;
    Statement: n.Statement;
    Program: n.Program;
  }

  export interface Collection<T = any> {
    // 增强的 find 方法，支持强类型
    find<K extends keyof n.Node>(
      type: K,
      filter?: Partial<n.Node[K]>
    ): Collection<n.Node[K]>;

    find<NodeType extends n.Node>(
      type: string | ((node: any) => boolean),
      filter?: Partial<NodeType>
    ): Collection<NodeType>;

    // 强类型的回调函数
    forEach(callback: (path: ASTPath<T>) => void): Collection<T>;
    some(callback: (path: ASTPath<T>) => boolean): boolean;

    // 保持向后兼容的方法
    get(): { node: { program: { body: n.Statement[] } } };
    replaceWith(node: n.Node | ((path: ASTPath<T>) => n.Node)): Collection<T>;
    toSource(options?: any): string;

    // 添加更多常用方法
    remove(): Collection<T>;
    insertBefore(node: n.Node): Collection<T>;
    insertAfter(node: n.Node): Collection<T>;
    at(index: number): Collection<T>;
    length: number;
  }

  // 使用 ast-types 的 Node 类型，但保持向后兼容
  export interface Node extends n.Node {
    // 保持一些向后兼容的属性
    source?: { value: string };
    specifiers?: Array<{ type: string; imported: { name: string } }>;
    [key: string]: any;
  }

  // 改进的 Transform 接口
  export interface Transform<T = n.Node> {
    node: T;
    parent?: Transform;
    value: T;
    replace(node: n.Node): void;
  }

  export function withParser(parser: string): API;

  // 导出 ast-types 的类型供使用
  export type { ASTPath, namedTypes as n, builders as b } from "ast-types";
}

// 为向后兼容，导出一些常用类型
export type { ASTPath, namedTypes as n, builders as b } from "ast-types";

// 定义常用的节点类型别名
export type LiteralNode = n.Literal;
export type TemplateLiteralNode = n.TemplateLiteral;
export type JSXTextNode = n.JSXText;
export type CallExpressionNode = n.CallExpression;
export type IdentifierNode = n.Identifier;
export type MemberExpressionNode = n.MemberExpression;
export type ImportDeclarationNode = n.ImportDeclaration;
export type JSXExpressionContainerNode = n.JSXExpressionContainer;
