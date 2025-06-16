import * as fs from "fs";
import { promisify } from "util";
import {
  AstTransformer,
  TransformResult,
  ExistingReference,
  FileAnalysisResult,
} from "./AstTransformer";
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

  /**
   * 收集文件中现有的 I18n 引用
   * @param filePath - 文件路径
   * @returns 现有的 I18n 引用列表
   */
  public async collectFileReferences(
    filePath: string
  ): Promise<ExistingReference[]> {
    try {
      console.log(
        `🔍 [DEBUG] FileTransformer.collectFileReferences: ${filePath}`
      );

      // 读取文件内容
      const source = await readFile(filePath, "utf-8");
      console.log(`📖 [DEBUG] 重新读取文件内容长度: ${source.length} 字符`);

      // 显示文件的前200个字符用于验证内容
      console.log(`📝 [DEBUG] 文件内容预览: "${source.substring(0, 200)}..."`);

      // 使用 AstTransformer 收集引用
      const references = this.astTransformer.collectExistingI18nCalls(
        source,
        filePath
      );

      console.log(`📋 [DEBUG] 收集到 ${references.length} 个引用`);
      references.forEach((ref, index) => {
        console.log(
          `  ${index + 1}. ${ref.key} -> ${ref.filePath}:${ref.lineNumber}:${
            ref.columnNumber
          } (${ref.callExpression})`
        );
      });

      return references;
    } catch (error) {
      console.error(`❌ [DEBUG] 收集文件引用 ${filePath} 时发生错误:`, error);
      throw error;
    }
  }

  /**
   * 分析并转换文件，同时返回现有引用和新翻译
   * @param filePath - 文件路径
   * @returns 完整的文件分析结果
   */
  public async analyzeAndTransformFile(
    filePath: string
  ): Promise<FileAnalysisResult> {
    try {
      console.log(
        `📁 [DEBUG] FileTransformer.analyzeAndTransformFile: ${filePath}`
      );

      // 读取文件内容
      const source = await readFile(filePath, "utf-8");
      console.log(`📖 [DEBUG] 读取文件内容长度: ${source.length} 字符`);

      // 使用 AstTransformer 进行分析和转换
      const result = this.astTransformer.analyzeAndTransformSource(
        source,
        filePath
      );

      console.log(`🔍 [DEBUG] AstTransformer 返回结果:`);
      console.log(`  - 现有引用: ${result.existingReferences.length}`);
      console.log(`  - 新翻译: ${result.newTranslations.length}`);
      console.log(`  - 转换后代码长度: ${result.transformedCode.length} 字符`);

      // 如果有新翻译，写入修改后的文件
      if (result.newTranslations.length > 0) {
        console.log(`💾 [DEBUG] 写入修改后的文件: ${filePath}`);
        await writeFile(filePath, result.transformedCode);
        console.log(`✅ [DEBUG] 文件写入完成`);
      } else {
        console.log(`📄 [DEBUG] 没有新翻译，跳过文件写入`);
      }

      return result;
    } catch (error) {
      console.error(`❌ [DEBUG] 分析和转换文件 ${filePath} 时发生错误:`, error);
      throw error;
    }
  }
}
