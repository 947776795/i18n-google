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

describe("TranslationManager - unit", () => {
  let tempDir: string;
  let config: I18nConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(process.cwd(), "test-tmp-tm-"));
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

  it("saveCompleteRecordDirect writes normalized ordering (mark last)", async () => {
    const mgr = new TranslationManager(config);
    const record: CompleteTranslationRecord = {
      "components/A.ts": {
        Hello: { zh: "你好", en: "Hello", mark: 1 } as any,
      },
    } as any;

    await fs.promises.mkdir(config.outputDir, { recursive: true });
    await mgr["saveCompleteRecordDirect"](record);
    const file = path.join(config.outputDir, "i18n-complete-record.json");
    const json = JSON.parse(fs.readFileSync(file, "utf-8"));
    expect(Object.keys(json["components/A.ts"].Hello)).toEqual([
      "en",
      "zh",
      "mark",
    ]);
  });

  it("generateModularFilesFromCompleteRecord produces module files", async () => {
    const mgr = new TranslationManager(config);
    const record: CompleteTranslationRecord = {
      "components/Button/index.ts": {
        Click: { en: "Click", "zh-Hans": "点击", mark: 0 } as any,
      },
    } as any;
    await fs.promises.mkdir(config.outputDir, { recursive: true });
    await mgr["generateModuleFilesFromRecord"](record as any);

    const file = path.join(config.outputDir, "components/Button/index.ts");
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, "utf-8");
    expect(content).toContain("export default translations");
  });

  it("deleteKeysFromCompleteRecord removes keys and updates references map", async () => {
    const mgr = new TranslationManager(config);
    const file = path.join(config.outputDir, "i18n-complete-record.json");
    await fs.promises.mkdir(config.outputDir, { recursive: true });
    const initial: CompleteTranslationRecord = {
      "mod/A.ts": {
        K1: { en: "K1", "zh-Hans": "K1", mark: 0 } as any,
        K2: { en: "K2", "zh-Hans": "K2", mark: 0 } as any,
      },
    } as any;
    fs.writeFileSync(file, JSON.stringify(initial, null, 2), "utf-8");

    const refs = new Map<string, any[]>([
      ["K1", [{ filePath: "x", lineNumber: 1, columnNumber: 1 }]],
      ["K2", [{ filePath: "y", lineNumber: 1, columnNumber: 1 }]],
    ]);

    const result = await mgr.deleteKeysFromCompleteRecord(["K1"], refs);
    expect(result.deletedCount).toBe(1);
    expect(refs.has("K1")).toBe(false);

    const json = JSON.parse(fs.readFileSync(file, "utf-8"));
    expect(json["mod/A.ts"].K1).toBeUndefined();
    expect(json["mod/A.ts"].K2).toBeDefined();
  });
});
