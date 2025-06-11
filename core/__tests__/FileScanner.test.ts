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
import { FileScanner } from "../FileScanner";
import type { I18nConfig } from "../../types";

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const rm = promisify(fs.rm);

describe("FileScanner", () => {
  let scanner: FileScanner;
  let testDir: string;
  let originalCwd: string;

  const mockConfig: I18nConfig = {
    rootDir: "test-src",
    languages: ["en", "zh-CN"],
    ignore: ["node_modules", "dist", "*.test.ts"],
    spreadsheetId: "test-sheet-id",
    sheetName: "Translations",
    keyFile: "test-key.json",
    startMarker: "%",
    endMarker: "%",
    include: ["ts", "tsx", "js", "jsx"],
    outputDir: "translations",
  };

  beforeAll(async () => {
    originalCwd = process.cwd();
    testDir = path.join(process.cwd(), "__test_scanner__");
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // 清理之前的测试数据
    try {
      await rm("test-src", { recursive: true, force: true });
    } catch (error) {
      // 忽略错误，目录可能不存在
    }
    scanner = new FileScanner(mockConfig);
  });

  describe("scanFiles", () => {
    it("should scan and return files with correct extensions", async () => {
      // 创建测试文件结构
      await mkdir("test-src", { recursive: true });
      await mkdir("test-src/components", { recursive: true });

      await writeFile("test-src/index.ts", "// ts file");
      await writeFile("test-src/App.tsx", "// tsx file");
      await writeFile("test-src/components/Button.jsx", "// jsx file");
      await writeFile("test-src/components/Header.js", "// js file");
      await writeFile("test-src/README.md", "// md file - should be ignored");
      await writeFile(
        "test-src/config.json",
        "// json file - should be ignored"
      );

      const files = await scanner.scanFiles();

      expect(files).toHaveLength(4);
      expect(files.some((f) => f.endsWith("index.ts"))).toBe(true);
      expect(files.some((f) => f.endsWith("App.tsx"))).toBe(true);
      expect(files.some((f) => f.endsWith("Button.jsx"))).toBe(true);
      expect(files.some((f) => f.endsWith("Header.js"))).toBe(true);
      expect(files.some((f) => f.endsWith("README.md"))).toBe(false);
      expect(files.some((f) => f.endsWith("config.json"))).toBe(false);
    });

    it("should ignore directories specified in ignore list", async () => {
      // 创建被忽略的目录
      await mkdir("test-src", { recursive: true });
      await mkdir("test-src/node_modules", { recursive: true });
      await mkdir("test-src/dist", { recursive: true });
      await mkdir("test-src/components", { recursive: true });

      await writeFile(
        "test-src/node_modules/package.ts",
        "// should be ignored"
      );
      await writeFile("test-src/dist/build.ts", "// should be ignored");
      await writeFile("test-src/components/Valid.ts", "// should be included");

      const files = await scanner.scanFiles();

      expect(files.some((f) => f.includes("node_modules"))).toBe(false);
      expect(files.some((f) => f.includes("dist"))).toBe(false);
      expect(files.some((f) => f.endsWith("Valid.ts"))).toBe(true);
    });

    it("should ignore files matching ignore patterns", async () => {
      await mkdir("test-src", { recursive: true });
      await mkdir("test-src/components", { recursive: true });

      await writeFile("test-src/components/Button.ts", "// should be included");
      await writeFile(
        "test-src/components/Button.test.ts",
        "// should be ignored"
      );

      const files = await scanner.scanFiles();

      // 检查是否包含 Button.ts 但不是 Button.test.ts
      const hasButtonTs = files.some(
        (f) => f.endsWith("Button.ts") && !f.endsWith("Button.test.ts")
      );
      const hasButtonTestTs = files.some((f) => f.endsWith("Button.test.ts"));

      expect(hasButtonTs).toBe(true);
      expect(hasButtonTestTs).toBe(false);
    });

    it("should handle nested directory structures", async () => {
      // 创建深层嵌套结构
      await mkdir("test-src", { recursive: true });
      await mkdir("test-src/components/ui/forms/inputs", { recursive: true });

      await writeFile(
        "test-src/components/ui/forms/inputs/TextInput.tsx",
        "// nested file"
      );
      await writeFile("test-src/components/ui/Button.tsx", "// ui component");
      await writeFile("test-src/components/Layout.tsx", "// layout component");

      const files = await scanner.scanFiles();

      expect(files.some((f) => f.endsWith("TextInput.tsx"))).toBe(true);
      expect(files.some((f) => f.endsWith("Button.tsx"))).toBe(true);
      expect(files.some((f) => f.endsWith("Layout.tsx"))).toBe(true);
    });

    it("should return empty array when no files match criteria", async () => {
      await mkdir("test-src", { recursive: true });
      await mkdir("test-src/empty", { recursive: true });

      // 只创建不匹配的文件
      await writeFile("test-src/empty/style.css", "// css file");
      await writeFile("test-src/empty/config.json", "// json file");

      const files = await scanner.scanFiles();

      expect(files).toHaveLength(0);
    });

    it("should handle empty directories", async () => {
      await mkdir("test-src", { recursive: true });
      await mkdir("test-src/empty-dir", { recursive: true });

      const files = await scanner.scanFiles();

      expect(files).toHaveLength(0);
    });

    it("should handle directory with only ignored subdirectories", async () => {
      await mkdir("test-src", { recursive: true });
      await mkdir("test-src/node_modules/lib", { recursive: true });
      await mkdir("test-src/dist/assets", { recursive: true });

      await writeFile("test-src/node_modules/lib/index.ts", "// ignored");
      await writeFile("test-src/dist/assets/main.js", "// ignored");

      const files = await scanner.scanFiles();

      expect(files).toHaveLength(0);
    });

    it("should handle mixed file extensions in same directory", async () => {
      await mkdir("test-src", { recursive: true });
      await mkdir("test-src/mixed", { recursive: true });

      await writeFile("test-src/mixed/component.tsx", "// should include");
      await writeFile("test-src/mixed/script.js", "// should include");
      await writeFile("test-src/mixed/style.css", "// should ignore");
      await writeFile("test-src/mixed/data.json", "// should ignore");
      await writeFile("test-src/mixed/types.ts", "// should include");

      const files = await scanner.scanFiles();
      const mixedFiles = files.filter((f) => f.includes("mixed"));

      expect(mixedFiles).toHaveLength(3);
      expect(mixedFiles.some((f) => f.endsWith(".tsx"))).toBe(true);
      expect(mixedFiles.some((f) => f.endsWith(".js"))).toBe(true);
      expect(mixedFiles.some((f) => f.endsWith(".ts"))).toBe(true);
      expect(mixedFiles.some((f) => f.endsWith(".css"))).toBe(false);
      expect(mixedFiles.some((f) => f.endsWith(".json"))).toBe(false);
    });
  });
});
