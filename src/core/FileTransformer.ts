import * as fs from "fs";
import { promisify } from "util";
import {
  AstTransformer,
  TransformResult,
  ExistingReference,
  FileAnalysisResult,
} from "./AstTransformer";
import type { I18nConfig } from "../types";
import { Logger } from "../utils/StringUtils";

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
      Logger.debug(
        `🔍 [DEBUG] FileTransformer.collectFileReferences: ${filePath}`
      );

      // 读取文件内容
      const source = await readFile(filePath, "utf-8");
      Logger.debug(`📖 [DEBUG] 重新读取文件内容长度: ${source.length} 字符`);

      // 显示文件的前200个字符用于验证内容
      Logger.debug(`📝 [DEBUG] 文件内容预览: "${source.substring(0, 200)}..."`);

      // 使用 AstTransformer 收集引用（通过 analyzeAndTransformSource 返回的 AST 结果更稳妥）
      const { existingReferences } =
        this.astTransformer.analyzeAndTransformSource(source, filePath);

      Logger.debug(`📋 [DEBUG] 收集到 ${existingReferences.length} 个引用`);
      existingReferences.forEach((ref: ExistingReference, index: number) => {
        Logger.debug(
          `  ${index + 1}. ${ref.key} -> ${ref.filePath}:${ref.lineNumber}:${
            ref.columnNumber
          } (${ref.callExpression})`
        );
      });

      return existingReferences;
    } catch (error) {
      Logger.error(`❌ 收集文件引用 ${filePath} 时发生错误:`, error);
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
      Logger.debug(
        `📁 [DEBUG] FileTransformer.analyzeAndTransformFile: ${filePath}`
      );

      // 读取文件内容
      const source = await readFile(filePath, "utf-8");
      Logger.debug(`📖 [DEBUG] 读取文件内容长度: ${source.length} 字符`);

      // 使用 AstTransformer 进行分析和转换
      const result = this.astTransformer.analyzeAndTransformSource(
        source,
        filePath
      );

      Logger.debug(`🔍 [DEBUG] AstTransformer 返回结果:`);
      Logger.debug(`  - 现有引用: ${result.existingReferences.length}`);
      Logger.debug(`  - 新翻译: ${result.newTranslations.length}`);
      Logger.debug(`  - 转换后代码长度: ${result.transformedCode.length} 字符`);

      // 检查是否需要写入文件（有新翻译或导入路径被修复）
      const shouldWriteFile =
        result.newTranslations.length > 0 || result.transformedCode !== source;

      if (shouldWriteFile) {
        await writeFile(filePath, result.transformedCode);
        if (result.newTranslations.length > 0) {
          Logger.debug(`✅ [DEBUG] 文件写入完成（包含新翻译）`);
        } else {
          Logger.debug(`✅ [DEBUG] 文件写入完成（导入路径修复）`);
        }
      } else {
        Logger.debug(`📄 [DEBUG] 文件无变化，跳过写入`);
      }

      return result;
    } catch (error) {
      Logger.error(`❌ 分析和转换文件 ${filePath} 时发生错误:`, error);
      throw error;
    }
  }
}
