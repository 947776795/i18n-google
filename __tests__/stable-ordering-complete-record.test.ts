const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock("../src/utils/StringUtils", () => ({
  Logger: mockLogger,
}));

import * as fs from "fs";
import * as path from "path";
import type { I18nConfig } from "../src/types";
import {
  TranslationManager,
  type CompleteTranslationRecord,
} from "../src/core/TranslationManager";

describe("CompleteRecord stable ordering across runs", () => {
  let tempDir: string;
  let config: I18nConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(process.cwd(), "test-tmp-stable-"));
    config = {
      rootDir: tempDir,
      outputDir: path.join(tempDir, "i18n"),
      spreadsheetId: "s",
      sheetName: "sh",
      languages: ["en", "zh-Hans"],
      sheetsReadRange: "A1:Z10000",
      sheetsMaxRows: 10000,
      ignore: [],
      keyFile: "k.json",
      startMarker: "/* I18N_START */",
      endMarker: "/* I18N_END */",
      include: ["ts", "tsx"],
      apiKey: "key",
    } as I18nConfig;
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("writing the same data with different insertion orders yields identical file", async () => {
    const mgr = new TranslationManager(config);
    await fs.promises.mkdir(config.outputDir, { recursive: true });
    const target = path.join(config.outputDir, "i18n-complete-record.json");

    const recordRun1: CompleteTranslationRecord = {
      "b/Mod.ts": {
        K2: { en: "K2", "zh-Hans": "K2", mark: 0 } as any,
        K1: { en: "K1", "zh-Hans": "K1", mark: 1 } as any,
      },
      "a/Mod.ts": {
        A2: { en: "A2", "zh-Hans": "A2", mark: 0 } as any,
        A1: { en: "A1", "zh-Hans": "A1", mark: 0 } as any,
      },
    } as any;

    await mgr["saveCompleteRecordDirect"](recordRun1);
    const content1 = fs.readFileSync(target, "utf-8");

    const recordRun2: CompleteTranslationRecord = {
      "a/Mod.ts": {
        A1: { en: "A1", "zh-Hans": "A1", mark: 0 } as any,
        A2: { en: "A2", "zh-Hans": "A2", mark: 0 } as any,
      },
      "b/Mod.ts": {
        K1: { en: "K1", "zh-Hans": "K1", mark: 1 } as any,
        K2: { en: "K2", "zh-Hans": "K2", mark: 0 } as any,
      },
    } as any;

    await mgr["saveCompleteRecordDirect"](recordRun2);
    const content2 = fs.readFileSync(target, "utf-8");

    // Expect identical outputs when data is the same regardless of insertion order
    expect(content2).toBe(content1);
  });
});
