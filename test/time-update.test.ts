import { I18nScanner } from "../src/core/I18nScanner";
import { TranslationManager } from "../src/core/TranslationManager";
import { ExistingReference } from "../src/core/AstTransformer";
import { I18nConfig } from "../src/types";
import * as fs from "fs";
import * as path from "path";

// Mock TranslationManager
jest.mock("../src/core/TranslationManager");
jest.mock("../src/core/GoogleSheetsSync");
jest.mock("../src/core/FileScanner");
jest.mock("../src/core/FileTransformer");

describe("时间更新功能测试", () => {
  let config: I18nConfig;
  let scanner: I18nScanner;
  let mockTranslationManager: jest.Mocked<TranslationManager>;

  beforeEach(() => {
    config = {
      rootDir: "./test",
      languages: ["en", "zh-Hans"],
      ignore: [],
      spreadsheetId: "test",
      sheetName: "test", 
      keyFile: "./test.json",
      startMarker: "~",
      endMarker: "~",
      include: ["ts", "tsx"],
      outputDir: "./test/output",
      apiKey: "test-key",
      keyExpirationDays: 7, // 启用时间检测
    };

    // 创建mock实例
    mockTranslationManager = new TranslationManager(config) as jest.Mocked<TranslationManager>;
    
    scanner = new I18nScanner(config);
    (scanner as any).translationManager = mockTranslationManager;
  });

  describe("updateReferencedKeysTimestamp", () => {
    it("应该更新被引用key的最后使用时间", async () => {
      const testTimestamp = Date.now();
      
      // 模拟现有记录
      const existingRecord = {
        "test/component.ts": {
          "existingKey": {
            en: "Existing Text",
            "zh-Hans": "现有文本",
            _lastUsed: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30天前的时间戳
          }
        }
      };

      // 模拟当前引用
      const allReferences = new Map<string, ExistingReference[]>();
      allReferences.set("existingKey", [{
        key: "existingKey",
        filePath: "test/component.ts",
        lineNumber: 1,
        columnNumber: 1,
        callExpression: 'I18n.t("existingKey")',
        scanTimestamp: testTimestamp, // 新的扫描时间戳
      }]);

      // Mock方法
      mockTranslationManager.loadCompleteRecord.mockResolvedValue(existingRecord);
      mockTranslationManager.saveCompleteRecordDirect.mockResolvedValue();

      // 调用私有方法进行测试
      await (scanner as any).updateReferencedKeysTimestamp(allReferences);

      // 验证保存被调用，并且时间被更新
      expect(mockTranslationManager.saveCompleteRecordDirect).toHaveBeenCalledWith(
        expect.objectContaining({
          "test/component.ts": expect.objectContaining({
            "existingKey": expect.objectContaining({
              _lastUsed: testTimestamp, // 应该更新为新时间戳
            })
          })
        })
      );
    });

    it("没有配置过期时间时不应该更新时间", async () => {
      // 修改配置，移除过期时间
      const configWithoutExpiration = { ...config };
      delete configWithoutExpiration.keyExpirationDays;
      
      const scannerWithoutExpiration = new I18nScanner(configWithoutExpiration);
      (scannerWithoutExpiration as any).translationManager = mockTranslationManager;

      const allReferences = new Map<string, ExistingReference[]>();
      allReferences.set("testKey", [{
        key: "testKey",
        filePath: "test/component.ts", 
        lineNumber: 1,
        columnNumber: 1,
        callExpression: 'I18n.t("testKey")',
        scanTimestamp: Date.now(),
      }]);

      await (scannerWithoutExpiration as any).updateReferencedKeysTimestamp(allReferences);

      // 没有配置过期时间时，方法应该早期返回，不调用保存方法
      expect(mockTranslationManager.saveCompleteRecordDirect).not.toHaveBeenCalled();
    });

    it("没有完整记录时应该安全退出", async () => {
      mockTranslationManager.loadCompleteRecord.mockResolvedValue({});

      const allReferences = new Map<string, ExistingReference[]>();
      allReferences.set("testKey", [{
        key: "testKey",
        filePath: "test/component.ts",
        lineNumber: 1,
        columnNumber: 1,
        callExpression: 'I18n.t("testKey")',
        scanTimestamp: Date.now(),
      }]);

      // 应该不抛出错误
      await expect((scanner as any).updateReferencedKeysTimestamp(allReferences)).resolves.not.toThrow();
      
      expect(mockTranslationManager.saveCompleteRecordDirect).not.toHaveBeenCalled();
    });
  });
});