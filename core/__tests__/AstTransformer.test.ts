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
import { StringUtils } from "../utils/StringUtils";
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
    startMarker: "%",
    endMarker: "%",
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

  describe("transformFile - String Literals", () => {
    it("should transform text wrapped in % to I18n.t calls", async () => {
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

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        key: expect.stringMatching(/^[a-f0-9]{8}$/),
        text: "Hello World",
      });
      expect(results[1]).toEqual({
        key: expect.stringMatching(/^[a-f0-9]{8}$/),
        text: "Welcome to our app",
      });

      const transformedCode = await readFile(testFile, "utf-8");
      expect(transformedCode).toContain('import { I18n } from "@utils"');
      expect(transformedCode).toContain("I18n.t(");
      expect(transformedCode).toContain("Not translated text");
      expect(transformedCode).toContain("{I18n.t("); // JSX expression container
    });

    it("should handle multiple % symbols correctly", async () => {
      const testFile = path.join(testDir, "multiple-percent.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>%%Hello World%%</h1>
              <p>%%%Multiple Percent%%%</p>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe("Hello World");
      expect(results[1].text).toBe("Multiple Percent");
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

    it("should handle JavaScript variables (non-JSX)", async () => {
      const testFile = path.join(testDir, "js-variables.ts");
      const sourceCode = `
        const message = "%Hello World%";
        const button = "%Click Me%";
        const log = console.log("%Debug Message%");
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(3);
      const transformedCode = await readFile(testFile, "utf-8");
      expect(transformedCode).toContain('import { I18n } from "@utils"');
      expect(transformedCode).toContain("I18n.t(");
      // Should not have JSX expression containers in pure JS
      expect(transformedCode).not.toContain("{I18n.t(");
    });
  });

  describe("transformFile - Template Literals", () => {
    it("should transform template literals with variables", async () => {
      const testFile = path.join(testDir, "template-literals.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = ({ name, count }: { name: string; count: number }) => {
          return (
            <div>
              <h1>{\`%Hello \${name}%\`}</h1>
              <p>{\`%You have \${count} items%\`}</p>
              <span>{\`No percent signs here \${name}\`}</span>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe("Hello %{var0}");
      expect(results[1].text).toBe("You have %{var0} items");

      const transformedCode = await readFile(testFile, "utf-8");
      expect(transformedCode).toContain('import { I18n } from "@utils"');
      expect(transformedCode).toContain("I18n.t(");
      expect(transformedCode).toContain("var0: name");
      expect(transformedCode).toContain("var0: count");
      expect(transformedCode).toContain("No percent signs here"); // Should remain unchanged
    });

    it("should handle complex template literals with multiple variables", async () => {
      const testFile = path.join(testDir, "complex-template.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = ({ user, score, level }: any) => {
          return (
            <div>
              <h1>{\`%Welcome \${user.name}, you are level \${level} with \${score} points%\`}</h1>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe(
        "Welcome %{var0}, you are level %{var1} with %{var2} points"
      );

      const transformedCode = await readFile(testFile, "utf-8");
      expect(transformedCode).toContain("var0: user.name");
      expect(transformedCode).toContain("var1: level");
      expect(transformedCode).toContain("var2: score");
    });

    it("should handle template literals in JavaScript (non-JSX)", async () => {
      const testFile = path.join(testDir, "js-template.ts");
      const sourceCode = `
        const name = "John";
        const message = \`%Hello \${name}, welcome back%\`;
        console.log(\`%Debug: \${message}%\`);
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe("Hello %{var0}, welcome back");
      expect(results[1].text).toBe("Debug: %{var0}");

      const transformedCode = await readFile(testFile, "utf-8");
      expect(transformedCode).toContain('import { I18n } from "@utils"');
      expect(transformedCode).toContain("I18n.t(");
      expect(transformedCode).toContain("var0: name");
      expect(transformedCode).toContain("var0: message");
      // Should not have JSX expression containers
      expect(transformedCode).not.toContain("{I18n.t(");
    });

    it("should handle template literals with only static content", async () => {
      const testFile = path.join(testDir, "static-template.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>{\`%Static Template String%\`}</h1>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe("Static Template String");

      const transformedCode = await readFile(testFile, "utf-8");
      expect(transformedCode).toContain("I18n.t(");
      expect(transformedCode).not.toContain("{ var0:");
    });
  });

  describe("I18n Import Handling", () => {
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
  });

  describe("Edge Cases", () => {
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

    it("should handle empty translation text", async () => {
      const testFile = path.join(testDir, "empty-text.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>%%</h1>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe("");
    });

    it("should handle file read/write errors gracefully", async () => {
      const nonExistentFile = path.join(testDir, "non-existent.tsx");

      await expect(
        transformer.transformFile(nonExistentFile)
      ).rejects.toThrow();
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
      {
        filePath: "src/components/Template.tsx",
        text: "Hello %{var0}, you have %{var1} items",
      },
    ];

    testCases.forEach(({ filePath, text }) => {
      it(`should generate hash-based key for "${text}"`, () => {
        const key = StringUtils.generateTranslationKey(filePath, text);
        expect(key).toMatch(/^[a-f0-9]{8}$/);
        expect(key).toBe(StringUtils.generateTranslationKey(filePath, text));
        if (text !== testCases[0].text) {
          expect(key).not.toBe(
            StringUtils.generateTranslationKey(
              testCases[0].filePath,
              testCases[0].text
            )
          );
        }
      });
    });

    it("should generate different keys for same text in different files", () => {
      const text = "Hello World";
      const key1 = StringUtils.generateTranslationKey("file1.tsx", text);
      const key2 = StringUtils.generateTranslationKey("file2.tsx", text);

      expect(key1).not.toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{8}$/);
      expect(key2).toMatch(/^[a-f0-9]{8}$/);
    });
  });

  describe("Configuration Integration", () => {
    it("should respect custom markers", async () => {
      const customConfig: I18nConfig = {
        ...mockConfig,
        startMarker: "T_",
        endMarker: "_T",
      };

      const customTransformer = new AstTransformer(customConfig);
      const testFile = path.join(testDir, "custom-markers.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>T_Custom Translation_T</h1>
              <p>%This should not match%</p>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await customTransformer.transformFile(testFile);

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe("Custom Translation");
    });

    it("should handle different start and end markers", async () => {
      const customConfig: I18nConfig = {
        ...mockConfig,
        startMarker: "[[",
        endMarker: "]]",
      };

      const customTransformer = new AstTransformer(customConfig);
      const testFile = path.join(testDir, "different-markers.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          return (
            <div>
              <h1>[[hello world]]</h1>
              <p>%This should not match%</p>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await customTransformer.transformFile(testFile);

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe("hello world");
    });
  });

  describe("transformFile - JSX Text Nodes", () => {
    it("should transform JSX text nodes that are pure text", async () => {
      const testFile = path.join(testDir, "jsx-text.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          return (
            <div>
              Hello World
              <p>Welcome to our app</p>
              <span>Normal text</span>
              <h1>Title</h1>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(4);
      expect(results[0]).toEqual({
        key: expect.stringMatching(/^[a-f0-9]{8}$/),
        text: "Hello World",
      });
      expect(results[1]).toEqual({
        key: expect.stringMatching(/^[a-f0-9]{8}$/),
        text: "Welcome to our app",
      });
      expect(results[2]).toEqual({
        key: expect.stringMatching(/^[a-f0-9]{8}$/),
        text: "Normal text",
      });
      expect(results[3]).toEqual({
        key: expect.stringMatching(/^[a-f0-9]{8}$/),
        text: "Title",
      });

      const transformedCode = await readFile(testFile, "utf-8");
      expect(transformedCode).toContain('import { I18n } from "@utils"');
      expect(transformedCode).toContain("{I18n.t(");
      expect(transformedCode).not.toContain("Hello World");
      expect(transformedCode).not.toContain("Welcome to our app");
    });

    it("should handle both marked strings and pure JSX text", async () => {
      const testFile = path.join(testDir, "jsx-mixed-types.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          const markedString = "%Marked String%";
          return (
            <div>
              Pure JSX Text
              <p title="%Marked Attribute%">Another Pure Text</p>
              <span>{"%Marked in Expression%"}</span>
              <h1>{\`%Marked Template \${name}%\`}</h1>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(6);

      // 验证包含了所有类型的翻译
      const texts = results.map((r) => r.text).sort();
      expect(texts).toEqual([
        "Another Pure Text",
        "Marked Attribute",
        "Marked String",
        "Marked Template %{var0}",
        "Marked in Expression",
        "Pure JSX Text",
      ]);
    });

    it("should handle JSX text with whitespace correctly", async () => {
      const testFile = path.join(testDir, "jsx-whitespace.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          return (
            <div>
              
              Hello World
              
              <p>  Welcome  </p>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(2);
      expect(results[0].text).toBe("Hello World");
      expect(results[1].text).toBe("Welcome");
    });

    it("should skip empty or whitespace-only JSX text", async () => {
      const testFile = path.join(testDir, "jsx-empty.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          return (
            <div>
              
              <p>Valid text</p>
              
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe("Valid text");
    });

    it("should handle mixed JSX text and string literals", async () => {
      const testFile = path.join(testDir, "jsx-mixed.tsx");
      const sourceCode = `
        import React from 'react';
        
        export const TestComponent = () => {
          const message = "%JavaScript string%";
          return (
            <div>
              JSX text node
              <p title="%Attribute value%">Another JSX text</p>
            </div>
          );
        };
      `;

      await writeFile(testFile, sourceCode, "utf-8");

      const results = await transformer.transformFile(testFile);

      expect(results).toHaveLength(4);

      // 验证包含了所有类型的翻译
      const texts = results.map((r) => r.text).sort();
      expect(texts).toEqual([
        "Another JSX text",
        "Attribute value",
        "JSX text node",
        "JavaScript string",
      ]);
    });
  });
});
