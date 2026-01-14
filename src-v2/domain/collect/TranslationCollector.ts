/**
 * 翻译收集主编排器
 * 整合依赖分析和内容提取流程
 */

import { MarkExtractor } from "./MarkExtractor";
import { DependencyAnalyzer } from "./DependencyAnalyzer";
import { MarkedExtractor } from "../../infra/ast/MarkedExtractor";
import type { I18nConfig } from "../../types/config";
import type { ExtractedContent } from "../../types/extraction";

/**
 * 文件处理结果
 */
export interface FileResult {
  /** 文件路径 */
  filePath: string;
  
  /** 提取的内容 */
  extractions: ExtractedContent[];
  
  /** 是否包含标记内容 */
  hasMarkedContent: boolean;
  
  /** 处理时间 */
  processingTime: number;
}

/**
 * 收集结果
 */
export interface CollectionResult {
  /** 所有处理的文件 */
  filesProcessed: string[];
  
  /** 包含标记的文件 */
  filesWithMarks: string[];
  
  /** 文件结果映射 */
  fileResults: Map<string, FileResult>;
  
  /** 全局摘要 */
  summary: CollectionSummary;
}

/**
 * 收集摘要
 */
export interface CollectionSummary {
  /** 总文件数 */
  totalFiles: number;
  
  /** 包含标记的文件数 */
  filesWithMarks: number;
  
  /** 总提取数量 */
  totalExtractions: number;
  
  /** 各类型提取数量 */
  extractionTypes: Record<string, number>;
  
  /** 总处理时间 */
  totalTime: number;
}

/**
 * 翻译收集主编排器
 */
export class TranslationCollector {
  private markExtractor: MarkExtractor;
  private dependencyAnalyzer: DependencyAnalyzer;
  private markedExtractor: MarkedExtractor;

  constructor(private config: I18nConfig) {
    this.markExtractor = new MarkExtractor();
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.markedExtractor = new MarkedExtractor(config);
  }

  /**
   * 主收集方法
   */
  async collect(entryFiles: string[]): Promise<CollectionResult> {
    const startTime = Date.now();
    
    try {
      // 1. 依赖分析，获取所有相关文件
      const allFiles = this.analyzeDependencies(entryFiles);
      
      // 2. 处理每个文件
      const fileResults = new Map<string, FileResult>();
      const filesWithMarks: string[] = [];
      
      for (const filePath of allFiles) {
        const result = await this.processFile(filePath);
        fileResults.set(filePath, result);
        
        if (result.hasMarkedContent) {
          filesWithMarks.push(filePath);
        }
      }
      
      // 3. 生成收集结果
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      return {
        filesProcessed: allFiles,
        filesWithMarks,
        fileResults,
        summary: this.generateSummary(fileResults, totalTime),
      };
    } catch (error) {
      console.error("Translation collection failed:", error);
      throw error;
    }
  }

  /**
   * 处理单个文件
   */
  async processFile(filePath: string): Promise<FileResult> {
    const startTime = Date.now();
    
    try {
      // 1. 读取文件内容
      const source = await this.readFileContent(filePath);
      
      // 2. 快速检测是否包含标记
      const hasMarks = this.markExtractor.hasMarks(source, this.config);
      
      if (!hasMarks) {
        return {
          filePath,
          extractions: [],
          hasMarkedContent: false,
          processingTime: Date.now() - startTime,
        };
      }
      
      // 3. 使用AST级提取器进行精确提取
      const extractions = this.markedExtractor.extract(source, filePath);
      
      return {
        filePath,
        extractions,
        hasMarkedContent: extractions.length > 0,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`Failed to process file ${filePath}:`, error);
      return {
        filePath,
        extractions: [],
        hasMarkedContent: false,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 分析依赖关系
   */
  private analyzeDependencies(entryFiles: string[]): string[] {
    const allFiles: string[] = [];
    
    for (const entryFile of entryFiles) {
      const dependencies = this.dependencyAnalyzer.analyze(entryFile, this.config);
      allFiles.push(...dependencies);
    }
    
    // 去重
    return Array.from(new Set(allFiles));
  }

  /**
   * 读取文件内容
   */
  private async readFileContent(filePath: string): Promise<string> {
    const fs = await import('fs');
    return fs.promises.readFile(filePath, 'utf-8');
  }

  /**
   * 生成收集摘要
   */
  private generateSummary(
    fileResults: Map<string, FileResult>, 
    totalTime: number
  ): CollectionSummary {
    let totalExtractions = 0;
    const extractionTypes: Record<string, number> = {};
    
    for (const result of fileResults.values()) {
      totalExtractions += result.extractions.length;
      
      for (const extraction of result.extractions) {
        extractionTypes[extraction.type] = (extractionTypes[extraction.type] || 0) + 1;
      }
    }
    
    const filesWithMarks = Array.from(fileResults.values())
      .filter(result => result.hasMarkedContent).length;
    
    return {
      totalFiles: fileResults.size,
      filesWithMarks,
      totalExtractions,
      extractionTypes,
      totalTime,
    };
  }
}