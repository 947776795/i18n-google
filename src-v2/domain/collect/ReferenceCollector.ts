/**
 * I18n.t() 调用收集器
 * 负责从源码中收集现有的 I18n.t() 调用
 */

import * as jscodeshift from 'jscodeshift';
import type { ASTPath } from 'jscodeshift';
import { namedTypes as n } from 'ast-types';
import type { ExistingReference } from '../../types/extraction';
import type { I18nConfig } from '../../types/config';
import { AstUtils } from '../../utils/AstUtils';

type JSCodeshiftAPI = ReturnType<typeof jscodeshift.withParser>;
type JSCodeshiftCollection = ReturnType<JSCodeshiftAPI>;

/**
 * I18n.t() 调用收集器
 */
export class ReferenceCollector {
  constructor(private config: I18nConfig) {}

  /**
   * 收集源码中的所有 I18n.t() 调用
   */
  collect(source: string, filePath: string): ExistingReference[] {
    try {
      // 解析源码为AST
      const { root, j } = this.parseSource(source);

      const references: ExistingReference[] = [];
      const keyFileMap = new Map<string, boolean>(); // 用于去重：相同文件中的相同 key 只记录一次

      // 查找所有 I18n.t() 调用
      root.find(j.CallExpression).forEach((path: ASTPath<n.CallExpression>) => {
        const reference = this.extractI18nCall(path, filePath);

        if (reference) {
          // 检查是否已经记录过（同一文件中的相同 key）
          const key = `${filePath}:${reference.key}`;
          if (!keyFileMap.has(key)) {
            references.push(reference);
            keyFileMap.set(key, true);
          }
        }
      });

      return references;
    } catch (error) {
      console.error(`Failed to collect from ${filePath}:`, error);
      return [];
    }
  }

  /**
   * 解析源码为AST
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
   * 提取 I18n.t() 调用
   */
  private extractI18nCall(
    path: ASTPath<n.CallExpression>,
    filePath: string
  ): ExistingReference | null {
    const callExpr = path.node;

    // 检查是否是 I18n.t() 调用
    if (!AstUtils.isI18nTCall(callExpr)) {
      return null;
    }

    const callee = callExpr.callee;

    // 验证调用的结构：必须是 I18n.t
    if (!n.MemberExpression.check(callee)) {
      return null;
    }

    const object = callee.object;
    const property = callee.property;

    // 检查对象是否是 I18n
    if (!n.Identifier.check(object) || object.name !== 'I18n') {
      return null;
    }

    // 检查属性是否是 t
    if (!n.Identifier.check(property) || property.name !== 't') {
      return null;
    }

    // 获取 key 参数
    const keyArg = callExpr.arguments[0];
    if (!keyArg) {
      return null; // 没有参数，不收集
    }

    // 只支持字符串字面量和模板字面量作为 key
    let key: string | null = null;

    if (n.Literal.check(keyArg) && typeof keyArg.value === 'string') {
      key = keyArg.value;
    } else if (n.TemplateLiteral.check(keyArg)) {
      // 对于模板字面量，只收集没有变量的情况
      if (keyArg.expressions.length === 0 && keyArg.quasis.length === 1) {
        key = keyArg.quasis[0].value.cooked || keyArg.quasis[0].value.raw;
      }
    }

    if (!key) {
      return null; // 不是有效的 key，不收集
    }

    // 创建引用对象
    return {
      key,
      filePath,
    };
  }
}
