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
import { PreviewFileService } from "../src/core/PreviewFileService";
import type { CompleteTranslationRecord } from "../src/core/TranslationManager";

describe("PreviewFileService - unit", () => {
  let tempDir: string;
  let config: I18nConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(process.cwd(), "test-tmp-preview-"));
    config = {
      rootDir: tempDir,
      outputDir: path.join(tempDir, "out"),
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

  it("generateDeletePreviewFromCompleteRecord writes expected subset", async () => {
    const svc = new PreviewFileService(config);
    const complete: CompleteTranslationRecord = {
      "components/A.ts": {
        Hello: { en: "Hello", "zh-Hans": "你好", mark: 0 },
        World: { en: "World", "zh-Hans": "世界", mark: 1 },
      },
      "components/B.ts": {
        Foo: { en: "Foo", "zh-Hans": "福", mark: 0 },
      },
    } as any;

    const formatted = ["[components/A.ts][Hello]", "[components/B.ts][Foo]"];
    const previewPath = await svc.generateDeletePreviewFromCompleteRecord(
      formatted,
      complete
    );

    expect(fs.existsSync(previewPath)).toBe(true);
    const json = JSON.parse(fs.readFileSync(previewPath, "utf-8"));
    expect(Object.keys(json)).toEqual(["components/A.ts", "components/B.ts"]);
    expect(Object.keys(json["components/A.ts"])).toEqual(["Hello"]);
    expect(Object.keys(json["components/B.ts"])).toEqual(["Foo"]);
  });

  it("cleanupPreviewFiles removes files and ignores missing ones", async () => {
    const svc = new PreviewFileService(config);
    const file1 = path.join(config.outputDir, "p1.json");
    const file2 = path.join(config.outputDir, "p2.json");
    fs.mkdirSync(config.outputDir, { recursive: true });
    fs.writeFileSync(file1, "{}", "utf-8");

    await svc.cleanupPreviewFiles([file1, file2]);

    expect(fs.existsSync(file1)).toBe(false);
    // file2 did not exist; ensure no throw and logs were called
    expect(mockLogger.debug).toHaveBeenCalled();
  });
});
