import { GoogleSheetsSync } from "../src/core/GoogleSheetsSync";
import { TranslationManager, CompleteTranslationRecord } from "../src/core/TranslationManager";
import { I18nConfig } from "../src/types";

// Mock google sheets
jest.mock("googleapis");

describe("字段过滤测试", () => {
  let config: I18nConfig;

  beforeEach(() => {
    config = {
      rootDir: "./test",
      languages: ["en", "zh-Hans"],
      ignore: [],
      spreadsheetId: "test-spreadsheet-id",
      sheetName: "test-sheet",
      keyFile: "./test.json",
      startMarker: "~",
      endMarker: "~", 
      include: ["ts", "tsx"],
      outputDir: "./test/output",
      apiKey: "test-key",
    };
  });

  describe("GoogleSheetsSync字段过滤", () => {
    it("cleanRecordForRemoteSync应该排除_lastUsed字段", () => {
      const googleSheetsSync = new GoogleSheetsSync(config);
      
      const testRecord: CompleteTranslationRecord = {
        "test/component.ts": {
          "testKey": {
            en: "Test Text",
            "zh-Hans": "测试文本",
            mark: 1,
            _lastUsed: Date.now(), // 应该被排除
          }
        }
      };

      // 调用私有方法进行测试
      const cleanedRecord = (googleSheetsSync as any).cleanRecordForRemoteSync(testRecord);

      // 验证_lastUsed字段被排除
      expect(cleanedRecord["test/component.ts"]["testKey"]._lastUsed).toBeUndefined();
      
      // 验证其他字段保持不变
      expect(cleanedRecord["test/component.ts"]["testKey"].en).toBe("Test Text");
      expect(cleanedRecord["test/component.ts"]["testKey"]["zh-Hans"]).toBe("测试文本");
      expect(cleanedRecord["test/component.ts"]["testKey"].mark).toBe(1);
    });

    it("应该处理多个模块和多个key", () => {
      const googleSheetsSync = new GoogleSheetsSync(config);
      
      const testRecord: CompleteTranslationRecord = {
        "test/component1.ts": {
          "key1": {
            en: "Text 1",
            "zh-Hans": "文本1",
            _lastUsed: Date.now() - 24 * 60 * 60 * 1000,
          }
        },
        "test/component2.ts": {
          "key2": {
            en: "Text 2", 
            "zh-Hans": "文本2",
            _lastUsed: Date.now() - 2 * 24 * 60 * 60 * 1000,
          },
          "key3": {
            en: "Text 3",
            "zh-Hans": "文本3",
            mark: 2,
            _lastUsed: Date.now() - 3 * 24 * 60 * 60 * 1000,
          }
        }
      };

      const cleanedRecord = (googleSheetsSync as any).cleanRecordForRemoteSync(testRecord);

      // 验证所有_lastUsed字段都被排除
      expect(cleanedRecord["test/component1.ts"]["key1"]._lastUsed).toBeUndefined();
      expect(cleanedRecord["test/component2.ts"]["key2"]._lastUsed).toBeUndefined();
      expect(cleanedRecord["test/component2.ts"]["key3"]._lastUsed).toBeUndefined();
      
      // 验证其他字段保持完整
      expect(cleanedRecord["test/component1.ts"]["key1"].en).toBe("Text 1");
      expect(cleanedRecord["test/component2.ts"]["key3"].mark).toBe(2);
    });
  });

  describe("TranslationManager模块化生成字段过滤", () => {
    it("buildModuleTranslations应该只处理配置的语言", () => {
      const translationManager = new TranslationManager(config);
      
      const moduleKeys = {
        "testKey": {
          en: "Test Text",
          "zh-Hans": "测试文本",
          fr: "Texte de test", // 不在配置的语言中
          mark: 1, // 不是语言字段
          _lastUsed: Date.now(), // 不是语言字段
        }
      };

      // 调用私有方法进行测试
      const result = (translationManager as any).buildModuleTranslations(moduleKeys);

      // 验证只有配置的语言被包含
      expect(result.en).toBeDefined();
      expect(result["zh-Hans"]).toBeDefined();
      expect(result.fr).toBeUndefined(); // 不在配置中的语言应该被排除

      // 验证翻译内容正确
      expect(result.en.testKey).toBe("Test Text");
      expect(result["zh-Hans"].testKey).toBe("测试文本");

      // 验证没有非语言字段
      expect((result as any).mark).toBeUndefined();
      expect((result as any)._lastUsed).toBeUndefined();
    });

    it("应该处理多个key", () => {
      const translationManager = new TranslationManager(config);
      
      const moduleKeys = {
        "key1": {
          en: "Text 1",
          "zh-Hans": "文本1",
          _lastUsed: Date.now() - 24 * 60 * 60 * 1000,
        },
        "key2": {
          en: "Text 2",
          "zh-Hans": "文本2", 
          mark: 1,
          _lastUsed: Date.now() - 2 * 24 * 60 * 60 * 1000,
        }
      };

      const result = (translationManager as any).buildModuleTranslations(moduleKeys);

      // 验证所有key的翻译都被正确处理
      expect(result.en.key1).toBe("Text 1");
      expect(result.en.key2).toBe("Text 2");
      expect(result["zh-Hans"].key1).toBe("文本1");
      expect(result["zh-Hans"].key2).toBe("文本2");

      // 验证非语言字段被排除
      expect(result.en._lastUsed).toBeUndefined();
      expect(result.en.mark).toBeUndefined();
    });
  });

  describe("完整流程测试", () => {
    it("从包含_lastUsed的记录到清理后的远端数据", () => {
      const originalRecord: CompleteTranslationRecord = {
        "test/component.ts": {
          "testKey": {
            en: "Test Text",
            "zh-Hans": "测试文本",
            mark: 1,
            _lastUsed: Date.now(),
          }
        }
      };

      // 1. GoogleSheetsSync清理
      const googleSheetsSync = new GoogleSheetsSync(config);
      const cleanedForRemote = (googleSheetsSync as any).cleanRecordForRemoteSync(originalRecord);

      // 2. TranslationManager模块化处理
      const translationManager = new TranslationManager(config);
      const moduleTranslations = (translationManager as any).buildModuleTranslations(
        cleanedForRemote["test/component.ts"]
      );

      // 验证最终结果只包含翻译数据
      expect(moduleTranslations.en.testKey).toBe("Test Text");
      expect(moduleTranslations["zh-Hans"].testKey).toBe("测试文本");
      
      // 验证所有非翻译字段都被排除
      expect((moduleTranslations as any)._lastUsed).toBeUndefined();
      expect((moduleTranslations as any).mark).toBeUndefined();
    });
  });
});