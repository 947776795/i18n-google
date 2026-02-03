/**
 * Infra - AST Module
 * 代码转换器 - 将源码中的 ~text~ 替换为 I18n.t(key)，并添加导入
 */

import * as jscodeshift from 'jscodeshift';
import { namedTypes as n, builders as b } from 'ast-types';
import type { ASTPath } from 'jscodeshift';
import { AstUtils } from '../../utils/AstUtils';

type JSCodeshiftAPI = ReturnType<typeof jscodeshift.withParser>;
type JSCodeshiftCollection = ReturnType<JSCodeshiftAPI>;

/**
 * 转换结果
 */
export interface TransformResult {
  /** 转换后的代码 */
  code: string;
  /** 提取的 key 数量 */
  keyCount: number;
  /** 是否有变化 */
  hasChanges: boolean;
}

/**
 * 代码转换器
 *
 * 职责：将源码中的 ~text~ 替换为 I18n.t(key)，并添加正确的导入
 *
 * 转换规则:
 * 1. 在 JSX 文本节点中：替换为 {I18n.t("key")}
 * 2. 在 JSX 属性中：替换为 {I18n.t("key")}（如 title={I18n.t("key")}）
 * 3. 在表达式中：替换为 I18n.t("key")
 * 4. 模板字符串：替换为 I18n.t("key", { var0: expr, ... })
 */
