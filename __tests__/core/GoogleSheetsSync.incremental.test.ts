import { GoogleSheetsSync } from "../../core/GoogleSheetsSync";
import type { I18nConfig } from "../../../types";
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

describe("GoogleSheetsSync - 增量同步功能", () => {
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

  describe("变更检测算法", () => {
    test("应该正确计算数据版本哈希", () => {
      const record: CompleteTranslationRecord = {
        "TestModule.ts": {
          test_key: {
            en: "test",
            "zh-Hans": "测试",
            ko: "테스트",
            mark: 0,
          } as any,
        },
      };

      const version1 = googleSheetsSync.calculateDataVersion(record);
      expect(version1).toBeTruthy();
      expect(typeof version1).toBe("string");

      // 相同数据应该产生相同版本
      const version2 = googleSheetsSync.calculateDataVersion(record);
      expect(version1).toBe(version2);

      // 修改数据应该产生不同版本
      const modifiedRecord = JSON.parse(JSON.stringify(record));
      modifiedRecord["TestModule.ts"]["test_key"]["zh-Hans"] = "测试修改";
      const version3 = googleSheetsSync.calculateDataVersion(modifiedRecord);
      expect(version1).not.toBe(version3);
    });

    test("应该正确检测新增的翻译", () => {
      const remoteRecord: CompleteTranslationRecord = {
        "TestModule.ts": {
          existing_key: {
            en: "existing",
            "zh-Hans": "现有",
            ko: "기존",
            mark: 0,
          } as any,
        },
      };

      const localRecord: CompleteTranslationRecord = {
        "TestModule.ts": {
          existing_key: {
            en: "existing",
            "zh-Hans": "现有",
            ko: "기존",
            mark: 0,
          } as any,
          new_key: {
            en: "new",
            "zh-Hans": "新增",
            ko: "새로운",
            mark: 0,
          } as any,
        },
      };

      const changeSet = googleSheetsSync.calculateChangeSet(
        remoteRecord,
        localRecord
      );

      expect(changeSet.addedRows).toHaveLength(1);
      expect(changeSet.addedRows[0].key).toBe("[TestModule.ts][new]");
      expect(changeSet.modifiedRows).toHaveLength(0);
      expect(changeSet.deletedKeys).toHaveLength(0);
    });

    test("应该正确检测修改的翻译", () => {
      const remoteRecord: CompleteTranslationRecord = {
        "TestModule.ts": {
          test_key: {
            en: "test",
            "zh-Hans": "测试",
            ko: "테스트",
            mark: 0,
          } as any,
        },
      };

      const localRecord: CompleteTranslationRecord = {
        "TestModule.ts": {
          test_key: {
            en: "test",
            "zh-Hans": "测试修改",
            ko: "테스트",
            mark: 1,
          } as any,
        },
      };

      const changeSet = googleSheetsSync.calculateChangeSet(
        remoteRecord,
        localRecord
      );

      expect(changeSet.addedRows).toHaveLength(0);
      expect(changeSet.modifiedRows).toHaveLength(1);
      expect(changeSet.modifiedRows[0].key).toBe("[TestModule.ts][test]");
      expect(changeSet.deletedKeys).toHaveLength(0);
    });

    test("应该正确检测删除的翻译", () => {
      const remoteRecord: CompleteTranslationRecord = {
        "TestModule.ts": {
          old_key: {
            en: "old",
            "zh-Hans": "旧的",
            ko: "오래된",
            mark: 0,
          } as any,
          keep_key: {
            en: "keep",
            "zh-Hans": "保留",
            ko: "유지",
            mark: 0,
          } as any,
        },
      };

      const localRecord: CompleteTranslationRecord = {
        "TestModule.ts": {
          keep_key: {
            en: "keep",
            "zh-Hans": "保留",
            ko: "유지",
            mark: 0,
          } as any,
        },
      };

      const changeSet = googleSheetsSync.calculateChangeSet(
        remoteRecord,
        localRecord
      );

      expect(changeSet.addedRows).toHaveLength(0);
      expect(changeSet.modifiedRows).toHaveLength(0);
      expect(changeSet.deletedKeys).toHaveLength(1);
      expect(changeSet.deletedKeys[0]).toBe("[TestModule.ts][old]");
    });

    test("处理复杂变更场景", () => {
      const remoteRecord: CompleteTranslationRecord = {
        "ModuleA.ts": {
          key1: { en: "Text1", "zh-Hans": "文本1", mark: 0 } as any,
          key2: { en: "Text2", "zh-Hans": "文本2", mark: 0 } as any,
        },
        "ModuleB.ts": {
          key3: { en: "Text3", "zh-Hans": "文本3", mark: 0 } as any,
        },
      };

      const localRecord: CompleteTranslationRecord = {
        "ModuleA.ts": {
          key1: { en: "Text1", "zh-Hans": "新文本1", mark: 0 } as any, // 修改
          key4: { en: "Text4", "zh-Hans": "文本4", mark: 0 } as any, // 新增
        },
        "ModuleC.ts": {
          key5: { en: "Text5", "zh-Hans": "文本5", mark: 0 } as any, // 新增模块
        },
        // ModuleB.ts 整个删除
      };

      const changeSet = googleSheetsSync.calculateChangeSet(
        remoteRecord,
        localRecord
      );

      expect(changeSet.addedRows).toHaveLength(2); // key4, key5
      expect(changeSet.modifiedRows).toHaveLength(1); // key1
      expect(changeSet.deletedKeys).toHaveLength(2); // key2, key3
    });
  });

  describe("增量同步应用", () => {
    beforeEach(() => {
      // Mock current sheet data
      mockGoogleSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ["key", "en", "zh-Hans", "ko", "mark"],
            ["[TestModule.ts][existing]", "existing", "现有", "기존", "0"],
            [
              "[TestModule.ts][to_modify]",
              "old_value",
              "旧值",
              "오래된 값",
              "0",
            ],
            ["[TestModule.ts][to_delete]", "delete_me", "删除我", "삭제", "0"],
          ],
        },
      });
    });

    test("应该正确处理新增行", async () => {
      const changeSet = {
        addedRows: [
          {
            key: "[TestModule.ts][new_key]",
            values: ["[TestModule.ts][new_key]", "new", "新增", "새로운", "0"],
          },
        ],
        modifiedRows: [],
        deletedKeys: [],
      };

      await (googleSheetsSync as any).applyIncrementalChangesInternal(
        changeSet,
        {
          enableStyleProtection: true,
        }
      );

      expect(mockGoogleSheets.spreadsheets.values.append).toHaveBeenCalledWith({
        spreadsheetId: "test-spreadsheet-id",
        range: "test-sheet!A:A",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [["[TestModule.ts][new_key]", "new", "新增", "새로운", "0"]],
        },
      });
    });

    test("应该正确处理修改行", async () => {
      const changeSet = {
        addedRows: [],
        modifiedRows: [
          {
            key: "[TestModule.ts][to_modify]",
            values: [
              "[TestModule.ts][to_modify]",
              "new_value",
              "新值",
              "새 값",
              "1",
            ],
          },
        ],
        deletedKeys: [],
      };

      await (googleSheetsSync as any).applyIncrementalChangesInternal(
        changeSet,
        {
          enableStyleProtection: true,
        }
      );

      expect(
        mockGoogleSheets.spreadsheets.values.batchUpdate
      ).toHaveBeenCalledWith({
        spreadsheetId: "test-spreadsheet-id",
        requestBody: {
          valueInputOption: "RAW",
          data: [
            {
              range: "test-sheet!A3:E3",
              values: [
                [
                  "[TestModule.ts][to_modify]",
                  "new_value",
                  "新值",
                  "새 값",
                  "1",
                ],
              ],
            },
          ],
        },
      });
    });

    test("应该正确处理删除行", async () => {
      const changeSet = {
        addedRows: [],
        modifiedRows: [],
        deletedKeys: ["[TestModule.ts][to_delete]"],
      };

      await (googleSheetsSync as any).applyIncrementalChangesInternal(
        changeSet,
        {
          enableStyleProtection: true,
        }
      );

      expect(mockGoogleSheets.spreadsheets.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: "test-spreadsheet-id",
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: "ROWS",
                  startIndex: 3,
                  endIndex: 4,
                },
              },
            },
          ],
        },
      });
    });
  });

  describe("并发控制", () => {
    test("应该在版本冲突时抛出错误", async () => {
      const originalRecord: CompleteTranslationRecord = {
        "TestModule.ts": {
          test_key: {
            en: "test",
            "zh-Hans": "测试",
            ko: "테스트",
            mark: 0,
          } as any,
        },
      };

      const originalVersion =
        googleSheetsSync.calculateDataVersion(originalRecord);

      // 模拟远端数据已被修改
      mockGoogleSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ["key", "en", "zh-Hans", "ko", "mark"],
            ["[TestModule.ts][test]", "test", "测试修改", "테스트", "0"],
          ],
        },
      });

      await expect(
        googleSheetsSync.validateRemoteVersion(originalVersion)
      ).rejects.toThrow("远端数据版本冲突");
    });

    test("应该正确获取和释放行锁", async () => {
      const changeSet = {
        addedRows: [],
        modifiedRows: [
          {
            key: "[TestModule.ts][test_key]",
            values: ["test", "en", "zh"],
            rowIndex: 2,
          },
        ],
        deletedKeys: ["[TestModule.ts][old_key]"],
      };

      // Mock getCurrentSheetData方法返回包含相关行的数据
      (googleSheetsSync as any).getCurrentSheetData = jest
        .fn()
        .mockResolvedValue([
          ["key", "en", "zh-Hans", "ko", "mark"],
          ["[TestModule.ts][existing]", "existing", "现有", "기존", "0"],
          ["[TestModule.ts][test_key]", "test", "测试", "테스트", "0"], // 行索引2
          ["[TestModule.ts][old_key]", "old", "旧的", "오래된", "0"], // 行索引3
        ]);

      const lockInfo = await googleSheetsSync.acquireRowLocks(changeSet);

      expect(lockInfo.lockId).toBeTruthy();
      expect(lockInfo.lockedRows.size).toBe(2); // 一个修改行，一个删除行
      expect(lockInfo.lockTimestamp).toBeTruthy();

      await googleSheetsSync.releaseRowLocks(lockInfo);

      // 验证锁标记被清除
      expect(
        mockGoogleSheets.spreadsheets.values.batchUpdate
      ).toHaveBeenCalledTimes(2); // 一次设置锁，一次清除锁
    });
  });

  describe("完整增量同步流程", () => {
    test("应该正确执行完整的增量同步", async () => {
      // 设置远端数据
      mockGoogleSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ["key", "en", "zh-Hans", "ko", "mark"],
            ["[TestModule.ts][existing]", "existing", "现有", "기존", "0"],
          ],
        },
      });

      const localRecord: CompleteTranslationRecord = {
        "TestModule.ts": {
          existing: {
            en: "existing",
            "zh-Hans": "现有",
            ko: "기존",
            mark: 0,
          } as any,
          new_key: {
            en: "new",
            "zh-Hans": "新增",
            ko: "새로운",
            mark: 0,
          } as any,
        },
      };

      // Mock Google Sheets初始化状态和相关方法
      (googleSheetsSync as any).isInitialized = true;

      // Mock 获取Sheet ID
      (googleSheetsSync as any).getSheetId = jest.fn().mockResolvedValue(0);

      // Mock 行锁相关方法
      (googleSheetsSync as any).acquireRowLocks = jest.fn().mockResolvedValue({
        lockId: "test-lock",
        lockedRows: new Set(),
        lockTimestamp: Date.now(),
      });
      (googleSheetsSync as any).releaseRowLocks = jest
        .fn()
        .mockResolvedValue(undefined);

      await googleSheetsSync.syncCompleteRecordToSheet(localRecord, {
        enableStyleProtection: true,
      });

      // 验证只有新增的行被处理
      expect(mockGoogleSheets.spreadsheets.values.append).toHaveBeenCalledTimes(
        1
      );
      expect(
        mockGoogleSheets.spreadsheets.values.batchUpdate
      ).not.toHaveBeenCalled();
      expect(mockGoogleSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });

    test("应该在没有变更时跳过同步", async () => {
      // 设置远端数据与本地数据完全一致
      const record: CompleteTranslationRecord = {
        "TestModule.ts": {
          test_key: {
            en: "test",
            "zh-Hans": "测试",
            ko: "테스트",
            mark: 0,
          } as any,
        },
      };

      mockGoogleSheets.spreadsheets.values.get.mockResolvedValue({
        data: {
          values: [
            ["key", "en", "zh-Hans", "ko", "mark"],
            ["[TestModule.ts][test]", "test", "测试", "테스트", "0"],
          ],
        },
      });

      await googleSheetsSync.syncCompleteRecordToSheet(record);

      // 验证没有进行任何更新操作
      expect(
        mockGoogleSheets.spreadsheets.values.append
      ).not.toHaveBeenCalled();
      expect(
        mockGoogleSheets.spreadsheets.values.batchUpdate
      ).not.toHaveBeenCalled();
      expect(mockGoogleSheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe("错误处理机制", () => {
    test("应该正确分类网络错误", () => {
      const networkError = new Error("ENOTFOUND googleapis.com");
      const errorType = (googleSheetsSync as any).categorizeError(networkError);
      expect(errorType).toBe("UNKNOWN"); // 网络错误会被归类为UNKNOWN
    });

    test("应该正确分类版本冲突错误", () => {
      const versionError = new Error("远端数据版本冲突");
      const errorType = (googleSheetsSync as any).categorizeError(versionError);
      expect(errorType).toBe("VERSION_CONFLICT");
    });

    test("应该正确分类并发错误", () => {
      const concurrencyError = new Error("行已被锁定");
      const errorType = (googleSheetsSync as any).categorizeError(
        concurrencyError
      );
      expect(errorType).toBe("CONCURRENCY_ERROR");
    });

    test("应该正确分类API限制错误", () => {
      const rateLimitError = { code: 429, message: "Rate limit exceeded" };
      const errorType = (googleSheetsSync as any).categorizeError(
        rateLimitError
      );
      expect(errorType).toBe("RATE_LIMIT");
    });
  });
});
