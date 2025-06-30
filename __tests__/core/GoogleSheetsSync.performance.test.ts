import { GoogleSheetsSync } from "../../core/GoogleSheetsSync";
import type { I18nConfig } from "../../types";
import type { CompleteTranslationRecord } from "../../core/TranslationManager";

// Mock Google Sheets API
const mockGoogleSheets = {
  spreadsheets: {
    values: {
      get: jest.fn(),
      update: jest.fn(),
      append: jest.fn(),
      batchUpdate: jest.fn(),
      clear: jest.fn(),
    },
    batchUpdate: jest.fn(),
    get: jest.fn(),
  },
};

// Mock configuration
const mockConfig: I18nConfig = {
  rootDir: ".",
  languages: ["en", "zh-Hans", "ko"],
  ignore: ["node_modules/**"],
  spreadsheetId: "test-spreadsheet-id",
  sheetName: "test-sheet",
  keyFile: "test-key.json",
  startMarker: "t(",
  endMarker: ")",
  include: ["**/*.ts", "**/*.tsx"],
  outputDir: "test-output",
  logLevel: "verbose",
};

// 生成大量测试数据的工具函数
function generateLargeDataSet(
  count: number,
  keyPrefix: string = "key_"
): CompleteTranslationRecord {
  const data: CompleteTranslationRecord = {};

  for (let i = 0; i < count; i++) {
    const moduleKey = `Module${Math.floor(i / 10)}.ts`;
    if (!data[moduleKey]) {
      data[moduleKey] = {};
    }

    data[moduleKey][`${keyPrefix}${i}`] = {
      en: `English text ${i}`,
      "zh-Hans": `中文文本 ${i}`,
      ko: `한국어 텍스트 ${i}`,
      mark: i % 2,
    } as any;
  }

  return data;
}

