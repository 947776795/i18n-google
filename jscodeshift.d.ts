declare module "jscodeshift" {
  export interface API {
    (source: string | Node): Collection;
    importDeclaration: (specifiers: any[], source: any) => any;
    importSpecifier: (local: any, imported: any) => any;
    identifier: (name: string) => any;
    stringLiteral: (value: string) => any;
    literal: (value: string) => any;
    memberExpression: (object: any, property: any) => any;
    callExpression: (callee: any, args: any[]) => any;
    Literal: any;
    ImportDeclaration: any;
  }

  export interface Collection {
    find: (type: any, filter?: any) => Collection;
    forEach: (callback: (path: Transform) => void) => void;
    some: (callback: (path: Transform) => boolean) => boolean;
    get: () => { node: { program: { body: any[] } } };
    replaceWith: (node: any) => void;
    toSource: () => string;
  }

  export interface Node {
    type?: string;
    value?: string | null;
    source?: { value: string };
    specifiers?: Array<{ type: string; imported: { name: string } }>;
    [key: string]: any;
  }

  export interface Transform {
    node: Node;
  }

  export function withParser(parser: string): API;
}
