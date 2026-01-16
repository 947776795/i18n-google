/**
 * Core - Scanner
 * 主流程编排器 - 编排所有模块，完成扫描转换流程
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileScanner } from '../domain/scan/FileScanner';
import { PathMapper } from '../domain/scan/PathMapper';
import { MarkExtractor } from '../domain/collect/MarkExtractor';
import { JSXTextExtractor } from '../domain/collect/JSXTextExtractor';
import { TemplateExtractor } from '../domain/collect/TemplateExtractor';
import { ConfigLoader } from '../domain/collect/ConfigLoader';
import { DependencyAnalyzer } from '../domain/collect/DependencyAnalyzer';
import { CodeTransformer } from '../infra/ast/CodeTransformer';
import { RecordGenerator } from '../domain/record/RecordGenerator';
import { LangFileGenerator } from '../domain/record/LangFileGenerator';
import { I18nConfig } from '../types/config';

/**
 * 运行配置选项
 */
export interface RunOptions {
  /** 项目根目录 (包含 i18n.config.js) */
  projectRoot: string;
  /** 扫描的源码目录 (相对于项目根目录，如 "src/app") */
  appDir?: string;
  /** 输出的翻译目录 (相对于项目根目录，如 "src/translate") */
  translateDir?: string;
  /** 支持的语言列表 (如 ["en", "ko", "zh-CN"]) */
  locales?: string[];
}

/**
 * 扫描结果
 */
export interface ScanResult {
  /** 扫描的文件数量 */
  totalFiles: number;
  /** 提取的标记文本数量 */
  totalKeys: number;
  /** 转换的文件数量 */
  transformedFiles: number;
  /** 生成的语言文件数量 */
  generatedFiles: number;
}

/**
 * 主流程编排器
 *
 * 职责：编排所有模块，完成完整流程
 *
 * 流程步骤:
 * 2️⃣ 🔧 加载配置
 * 3️⃣ 📁 扫描文件
 * 4️⃣ 🔍 收集翻译 + 代码转换（含递归依赖分析）
 *    - MarkExtractor: 提取带标记的字符串字面量
 *    - JSXTextExtractor: 提取纯 JSX 文本节点
 *    - TemplateExtractor: 提取带标记的模板字符串
 * 6️⃣ 🔧 生成记录
 * 7️⃣ 🔧 生成翻译文件
 */
export class Scanner {
  private configLoader: ConfigLoader;
  private fileScanner: FileScanner;
  private pathMapper: PathMapper;
  private markExtractor: MarkExtractor;
  private jsxTextExtractor: JSXTextExtractor;
  private templateExtractor: TemplateExtractor;
  private dependencyAnalyzer: DependencyAnalyzer;
  private codeTransformer: CodeTransformer;
  private recordGenerator: RecordGenerator;
  private langFileGenerator: LangFileGenerator;

  constructor() {
    this.configLoader = new ConfigLoader();
    this.fileScanner = new FileScanner();
    this.pathMapper = new PathMapper();
    this.markExtractor = new MarkExtractor();
    this.jsxTextExtractor = null as any; // 延迟初始化，需要 config
    this.templateExtractor = null as any; // 延迟初始化，需要 config
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.codeTransformer = new CodeTransformer();
    this.recordGenerator = new RecordGenerator();
    this.langFileGenerator = new LangFileGenerator();
  }

