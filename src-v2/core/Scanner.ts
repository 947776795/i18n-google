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
import { ReferenceCollector } from '../domain/collect/ReferenceCollector';
import { CodeTransformer } from '../infra/ast/CodeTransformer';
import { RecordGenerator } from '../domain/record/RecordGenerator';
import { LangFileGenerator } from '../domain/record/LangFileGenerator';
import { GoogleSheetsSync } from '../infra/sync/GoogleSheetsSync';
import { RecordMerger } from '../domain/record/RecordMerger';
import { UnusedKeyAnalyzer } from '../domain/cleanup/UnusedKeyAnalyzer';
import { UserPrompt } from '../ui/UserPrompt';
import { TranslationRecord } from '../types/record';
import { CodeReference } from '../types/sync';

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
  /** 跳过确认：true=自动删除, false=自动保留, undefined=交互式询问 */
  skipConfirm?: boolean | null;
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
  /** 删除的无用 keys 数量 */
  deletedKeys?: number;
  /** 同步状态 */
  syncStatus?: {
    /** 是否成功拉取远端数据 */
    pulled: boolean;
    /** 是否成功推送远端数据 */
    pushed: boolean;
  };
}

/**
 * 主流程编排器
 *
 * 职责：编排所有模块，完成完整流程
 *
 * 完整流程步骤:
 * 1️⃣ 加载配置
 * 2️⃣ 从 Google Sheets 拉取远端翻译
 * 3️⃣ 读取本地现有翻译记录
 * 4️⃣ 扫描文件
 * 5️⃣ 收集翻译 keys（新 keys + I18n.t 引用）
 * 6️⃣ 三方合并翻译数据（远端优先）
 * 7️⃣ 代码转换 + 写入
 * 8️⃣ 生成翻译文件
 * 9️⃣ 检测无用翻译 keys（提示用户确认删除）
 * 🔟 推送到 Google Sheets
 */
export class Scanner {
  private configLoader: ConfigLoader;
  private fileScanner: FileScanner;
  private pathMapper: PathMapper;
  private markExtractor: MarkExtractor;
  private jsxTextExtractor?: JSXTextExtractor;
  private templateExtractor?: TemplateExtractor;
  private dependencyAnalyzer: DependencyAnalyzer;
  private referenceCollector?: ReferenceCollector;
  private codeTransformer: CodeTransformer;
  private recordGenerator: RecordGenerator;
  private langFileGenerator: LangFileGenerator;
  private googleSheetsSync?: GoogleSheetsSync;
  private recordMerger: RecordMerger;
  private unusedKeyAnalyzer: UnusedKeyAnalyzer;
  private userPrompt: UserPrompt;

  constructor() {
    this.configLoader = new ConfigLoader();
    this.fileScanner = new FileScanner();
    this.pathMapper = new PathMapper();
    this.markExtractor = new MarkExtractor();
    // jsxTextExtractor、templateExtractor 和 referenceCollector 延迟初始化，需要 config
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.codeTransformer = new CodeTransformer();
    this.recordGenerator = new RecordGenerator();
    this.langFileGenerator = new LangFileGenerator();
    this.recordMerger = new RecordMerger();
    this.unusedKeyAnalyzer = new UnusedKeyAnalyzer();
    this.userPrompt = new UserPrompt();
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
      deletedKeys: 0,
      syncStatus: {
        pulled: false,
        pushed: false,
      },
    };

    // 如果指定了 skipConfirm，设置自动确认
    if (options.skipConfirm !== undefined) {
      this.userPrompt.setAutoConfirm(options.skipConfirm);
    }

    // ============ 主流程 ============

    // 1️⃣ 加载配置
    const config = await this.configLoader.load(options.projectRoot);

    // 解析目录路径（支持命令行覆盖）
    const appDir = options.appDir
      ? path.resolve(options.projectRoot, options.appDir)
      : path.resolve(options.projectRoot, config.rootDir);

    const translateDir = options.translateDir
      ? path.resolve(options.projectRoot, options.translateDir)
      : path.resolve(options.projectRoot, config.outputDir);

    const locales = options.locales || config.languages;
    const recordPath = path.join(translateDir, 'i18n-complete-record.json');

    // 初始化 Google Sheets 同步器（如果配置了）
    if (config.spreadsheetId && config.keyFile) {
      this.googleSheetsSync = new GoogleSheetsSync(config);
    }

    // 2️⃣ 从 Google Sheets 拉取远端翻译
    let remoteRecord: TranslationRecord = {};
    if (this.googleSheetsSync) {
      try {
        remoteRecord = await this.googleSheetsSync.pull();
        result.syncStatus!.pulled = true;
      } catch (error) {
        console.log(`⚠️  拉取远端翻译失败: ${error}`);
      }
    }

