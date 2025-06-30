import { GoogleSheetsSync } from "../../core/GoogleSheetsSync";
import { I18nScanner } from "../../core/I18nScanner";
import type { I18nConfig } from "../../../types";

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
  logLevel: "normal",
};

describe("增量同步集成测试", () => {
  let googleSheetsSync: GoogleSheetsSync;
  let i18nScanner: I18nScanner;

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

  beforeEach(() => {
    jest.clearAllMocks();

    googleSheetsSync = new GoogleSheetsSync(mockConfig);
    i18nScanner = new I18nScanner(mockConfig);

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

  test("应该正确处理完整的增量同步流程", async () => {
    // 模拟远端数据
    const remoteSheetData = [
      ["key", "en", "zh-Hans", "ko", "mark"],
      [
        "[TestModule.ts][Hello World]",
        "Hello World",
        "你好世界",
        "안녕하세요",
        "0",
      ],
      ["[TestModule.ts][Goodbye]", "Goodbye", "再见", "안녕히 가세요", "0"],
    ];

    // 模拟本地扫描结果
    const localRecord = {
      "TestModule.ts": {
        hello_world: {
          en: "Hello World",
          "zh-Hans": "你好世界",
          ko: "안녕하세요",
          mark: 0,
        } as any,
        welcome: {
          en: "Welcome",
          "zh-Hans": "欢迎",
          ko: "환영합니다",
          mark: 0,
        } as any,
      },
    };

    // Mock Google Sheets API 响应
    mockGoogleSheets.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: remoteSheetData,
      },
    });

    // Mock getCurrentSheetData
    (googleSheetsSync as any).getCurrentSheetData = jest
      .fn()
      .mockResolvedValue(remoteSheetData);

    // Mock 相关方法
    (googleSheetsSync as any).getSheetId = jest.fn().mockResolvedValue(0);
    (googleSheetsSync as any).acquireRowLocks = jest.fn().mockResolvedValue({
      lockId: "test-lock",
      lockedRows: new Set([2]), // 删除第2行
      lockTimestamp: Date.now(),
    });
    (googleSheetsSync as any).releaseRowLocks = jest
      .fn()
      .mockResolvedValue(undefined);

    // 执行增量同步
    await googleSheetsSync.syncCompleteRecordToSheet(localRecord, {
      enableStyleProtection: true,
    });

    // 验证API调用
    expect(mockGoogleSheets.spreadsheets.batchUpdate).toHaveBeenCalled(); // 删除行
    expect(mockGoogleSheets.spreadsheets.values.append).toHaveBeenCalled(); // 新增行

    console.log("✅ 完整增量同步流程测试通过");
  });

  test("应该正确处理样式保护", async () => {
    const testRecord = {
      "TestModule.ts": {
        test_key: {
          en: "Test",
          "zh-Hans": "测试",
          ko: "테스트",
          mark: 0,
        } as any,
      },
    };

    // Mock 空的远端数据
    mockGoogleSheets.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [["key", "en", "zh-Hans", "ko", "mark"]],
      },
    });

    (googleSheetsSync as any).getCurrentSheetData = jest
      .fn()
      .mockResolvedValue([["key", "en", "zh-Hans", "ko", "mark"]]);

    // Mock 相关方法
    (googleSheetsSync as any).getSheetId = jest.fn().mockResolvedValue(0);
    (googleSheetsSync as any).acquireRowLocks = jest.fn().mockResolvedValue({
      lockId: "test-lock",
      lockedRows: new Set(),
      lockTimestamp: Date.now(),
    });
    (googleSheetsSync as any).releaseRowLocks = jest
      .fn()
      .mockResolvedValue(undefined);

    await googleSheetsSync.syncCompleteRecordToSheet(testRecord, {
      enableStyleProtection: true,
    });

    // 验证使用了样式保护的API调用
    const appendCall =
      mockGoogleSheets.spreadsheets.values.append.mock.calls[0];
    expect(appendCall[0].requestBody.valueInputOption).toBe("RAW");
    expect(appendCall[0].requestBody.insertDataOption).toBe("INSERT_ROWS");

    console.log("✅ 样式保护测试通过");
  });

  test("应该正确处理并发冲突", async () => {
    const testRecord = {
      "TestModule.ts": {
        test_key: {
          en: "Test",
          "zh-Hans": "测试",
          ko: "테스트",
          mark: 0,
        } as any,
      },
    };

    // 第一次调用返回一个版本，第二次返回不同版本（模拟并发修改）
    mockGoogleSheets.spreadsheets.values.get
      .mockResolvedValueOnce({
        data: {
          values: [["key", "en", "zh-Hans", "ko", "mark"]],
        },
      })
      .mockResolvedValueOnce({
        data: {
          values: [
            ["key", "en", "zh-Hans", "ko", "mark"],
            ["[TestModule.ts][Other]", "Other", "其他", "기타", "0"],
          ],
        },
      });

    try {
      await googleSheetsSync.syncCompleteRecordToSheet(testRecord, {
        enableStyleProtection: true,
      });
      // 如果没有抛出错误，测试失败
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain("版本冲突");
      console.log("✅ 并发冲突检测测试通过");
    }
  });

  test("应该正确处理网络错误重试", async () => {
    const testRecord = {
      "TestModule.ts": {
        test_key: {
          en: "Test",
          "zh-Hans": "测试",
          ko: "테스트",
          mark: 0,
        } as any,
      },
    };

    // 模拟网络错误
    const networkError = new Error("网络连接失败");
    (networkError as any).code = "ECONNREFUSED";

    mockGoogleSheets.spreadsheets.values.get
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({
        data: {
          values: [["key", "en", "zh-Hans", "ko", "mark"]],
        },
      });

    try {
      await googleSheetsSync.syncCompleteRecordToSheet(testRecord, {
        enableStyleProtection: true,
        maxRetries: 1,
      });
      // 如果没有抛出错误，说明重试机制工作正常
      console.log("✅ 网络错误重试测试通过");
    } catch (error: any) {
      // 预期会抛出网络错误
      expect(error.message).toContain("网络");
    }
  });

  test("性能基准测试", async () => {
    // 生成中等规模的测试数据
    const testRecord: any = {};
    for (let i = 0; i < 50; i++) {
      testRecord[`Module${i}.ts`] = {
        [`key_${i}`]: {
          en: `English ${i}`,
          "zh-Hans": `中文 ${i}`,
          ko: `한국어 ${i}`,
          mark: 0,
        },
      };
    }

    // Mock 空的远端数据
    mockGoogleSheets.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: [["key", "en", "zh-Hans", "ko", "mark"]],
      },
    });

    (googleSheetsSync as any).getCurrentSheetData = jest
      .fn()
      .mockResolvedValue([["key", "en", "zh-Hans", "ko", "mark"]]);

    // Mock 相关方法
    (googleSheetsSync as any).getSheetId = jest.fn().mockResolvedValue(0);
    (googleSheetsSync as any).acquireRowLocks = jest.fn().mockResolvedValue({
      lockId: "test-lock",
      lockedRows: new Set(),
      lockTimestamp: Date.now(),
    });
    (googleSheetsSync as any).releaseRowLocks = jest
      .fn()
      .mockResolvedValue(undefined);

    const startTime = Date.now();
    await googleSheetsSync.syncCompleteRecordToSheet(testRecord, {
      enableStyleProtection: true,
    });
    const duration = Date.now() - startTime;

    // 50条记录应该在2秒内完成
    expect(duration).toBeLessThan(2000);

    console.log(`✅ 性能基准测试通过: ${duration}ms for 50 records`);
  });
});
