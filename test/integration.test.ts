import { I18nConfig } from "../src/types";
import { UnusedKeyAnalyzer } from "../src/core/UnusedKeyAnalyzer";
import { AstTransformer } from "../src/core/AstTransformer";
import { CompleteTranslationRecord } from "../src/core/TranslationManager";

describe("时间功能集成测试", () => {
  let config: I18nConfig;

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
  });

  describe("完整的时间检测工作流程", () => {
    it("应该完整执行：引用收集 -> 时间戳添加 -> 过期检测", () => {
      // 1. 模拟引用收集阶段
      const astTransformer = new AstTransformer(config);
      const sourceCode = `
        import { I18n } from "./i18n";
        
        function Component() {
          return (
            <div>
              {I18n.t("activeKey")}
              <p>{I18n.t("anotherActiveKey")}</p>
            </div>
          );
        }
      `;

      const references = astTransformer.collectExistingI18nCalls(sourceCode, "test/Component.tsx");
      
      // 验证引用收集成功且有时间戳
      expect(references).toHaveLength(2);
      expect(references[0].scanTimestamp).toBeDefined();
      expect(references[1].scanTimestamp).toBeDefined();

      // 2. 模拟完整记录（包含过期和未过期的key）
      const oldTimestamp = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10天前的时间戳
      const newTimestamp = references[0].scanTimestamp!; // 刚刚扫描的时间戳

      const completeRecord: CompleteTranslationRecord = {
        "test/Component.tsx": {
          "activeKey": {
            en: "Active Text",
            "zh-Hans": "活跃文本",
            _lastUsed: oldTimestamp, // 将会被更新为newTimestamp
          },
          "anotherActiveKey": {
            en: "Another Active Text", 
            "zh-Hans": "另一个活跃文本",
            _lastUsed: oldTimestamp, // 将会被更新为newTimestamp
          },
          "expiredKey": {
            en: "Expired Text",
            "zh-Hans": "过期文本",
            _lastUsed: oldTimestamp, // 过期且无引用
          },
          "noTimeKey": {
            en: "No Time Text",
            "zh-Hans": "无时间文本",
            // 没有_lastUsed，应该被视为过期
          }
        }
      };

      // 3. 模拟时间更新过程
      const updatedRecord = JSON.parse(JSON.stringify(completeRecord));
      references.forEach(ref => {
        const key = ref.key;
        if (updatedRecord["test/Component.tsx"][key]) {
          updatedRecord["test/Component.tsx"][key]._lastUsed = newTimestamp;
        }
      });

      // 4. 执行过期检测
      const referencesMap = new Map();
      references.forEach(ref => {
        if (!referencesMap.has(ref.key)) {
          referencesMap.set(ref.key, []);
        }
        referencesMap.get(ref.key).push(ref);
      });

      const analyzer = new UnusedKeyAnalyzer(config);
      const expiredKeys = analyzer.detectTimeBasedUnusedKeys(updatedRecord, referencesMap);

      // 5. 验证结果
      // activeKey 和 anotherActiveKey 有引用，不应该被检测为过期
      expect(expiredKeys).not.toContain("activeKey");
      expect(expiredKeys).not.toContain("anotherActiveKey");
      
      // expiredKey 无引用且过期，应该被检测出
      expect(expiredKeys).toContain("expiredKey");
      
      // noTimeKey 无时间记录且无引用，应该被检测出
      expect(expiredKeys).toContain("noTimeKey");

      // 验证时间更新生效
      expect(updatedRecord["test/Component.tsx"]["activeKey"]._lastUsed).toBe(newTimestamp);
      expect(updatedRecord["test/Component.tsx"]["anotherActiveKey"]._lastUsed).toBe(newTimestamp);
    });
  });

  describe("不同配置场景测试", () => {
    it("没有配置过期时间时应该使用传统检测", () => {
      const configWithoutExpiration = { ...config };
      delete configWithoutExpiration.keyExpirationDays;

      const analyzer = new UnusedKeyAnalyzer(configWithoutExpiration);
      const oldTimestamp = Date.now() - 10 * 24 * 60 * 60 * 1000;

      const completeRecord: CompleteTranslationRecord = {
        "test/component.ts": {
          "unreferencedKey": {
            en: "Unreferenced Text",
            "zh-Hans": "无引用文本",
            _lastUsed: oldTimestamp, // 过期但是没有配置过期检测
          }
        }
      };

      const referencesMap = new Map(); // 空引用

      const result = analyzer.detectTimeBasedUnusedKeys(completeRecord, referencesMap);

      // 没有配置过期时间，应该检测出无引用的key（不管时间）
      expect(result).toContain("unreferencedKey");
    });

    it("过期时间为0时应该立即过期", () => {
      const configWithZeroExpiration = { ...config, keyExpirationDays: 0 };
      const analyzer = new UnusedKeyAnalyzer(configWithZeroExpiration);

      const recentTimestamp = Date.now() - 1000; // 1秒前的时间戳

      const completeRecord: CompleteTranslationRecord = {
        "test/component.ts": {
          "recentButExpiredKey": {
            en: "Recent Text",
            "zh-Hans": "最近文本", 
            _lastUsed: recentTimestamp, // 很近，但过期时间为0所以立即过期
          }
        }
      };

      const referencesMap = new Map(); // 无引用

      const result = analyzer.detectTimeBasedUnusedKeys(completeRecord, referencesMap);

      expect(result).toContain("recentButExpiredKey");
    });
  });

  describe("边界情况测试", () => {
    it("应该正确处理空的完整记录", () => {
      const analyzer = new UnusedKeyAnalyzer(config);
      const emptyRecord: CompleteTranslationRecord = {};
      const emptyReferences = new Map();

      const result = analyzer.detectTimeBasedUnusedKeys(emptyRecord, emptyReferences);

      expect(result).toEqual([]);
    });

    it("应该处理无效的时间格式", () => {
      const analyzer = new UnusedKeyAnalyzer(config);
      
      const recordWithInvalidTime: CompleteTranslationRecord = {
        "test/component.ts": {
          "invalidTimeKey": {
            en: "Invalid Time Text",
            "zh-Hans": "无效时间文本",
            _lastUsed: 12345, // 无效数字格式（太旧的时间戳）
          }
        }
      };

      const referencesMap = new Map();

      // 应该将无效时间视为过期
      const result = analyzer.detectTimeBasedUnusedKeys(recordWithInvalidTime, referencesMap);
      expect(result).toContain("invalidTimeKey");
    });
  });
});