    // 3️⃣ 读取本地现有翻译记录
    let localRecord: TranslationRecord = {};
    try {
      if (fs.existsSync(recordPath)) {
        const content = fs.readFileSync(recordPath, 'utf-8');
        const loadedRecord: TranslationRecord = JSON.parse(content);

        // 🔑 直接使用加载的数据，不再转换格式
        // 现在内存中统一使用语言代码（如 "en"），不再使用 "en.json"
        localRecord = loadedRecord;

        // 🔑 将 localRecord 的数据加载到 recordGenerator 中
        // 这样无用 key 检测才能发现之前存在但当前未使用的 keys
        for (const [folderName, localeMap] of Object.entries(localRecord)) {
          for (const [locale, translations] of Object.entries(localeMap)) {
            for (const [key, value] of Object.entries(translations)) {
              this.recordGenerator.add(folderName, locale, key, value);
            }
          }
        }
      }
    } catch (error) {
      console.log(`⚠️  读取本地记录失败: ${error}`);
    }

    // 4️⃣ 扫描文件
    const entryFiles = this.fileScanner.scan(appDir, config);
    result.totalFiles = entryFiles.length;

    if (entryFiles.length === 0) {
      console.log('⚠️  未找到任何入口文件 (page.tsx/layout.tsx)');
      return result;
    }

    // 用于追踪已处理的文件（避免重复转换）
    const processedFiles = new Set<string>();

    // 用于收集新扫描的 keys（按 folderName 分组）
    const newKeysByFolder = new Map<string, Set<string>>();

    // 用于收集代码引用（用于无用 key 检测）
    const codeReferences = new Set<CodeReference>();

    // 5️⃣ 收集翻译 keys + 代码转换（含递归依赖分析）
    // 初始化需要 config 的提取器
    this.jsxTextExtractor = new JSXTextExtractor(config);
    this.templateExtractor = new TemplateExtractor(config);
    this.referenceCollector = new ReferenceCollector(config);

