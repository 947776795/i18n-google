/**
 * Infra - AST Module
 * 代码转换器 - 将源码中的 ~text~ 替换为 I18n.t(key)，并添加导入
 */

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
 * 1. 替换标记文本为 I18n.t() 调用
 * 2. 根据文件类型添加不同的导入
 */
export class CodeTransformer {
  /**
   * 转换源码
   *
   * @param source 源码字符串
   * @param keys 提取的 key 列表
   * @param isEntry 是否为入口文件 (page.tsx/layout.tsx)
   * @param folderName 文件夹名称
   * @returns 转换结果
   */
  transform(source: string, keys: string[], isEntry: boolean, folderName: string): TransformResult {
    let code = source;
    let hasChanges = false;

    // 1. 替换标记文本为 I18n.t() 调用
    for (const key of keys) {
      const markPattern = new RegExp(`~${this.escapeRegExp(key)}~`, 'g');
      const replacement = `{I18n.t("${key}")}`;
      const newCode = code.replace(markPattern, replacement);

      if (newCode !== code) {
        hasChanges = true;
        code = newCode;
      }
    }

    // 2. 添加导入语句
    if (hasChanges || keys.length > 0) {
      const importStatement = this.generateImport(isEntry, folderName);
      code = this.insertImport(code, importStatement);
    }

    return {
      code,
      keyCount: keys.length,
      hasChanges,
    };
  }

  /**
   * 生成导入语句
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
   * @param isEntry 是否为入口文件
   * @param folderName 文件夹名称
   * @returns 导入语句字符串
   */
  private generateImport(isEntry: boolean, folderName: string): string {
    if (isEntry) {
      return `import { I18nUtil } from "@utils";\nconst I18n = I18nUtil.createScoped('${folderName}');`;
    } else {
      return `import { I18nUtil as I18n } from "@utils";`;
    }
  }

  /**
   * 在源码开头插入导入语句
   *
   * @param source 源码字符串
   * @param importStatement 导入语句
   * @returns 插入导入后的源码
   */
  private insertImport(source: string, importStatement: string): string {
    // 移除开头的空白行
    const trimmedSource = source.trimStart();

    // 检查是否已有 I18n 相关导入
    const hasI18nImport = /import\s+.*I18nUtil.*from\s+['"]/.test(trimmedSource);

    if (hasI18nImport) {
      // 已有导入，不做修改
      return source;
    }

    // 插入导入语句
    return `${importStatement}\n\n${trimmedSource}`;
  }

  /**
   * 转义正则表达式特殊字符
   *
   * @param str 输入字符串
   * @returns 转义后的字符串
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
