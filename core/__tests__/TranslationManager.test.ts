import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import { TranslationManager } from "../TranslationManager";
import type { TransformResult } from "../AstTransformer";
import type { I18nConfig } from "../../types";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const rm = promisify(fs.rm);
const access = promisify(fs.access);

describe("TranslationManager", () => {
  let manager: TranslationManager;
  let testDir: string;
  let originalCwd: string;

  const mockConfig: I18nConfig = {
    rootDir: "src",
    languages: ["en", "zh-CN", "es"],
    ignore: ["node_modules"],
    spreadsheetId: "test-sheet-id",
    sheetName: "Translations",
    keyFile: "test-key.json",
    check: {
      test: (value: string) => value.startsWith("%") && value.endsWith("%"),
    },
    format: (value: string) => value.replace(/^%|%$/g, ""),
    include: ["ts", "tsx"],
    outputDir: "test-translations",
  };

  beforeAll(async () => {
    originalCwd = process.cwd();
    testDir = path.join(process.cwd(), "__test_translation_manager__");
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    manager = new TranslationManager(mockConfig);
    // 清理之前的测试数据
    try {
      await rm("test-translations", { recursive: true, force: true });
    } catch (error) {
      // 忽略错误，目录可能不存在
    }
  });

  describe("initialize", () => {
    it("should create output directory if it doesn't exist", async () => {
      await manager.initialize();

      // 检查目录是否被创建
      const dirExists = await access("test-translations")
        .then(() => true)
        .catch(() => false);
      expect(dirExists).toBe(true);
    });

    it("should load existing translation files", async () => {
      // 预先创建翻译文件
      await mkdir("test-translations", { recursive: true });
      await writeFile(
        "test-translations/en.json",
        JSON.stringify(
          {
            hello: "Hello",
            world: "World",
          },
          null,
          2
        )
      );
      await writeFile(
        "test-translations/zh-CN.json",
        JSON.stringify(
          {
            hello: "你好",
            world: "世界",
          },
          null,
          2
        )
      );

      await manager.initialize();

      const translations = manager.getTranslations();
      expect(translations.en).toEqual({
        hello: "Hello",
        world: "World",
      });
      expect(translations["zh-CN"]).toEqual({
        hello: "你好",
        world: "世界",
      });
    });

    it("should initialize empty translations for languages without existing files", async () => {
      await manager.initialize();

      const translations = manager.getTranslations();
      expect(translations.en).toEqual({});
      expect(translations["zh-CN"]).toEqual({});
      expect(translations.es).toEqual({});
    });

    it("should handle corrupted JSON files gracefully", async () => {
      await mkdir("test-translations", { recursive: true });
      await writeFile("test-translations/en.json", "invalid json content");

      await manager.initialize();

      const translations = manager.getTranslations();
      expect(translations.en).toEqual({});
    });
  });

  describe("addTranslation", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should add translation for all configured languages", () => {
      const result: TransformResult = {
        key: "hello_world",
        text: "Hello World",
      };

      manager.addTranslation(result);

      const translations = manager.getTranslations();
      expect(translations.en["hello_world"]).toBe("Hello World");
      expect(translations["zh-CN"]["hello_world"]).toBe("Hello World");
      expect(translations.es["hello_world"]).toBe("Hello World");
    });

    it("should not overwrite existing translations", () => {
      // 先添加一个翻译
      const result1: TransformResult = {
        key: "hello",
        text: "Hello",
      };
      manager.addTranslation(result1);

      // 修改 getTranslations 返回的数据
      const translations = manager.getTranslations();
      translations.en["hello"] = "Custom Hello";
      translations["zh-CN"]["hello"] = "自定义你好";

      // 再次添加相同的key
      const result2: TransformResult = {
        key: "hello",
        text: "Hello Again",
      };
      manager.addTranslation(result2);

      // 验证不会被覆盖
      const updatedTranslations = manager.getTranslations();
      expect(updatedTranslations.en["hello"]).toBe("Custom Hello");
      expect(updatedTranslations["zh-CN"]["hello"]).toBe("自定义你好");
    });

    it("should handle multiple different translations", () => {
      const results: TransformResult[] = [
        { key: "button_save", text: "Save" },
        { key: "button_cancel", text: "Cancel" },
        { key: "message_success", text: "Success!" },
      ];

      results.forEach((result) => manager.addTranslation(result));

      const translations = manager.getTranslations();
      expect(Object.keys(translations.en)).toHaveLength(3);
      expect(translations.en["button_save"]).toBe("Save");
      expect(translations.en["button_cancel"]).toBe("Cancel");
      expect(translations.en["message_success"]).toBe("Success!");
    });
  });

  describe("getTranslations", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should return current translations", () => {
      const result: TransformResult = {
        key: "test_key",
        text: "Test Value",
      };
      manager.addTranslation(result);

      const translations = manager.getTranslations();
      expect(translations).toHaveProperty("en");
      expect(translations).toHaveProperty("zh-CN");
      expect(translations).toHaveProperty("es");
      expect(translations.en["test_key"]).toBe("Test Value");
    });

    it("should return empty object initially", () => {
      const translations = manager.getTranslations();
      expect(translations.en).toEqual({});
      expect(translations["zh-CN"]).toEqual({});
      expect(translations.es).toEqual({});
    });
  });

  describe("updateTranslations", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should replace all translations with new data", () => {
      // 先添加一些翻译
      manager.addTranslation({ key: "old_key", text: "Old Value" });

      // 更新为新的翻译数据
      const newTranslations = {
        en: { new_key: "New Value" },
        "zh-CN": { new_key: "新值" },
        es: { new_key: "Nuevo Valor" },
      };

      manager.updateTranslations(newTranslations);

      const translations = manager.getTranslations();
      expect(translations).toEqual(newTranslations);
      expect(translations.en).not.toHaveProperty("old_key");
    });

    it("should handle partial language updates", () => {
      const partialTranslations = {
        en: { partial_key: "Partial Value" },
      };

      manager.updateTranslations(partialTranslations);

      const translations = manager.getTranslations();
      expect(translations.en["partial_key"]).toBe("Partial Value");
      expect(translations["zh-CN"]).toBeUndefined();
    });
  });

  describe("saveTranslations", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should save all language files correctly", async () => {
      // 添加一些翻译
      manager.addTranslation({ key: "save_test", text: "Save Test" });

      await manager.saveTranslations();

      // 验证文件是否被创建和内容是否正确
      const enContent = await readFile("test-translations/en.json", "utf-8");
      const zhContent = await readFile("test-translations/zh-CN.json", "utf-8");
      const esContent = await readFile("test-translations/es.json", "utf-8");

      expect(JSON.parse(enContent)).toEqual({ save_test: "Save Test" });
      expect(JSON.parse(zhContent)).toEqual({ save_test: "Save Test" });
      expect(JSON.parse(esContent)).toEqual({ save_test: "Save Test" });
    });

    it("should save formatted JSON with proper indentation", async () => {
      manager.addTranslation({ key: "format_test", text: "Format Test" });

      await manager.saveTranslations();

      const content = await readFile("test-translations/en.json", "utf-8");
      // 验证是否有proper格式化（包含换行和缩进）
      expect(content).toContain("\n");
      expect(content).toContain("  "); // 2空格缩进
    });

    it("should handle empty translations", async () => {
      await manager.saveTranslations();

      const enContent = await readFile("test-translations/en.json", "utf-8");
      expect(JSON.parse(enContent)).toEqual({});
    });

    it("should overwrite existing files", async () => {
      // 先创建一个文件
      await writeFile(
        "test-translations/en.json",
        JSON.stringify({ old: "old value" })
      );

      // 添加新翻译并保存
      manager.addTranslation({ key: "new", text: "new value" });
      await manager.saveTranslations();

      const content = await readFile("test-translations/en.json", "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed).toEqual({ new: "new value" });
      expect(parsed).not.toHaveProperty("old");
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete workflow", async () => {
      // 1. 初始化
      await manager.initialize();

      // 2. 添加翻译
      manager.addTranslation({ key: "workflow_test", text: "Workflow Test" });

      // 3. 保存
      await manager.saveTranslations();

      // 4. 创建新的管理器实例并初始化（模拟重新启动）
      const newManager = new TranslationManager(mockConfig);
      await newManager.initialize();

      // 5. 验证数据被正确加载
      const translations = newManager.getTranslations();
      expect(translations.en["workflow_test"]).toBe("Workflow Test");
    });

    it("should merge new translations with existing ones", async () => {
      // 预先创建一些翻译文件
      await mkdir("test-translations", { recursive: true });
      await writeFile(
        "test-translations/en.json",
        JSON.stringify({
          existing: "Existing Value",
        })
      );

      await manager.initialize();

      // 添加新翻译
      manager.addTranslation({ key: "new_addition", text: "New Addition" });

      await manager.saveTranslations();

      // 验证新旧翻译都存在
      const content = await readFile("test-translations/en.json", "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed["existing"]).toBe("Existing Value");
      expect(parsed["new_addition"]).toBe("New Addition");
    });
  });
});