    for (const entryFile of entryFiles) {
      // 计算入口文件的 folderName
      const folderName = this.pathMapper.toFolderName(entryFile.filePath, appDir);

      // 递归分析依赖文件
      const allFiles = this.dependencyAnalyzer.analyze(entryFile.filePath, config);

      for (const filePath of allFiles) {
        const source = fs.readFileSync(filePath, 'utf-8');
        const isAlreadyProcessed = processedFiles.has(filePath);

        // 🔑 关键修复：无论文件是否已处理，都要为当前 entryFile 收集引用
        // 这样可以确保组件迁移后，新的 entryFile 能正确收集依赖文件的引用
        const existingRefs = this.referenceCollector.collect(source, filePath);
        for (const ref of existingRefs) {
          // 使用入口文件的 folderName，而不是从 ref.filePath 计算
          // 这样可以确保被依赖的组件文件的引用与记录中的 folderName 匹配
          codeReferences.add({ folderName, key: ref.key });
        }

        // 如果文件已经处理过，跳过转换（避免重复转换）
        // 但需要为当前入口生成翻译副本：从 recordGenerator 中查找共享组件的翻译
        if (isAlreadyProcessed) {
          // 收集已转换文件中的 I18n.t() 引用
          const fileRefs = this.referenceCollector.collect(source, filePath);

          if (fileRefs.length > 0) {
            // 从 recordGenerator 中查找其他 folderName 的翻译，并复制到当前 folderName
            for (const ref of fileRefs) {
              // 遍历所有已处理的 folderName，查找包含这个 key 的翻译
              for (const locale of locales) {
                // 🔑 确保使用语言代码（移除可能的 .json 后缀）
                const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;
                let translatedValue = '';

                // 🔑 优先从 recordGenerator 中查找（当前扫描过程中已添加的翻译）
                const currentRecord = this.recordGenerator.generate();
                for (const [otherFolderName, localeMap] of Object.entries(currentRecord)) {
                  if (otherFolderName === folderName) continue;
                  if (localeMap[localeCode]?.[ref.key]) {
                    translatedValue = localeMap[localeCode][ref.key];
                    break;
                  }
                }

                // 如果 recordGenerator 中没有，尝试从 localRecord 查找
                if (!translatedValue) {
                  for (const [otherFolderName, localeMap] of Object.entries(localRecord)) {
                    if (otherFolderName === folderName) continue;
                    if (localeMap[localeCode]?.[ref.key]) {
                      translatedValue = localeMap[localeCode][ref.key];
                      break;
                    }
                  }
                }

                // 如果 localRecord 中没有，尝试从 remoteRecord 查找
                if (!translatedValue) {
                  for (const [otherFolderName, localeMap] of Object.entries(remoteRecord)) {
                    if (otherFolderName === folderName) continue;
                    if (localeMap[localeCode]?.[ref.key]) {
                      translatedValue = localeMap[localeCode][ref.key];
                      break;
                    }
                  }
                }

                // 如果找到了翻译，添加到当前 folderName
                if (translatedValue) {
                  this.recordGenerator.add(folderName, localeCode, ref.key, translatedValue);
                }
              }
            }
          }
          continue;
        }
        processedFiles.add(filePath);

        // 收集所有需要翻译的 key
        const allKeys = new Set<string>();

        // 1. 从 MarkExtractor 收集带标记的字符串字面量
        const markInfos = this.markExtractor.extractWithInfo(source, config.startMarker, config.endMarker);
        markInfos.forEach(info => allKeys.add(info.cleanedText));

        // 2. 从 JSXTextExtractor 收集纯 JSX 文本
        const jsxTextContents = this.jsxTextExtractor.extract(source, filePath);
        jsxTextContents.forEach(content => allKeys.add(content.cleanedText));

        // 3. 从 TemplateExtractor 收集带标记的模板字符串
        const templateContents = this.templateExtractor.extract(source, filePath);
        templateContents.forEach(content => allKeys.add(content.cleanedText));

        const keysArray = Array.from(allKeys);

        if (keysArray.length === 0) {
          // 🔑 即使没有新标记，也要检查是否有 I18n.t() 引用需要复制翻译
          const fileRefs = this.referenceCollector.collect(source, filePath);
          if (fileRefs.length > 0) {
            // 🔑 关键修复：将引用添加到 codeReferences，用于无用 key 检测
            for (const ref of fileRefs) {
              codeReferences.add({ folderName, key: ref.key });
            }

            // 从 localRecord 或 remoteRecord 中查找翻译，并复制到当前 folderName
            for (const ref of fileRefs) {
              for (const locale of locales) {
                // 🔑 确保使用语言代码（移除可能的 .json 后缀）
                const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;
                let translatedValue = '';

                // 优先从 localRecord 查找
                for (const [otherFolderName, localeMap] of Object.entries(localRecord)) {
                  if (otherFolderName === folderName) continue;
                  if (localeMap[localeCode]?.[ref.key]) {
                    translatedValue = localeMap[localeCode][ref.key];
                    break;
                  }
                }

                // 如果 localRecord 中没有，尝试从 remoteRecord 查找
                if (!translatedValue) {
                  for (const [otherFolderName, localeMap] of Object.entries(remoteRecord)) {
                    if (otherFolderName === folderName) continue;
                    if (localeMap[localeCode]?.[ref.key]) {
                      translatedValue = localeMap[localeCode][ref.key];
                      break;
                    }
                  }
                }

                // 如果找到了翻译，添加到当前 folderName
                if (translatedValue) {
                  this.recordGenerator.add(folderName, localeCode, ref.key, translatedValue);
                }
              }
            }
          }

          // 没有新标记，跳过后续逻辑
          continue;
        }

        // 6️⃣ 🔀 三方合并翻译数据
        // 为每个 folderName 收集新 keys
        if (!newKeysByFolder.has(folderName)) {
          newKeysByFolder.set(folderName, new Set<string>());
        }
        keysArray.forEach(key => newKeysByFolder.get(folderName)!.add(key));

        // 合并远端、本地和新的翻译
        const mergeResult = this.recordMerger.merge(
          remoteRecord,
          localRecord,
          newKeysByFolder.get(folderName)!,
          folderName,
          locales  // 传入配置的语言列表
        );

        // 判断是否为入口文件
        const isEntry = entryFile.filePath === filePath;
        const transformResult = this.codeTransformer.transform(source, keysArray, isEntry, folderName);

        // 写回文件
        fs.writeFileSync(filePath, transformResult.code, 'utf-8');

        // 收集转换后新增的 I18n.t() 引用（用于无用 key 检测）
        const newRefs = this.referenceCollector!.collect(transformResult.code, filePath);
        for (const ref of newRefs) {
          // 使用入口文件的 folderName，而不是从 ref.filePath 计算
          codeReferences.add({ folderName, key: ref.key });
        }

        // 使用合并后的翻译更新记录
        const mergedTranslations = mergeResult.mergedRecord[folderName];
        if (mergedTranslations) {
          for (const locale of locales) {
            // 🔑 确保使用语言代码（移除可能的 .json 后缀）
            const localeCode = locale.endsWith('.json') ? locale.slice(0, -5) : locale;
            if (mergedTranslations[localeCode]) {
              for (const [key, value] of Object.entries(mergedTranslations[localeCode])) {
                this.recordGenerator.add(folderName, localeCode, key, value);
              }
            }
          }
        }

        result.totalKeys += keysArray.length;
        result.transformedFiles++;
      }
    }

