import type { I18nConfig } from "../types";
import { ExistingReference, TransformResult } from "./AstTransformer";
import * as fs from "fs";
import * as path from "path";
import { Logger } from "../utils/StringUtils";

// 完整记录的数据结构
interface CompleteTranslationRecord {
  [key: string]: {
    files: string[]; // 引用该key的文件路径列表
    lastScanTime: string; // 最后扫描时间
  };
}

interface RecordMetadata {
  scanTime: string; // 本次扫描时间
  totalKeys: number; // 总Key数量
  usedKeys: number; // 已使用Key数量
  unusedKeys: number; // 无用Key数量
  newKeysAdded: number; // 本次新增Key数量
}

interface CompleteRecordFile {
  metadata: RecordMetadata;
  records: CompleteTranslationRecord;
}

export class RecordManager {
  constructor(private config: I18nConfig) {}

  /**
   * 生成完整记录文件
   */
  async generateCompleteRecord(
    references: Map<string, ExistingReference[]>,
    newTranslations: TransformResult[],
    currentTranslations: any
  ): Promise<void> {
    // 1. 加载现有记录
    const existingRecord = await this.loadExistingRecord();

    // 2. 合并数据
    const completeRecord = this.mergeRecordData(
      existingRecord,
      currentTranslations,
      references,
      newTranslations
    );

    // 3. 保存记录
    await this.saveCompleteRecord(completeRecord);

    Logger.info(
      `📋 完整记录已保存，包含 ${
        Object.keys(completeRecord.records).length
      } 个Key`
    );
  }

  /**
   * 加载现有记录
   */
  async loadExistingRecord(): Promise<CompleteRecordFile | null> {
    const recordPath = this.getRecordPath();

    try {
      const content = await fs.promises.readFile(recordPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      // 文件不存在是正常的
      return null;
    }
  }

  /**
   * 保存完整记录
   */
  async saveCompleteRecord(record: CompleteRecordFile): Promise<void> {
    const filePath = this.getRecordPath();

    // 确保输出目录存在
    await fs.promises.mkdir(this.config.outputDir, { recursive: true });

    const jsonContent = JSON.stringify(record, null, 2);
    await fs.promises.writeFile(filePath, jsonContent, "utf-8");

    Logger.info(`📄 完整记录已保存到: ${filePath}`);
  }

  /**
   * 更新记录文件（删除后）
   */
  async updateRecordAfterDeletion(deletedKeys: string[]): Promise<void> {
    const recordPath = this.getRecordPath();

    try {
      // 读取当前记录
      const content = await fs.promises.readFile(recordPath, "utf-8");
      const record: CompleteRecordFile = JSON.parse(content);

      // 删除对应的Key记录
      deletedKeys.forEach((key) => {
        delete record.records[key];
      });

      // 更新统计信息
      const totalKeys = Object.keys(record.records).length;
      const usedKeys = Object.values(record.records).filter(
        (r) => r.files.length > 0
      ).length;

      record.metadata = {
        ...record.metadata,
        scanTime: new Date().toISOString(),
        totalKeys,
        usedKeys,
        unusedKeys: totalKeys - usedKeys,
      };

      // 保存更新后的记录
      await fs.promises.writeFile(recordPath, JSON.stringify(record, null, 2));
    } catch (error) {
      Logger.warn("⚠️  更新记录文件失败:", error);
    }
  }

  /**
   * 合并记录数据
   */
  private mergeRecordData(
    existing: CompleteRecordFile | null,
    currentTranslations: any,
    currentReferences: Map<string, ExistingReference[]>,
    newTranslations: TransformResult[]
  ): CompleteRecordFile {
    Logger.debug("\n📋 [DEBUG] RecordManager.mergeRecordData 开始");
    Logger.debug("  - 现有记录:", existing ? "存在" : "不存在");
    Logger.debug("  - 当前引用Map大小:", currentReferences.size);
    Logger.debug("  - 新翻译数量:", newTranslations.length);

    const records: CompleteTranslationRecord = {};
    const scanTime = new Date().toISOString();

    // 获取所有Key（来自翻译文件和引用）
    const zhKeys = Object.keys(currentTranslations?.zh || {});
    const enKeys = Object.keys(currentTranslations?.en || {});
    const refKeys = Array.from(currentReferences.keys());
    const newKeys = newTranslations.map((t) => t.key);

    Logger.debug("📊 [DEBUG] Key来源统计:");
    Logger.debug(`  - 中文翻译文件: ${zhKeys.length} 个keys`);
    Logger.debug(`  - 英文翻译文件: ${enKeys.length} 个keys`);
    Logger.debug(`  - 引用Map: ${refKeys.length} 个keys`);
    Logger.debug(`  - 新翻译: ${newKeys.length} 个keys`);

    if (zhKeys.length > 0) {
      Logger.debug(`  - 中文keys前5个: [${zhKeys.slice(0, 5).join(", ")}]`);
    }
    if (refKeys.length > 0) {
      Logger.debug(`  - 引用keys前5个: [${refKeys.slice(0, 5).join(", ")}]`);
    }
    if (newKeys.length > 0) {
      Logger.debug(`  - 新翻译keys: [${newKeys.join(", ")}]`);
    }

    const allKeys = new Set([...zhKeys, ...enKeys, ...refKeys, ...newKeys]);

    Logger.debug(`🔗 [DEBUG] 合并后总Key数: ${allKeys.size}`);

    allKeys.forEach((key) => {
      // 获取引用的文件列表（去重）
      const refs = currentReferences.get(key) || [];
      const files = [...new Set(refs.map((r) => r.filePath))];

      Logger.debug(`🔍 [DEBUG] 处理key: ${key}`);
      Logger.debug(`  - 引用数: ${refs.length}`);
      Logger.debug(`  - 文件数: ${files.length}`);
      Logger.debug(`  - 文件列表: [${files.join(", ")}]`);

      // 检查是否是新翻译
      const isNewTranslation = newTranslations.some((t) => t.key === key);
      if (isNewTranslation) {
        Logger.debug(`  - ✨ 这是新翻译`);
        if (files.length === 0) {
          Logger.warn(`  - ⚠️  新翻译没有引用文件！`);
        }
      }

      records[key] = {
        files,
        lastScanTime: scanTime,
      };
    });

    Logger.debug(
      `📋 [DEBUG] RecordManager.mergeRecordData 完成，生成 ${
        Object.keys(records).length
      } 条记录`
    );

    return {
      metadata: this.generateMetadata(records, newTranslations.length),
      records,
    };
  }

  /**
   * 生成元数据
   */
  private generateMetadata(
    records: CompleteTranslationRecord,
    newKeysCount: number
  ): RecordMetadata {
    const totalKeys = Object.keys(records).length;
    const usedKeys = Object.values(records).filter(
      (r) => r.files.length > 0
    ).length;

    return {
      scanTime: new Date().toISOString(),
      totalKeys,
      usedKeys,
      unusedKeys: totalKeys - usedKeys,
      newKeysAdded: newKeysCount,
    };
  }

  /**
   * 获取记录文件路径
   */
  private getRecordPath(): string {
    return path.join(this.config.outputDir, "i18n-complete-record.json");
  }
}

export type { CompleteRecordFile, CompleteTranslationRecord, RecordMetadata };