export class CodeTransformer {
  /**
   * 转换源码
   *
   * @param source 源码字符串
   * @param marks 提取的标记列表（带 ~ 符号，如 ~text~）
   * @param isEntry 是否为入口文件 (page.tsx/layout.tsx)
   * @param folderName 文件夹名称
   * @returns 转换结果
   */
  transform(source: string, marks: string[], isEntry: boolean, folderName: string): TransformResult {
    const { root, j } = this.parseSource(source);

    let hasChanges = false;
    let keyCount = 0;

    // 1. 处理 JSX 文本节点（Feature 3）
    // 将纯 JSX 文本（如 <div>Welcome</div>）转换为 {I18n.t("Welcome")}
    root.find(j.JSXText).forEach((path: ASTPath<n.JSXText>) => {
      const textValue = path.node.value;
      const trimmedText = textValue.trim();

      if (!trimmedText) {
        return; // 跳过空白文本
      }

      // 清理文本：规范化内部空白字符（将换行符、多个空格替换为单个空格）
      // 这与提取时的 StringUtils.cleanExtractedText 逻辑保持一致
      const cleanedText = trimmedText.replace(/\s+/g, ' ');

      // 检查是否在 keys 中（keys 是不带 ~ 的清理后文本）
      for (const key of marks) {
        if (key === cleanedText) {
          this.convertJSXTextToI18nCall(path, key);
          hasChanges = true;
          keyCount++;
          break;
        }
      }
    });

    // 2. 处理带标记的字符串字面量（~text~）
    root.find(j.Literal).forEach((path: ASTPath<n.Literal>) => {
      if (this.isStringLiteral(path.node)) {
        // Bug 1 修复: 跳过 import 语句中的字符串
        if (AstUtils.isInImportDeclaration(path)) {
          return;
        }
        const value = path.node.value;

        // 检查是否精确匹配标记（使用精确匹配避免 "sdsd~".includes("d") 的问题）
        for (const mark of marks) {
          // 精确匹配：value 必须完全等于 mark，或者是完整标记的格式
          // 完整标记格式：~mark~（其中 mark 是去掉 ~ 后的 mark）
          const isExactMatch = value === mark ||
                               value === `~${mark}~` ||
                               (mark.startsWith('~') && value === mark) ||
                               (mark.endsWith('~') && value === mark);

          if (!isExactMatch) {
            continue;
          }

          // 🔧 关键修复：不完整标记保留 ~ 符号作为 key 的一部分
          // 只有完整的标记（~text~）才去掉 ~ 符号
          let key: string;
          if (mark.startsWith('~') && mark.endsWith('~')) {
            // 完整标记，去掉 ~ 符号
            key = mark.slice(1, -1);
          } else {
            // 不完整标记（如 sdsd~ 或 ~asd），保留原样
            key = mark;
          }

          // 如果在 JSX 属性中，需要转换为表达式
          if (this.isInJSXAttribute(path)) {
            // 将整个属性值转换为 {I18n.t("key")}
            this.convertToJSXExpression(path, key);
            hasChanges = true;
            keyCount++;
            break;
          }
          // 如果在 JSX 元素的直接子节点中（但不在 JSX 属性中），需要在文本周围添加花括号
          else if (this.isInJSXElementChildren(path)) {
            // 将字符串字面量替换为 {I18n.t("key")}
            this.convertToJSXExpression(path, key);
            hasChanges = true;
            keyCount++;
            break;
          }
          // 如果在 JSX 表达式容器中，替换整个容器内容
          else if (this.isInJSXExpressionContainer(path)) {
            // 替换整个容器为 I18n.t() 调用
            const i18nCall = this.createI18nCall(key);
            // 找到 JSXExpressionContainer 父节点并替换其表达式
            let parent = path.parent;
            while (parent && parent.node?.type !== 'JSXExpressionContainer') {
              parent = parent.parent;
            }
            if (parent) {
              parent.node.expression = i18nCall;
            }
            hasChanges = true;
            keyCount++;
            break;
          }
          // 其他情况（如变量声明），替换为 I18n.t() 调用
          else {
            this.convertToI18nCall(path, key);
            hasChanges = true;
            keyCount++;
            break;
          }
        }
      }
    });

    // 3. 处理带标记的模板字符串（Feature 4）
    // 将 `~Hello ${name}~` 转换为 I18n.t("Hello %{var0}!", { var0: name })
    root.find(j.TemplateLiteral).forEach((path: ASTPath<n.TemplateLiteral>) => {
      // 构建清理后的文本格式（如 "Hello %{var0}!"）
      const cleanedText = this.buildCleanedTemplateText(path.node);

      // 检查是否在标记列表中
      // marks 可能包含: 1) 带标记的原始文本 (~text~) 或 2) 清理后的文本或不完整标记（sdsd~）
      for (const mark of marks) {
        // 🔧 关键修复：不完整标记保留 ~ 符号作为 key 的一部分
        let keyToUse: string;
        if (mark.startsWith('~') && mark.endsWith('~')) {
          // 完整标记，去掉 ~ 符号
          keyToUse = mark.slice(1, -1);
        } else {
          // 不完整标记（如 sdsd~ 或 ~asd），保留原样
          keyToUse = mark;
        }

        // 如果清理后的文本在 marks 中（或去掉 ~ 后匹配）
        if (cleanedText === keyToUse || cleanedText === mark) {
          // 检查是否只有变量（跳过纯变量模板）
          if (this.hasOnlyVariables(path.node)) {
            break;
          }

          // 对于不完整标记，使用 mark 本身作为 key（保留 ~）
          // 对于完整标记，使用 cleanedText
          const finalKey = (mark.startsWith('~') && mark.endsWith('~')) ? cleanedText : mark;
          this.convertTemplateToI18nCall(path, finalKey);
          hasChanges = true;
          keyCount++;
          break;
        }
      }
    });

    // 添加导入语句到 AST（在生成代码前）
    if (hasChanges || marks.length > 0) {
      this.addImportToAST(root, j, isEntry, folderName);
    }

    // 使用 recast 生成代码
    const code = root.toSource({
      lineTerminator: '\n',
      trailingComma: true,
      tabWidth: 2,
      useTabs: false,
      quote: 'double',
      objectCurlySpacing: true,
    });

    return {
      code,
      keyCount,
      hasChanges,
    };
  }

  /**
   * 解析源码为 AST
   */
  private parseSource(source: string): { root: JSCodeshiftCollection; j: JSCodeshiftAPI } {
    const j = jscodeshift.withParser('tsx');
    const root = j(source);
    return { root, j };
  }

