import * as fs from "fs";
import { promisify } from "util";
import { AstTransformer, TransformResult } from "./AstTransformer";
import type { I18nConfig } from "../types";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * 文件转换器 - 负责文件 I/O 操作和错误处理
 * 使用 AstTransformer 进行实际的代码转换
 */
export class FileTransformer {
  private astTransformer: AstTransformer;

  constructor(config: I18nConfig) {
    this.astTransformer = new AstTransformer(config);
  }

  /**
   * 处理单个文件的转换
   * @param filePath - 文件路径
   * @returns 转换结果
   */
  public async transformFile(filePath: string): Promise<TransformResult[]> {
    try {
      // 读取文件内容
      const source = await readFile(filePath, "utf-8");

      // 使用 AstTransformer 进行转换
      const { results, transformedCode } = this.astTransformer.transformSource(
        source,
        filePath
      );

      // 如果有转换结果，写入修改后的文件
      if (results.length > 0) {
        await writeFile(filePath, transformedCode);
      }

      return results;
    } catch (error) {
      console.error(`处理文件 ${filePath} 时发生错误:`, error);
      throw error;
    }
  }
}
