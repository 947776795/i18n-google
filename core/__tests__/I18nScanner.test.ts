import {
  describe,
  expect,
  it,
  beforeEach,
  afterAll,
  jest,
} from "@jest/globals";
import { I18nScanner } from "../I18nScanner";
import type { I18nConfig } from "../../types";

// Mock all dependencies
jest.mock("../FileScanner");
jest.mock("../AstTransformer");
jest.mock("../TranslationManager");
jest.mock("../GoogleSheetsSync");

import { FileScanner } from "../FileScanner";
import { AstTransformer } from "../AstTransformer";
import { TranslationManager } from "../TranslationManager";
import { GoogleSheetsSync } from "../GoogleSheetsSync";

// Create typed mocks
const MockFileScanner = FileScanner as jest.MockedClass<typeof FileScanner>;
const MockAstTransformer = AstTransformer as jest.MockedClass<
  typeof AstTransformer
>;
const MockTranslationManager = TranslationManager as jest.MockedClass<
  typeof TranslationManager
>;
const MockGoogleSheetsSync = GoogleSheetsSync as jest.MockedClass<
  typeof GoogleSheetsSync
>;

describe("I18nScanner", () => {
  let scanner: I18nScanner;
  let mockFileScanner: any;
  let mockAstTransformer: any;
  let mockTranslationManager: any;
  let mockGoogleSheetsSync: any;
  const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

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

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockClear();

    // Create mock instances with proper typing
    mockFileScanner = {
      scanFiles: jest.fn(),
    };

    mockAstTransformer = {
      transformFile: jest.fn(),
    };

    mockTranslationManager = {
      initialize: jest.fn(),
      addTranslation: jest.fn(),
      getTranslations: jest.fn(),
      updateTranslations: jest.fn(),
      saveTranslations: jest.fn(),
    };

    mockGoogleSheetsSync = {
      syncFromSheet: jest.fn(),
      syncToSheet: jest.fn(),
    };

    // Setup constructor mocks
    MockFileScanner.mockImplementation(() => mockFileScanner);
    MockAstTransformer.mockImplementation(() => mockAstTransformer);
    MockTranslationManager.mockImplementation(() => mockTranslationManager);
    MockGoogleSheetsSync.mockImplementation(() => mockGoogleSheetsSync);

    scanner = new I18nScanner(mockConfig);
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe("constructor", () => {
    it("should initialize all dependencies with config", () => {
      expect(FileScanner).toHaveBeenCalledWith(mockConfig);
      expect(AstTransformer).toHaveBeenCalledWith(mockConfig);
      expect(TranslationManager).toHaveBeenCalledWith(mockConfig);
      expect(GoogleSheetsSync).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe("scan", () => {
    it("should execute complete scanning workflow successfully", async () => {
      // Setup mocks
      const mockFiles = ["src/App.tsx", "src/components/Button.tsx"];
      const mockTransformResults = [
        [{ key: "hello", text: "Hello" }],
        [{ key: "world", text: "World" }],
      ];
      const mockRemoteTranslations = {
        en: { hello: "Hello", remote: "Remote" },
        "zh-CN": { hello: "你好", remote: "远程" },
      };
      const mockFinalTranslations = {
        en: { hello: "Hello", world: "World", remote: "Remote" },
        "zh-CN": { hello: "你好", world: "世界", remote: "远程" },
      };

      mockFileScanner.scanFiles.mockResolvedValue(mockFiles);
      mockAstTransformer.transformFile
        .mockResolvedValueOnce(mockTransformResults[0])
        .mockResolvedValueOnce(mockTransformResults[1]);
      mockGoogleSheetsSync.syncFromSheet.mockResolvedValue(
        mockRemoteTranslations
      );
      mockTranslationManager.getTranslations.mockReturnValue(
        mockFinalTranslations
      );

      // Execute
      await scanner.scan();

      // Verify workflow execution order
      expect(mockTranslationManager.initialize).toHaveBeenCalledTimes(1);
      expect(mockFileScanner.scanFiles).toHaveBeenCalledTimes(1);
      expect(mockAstTransformer.transformFile).toHaveBeenCalledTimes(2);
      expect(mockAstTransformer.transformFile).toHaveBeenCalledWith(
        "src/App.tsx"
      );
      expect(mockAstTransformer.transformFile).toHaveBeenCalledWith(
        "src/components/Button.tsx"
      );

      // Verify translations are added
      expect(mockTranslationManager.addTranslation).toHaveBeenCalledTimes(2);
      expect(mockTranslationManager.addTranslation).toHaveBeenCalledWith({
        key: "hello",
        text: "Hello",
      });
      expect(mockTranslationManager.addTranslation).toHaveBeenCalledWith({
        key: "world",
        text: "World",
      });

      // Verify remote sync
      expect(mockGoogleSheetsSync.syncFromSheet).toHaveBeenCalledTimes(1);
      expect(mockTranslationManager.updateTranslations).toHaveBeenCalledWith(
        mockRemoteTranslations
      );

      // Verify save and upload
      expect(mockTranslationManager.saveTranslations).toHaveBeenCalledTimes(1);
      expect(mockGoogleSheetsSync.syncToSheet).toHaveBeenCalledWith(
        mockFinalTranslations
      );
    });

    it("should handle files with no translations", async () => {
      const mockFiles = ["src/utils.ts", "src/types.ts"];

      mockFileScanner.scanFiles.mockResolvedValue(mockFiles);
      mockAstTransformer.transformFile.mockResolvedValue([]); // No translations found
      mockGoogleSheetsSync.syncFromSheet.mockResolvedValue({});
      mockTranslationManager.getTranslations.mockReturnValue({});

      await scanner.scan();

      expect(mockAstTransformer.transformFile).toHaveBeenCalledTimes(2);
      expect(mockTranslationManager.addTranslation).not.toHaveBeenCalled();
      expect(mockTranslationManager.saveTranslations).toHaveBeenCalledTimes(1);
    });

    it("should handle empty file list", async () => {
      mockFileScanner.scanFiles.mockResolvedValue([]);
      mockGoogleSheetsSync.syncFromSheet.mockResolvedValue({});
      mockTranslationManager.getTranslations.mockReturnValue({});

      await scanner.scan();

      expect(mockAstTransformer.transformFile).not.toHaveBeenCalled();
      expect(mockTranslationManager.addTranslation).not.toHaveBeenCalled();
      expect(mockTranslationManager.saveTranslations).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple translations from single file", async () => {
      const mockFiles = ["src/MultiTranslation.tsx"];
      const mockTransformResults = [
        { key: "title", text: "Title" },
        { key: "subtitle", text: "Subtitle" },
        { key: "description", text: "Description" },
      ];

      mockFileScanner.scanFiles.mockResolvedValue(mockFiles);
      mockAstTransformer.transformFile.mockResolvedValue(mockTransformResults);
      mockGoogleSheetsSync.syncFromSheet.mockResolvedValue({});
      mockTranslationManager.getTranslations.mockReturnValue({});

      await scanner.scan();

      expect(mockTranslationManager.addTranslation).toHaveBeenCalledTimes(3);
      expect(mockTranslationManager.addTranslation).toHaveBeenCalledWith({
        key: "title",
        text: "Title",
      });
      expect(mockTranslationManager.addTranslation).toHaveBeenCalledWith({
        key: "subtitle",
        text: "Subtitle",
      });
      expect(mockTranslationManager.addTranslation).toHaveBeenCalledWith({
        key: "description",
        text: "Description",
      });
    });

    describe("error handling", () => {
      it("should handle FileScanner errors", async () => {
        const error = new Error("File scanning failed");
        mockFileScanner.scanFiles.mockRejectedValue(error);

        await expect(scanner.scan()).rejects.toThrow("File scanning failed");
        expect(consoleSpy).toHaveBeenCalledWith("扫描过程中发生错误:", error);
      });

      it("should handle AstTransformer errors", async () => {
        const mockFiles = ["src/BadFile.tsx"];
        const error = new Error("AST transformation failed");

        mockFileScanner.scanFiles.mockResolvedValue(mockFiles);
        mockAstTransformer.transformFile.mockRejectedValue(error);

        await expect(scanner.scan()).rejects.toThrow(
          "AST transformation failed"
        );
        expect(consoleSpy).toHaveBeenCalledWith("扫描过程中发生错误:", error);
      });

      it("should handle TranslationManager initialization errors", async () => {
        const error = new Error("Translation manager init failed");
        mockTranslationManager.initialize.mockRejectedValue(error);

        await expect(scanner.scan()).rejects.toThrow(
          "Translation manager init failed"
        );
        expect(consoleSpy).toHaveBeenCalledWith("扫描过程中发生错误:", error);
      });

      it("should handle GoogleSheetsSync errors during sync from sheet", async () => {
        const mockFiles = ["src/App.tsx"];
        const error = new Error("Google Sheets sync failed");

        mockFileScanner.scanFiles.mockResolvedValue(mockFiles);
        mockAstTransformer.transformFile.mockResolvedValue([]);
        mockGoogleSheetsSync.syncFromSheet.mockRejectedValue(error);

        await expect(scanner.scan()).rejects.toThrow(
          "Google Sheets sync failed"
        );
        expect(consoleSpy).toHaveBeenCalledWith("扫描过程中发生错误:", error);
      });

      it("should handle TranslationManager save errors", async () => {
        const mockFiles = ["src/App.tsx"];
        const error = new Error("Save translations failed");

        mockFileScanner.scanFiles.mockResolvedValue(mockFiles);
        mockAstTransformer.transformFile.mockResolvedValue([]);
        mockGoogleSheetsSync.syncFromSheet.mockResolvedValue({});
        mockTranslationManager.saveTranslations.mockRejectedValue(error);

        await expect(scanner.scan()).rejects.toThrow(
          "Save translations failed"
        );
        expect(consoleSpy).toHaveBeenCalledWith("扫描过程中发生错误:", error);
      });

      it("should handle GoogleSheetsSync errors during sync to sheet", async () => {
        const mockFiles = ["src/App.tsx"];
        const error = new Error("Google Sheets upload failed");

        mockFileScanner.scanFiles.mockResolvedValue(mockFiles);
        mockAstTransformer.transformFile.mockResolvedValue([]);
        mockGoogleSheetsSync.syncFromSheet.mockResolvedValue({});
        mockTranslationManager.getTranslations.mockReturnValue({});
        mockGoogleSheetsSync.syncToSheet.mockRejectedValue(error);

        await expect(scanner.scan()).rejects.toThrow(
          "Google Sheets upload failed"
        );
        expect(consoleSpy).toHaveBeenCalledWith("扫描过程中发生错误:", error);
      });
    });
  });
});
