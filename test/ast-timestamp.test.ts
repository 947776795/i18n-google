import { AstTransformer, ExistingReference } from "../src/core/AstTransformer";
import { I18nConfig } from "../src/types";

describe("引用收集时间戳测试", () => {
  let config: I18nConfig;
  let transformer: AstTransformer;

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
    };
    transformer = new AstTransformer(config);
  });

  describe("collectExistingI18nCalls", () => {
    it("应该为所有收集的引用添加scanTimestamp", () => {
      const sourceCode = `
        import { I18n } from "./i18n";
        
        function TestComponent() {
          return (
            <div>
              {I18n.t("testKey1")}
              {I18n.t("testKey2")}
            </div>
          );
        }
      `;

      const testFilePath = "test/TestComponent.tsx";
      const beforeTime = new Date().getTime();
      
      const references = transformer.collectExistingI18nCalls(sourceCode, testFilePath);
      
      const afterTime = new Date().getTime();

      // 验证引用数量
      expect(references).toHaveLength(2);

      // 验证每个引用都有scanTimestamp
      references.forEach((ref: ExistingReference) => {
        expect(ref.scanTimestamp).toBeDefined();
        expect(typeof ref.scanTimestamp).toBe("number");
        
        // 验证时间戳是有效的数字时间戳
        const scanTime = ref.scanTimestamp!;
        expect(scanTime).toBeGreaterThanOrEqual(beforeTime);
        expect(scanTime).toBeLessThanOrEqual(afterTime);
      });

      // 验证引用内容
      expect(references[0].key).toBe("testKey1");
      expect(references[1].key).toBe("testKey2");
    });

    it("应该为模板字面量引用添加scanTimestamp", () => {
      const sourceCode = `
        import { I18n } from "./i18n";
        
        function TestComponent() {
          return I18n.t(\`templateKey\`);
        }
      `;

      const testFilePath = "test/TestComponent.tsx";
      const references = transformer.collectExistingI18nCalls(sourceCode, testFilePath);

      expect(references).toHaveLength(1);
      expect(references[0].scanTimestamp).toBeDefined();
      expect(references[0].key).toBe("templateKey");
    });

    it("没有I18n调用时应该返回空数组", () => {
      const sourceCode = `
        function TestComponent() {
          return <div>No I18n calls here</div>;
        }
      `;

      const testFilePath = "test/TestComponent.tsx";
      const references = transformer.collectExistingI18nCalls(sourceCode, testFilePath);

      expect(references).toHaveLength(0);
    });

    it("应该忽略非I18n.t的调用", () => {
      const sourceCode = `
        import { SomeOther } from "./other";
        
        function TestComponent() {
          return (
            <div>
              {SomeOther.t("notI18nKey")}
              {I18n.other("alsoNotI18nKey")}
              {I18n.t("validI18nKey")}
            </div>
          );
        }
      `;

      const testFilePath = "test/TestComponent.tsx";
      const references = transformer.collectExistingI18nCalls(sourceCode, testFilePath);

      // 只应该收集到一个有效的I18n.t调用
      expect(references).toHaveLength(1);
      expect(references[0].key).toBe("validI18nKey");
      expect(references[0].scanTimestamp).toBeDefined();
    });
  });

  describe("时间戳一致性", () => {
    it("同一次扫描中的所有引用应该有相同的scanTimestamp", () => {
      const sourceCode = `
        import { I18n } from "./i18n";
        
        function TestComponent() {
          return (
            <div>
              {I18n.t("key1")}
              {I18n.t("key2")}
              {I18n.t("key3")}
            </div>
          );
        }
      `;

      const testFilePath = "test/TestComponent.tsx";
      const references = transformer.collectExistingI18nCalls(sourceCode, testFilePath);

      expect(references).toHaveLength(3);

      // 所有引用应该有相同的时间戳（因为在同一次调用中生成）
      const firstTimestamp = references[0].scanTimestamp;
      references.forEach(ref => {
        expect(ref.scanTimestamp).toBe(firstTimestamp);
      });
    });
  });
});