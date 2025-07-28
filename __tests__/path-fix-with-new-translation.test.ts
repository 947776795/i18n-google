// Mock StringUtils to reduce console output during tests and provide required methods
jest.mock("../src/utils/StringUtils", () => ({
  Logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    setLogLevel: jest.fn(),
  },
  StringUtils: {
    escapeRegex: jest.fn((str: string) =>
      str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    ),
    isTranslatableString: jest.fn((value: string, config: any) => {
      // 模拟实际的标记符号检测逻辑
      const { startMarker = "/* I18N_START */", endMarker = "/* I18N_END */" } =
        config || {};
      return (
        value.startsWith(startMarker) &&
        value.endsWith(endMarker) &&
        value.length >= startMarker.length + endMarker.length
      );
    }),
    formatString: jest.fn((value: string, config: any) => {
      // 模拟去除标记符号的逻辑
      const { startMarker = "/* I18N_START */", endMarker = "/* I18N_END */" } =
        config || {};
      return value
        .replace(
          new RegExp(`^${startMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}+`),
          ""
        )
        .replace(
          new RegExp(`${endMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}+$`),
          ""
        );
    }),
    cleanExtractedText: jest.fn((text: string) => {
      return text.replace(/^\s+/, "").replace(/\s+$/, "").replace(/\s+/g, " ");
    }),
    containsEnglishCharacters: jest.fn((text: string) => /[a-zA-Z]/.test(text)),
    generateTranslationKey: jest.fn((filePath: string, text: string) => text),
    generateHashTranslationKey: jest.fn(
      (filePath: string, text: string) => text
    ),
  },
}));

// Mock Google Sheets API
jest.mock("googleapis", () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({
        getClient: jest.fn().mockResolvedValue({}),
      })),
    },
    sheets: jest.fn().mockImplementation(() => ({
      spreadsheets: {
        values: {
          get: jest.fn(),
          update: jest.fn(),
        },
      },
    })),
  },
}));

// Mock llmTranslate
jest.mock("../src/utils/llmTranslate", () => ({
  llmTranslate: jest
    .fn()
    .mockImplementation((text: string, from: string, to: string) => {
      const translations: Record<string, Record<string, string>> = {
        "zh-Hans": {
          Hello: "你好",
          "Click me": "点击我",
          Submit: "提交",
          "New Button Text": "新按钮文本",
          "Another New Text": "另一个新文本",
          "Hello World": "你好世界",
          "Test Text": "测试文本",
        },
      };
      return Promise.resolve(translations[to]?.[text] || text);
    }),
}));

// Mock prompts
const mockPrompt = jest.fn();
jest.mock("prompts", () => mockPrompt);

import * as fs from "fs";
import * as path from "path";
import { I18nScanner } from "../src/core/I18nScanner";
import type { I18nConfig } from "../src/types";

