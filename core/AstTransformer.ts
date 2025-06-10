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

export class AstTransformer {
  constructor(private config: I18nConfig) {}

  /**
   * 处理单个文件的转换
   */
  public async transformFile(filePath: string): Promise<TransformResult[]> {
    const source = await readFile(filePath, "utf-8");
    const j = jscodeshift.withParser("tsx") as API;
    const root = j(source);
    const results: TransformResult[] = [];

    // 查找需要翻译的文本
    root.find(j.Literal).forEach((path: Transform) => {
      const value = path.node.value;
      if (typeof value === "string" && this.config.check.test(value)) {
        const text = this.config.format(value);
        const key = this.generateTranslationKey(filePath, text);
        results.push({ key, text });

        // 替换为 I18n.t 调用
        const callExpr = j.callExpression(
          j.memberExpression(j.identifier("I18n"), j.identifier("t")),
          [j.literal(key)]
        );
        path.node.value = undefined;
        path.node.type = "CallExpression";
        Object.assign(path.node, callExpr);
      }
    });

    // 添加 I18n 导入
    if (results.length > 0) {
      this.addI18nImport(j, root);
    }

    // 写入修改后的文件
    await writeFile(filePath, root.toSource());

    return results;
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
  private addI18nImport(j: API, root: any) {
    const hasI18nImport = root
      .find(j.ImportDeclaration)
      .some(
        (path: Transform) =>
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