    // 7️⃣ 生成翻译文件
    await this.recordGenerator.saveCompleteRecord(recordPath);

    const stats = this.recordGenerator.getStats();

    const record = this.recordGenerator.generate();
    await this.langFileGenerator.generate(record, translateDir, locales);

    const generatedFiles = this.langFileGenerator.getGeneratedFiles(
      record,
      translateDir,
      locales
    );
    result.generatedFiles = generatedFiles.length;

    // 8️⃣ 检测无用翻译 keys
    const analysisResult = this.unusedKeyAnalyzer.analyze(record, codeReferences);

    // 收集已删除的 keys（用于推送到远端）
    const deletedKeysFormatted: string[] = [];

    if (analysisResult.total > 0) {
      const shouldDelete = await this.userPrompt.confirmDeleteUnusedKeys(analysisResult.formattedUnusedKeys);
      if (shouldDelete) {
        // 从记录中删除这些 keys
        for (const formattedKey of analysisResult.formattedUnusedKeys) {
          // 解析格式: [folderName][key]
          const match = formattedKey.match(/^\[(.+)\]\[([^\]]+)\]$/);
          if (match) {
            const [, folderName, key] = match;
            if (record[folderName]) {
              for (const localeFile of Object.keys(record[folderName])) {
                if (record[folderName][localeFile][key]) {
                  delete record[folderName][localeFile][key];
                  // 🔑 生成远端格式的 key [folderName][key]
                  // 远端 key 格式直接使用 folderName，不需要文件路径
                  deletedKeysFormatted.push(`[${folderName}][${key}]`);
                }
              }
              // 如果该文件夹下没有翻译了，删除文件夹
              let hasTranslations = false;
              for (const localeFile of Object.keys(record[folderName])) {
                if (Object.keys(record[folderName][localeFile]).length > 0) {
                  hasTranslations = true;
                  break;
                }
              }
              if (!hasTranslations) {
                delete record[folderName];
              }
            }
          }
        }

        result.deletedKeys = analysisResult.total;

        // 重新保存记录
        await this.recordGenerator.saveCompleteRecord(recordPath);
        // 重新生成翻译文件
        await this.langFileGenerator.generate(record, translateDir, locales);
      }
    }

    // 9️⃣ 📤 推送到 Google Sheets（使用增量合并避免并发冲突）
    if (this.googleSheetsSync) {
      // 🔴 修复：不管是否推送，都先拉取远端最新数据并合并到本地
      const mergedRecord = await this.googleSheetsSync.pullAndMerge(record, deletedKeysFormatted);

      // 🔑 将合并后的远端更新写回本地文件
      for (const [folderName, localeMap] of Object.entries(mergedRecord)) {
        for (const [locale, translations] of Object.entries(localeMap)) {
          for (const [key, value] of Object.entries(translations)) {
            this.recordGenerator.add(folderName, locale, key, value);
          }
        }
      }
      // 保存更新后的完整记录
      await this.recordGenerator.saveCompleteRecord(recordPath);

      // 同时重新生成语言文件（远端更新需要同步到 en.json 等）
      const updatedRecord = this.recordGenerator.generate();
      await this.langFileGenerator.generate(updatedRecord, translateDir, locales);

      // 🔑 现在询问用户是否推送（合并已完成）
      const updatedStats = this.recordGenerator.getStats();
      const shouldPush = await this.userPrompt.confirmPushToSheet(
        updatedStats.totalKeys,
        deletedKeysFormatted.length
      );

      if (shouldPush) {
        try {
          // 只执行推送，不再需要合并
          await this.googleSheetsSync.push(updatedRecord, deletedKeysFormatted);
          result.syncStatus!.pushed = true;
          console.log(`✅ 推送成功`);
        } catch (error) {
          console.log(`⚠️  推送失败: ${error}`);
        }
      } else {
        console.log(`⏭️  跳过推送，远端更新已合并到本地`);
      }
    }

    // 关闭用户提示器
    this.userPrompt.close();

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
    if (result.deletedKeys !== undefined) {
      console.log(`   删除 keys 数: ${result.deletedKeys}`);
    }
    if (result.syncStatus) {
      console.log(`\n🔄 同步状态:`);
      console.log(`   远端拉取: ${result.syncStatus.pulled ? '✅' : '❌'}`);
      console.log(`   远端推送: ${result.syncStatus.pushed ? '✅' : '❌'}`);
    }
    console.log('='.repeat(50));
  }
}
