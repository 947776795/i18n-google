// Mock StringUtils to silence logs in tests
jest.mock("../src/utils/StringUtils", () => ({
  Logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    setLogLevel: jest.fn(),
  },
}));

// Mock Google Sheets API to avoid network
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
          get: jest.fn().mockResolvedValue({ data: { values: [] } }),
          update: jest.fn().mockResolvedValue({ data: {} }),
        },
      },
    })),
  },
}));

import * as fs from "fs";
import * as path from "path";
import {
  TranslationManager,
  type CompleteTranslationRecord,
} from "../src/core/TranslationManager";
import type { I18nConfig } from "../src/types";

/**
 * This test ensures that when saving the complete record, the language fields
 * appear in the exact order defined by config.languages, and the `mark` field
 * is always placed at the end.
 */
describe("i18n-complete-record ordering", () => {
  const outDir = "test-translate-order";
  const config: I18nConfig = {
    rootDir: "test-src",
    outputDir: outDir,
    include: ["tsx", "ts"],
    ignore: ["node_modules", ".git"],
    languages: ["en", "zh", "zh-tw"],
    apiKey: "test-key",
    spreadsheetId: "test-sheet",
    sheetName: "Sheet1",
    keyFile: "test-key.json",
    startMarker: "/* I18N_START */",
    endMarker: "/* I18N_END */",
    forceKeepKeys: {},
  };

  beforeEach(() => {
    if (fs.existsSync(outDir))
      fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(outDir))
      fs.rmSync(outDir, { recursive: true, force: true });
  });

  test("languages are saved in config order and mark is last", async () => {
    const tm = new TranslationManager(config);

    const record: CompleteTranslationRecord = {
      "components/Test.ts": {
        Hello: {
          // Intentionally put mark first and scramble languages
          mark: 1 as any,
          "zh-tw": "哈囉（繁體）",
          en: "Hello",
          zh: "你好",
        },
      },
    };

    await tm.saveCompleteRecordDirect(record);

    const filePath = path.join(outDir, "i18n-complete-record.json");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");

    // Capture the object for key `Hello` without depending on indentation
    const helloMatch = content.match(/"Hello"\s*:\s*\{([\s\S]*?)\n\s*\}/);
    expect(helloMatch).not.toBeNull();
    const block = helloMatch ? helloMatch[1] : "";

    const enIdx = block.indexOf('"en"');
    const zhIdx = block.indexOf('"zh"');
    const zhtwIdx = block.indexOf('"zh-tw"');
    const markIdx = block.indexOf('"mark"');

    expect(enIdx).toBeGreaterThan(-1);
    expect(zhIdx).toBeGreaterThan(-1);
    expect(zhtwIdx).toBeGreaterThan(-1);
    expect(markIdx).toBeGreaterThan(-1);

    expect(enIdx).toBeLessThan(zhIdx);
    expect(zhIdx).toBeLessThan(zhtwIdx);
    expect(zhtwIdx).toBeLessThan(markIdx);
  });
});