describe("Path Fix with New Translation Issue", () => {
  jest.setTimeout(30000); // 增加超时时间
  const testConfig: I18nConfig = {
    rootDir: "test-src",
    outputDir: "test-translate",
    include: ["tsx", "ts"],
    ignore: ["node_modules", ".git"],
    languages: ["en", "zh-Hans"],
    apiKey: "test-key",
    spreadsheetId: "test-sheet",
    sheetName: "Sheet1",
    keyFile: "test-key.json",
    startMarker: "/* I18N_START */",
    endMarker: "/* I18N_END */",
    forceKeepKeys: {},
  };

  beforeEach(() => {
    // 清理测试目录
    if (fs.existsSync("test-src")) {
      fs.rmSync("test-src", { recursive: true, force: true });
    }
    if (fs.existsSync("test-translate")) {
      fs.rmSync("test-translate", { recursive: true, force: true });
    }

    // 清理所有mock
    jest.clearAllMocks();

    // 默认模拟用户交互：自动跳过所有确认步骤
    mockPrompt.mockImplementation((questions: any) => {
      // 根据提示类型自动响应
      if (Array.isArray(questions)) {
        const responses: any = {};
        questions.forEach((q: any) => {
          if (q.name === "selectionMode") {
            responses[q.name] = "skip";
          } else if (q.name === "confirmSync") {
            responses[q.name] = true;
          } else if (q.name === "confirmRemoteSync") {
            responses[q.name] = true;
          } else if (q.type === "confirm") {
            responses[q.name] = true;
          } else {
            responses[q.name] = "skip";
          }
        });
        return Promise.resolve(responses);
      } else {
        // 单个问题
        if (questions.name === "selectionMode") {
          return Promise.resolve({ selectionMode: "skip" });
        } else if (questions.name === "confirmSync") {
          return Promise.resolve({ confirmSync: true });
        } else if (questions.name === "confirmRemoteSync") {
          return Promise.resolve({ confirmRemoteSync: true });
        } else if (questions.type === "confirm") {
          return Promise.resolve({ [questions.name]: true });
        } else {
          return Promise.resolve({ [questions.name]: "skip" });
        }
      }
    });
  });

  afterEach(() => {
    // 清理测试目录
    if (fs.existsSync("test-src")) {
      fs.rmSync("test-src", { recursive: true, force: true });
    }
    if (fs.existsSync("test-translate")) {
      fs.rmSync("test-translate", { recursive: true, force: true });
    }
  });

  test("should collect new translations when path fix occurs simultaneously", async () => {
    // 1. 创建原始文件结构和翻译
    fs.mkdirSync("test-src/components/Button", { recursive: true });

    // 原始文件 - 包含已有翻译引用
    const originalFileContent = `
import { I18nUtil } from "@utils";
import Translations from "@translate/components/Button/index";
import React from "react";

const I18n = I18nUtil.createScoped(Translations);

export default function Button() {
  return (
    <div>
      <div>{I18n.t("Click me")}</div>
      <div>{I18n.t("Submit")}</div>
    </div>
  );
}
`;

    fs.writeFileSync(
      "test-src/components/Button/index.tsx",
      originalFileContent
    );

    // 创建初始翻译文件和完整记录
    fs.mkdirSync("test-translate/components/Button", { recursive: true });
    const initialTranslationContent = `const translations = {
  "en": {
    "Click me": "Click me",
    "Submit": "Submit"
  },
  "zh-Hans": {
    "Click me": "点击我",
    "Submit": "提交"
  }
};

export default translations;`;
    fs.writeFileSync(
      "test-translate/components/Button/index.ts",
      initialTranslationContent
    );

    const initialCompleteRecord = {
      "components/Button/index.ts": {
        "Click me": { en: "Click me", "zh-Hans": "点击我", mark: 0 },
        Submit: { en: "Submit", "zh-Hans": "提交", mark: 0 },
      },
    };
    fs.writeFileSync(
      "test-translate/i18n-complete-record.json",
      JSON.stringify(initialCompleteRecord, null, 2)
    );

    // 2. 模拟文件移动到新位置
    fs.mkdirSync("test-src/components/UI/Button", { recursive: true });
    fs.renameSync(
      "test-src/components/Button/index.tsx",
      "test-src/components/UI/Button/index.tsx"
    );
    fs.rmSync("test-src/components/Button", { recursive: true, force: true });

    // 3. 修改移动后的文件，添加新的需要翻译的文本
    const modifiedFileContent = `
import { I18nUtil } from "@utils";
import Translations from "@translate/components/Button/index"; // 这个路径需要修复
import React from "react";

const I18n = I18nUtil.createScoped(Translations);

export default function Button() {
  return (
    <div>
      <div>{I18n.t("Click me")}</div>
      <div>{I18n.t("Submit")}</div>
      <div>/* I18N_START */New Button Text/* I18N_END */</div>  {/* 新的需要翻译的文本 */}
      <span>/* I18N_START */Another New Text/* I18N_END */</span>  {/* 另一个新的需要翻译的文本 */}
    </div>
  );
}
`;

    fs.writeFileSync(
      "test-src/components/UI/Button/index.tsx",
      modifiedFileContent
    );

    // 4. 运行扫描
    const scanner = new I18nScanner(testConfig);
    await scanner.scan();

    // 5. 验证结果
    // 5.1 验证导入路径已更新
    const updatedFileContent = fs.readFileSync(
      "test-src/components/UI/Button/index.tsx",
      "utf-8"
    );
    expect(updatedFileContent).toContain(
      "@translate/components/UI/Button/index"
    );
    expect(updatedFileContent).not.toContain(
      "@translate/components/Button/index"
    );

    // 5.2 验证新翻译文件生成在正确位置
    const newTranslatePath = "test-translate/components/UI/Button/index.ts";
    expect(fs.existsSync(newTranslatePath)).toBe(true);

    // 5.3 验证新的翻译被添加到了文件中
    const newTranslateContent = fs.readFileSync(newTranslatePath, "utf-8");
    expect(newTranslateContent).toContain('"New Button Text"');
    expect(newTranslateContent).toContain('"Another New Text"');

    // 5.4 **关键验证点**: 检查完整记录是否正确收集了新翻译
    const updatedCompleteRecord = JSON.parse(
      fs.readFileSync("test-translate/i18n-complete-record.json", "utf-8")
    );

    console.log(
      "Updated Complete Record:",
      JSON.stringify(updatedCompleteRecord, null, 2)
    );

    // 验证新模块路径存在
    expect(
      updatedCompleteRecord["components/UI/Button/index.ts"]
    ).toBeDefined();

    // 验证旧翻译被迁移
    expect(
      updatedCompleteRecord["components/UI/Button/index.ts"]["Click me"]
    ).toBeDefined();
    expect(
      updatedCompleteRecord["components/UI/Button/index.ts"]["Submit"]
    ).toBeDefined();

    // **这是关键测试点**: 验证新翻译被收集到complete record中
    expect(
      updatedCompleteRecord["components/UI/Button/index.ts"]["New Button Text"]
    ).toBeDefined();
    expect(
      updatedCompleteRecord["components/UI/Button/index.ts"]["Another New Text"]
    ).toBeDefined();

    // 验证新翻译包含正确的语言版本
    expect(
      updatedCompleteRecord["components/UI/Button/index.ts"]["New Button Text"][
        "en"
      ]
    ).toBe("New Button Text");
    expect(
      updatedCompleteRecord["components/UI/Button/index.ts"]["New Button Text"][
        "zh-Hans"
      ]
    ).toBe("新按钮文本");
    expect(
      updatedCompleteRecord["components/UI/Button/index.ts"][
        "Another New Text"
      ]["en"]
    ).toBe("Another New Text");
    expect(
      updatedCompleteRecord["components/UI/Button/index.ts"][
        "Another New Text"
      ]["zh-Hans"]
    ).toBe("另一个新文本");
  });

  test("should handle case where only new translations exist without path changes", async () => {
    // 创建只包含新翻译的简单场景，作为对照组
    fs.mkdirSync("test-src/components/Simple", { recursive: true });

    const simpleFileContent = `
import React from "react";

export default function Simple() {
  return (
    <div>
      <div>/* I18N_START */Hello World/* I18N_END */</div>
      <span>/* I18N_START */Test Text/* I18N_END */</span>
    </div>
  );
}
`;

    fs.writeFileSync("test-src/components/Simple/index.tsx", simpleFileContent);

    // 运行扫描
    const scanner = new I18nScanner(testConfig);
    await scanner.scan();

    // 验证新翻译被正确收集
    const completeRecord = JSON.parse(
      fs.readFileSync("test-translate/i18n-complete-record.json", "utf-8")
    );

    expect(completeRecord["components/Simple/index.ts"]).toBeDefined();
    expect(
      completeRecord["components/Simple/index.ts"]["Hello World"]
    ).toBeDefined();
    expect(
      completeRecord["components/Simple/index.ts"]["Test Text"]
    ).toBeDefined();
  });
});