  /**
   * 检查是否为字符串字面量
   */
  private isStringLiteral(node: n.Node): node is n.Literal & { value: string } {
    return n.Literal.check(node) && typeof node.value === 'string';
  }

  /**
   * 检查是否在 JSX 属性中
   */
  private isInJSXAttribute(path: ASTPath<n.Node>): boolean {
    let parent = path.parent;
    while (parent) {
      if (parent.node?.type === 'JSXAttribute') {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * 检查是否在 JSX 表达式容器中
   */
  private isInJSXExpressionContainer(path: ASTPath<n.Node>): boolean {
    let parent = path.parent;
    while (parent) {
      if (parent.node?.type === 'JSXExpressionContainer') {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * 检查是否在 JSX 元素的直接子节点中
   */
  private isInJSXElementChildren(path: ASTPath<n.Node>): boolean {
    let parent = path.parent;
    while (parent) {
      if (parent.node?.type === 'JSXElement') {
        return true;
      }
      if (parent.node?.type === 'JSXExpressionContainer') {
        return false;
      }
      if (parent.node?.type === 'JSXAttribute') {
        return false;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * 将字符串字面量转换为 JSX 表达式
   * 用于 JSX 中：~text~ → {I18n.t("text")}
   */
  private convertToJSXExpression(path: ASTPath<n.Literal>, key: string): void {
    const i18nCall = this.createI18nCall(key);

    // 替换节点为 JSX 表达式容器
    path.replace(b.jsxExpressionContainer(i18nCall) as any);
  }

  /**
   * 将字符串字面量转换为 I18n.t() 调用
   * 用于变量声明等情况：const b = '~text~' → const b = I18n.t("text")
   */
  private convertToI18nCall(path: ASTPath<n.Literal>, key: string): void {
    const i18nCall = this.createI18nCall(key);

    // 替换节点为 I18n.t() 调用
    path.replace(i18nCall);
  }

  /**
   * 创建 I18n.t() 调用表达式
   */
  private createI18nCall(key: string): n.CallExpression {
    return b.callExpression(
      b.memberExpression(b.identifier('I18n'), b.identifier('t')),
      [b.literal(key)]
    );
  }

  /**
   * 添加导入语句到 AST
   *
   * 入口文件 (page.tsx/layout.tsx):
   * ```typescript
   * import { I18nUtil } from "@utils";
   * const I18n = I18nUtil.createScoped('app');
   * ```
   *
   * 子模块文件:
   * ```typescript
   * import { I18nUtil as I18n } from "@utils";
   * ```
   *
   * @param root AST 根节点
   * @param j jscodeshift API
   * @param isEntry 是否为入口文件
   * @param folderName 文件夹名称
   */
  private addImportToAST(
    root: JSCodeshiftCollection,
    j: JSCodeshiftAPI,
    isEntry: boolean,
    folderName: string
  ): void {
    // 检查是否已有 I18n 相关导入
    const hasI18nImport = root.find(j.ImportDeclaration).some((path) => {
      const source = path.node.source?.value as string;
      return source === '@utils' || source === '@utils/i18n';
    });

    if (hasI18nImport) {
      // 已有导入，不做修改
      return;
    }

    // 获取 AST 的 program 节点
    const program = root.get().node.program as any;

    // 创建导入声明
    const importDeclaration = b.importDeclaration(
      isEntry
        ? [b.importSpecifier(b.identifier('I18nUtil'))]
        : [b.importSpecifier(b.identifier('I18nUtil'), b.identifier('I18n'))],
      b.literal('@utils')
    );

    // 找到第一个非 import 语句的位置
    let insertIndex = 0;
    for (let i = 0; i < program.body.length; i++) {
      if (!n.ImportDeclaration.check(program.body[i])) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    // 插入导入语句
    program.body.splice(insertIndex, 0, importDeclaration);

    // 如果是入口文件，添加 Scoped 初始化
    if (isEntry) {
      const scopedInit = b.variableDeclaration('const', [
        b.variableDeclarator(
          b.identifier('I18n'),
          b.callExpression(
            b.memberExpression(
              b.identifier('I18nUtil'),
              b.identifier('createScoped')
            ),
            [b.literal(folderName)]
          )
        ),
      ]);

      // 找到插入位置（导入语句之后）
      insertIndex = 0;
      for (let i = 0; i < program.body.length; i++) {
        if (n.ImportDeclaration.check(program.body[i])) {
          insertIndex = i + 1;
        } else {
          break;
        }
      }

      program.body.splice(insertIndex, 0, scopedInit);
    }
  }

  // ========== Feature 3: JSX 文本节点转换 ==========

  /**
   * 将 JSX 文本节点转换为 {I18n.t("key")}
   */
  private convertJSXTextToI18nCall(path: ASTPath<n.JSXText>, key: string): void {
    const i18nCall = this.createI18nCall(key);
    const expressionContainer = b.jsxExpressionContainer(i18nCall);

    // 直接替换 JSX 文本节点
    path.replace(expressionContainer as any);
  }

  // ========== Feature 4: 模板字符串转换 ==========

  /**
   * 将模板字符串转换为 I18n.t() 调用
   * 例如: `~Hello ${name}~` → I18n.t("Hello %{var0}!", { var0: name })
   */
  private convertTemplateToI18nCall(path: ASTPath<n.TemplateLiteral>, key: string): void {
    const node = path.node;
    const expressions = node.expressions || [];

    // 如果有变量，构建变量映射对象
    let variablesArg: n.ObjectExpression | null = null;
    if (expressions.length > 0) {
      const properties: any[] = [];

      expressions.forEach((expr: any, index: number) => {
        const placeholder = `var${index}`;
        properties.push(
          b.objectProperty(
            b.literal(placeholder),
            expr
          )
        );
      });

      variablesArg = b.objectExpression(properties) as any;
    }

    // 创建 I18n.t() 调用
    const i18nCall = this.createI18nCallWithVariables(key, variablesArg);

    // 替换模板字符串为 I18n.t() 调用
    path.replace(i18nCall as any);
  }

  /**
   * 创建带变量的 I18n.t() 调用表达式
   * I18n.t("key", { var0: expr, ... })
   */
  private createI18nCallWithVariables(
    key: string,
    variables: n.ObjectExpression | null
  ): n.CallExpression {
    const args: any[] = [b.literal(key)];

    if (variables) {
      args.push(variables);
    }

    return b.callExpression(
      b.memberExpression(b.identifier('I18n'), b.identifier('t')),
      args
    ) as any;
  }

  /**
   * 构建清理后的模板字符串文本（包含占位符）
   * 例如: `~Hello ${name}~` → "Hello %{var0}!"
   */
  private buildCleanedTemplateText(node: n.TemplateLiteral): string {
    const quasis = node.quasis || [];
    const expressions = node.expressions || [];
    let translationText = '';

    for (let i = 0; i < quasis.length; i++) {
      let quasiText = quasis[i].value.cooked || quasis[i].value.raw;

      // 去除标记符号 (~)
      quasiText = quasiText.replace(/^~+/g, '').replace(/~+$/g, '');

      translationText += quasiText;

      if (i < expressions.length) {
        // 使用 %{var0} 格式以兼容现有的翻译系统
        translationText += `%{var${i}}`;
      }
    }

    return translationText;
  }

  /**
   * 检查模板字符串是否只包含变量（没有静态文本）
   * 例如: `${1}` 或 `${a}${b}` → 只有变量，跳过
   * 例如: `${a}text` 或 `text${a}` → 有静态文本，处理
   */
  private hasOnlyVariables(node: n.TemplateLiteral): boolean {
    const quasis = node.quasis || [];

    for (const quasi of quasis) {
      const cooked = quasi.value.cooked || '';
      const raw = quasi.value.raw || '';

      // 如果任何静态部分不为空，说明有静态文本
      if (cooked.trim() !== '' || raw.trim() !== '') {
        return false;
      }
    }

    return true;
  }
}
