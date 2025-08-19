const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock("../src/utils/StringUtils", () => ({
  Logger: mockLogger,
}));

// Mocks for AstTransformer methods used by FileTransformer
const mockTransformSource = jest.fn();
const mockAnalyzeAndTransformSource = jest.fn();

jest.mock("../src/core/AstTransformer", () => ({
  AstTransformer: jest.fn().mockImplementation(() => ({
    transformSource: mockTransformSource,
    analyzeAndTransformSource: mockAnalyzeAndTransformSource,
  })),
}));

import * as fs from "fs";
import * as path from "path";
import { FileTransformer } from "../src/core/FileTransformer";
import type { I18nConfig } from "../src/types";

describe("FileTransformer - unit", () => {
  let tempDir: string;
  let config: I18nConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(process.cwd(), "test-tmp-"));
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
    // cleanup temp directory recursively
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  function writeTempFile(filename: string, content: string): string {
    const filePath = path.join(tempDir, filename);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  it("transformFile writes when there are results > 0", async () => {
    const filePath = writeTempFile("a.tsx", "const x = 1;\n");
    mockTransformSource.mockReturnValue({
      results: [{ key: "K" }],
      transformedCode: "// changed\n",
    });

    const ft = new FileTransformer(config);
    const results = await ft.transformFile(filePath);

    expect(results).toHaveLength(1);
    const written = fs.readFileSync(filePath, "utf-8");
    expect(written).toBe("// changed\n");
  });

  it("transformFile does not write when there are no results", async () => {
    const filePath = writeTempFile("b.tsx", "const y = 2;\n");
    mockTransformSource.mockReturnValue({
      results: [],
      transformedCode: "// would be ignored\n",
    });

    const original = fs.readFileSync(filePath, "utf-8");
    const ft = new FileTransformer(config);
    const results = await ft.transformFile(filePath);

    expect(results).toHaveLength(0);
    const after = fs.readFileSync(filePath, "utf-8");
    expect(after).toBe(original);
  });

  it("collectFileReferences returns references from analyzeAndTransformSource", async () => {
    const filePath = writeTempFile("c.tsx", "console.log('hi');\n");
    mockAnalyzeAndTransformSource.mockReturnValue({
      existingReferences: [
        {
          key: "Hello",
          filePath,
          lineNumber: 1,
          columnNumber: 1,
          callExpression: "I18n.t",
        },
      ],
      newTranslations: [],
      transformedCode: "console.log('hi');\n",
    });

    const ft = new FileTransformer(config);
    const refs = await ft.collectFileReferences(filePath);
    expect(refs).toHaveLength(1);
    expect(refs[0].key).toBe("Hello");
  });

  it("analyzeAndTransformFile writes when new translations exist", async () => {
    const filePath = writeTempFile("d.tsx", "export const A = 1;\n");
    mockAnalyzeAndTransformSource.mockReturnValue({
      existingReferences: [],
      newTranslations: [{ key: "New" }],
      transformedCode: "// transformed D\n",
    });

    const ft = new FileTransformer(config);
    const result = await ft.analyzeAndTransformFile(filePath);
    expect(result.newTranslations).toHaveLength(1);
    const written = fs.readFileSync(filePath, "utf-8");
    expect(written).toBe("// transformed D\n");
  });

  it("analyzeAndTransformFile writes when transformedCode differs even without new translations", async () => {
    const filePath = writeTempFile("e.tsx", "const E = 5;\n");
    mockAnalyzeAndTransformSource.mockReturnValue({
      existingReferences: [],
      newTranslations: [],
      transformedCode: "// fixed import path\n",
    });

    const ft = new FileTransformer(config);
    await ft.analyzeAndTransformFile(filePath);
    const written = fs.readFileSync(filePath, "utf-8");
    expect(written).toBe("// fixed import path\n");
  });
});
