import { UnusedKeyAnalyzer } from "../src/core/UnusedKeyAnalyzer";
import { ExistingReference } from "../src/core/AstTransformer";
import { CompleteTranslationRecord } from "../src/core/TranslationManager";
import { I18nConfig } from "../src/types";

describe("基于时间的无用Key检测", () => {
  let config: I18nConfig;
  let analyzer: UnusedKeyAnalyzer;

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
      keyExpirationDays: 7, // 7天过期
    };
    analyzer = new UnusedKeyAnalyzer(config);
  });

  describe("detectTimeBasedUnusedKeys", () => {
    it("应该检测出无引用且过期的key", () => {
      // 创建测试数据：包含过期key
      const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10天前
      const recentTime = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3天前

      const completeRecord: CompleteTranslationRecord = {
        "test/component.ts": {
          "expiredKey": {
            en: "Expired Text",
            "zh-Hans": "过期文本",
            _lastUsed: oldTime, // 10天前使用，已过期
          },
          "recentKey": {
            en: "Recent Text", 
            "zh-Hans": "最近文本",
            _lastUsed: recentTime, // 3天前使用，未过期
          },
          "noTimeKey": {
            en: "No Time Text",
            "zh-Hans": "无时间文本",
            // 没有_lastUsed字段，应该被视为过期
          }
        }
      };

      const referencesMap = new Map<string, ExistingReference[]>();
      // 没有任何引用，所有key都是无引用的

      const result = analyzer.detectTimeBasedUnusedKeys(completeRecord, referencesMap);

      // 应该检测出expiredKey和noTimeKey
      expect(result).toContain("expiredKey");
      expect(result).toContain("noTimeKey");
      expect(result).not.toContain("recentKey"); // recentKey未过期，不应该被检测出
    });

    it("应该保留有引用的key，即使时间过期", () => {
      const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10天前

      const completeRecord: CompleteTranslationRecord = {
        "test/component.ts": {
          "referencedButOldKey": {
            en: "Referenced Old Text",
            "zh-Hans": "被引用的旧文本", 
            _lastUsed: oldTime, // 过期时间，但有引用
          }
        }
      };

      const referencesMap = new Map<string, ExistingReference[]>();
      referencesMap.set("referencedButOldKey", [{
        key: "referencedButOldKey",
        filePath: "test/component.ts",
        lineNumber: 1,
        columnNumber: 1,
        callExpression: 'I18n.t("referencedButOldKey")',
        scanTimestamp: Date.now()
      }]);

      const result = analyzer.detectTimeBasedUnusedKeys(completeRecord, referencesMap);

      // 有引用的key不应该被检测为无用，即使时间过期
      expect(result).not.toContain("referencedButOldKey");
    });

    it("未配置过期时间时应该使用原有逻辑", () => {
      // 修改配置，移除过期时间设置
      const configWithoutExpiration = { ...config };
      delete configWithoutExpiration.keyExpirationDays;
      
      const analyzerWithoutExpiration = new UnusedKeyAnalyzer(configWithoutExpiration);

      const completeRecord: CompleteTranslationRecord = {
        "test/component.ts": {
          "unreferencedKey": {
            en: "Unreferenced Text",
            "zh-Hans": "无引用文本",
          }
        }
      };

      const referencesMap = new Map<string, ExistingReference[]>();
      // 没有引用

      const result = analyzerWithoutExpiration.detectTimeBasedUnusedKeys(completeRecord, referencesMap);

      // 没有配置过期时间，应该检测出无引用的key
      expect(result).toContain("unreferencedKey");
    });

    it("应该正确处理强制保留的key", () => {
      const configWithForceKeep = {
        ...config,
        forceKeepKeys: {
          "test/component.ts": ["forceKeptKey"]
        }
      };
      const analyzerWithForceKeep = new UnusedKeyAnalyzer(configWithForceKeep);

      const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000;

      const completeRecord: CompleteTranslationRecord = {
        "test/component.ts": {
          "forceKeptKey": {
            en: "Force Kept Text",
            "zh-Hans": "强制保留文本",
            _lastUsed: oldTime, // 过期，但强制保留
          },
          "regularExpiredKey": {
            en: "Regular Expired Text",
            "zh-Hans": "常规过期文本", 
            _lastUsed: oldTime, // 过期，不强制保留
          }
        }
      };

      const referencesMap = new Map<string, ExistingReference[]>();

      const result = analyzerWithForceKeep.detectTimeBasedUnusedKeys(completeRecord, referencesMap);

      // 强制保留的key不应该被检测出，即使过期
      expect(result).not.toContain("forceKeptKey");
      expect(result).toContain("regularExpiredKey");
    });
  });

  describe("时间格式处理", () => {
    it("应该正确解析时间戳格式", () => {
      const testTimestamp = Date.now() - 24 * 60 * 60 * 1000; // 1天前的时间戳
      const completeRecord: CompleteTranslationRecord = {
        "test/component.ts": {
          "testKey": {
            en: "Test Text",
            "zh-Hans": "测试文本",
            _lastUsed: testTimestamp,
          }
        }
      };

      const referencesMap = new Map<string, ExistingReference[]>();

      // 应该不抛出错误
      expect(() => {
        analyzer.detectTimeBasedUnusedKeys(completeRecord, referencesMap);
      }).not.toThrow();
    });
  });
});