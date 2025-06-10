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
import { AstTransformer } from "../AstTransformer";
import type { I18nConfig } from "../../types";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const rm = promisify(fs.rm);

describe("AstTransformer", () => {
  let transformer: AstTransformer;
  let testDir: string;

  const mockConfig: I18nConfig = {
    rootDir: "src",
    languages: ["en", "zh-CN"],
    ignore: ["node_modules"],
    spreadsheetId: "test-sheet-id",
    sheetName: "Translations",
    keyFile: "test-key.json",
    check: {
      test: (value: string) => value.startsWith("%") && value.endsWith("%"),
    },
    format: (value: string) => value.replace(/^%|%$/g, ""),
    include: ["ts", "tsx"],
    outputDir: "translations",
  };

  beforeAll(async () => {
    testDir = path.join(process.cwd(), "__test_files__");
    await mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    transformer = new AstTransformer(mockConfig);
  });

  describe("transformFile", () => {
    it("should transform text wrapped in % to I18n.t calls", async () => {
      // 创建测试文件
      const testFile = path.join(testDir, "test.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>%Hello World%</h1>
              <p>%Welcome to our app%</p>
              <span>Not translated text</span>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      // 执行转换
      const results = await transformer.transformFile(testFile);

      // 验证结果
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        key: expect.stringMatching(/^[a-f0-9]{8}$/),
        text: "Hello World",
      });
      expect(results[1]).toEqual({
        key: expect.stringMatching(/^[a-f0-9]{8}$/),
        text: "Welcome to our app",
      });

      // 验证转换后的文件内容
      const transformedCode = await readFile(testFile, "utf-8");
      expect(transformedCode).toContain('import { I18n } from "@utils"');
      expect(transformedCode).toContain("I18n.t(");
      expect(transformedCode).toContain("Not translated text");
    });

    it("should not add I18n import if no translations needed", async () => {
      const testFile = path.join(testDir, "no-translations.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>No translations needed</h1>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(0);
      const transformedCode = await readFile(testFile, "utf-8");
      expect(transformedCode).not.toContain("import { I18n }");
    });

    it("should handle multiple occurrences of the same text", async () => {
      const testFile = path.join(testDir, "duplicate-text.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>%Submit%</h1>
              <button>%Submit%</button>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(results[1]);
      expect(results[0]).toEqual({
        key: expect.stringMatching(/^[a-f0-9]{8}$/),
        text: "Submit",
      });

      const transformedCode = await readFile(testFile, "utf-8");
      const matches = transformedCode.match(/I18n\.t\("[a-f0-9]{8}"\)/g);
      expect(matches).toHaveLength(2);
    });

    it("should handle special characters in translation keys", async () => {
      const testFile = path.join(testDir, "special-chars.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>%Hello, World! (Special) #123%</h1>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        key: expect.stringMatching(/^[a-f0-9]{8}$/),
        text: "Hello, World! (Special) #123",
      });
    });

    it("should handle existing I18n imports", async () => {
      const testFile = path.join(testDir, "existing-import.tsx");
      const sourceCode = `
        import React from 'react';
        import { I18n } from "@utils";
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>%New Translation%</h1>
              {I18n.t("existing_translation")}
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(1);
      const transformedCode = await readFile(testFile, "utf-8");
      const importMatches = transformedCode.match(
        /import.*I18n.*from "@utils"/g
      );
      expect(importMatches).toHaveLength(1);
    });

    it("should add I18n import when file has other @utils imports but not I18n", async () => {
      const testFile = path.join(testDir, "other-utils-import.tsx");
      const sourceCode = `
        import React from 'react';
        import { formatDate } from "@utils";
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>%Hello World%</h1>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(1);
      const transformedCode = await readFile(testFile, "utf-8");
      expect(transformedCode).toContain('import { I18n } from "@utils"');
      expect(transformedCode).toContain('import { formatDate } from "@utils"');
    });

    it("should add I18n import when file has I18n import from different source", async () => {
      const testFile = path.join(testDir, "different-source-import.tsx");
      const sourceCode = `
        import React from 'react';
        import { I18n } from "react-i18next";
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>%Hello World%</h1>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(1);
      const transformedCode = await readFile(testFile, "utf-8");
      expect(transformedCode).toContain('import { I18n } from "@utils"');
      expect(transformedCode).toContain('import { I18n } from "react-i18next"');
    });

    it("should handle default imports from @utils", async () => {
      const testFile = path.join(testDir, "default-import.tsx");
      const sourceCode = `
        import React from 'react';
        import utils from "@utils";
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>%Hello World%</h1>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(1);
      const transformedCode = await readFile(testFile, "utf-8");
      expect(transformedCode).toContain('import { I18n } from "@utils"');
      expect(transformedCode).toContain('import utils from "@utils"');
    });
  });

  describe("generateTranslationKey", () => {
    const testCases = [
      {
        filePath: "src/components/Header.tsx",
        text: "Hello World",
      },
      {
        filePath: "src/components/Form.tsx",
        text: "Submit Form!",
      },
      {
        filePath: "src/components/Numbers.tsx",
        text: "123 Numbers",
      },
      {
        filePath: "src/components/Special.tsx",
        text: "Special @#$ Characters",
      },
      {
        filePath: "src/components/Multiple.tsx",
        text: "__multiple___underscores__",
      },
    ];

    testCases.forEach(({ filePath, text }) => {
      it(`should generate hash-based key for "${text}"`, () => {
        const key = transformer["generateTranslationKey"](filePath, text);
        // We expect an MD5 hash of 8 characters
        expect(key).toMatch(/^[a-f0-9]{8}$/);
        // Keys should be consistent for same input
        expect(key).toBe(transformer["generateTranslationKey"](filePath, text));
        // Different text should generate different keys
        if (text !== testCases[0].text) {
          expect(key).not.toBe(
            transformer["generateTranslationKey"](
              testCases[0].filePath,
              testCases[0].text
            )
          );
        }
      });
    });
  });
});