  /**
   * 执行完整流程
   *
   * @param options 运行选项
   * @returns 扫描结果
   */
  async run(options: RunOptions): Promise<ScanResult> {
    const result: ScanResult = {
      totalFiles: 0,
      totalKeys: 0,
      transformedFiles: 0,
      generatedFiles: 0,
    };

    // ============ 主流程 ============
    // 2️⃣ 🔧 加载配置
    console.log(`\n🔧 加载配置...`);
    const config = await this.configLoader.load(options.projectRoot);
    console.log(`   配置文件: i18n.config.js`);
    console.log(`   扫描目录: ${config.rootDir}`);
    console.log(`   输出目录: ${config.outputDir}`);
    console.log(`   语言列表: ${config.languages.join(', ')}`);

    // 解析目录路径（支持命令行覆盖）
    const appDir = options.appDir
      ? path.resolve(options.projectRoot, options.appDir)
      : path.resolve(options.projectRoot, config.rootDir);

    const translateDir = options.translateDir
      ? path.resolve(options.projectRoot, options.translateDir)
      : path.resolve(options.projectRoot, config.outputDir);

    const locales = options.locales || config.languages;

    // 3️⃣ 📁 扫描文件
    console.log(`\n📁 扫描文件: ${appDir}`);
    const entryFiles = this.fileScanner.scan(appDir, config);
    result.totalFiles = entryFiles.length;
    console.log(`   找到 ${entryFiles.length} 个入口文件`);

    if (entryFiles.length === 0) {
      console.log('⚠️  未找到任何入口文件 (page.tsx/layout.tsx)');
      return result;
    }

    // 用于追踪已处理的文件（避免重复转换）
    const processedFiles = new Set<string>();

    // 4️⃣ 🔍 收集翻译 + 代码转换（含递归依赖分析）
    console.log('\n🔍 收集翻译并转换代码...');

    // 初始化需要 config 的提取器
    this.jsxTextExtractor = new JSXTextExtractor(config);
    this.templateExtractor = new TemplateExtractor(config);

    for (const entryFile of entryFiles) {
      // 计算入口文件的 folderName
      const folderName = this.pathMapper.toFolderName(entryFile.filePath, appDir);

      // 递归分析依赖文件
      const allFiles = this.dependencyAnalyzer.analyze(entryFile.filePath, config);
      console.log(`   📂 ${entryFile.fileName} → ${folderName} (${allFiles.length} 个文件)`);

      for (const filePath of allFiles) {
        // 跳过已处理的文件
        if (processedFiles.has(filePath)) {
          console.log(`      ⏭️  ${path.relative(appDir, filePath)} (已处理)`);
          continue;
        }
        processedFiles.add(filePath);

        const source = fs.readFileSync(filePath, 'utf-8');

        // 收集所有需要翻译的 key
        const allKeys = new Set<string>();

        // 1. 从 MarkExtractor 收集带标记的字符串字面量
        const markKeys = this.markExtractor.extract(source, config);
        markKeys.forEach(key => allKeys.add(key));

        // 2. 从 JSXTextExtractor 收集纯 JSX 文本
        const jsxTextContents = this.jsxTextExtractor.extract(source, filePath);
        jsxTextContents.forEach(content => allKeys.add(content.cleanedText));

        // 3. 从 TemplateExtractor 收集带标记的模板字符串
        const templateContents = this.templateExtractor.extract(source, filePath);
        templateContents.forEach(content => allKeys.add(content.cleanedText));

        const keysArray = Array.from(allKeys);

        if (keysArray.length === 0) {
          console.log(`      ⏭️  ${path.relative(appDir, filePath)} (无标记)`);
          continue;
        }

        // 判断是否为入口文件
        const isEntry = entryFile.filePath === filePath;
        const transformResult = this.codeTransformer.transform(source, keysArray, isEntry, folderName);

        // 写回文件
        fs.writeFileSync(filePath, transformResult.code, 'utf-8');

        // 添加到记录
        for (const locale of locales) {
          for (const key of keysArray) {
            this.recordGenerator.add(folderName, locale, key, key);
          }
        }

        result.totalKeys += keysArray.length;
        result.transformedFiles++;

        console.log(`      ✅ ${path.relative(appDir, filePath)} (${keysArray.length} 个标记)`);
      }
    }

    // 6️⃣ 🔧 生成记录
    const recordPath = path.join(translateDir, 'i18n-complete-record.json');
    console.log(`\n🔧 生成记录: ${recordPath}`);
    await this.recordGenerator.saveCompleteRecord(recordPath);

    const stats = this.recordGenerator.getStats();
    console.log(`   总文件夹数: ${stats.totalFolders}`);
    console.log(`   总 Key 数: ${stats.totalKeys}`);

    // 7️⃣ 🔧 生成翻译文件
    console.log('\n🔧 生成翻译文件...');
    const record = this.recordGenerator.generate();
    await this.langFileGenerator.generate(record, translateDir, locales);

    const generatedFiles = this.langFileGenerator.getGeneratedFiles(
      record,
      translateDir,
      locales
    );
    result.generatedFiles = generatedFiles.length;

    for (const file of generatedFiles) {
      console.log(`   ✅ ${file}`);
    }

    return result;
  }

  /**
   * 打印结果摘要
   *
   * @param result 扫描结果
   */
  printSummary(result: ScanResult): void {
    console.log('\n' + '='.repeat(50));
    console.log('✅ 扫描完成！');
    console.log('='.repeat(50));
    console.log(`📊 统计:`);
    console.log(`   扫描文件数: ${result.totalFiles}`);
    console.log(`   提取标记数: ${result.totalKeys}`);
    console.log(`   转换文件数: ${result.transformedFiles}`);
    console.log(`   生成文件数: ${result.generatedFiles}`);
    console.log('='.repeat(50));
  }
}