describe("GoogleSheetsSync - 性能测试", () => {
  let googleSheetsSync: GoogleSheetsSync;

  beforeEach(() => {
    jest.clearAllMocks();
    googleSheetsSync = new GoogleSheetsSync(mockConfig);

    // 注入mock的Google Sheets实例
    (googleSheetsSync as any).googleSheets = mockGoogleSheets;
    (googleSheetsSync as any).isInitialized = true;

    // Mock sheet metadata
    mockGoogleSheets.spreadsheets.get.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: {
              title: "test-sheet",
              sheetId: 0,
            },
          },
        ],
      },
    });
  });

  describe("变更检测性能", () => {
    test("大数据集变更检测应该在合理时间内完成", () => {
      const largeRemoteData = generateLargeDataSet(1000);
      const largeLocalData = {
        ...largeRemoteData,
        "NewModule.ts": {
          new_key: {
            en: "New",
            "zh-Hans": "新增",
            ko: "새로운",
            mark: 0,
          } as any,
        },
      };

      // 修改其中 1% 的数据
      const keysToModify = Object.keys(largeRemoteData).slice(0, 10);
      keysToModify.forEach((moduleKey) => {
        const firstKey = Object.keys(largeRemoteData[moduleKey])[0];
        (largeLocalData as any)[moduleKey][firstKey]["zh-Hans"] = "已修改";
      });

      const startTime = Date.now();
      const changeSet = googleSheetsSync.calculateChangeSet(
        largeRemoteData,
        largeLocalData
      );
      const duration = Date.now() - startTime;

      // 验证变更检测在1秒内完成
      expect(duration).toBeLessThan(1000);

      // 验证检测到正确的变更数量
      expect(changeSet.addedRows).toHaveLength(1); // 新增的模块
      expect(changeSet.modifiedRows).toHaveLength(10); // 修改的行
      expect(changeSet.deletedKeys).toHaveLength(0); // 没有删除

      console.log(`变更检测性能: ${duration}ms for 1000+ records`);
    });

    test("数据版本计算应该一致且高效", () => {
      const testData = generateLargeDataSet(500);

      const startTime = Date.now();
      const version1 = googleSheetsSync.calculateDataVersion(testData);
      const version2 = googleSheetsSync.calculateDataVersion(testData);
      const duration = Date.now() - startTime;

      // 相同数据应该产生相同版本
      expect(version1).toBe(version2);

      // 版本计算应该在500ms内完成
      expect(duration).toBeLessThan(500);

      console.log(`版本计算性能: ${duration}ms for 500 records`);
    });
  });

  describe("增量同步效率", () => {
    test("应该只处理变更的数据", async () => {
      const baseData = generateLargeDataSet(100);
      const modifiedData = { ...baseData };

      // 只修改5条数据
      Object.keys(baseData)
        .slice(0, 5)
        .forEach((moduleKey) => {
          const firstKey = Object.keys(baseData[moduleKey])[0];
          modifiedData[moduleKey][firstKey]["zh-Hans"] = "已修改";
        });

      // Mock getCurrentSheetData
      const sheetData = [["key", "en", "zh-Hans", "ko", "mark"]];
      Object.entries(baseData).forEach(([modulePath, moduleKeys]) => {
        Object.entries(moduleKeys).forEach(([key, translations]) => {
          const combinedKey = `[${modulePath}][${translations.en}]`;
          sheetData.push([
            combinedKey,
            translations.en,
            translations["zh-Hans"],
            translations.ko,
            (translations.mark || 0).toString(),
          ]);
        });
      });

      (googleSheetsSync as any).getCurrentSheetData = jest
        .fn()
        .mockResolvedValue(sheetData);

      // Mock 相关方法
      (googleSheetsSync as any).getSheetId = jest.fn().mockResolvedValue(0);
      (googleSheetsSync as any).acquireRowLocks = jest.fn().mockResolvedValue({
        lockId: "test-lock",
        lockedRows: new Set([1, 2, 3, 4, 5]),
        lockTimestamp: Date.now(),
      });
      (googleSheetsSync as any).releaseRowLocks = jest
        .fn()
        .mockResolvedValue(undefined);

      const changeSet = googleSheetsSync.calculateChangeSet(
        baseData,
        modifiedData
      );

      await (googleSheetsSync as any).applyIncrementalChangesInternal(
        changeSet,
        {
          enableStyleProtection: true,
        }
      );

      // 验证只有修改的行被处理
      expect(changeSet.modifiedRows).toHaveLength(5);
      expect(changeSet.addedRows).toHaveLength(0);
      expect(changeSet.deletedKeys).toHaveLength(0);

      // 验证API调用次数
      expect(
        mockGoogleSheets.spreadsheets.values.batchUpdate
      ).toHaveBeenCalledTimes(1); // 只有修改操作

      console.log("✅ 增量同步只处理了变更的5条数据");
    });

    test("空变更集应该跳过所有操作", () => {
      const sameData = generateLargeDataSet(50);

      const changeSet = googleSheetsSync.calculateChangeSet(sameData, sameData);

      expect((googleSheetsSync as any).isChangeSetEmpty(changeSet)).toBe(true);
      expect(changeSet.addedRows).toHaveLength(0);
      expect(changeSet.modifiedRows).toHaveLength(0);
      expect(changeSet.deletedKeys).toHaveLength(0);

      console.log("✅ 空变更集正确跳过所有操作");
    });
  });

  describe("并发控制性能", () => {
    test("版本验证应该高效", async () => {
      const testRecord = generateLargeDataSet(100);

      // Mock syncCompleteRecordFromSheet
      mockGoogleSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [["key", "en", "zh-Hans", "ko", "mark"]],
        },
      });

      const expectedVersion = googleSheetsSync.calculateDataVersion(testRecord);

      const startTime = Date.now();
      try {
        await googleSheetsSync.validateRemoteVersion(expectedVersion);
      } catch (error: any) {
        // 预期会抛出版本冲突错误，因为远端是空的
        expect(error.message).toContain("版本冲突");
      }
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);

      console.log(`版本验证性能: ${duration}ms`);
    });

    test("行锁机制应该高效处理多行", async () => {
      const changeSet = {
        addedRows: [],
        modifiedRows: Array.from({ length: 20 }, (_, i) => ({
          key: `[Module${i}.ts][key_${i}]`,
          values: [`key_${i}`, `en_${i}`, `zh_${i}`, `ko_${i}`, "0"],
        })),
        deletedKeys: Array.from(
          { length: 10 },
          (_, i) => `[Module${i}.ts][old_${i}]`
        ),
      };

      // Mock getCurrentSheetData with relevant rows
      const sheetData = [["key", "en", "zh-Hans", "ko", "mark"]];
      changeSet.modifiedRows.forEach((row, index) => {
        sheetData.push([
          row.key,
          `en_${index}`,
          `zh_${index}`,
          `ko_${index}`,
          "0",
        ]);
      });
      changeSet.deletedKeys.forEach((key, index) => {
        sheetData.push([
          key,
          `old_en_${index}`,
          `old_zh_${index}`,
          `old_ko_${index}`,
          "0",
        ]);
      });

      (googleSheetsSync as any).getCurrentSheetData = jest
        .fn()
        .mockResolvedValue(sheetData);

      const startTime = Date.now();
      const lockInfo = await googleSheetsSync.acquireRowLocks(changeSet);
      const duration = Date.now() - startTime;

      expect(lockInfo.lockedRows.size).toBe(30); // 20 修改 + 10 删除
      expect(duration).toBeLessThan(500);

      await googleSheetsSync.releaseRowLocks(lockInfo);

      console.log(`行锁性能: ${duration}ms for 30 rows`);
    });
  });

  describe("内存使用优化", () => {
    test("大数据集处理不应导致内存泄漏", () => {
      const memoryBefore = process.memoryUsage();

      // 处理多个大数据集
      for (let i = 0; i < 5; i++) {
        const largeData = generateLargeDataSet(200);
        const version = googleSheetsSync.calculateDataVersion(largeData);
        expect(version).toBeTruthy();

        const changeSet = googleSheetsSync.calculateChangeSet(
          largeData,
          largeData
        );
        expect((googleSheetsSync as any).isChangeSetEmpty(changeSet)).toBe(
          true
        );
      }

      const memoryAfter = process.memoryUsage();
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      // 内存增长应该在合理范围内（<50MB）
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`内存使用: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});
