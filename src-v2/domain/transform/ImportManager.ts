/**
 * 导入管理器（新版本简化实现）
 * 负责管理源码中的导入语句
 *
 * 规则：
 * - 入口文件（page.tsx/layout.tsx）：import { I18nUtil } from "@utils" + createScoped 初始化
 * - 非入口文件：import { I18nUtil as I18n } from "@utils"
 */

import * as jscodeshift from 'jscodeshift';
import type { ASTPath } from 'jscodeshift';
import { namedTypes as n, builders as b } from 'ast-types';
import type { I18nConfig } from '../../types/config';
import { PathMapper } from '../scan/PathMapper';

type JSCodeshiftAPI = ReturnType<typeof jscodeshift.withParser>;
type JSCodeshiftCollection = ReturnType<JSCodeshiftAPI>;

/**
 * 导入管理器（新版本）
 */
export class ImportManager {
  private pathMapper: PathMapper;

  constructor(private config: I18nConfig) {
    this.pathMapper = new PathMapper();
  }

  /**
   * 处理源码中的导入语句
   * @param source - 源码字符串
   * @param filePath - 文件路径
   * @param addImports - 是否添加新导入
   * @returns 修改后的源码
   */
  manageImports(source: string, filePath: string, addImports: boolean = true): string {
    const { root, j } = this.parseSource(source);

    if (!addImports) {
      return source;
    }

    // 检查是否需要导入（有 I18n 调用）
    const hasI18nCalls = this.hasI18nCalls(root, j);
    if (!hasI18nCalls) {
      return source;
    }

    const isEntry = this.isEntryFile(filePath);

    if (isEntry) {
      // 入口文件：添加 I18nUtil 导入 + Scoped 初始化
      const scopedPath = this.pathMapper.toFolderName(filePath, this.config.rootDir);
      this.addEntryFileImports(root, j, scopedPath);
    } else {
      // 非入口文件：只添加 I18nUtil as I18n 导入
      this.addNonEntryFileImports(root, j);
    }

    return root.toSource();
  }

  /**
   * 解析源码为 AST
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
   * 检查是否是入口文件（page.tsx 或 layout.tsx）
   */
  private isEntryFile(filePath: string): boolean {
    const fileName = filePath.split('/').pop() || '';
    return fileName === 'page.tsx' || fileName === 'layout.tsx';
  }

  /**
   * 检查是否有 I18n 调用
   */
  private hasI18nCalls(
    root: JSCodeshiftCollection,
    j: JSCodeshiftAPI
  ): boolean {
    return root.find(j.CallExpression).some((path: ASTPath<n.CallExpression>) => {
      return this.isI18nTCall(path.node);
    });
  }

  /**
   * 检查是否是 I18n.t() 调用
   */
  private isI18nTCall(callExpr: n.CallExpression): boolean {
    const callee = callExpr.callee;

    if (n.MemberExpression.check(callee)) {
      const object = callee.object;
      const property = callee.property;

      if (n.Identifier.check(object) && object.name === 'I18n') {
        if (n.Identifier.check(property) && property.name === 't') {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 添加入口文件导入
   * import { I18nUtil } from "@utils"
   * const I18n = I18nUtil.createScoped('app_sub1_page')
   */
  private addEntryFileImports(
    root: JSCodeshiftCollection,
    j: JSCodeshiftAPI,
    scopedPath: string
  ): void {
    // 移除旧的 I18nUtil 导入
    this.removeI18nUtilImports(root, j);

    // 添加新的导入：import { I18nUtil } from "@utils"
    const importDecl = b.importDeclaration(
      [b.importSpecifier(b.identifier('I18nUtil'))],
      b.literal('@utils')
    );

    const program = root.get().node.program as any;
    program.body.unshift(importDecl);

    // 如果不存在 Scoped 初始化，则添加
    if (!this.hasScopedInitialization(root, j)) {
      this.addScopedInitialization(root, j, scopedPath);
    }
  }

  /**
   * 添加非入口文件导入
   * import { I18nUtil as I18n } from "@utils"
   */
  private addNonEntryFileImports(
    root: JSCodeshiftCollection,
    j: JSCodeshiftAPI
  ): void {
    // 移除旧的 I18nUtil 导入
    this.removeI18nUtilImports(root, j);

    // 添加新的导入：import { I18nUtil as I18n } from "@utils"
    const importDecl = b.importDeclaration(
      [b.importSpecifier(b.identifier('I18nUtil'), b.identifier('I18n'))],
      b.literal('@utils')
    );

    const program = root.get().node.program as any;
    program.body.unshift(importDecl);
  }

  /**
   * 移除所有 I18nUtil 相关导入
   */
  private removeI18nUtilImports(
    root: JSCodeshiftCollection,
    j: JSCodeshiftAPI
  ): void {
    root.find(j.ImportDeclaration).forEach((path) => {
      const source = path.node.source?.value as string;
      if (source === '@utils' || source === '@utils/i18n') {
        // 检查是否导入 I18nUtil
        const hasI18nUtil = path.node.specifiers?.some((spec) => {
          if (n.ImportSpecifier.check(spec)) {
            return spec.imported.name === 'I18nUtil';
          }
          return false;
        });
        if (hasI18nUtil) {
          path.prune();
        }
      }
    });
  }

  /**
   * 添加 Scoped 初始化
   * const I18n = I18nUtil.createScoped('app_sub1_page')
   */
  private addScopedInitialization(
    root: JSCodeshiftCollection,
    _j: JSCodeshiftAPI,
    scopedPath: string
  ): void {
    const scopedInit = b.variableDeclaration('const', [
      b.variableDeclarator(
        b.identifier('I18n'),
        b.callExpression(
          b.memberExpression(
            b.identifier('I18nUtil'),
            b.identifier('createScoped')
          ),
          [b.literal(scopedPath)]
        )
      ),
    ]);

    const program = root.get().node.program as any;

    // 在第一个 import 语句之后插入
    let insertIndex = 0;
    const body = program.body;

    for (let i = 0; i < body.length; i++) {
      if (n.ImportDeclaration.check(body[i])) {
        insertIndex = i + 1;
      } else {
        break;
      }
    }

    program.body.splice(insertIndex, 0, scopedInit);
  }

  /**
   * 检查是否有 Scoped 初始化
   */
  private hasScopedInitialization(
    root: JSCodeshiftCollection,
    j: JSCodeshiftAPI
  ): boolean {
    return root.find(j.VariableDeclarator).some((path: ASTPath<n.VariableDeclarator>) => {
      const id = path.node.id;

      return (
        n.Identifier.check(id) &&
        id.name === 'I18n' &&
        n.CallExpression.check(path.node.init) &&
        this.isScopedCall(path.node.init as n.CallExpression)
      );
    });
  }

  /**
   * 检查是否是 Scoped 调用
   */
  private isScopedCall(callExpr: n.CallExpression): boolean {
    const callee = callExpr.callee;

    if (n.MemberExpression.check(callee)) {
      const object = callee.object;
      const property = callee.property;

      if (
        n.Identifier.check(object) &&
        object.name === 'I18nUtil' &&
        n.Identifier.check(property) &&
        property.name === 'createScoped'
      ) {
        return true;
      }
    }

    return false;
  }
}
