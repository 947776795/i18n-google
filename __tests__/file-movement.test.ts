// Mock inquirer for user interaction
const mockPrompt = jest.fn();
jest.mock("inquirer", () => ({
  prompt: mockPrompt,
}));

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
    isTranslatableString: jest.fn((value: string) => {
      // 简单的可翻译字符串检测逻辑
      return (
        value.length > 1 && /[a-zA-Z]/.test(value) && !value.startsWith("http")
      );
    }),
    formatString: jest.fn((value: string) => value.trim()),
    cleanExtractedText: jest.fn((text: string) => text.trim()),
    containsEnglishCharacters: jest.fn((text: string) => /[a-zA-Z]/.test(text)),
    generateTranslationKey: jest.fn((filePath: string, text: string) => text),
    generateHashTranslationKey: jest.fn(
      (filePath: string, text: string) => text
    ),
  },
}));

import * as fs from "fs";
import * as path from "path";
import { I18nScanner } from "../src/core/I18nScanner";
import { PathUtils } from "../src/utils/PathUtils";
import type { I18nConfig } from "../src/types";

describe("File Movement Path Update Fix", () => {
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

    // 默认模拟用户确认远程同步
    mockPrompt.mockResolvedValue({ confirmSync: true });
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

  test("should update import paths when file is moved", async () => {
    // 创建简单的测试文件，只包含已有翻译引用，没有新翻译
    fs.mkdirSync("test-src/components/Button", { recursive: true });

    const initialContent = `
import { I18nUtil } from "@utils";
import Translations from "@translate/components/Button/index";
import React from "react";

const I18n = I18nUtil.createScoped(Translations);

export default function Button() {
  return (
    <div>
      <div>{I18n.t("Click me")}</div>
      <div>{I18n.t("Cancel")}</div>
    </div>
  );
}
`;

    fs.writeFileSync("test-src/components/Button/index.tsx", initialContent);

    // 手动创建初始翻译文件和完整记录，模拟已有翻译的情况
    fs.mkdirSync("test-translate/components/Button", { recursive: true });
    const initialTranslationContent = `const translations = {
  "en": {
    "Click me": "Click me",
    "Cancel": "Cancel"
  },
  "zh-Hans": {
    "Click me": "点击我",
    "Cancel": "取消"
  }
};

export default translations;`;
    fs.writeFileSync(
      "test-translate/components/Button/index.ts",
      initialTranslationContent
    );

    const completeRecord = {
      "components/Button/index.ts": {
        "Click me": { en: "Click me", "zh-Hans": "点击我", mark: 0 },
        Cancel: { en: "Cancel", "zh-Hans": "取消", mark: 0 },
      },
    };
    fs.writeFileSync(
      "test-translate/i18n-complete-record.json",
      JSON.stringify(completeRecord, null, 2)
    );

    // 模拟文件移动
    fs.mkdirSync("test-src/components/UI/Button", { recursive: true });
    fs.renameSync(
      "test-src/components/Button/index.tsx",
      "test-src/components/UI/Button/index.tsx"
    );
    fs.rmSync("test-src/components/Button", { recursive: true, force: true });

    // 模拟用户交互：跳过删除，确认同步
    mockPrompt
      .mockResolvedValueOnce({ selectionMode: "skip" })
      .mockResolvedValueOnce({ confirmSync: true });

    // 运行扫描
    const scanner = new I18nScanner(testConfig);
    await scanner.scan();

    // 验证导入路径已更新
    const movedFileContent = fs.readFileSync(
      "test-src/components/UI/Button/index.tsx",
      "utf-8"
    );
    expect(movedFileContent).toContain("@translate/components/UI/Button/index");
    expect(movedFileContent).not.toContain(
      "@translate/components/Button/index"
    );

    // 验证新翻译文件生成
    const newTranslatePath = "test-translate/components/UI/Button/index.ts";
    expect(fs.existsSync(newTranslatePath)).toBe(true);

    // 验证翻译内容被正确迁移
    const newTranslateContent = fs.readFileSync(newTranslatePath, "utf-8");
    expect(newTranslateContent).toContain('"Click me"');
    expect(newTranslateContent).toContain('"Cancel"');
  });

  test("should detect file migration in complete record", async () => {
    // 1. 创建模拟的完整记录
    const existingRecord = {
      "components/Button/index.ts": {
        "Click me": { en: "Click me", "zh-Hans": "点击我" },
        Cancel: { en: "Cancel", "zh-Hans": "取消" },
      },
    };

    // 2. 创建新的路径分类（模拟文件移动后的情况）
    const pathClassification = {
      "components/UI/Button/index.ts": ["Click me", "Cancel"],
    };

    // 3. 测试迁移检测逻辑
    const migrationDetected = detectFileMigrations(
      existingRecord,
      pathClassification
    );

    expect(migrationDetected.size).toBe(1);
    expect(migrationDetected.get("components/UI/Button/index.ts")).toBe(
      "components/Button/index.ts"
    );
  });

  test("should validate and fix incorrect import paths", () => {
    const currentFilePath = "test-src/components/UI/Button/index.tsx";
    const correctImportPath = PathUtils.getTranslationImportPath(
      currentFilePath,
      testConfig
    );

    expect(correctImportPath).toBe("@translate/components/UI/Button/index");
  });
});

// 辅助函数：模拟迁移检测逻辑
function detectFileMigrations(
  existingRecord: any,
  pathClassification: Record<string, string[]>
): Map<string, string> {
  const migrationMap = new Map<string, string>();

  const currentModulePaths = new Set(Object.keys(pathClassification));
  const existingModulePaths = new Set(Object.keys(existingRecord));

  for (const currentPath of currentModulePaths) {
    if (!existingModulePaths.has(currentPath)) {
      const keys = pathClassification[currentPath];

      for (const existingPath of existingModulePaths) {
        if (!currentModulePaths.has(existingPath)) {
          const existingKeys = Object.keys(existingRecord[existingPath]);
          const overlappingKeys = keys.filter((key) =>
            existingKeys.includes(key)
          );

          if (
            overlappingKeys.length > 0 &&
            overlappingKeys.length / keys.length >= 0.8
          ) {
            migrationMap.set(currentPath, existingPath);
            break;
          }
        }
      }
    }
  }

  return migrationMap;
}
