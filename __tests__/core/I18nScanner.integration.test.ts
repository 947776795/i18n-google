import { I18nScanner } from "../../core/I18nScanner";
import type { I18nConfig } from "../../types";

describe("I18nScanner Integration", () => {
  let scanner: I18nScanner;
  let mockConfig: I18nConfig;

  beforeEach(() => {
    mockConfig = {
      rootDir: "./demo/src",
      outputDir: "./demo/src/translate",
      languages: ["en", "zh", "ja"],
      ignore: ["node_modules", "dist"],
      spreadsheetId: "test-sheet-id",
      sheetName: "Sheet1",
      keyFile: "./credentials.json",
      startMarker: "// START_I18N",
      endMarker: "// END_I18N",
      include: [".ts", ".tsx", ".js", ".jsx"],
      logLevel: "silent",
    };

    scanner = new I18nScanner(mockConfig);
    jest.clearAllMocks();
  });

  describe("responsibility separation", () => {
    it("should not contain path conversion logic", () => {
      expect((scanner as any).convertFilePathToModulePath).toBeUndefined();
    });

    it("should not contain direct deletion logic", () => {
      expect(
        (scanner as any).detectUnusedKeysAndGenerateRecord
      ).toBeUndefined();
    });

    it("should not contain preview file management logic", () => {
      expect((scanner as any).cleanupPreviewFiles).toBeUndefined();
    });

    it("should have proper service delegation", () => {
      expect((scanner as any).deleteService).toBeDefined();
      expect((scanner as any).fileScanner).toBeDefined();
      expect((scanner as any).fileTransformer).toBeDefined();
      expect((scanner as any).translationManager).toBeDefined();
      expect((scanner as any).googleSheetsSync).toBeDefined();
      expect((scanner as any).unusedKeyAnalyzer).toBeDefined();
    });

    it("should use DeleteService for deletion operations", () => {
      const deleteService = (scanner as any).deleteService;
      expect(deleteService).toBeDefined();
      expect(deleteService.detectUnusedKeysAndGenerateRecord).toBeDefined();
      expect(deleteService.cleanupPreviewFiles).toBeDefined();
    });

    it("should maintain single responsibility principle", () => {
      const scannerMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(scanner)
      );
      expect(scannerMethods).toContain("scan");
      expect(scannerMethods).not.toContain("convertFilePathToModulePath");
      expect(scannerMethods).not.toContain("generateDeletePreview");
      expect(scannerMethods).not.toContain("transformSource");
      expect(scannerMethods).not.toContain("syncToGoogleSheets");
    });
  });

  describe("configuration handling", () => {
    it("should properly initialize all services with config", () => {
      expect(() => new I18nScanner(mockConfig)).not.toThrow();
    });

    it("should handle different log levels", () => {
      const configs = [
        { ...mockConfig, logLevel: "silent" as const },
        { ...mockConfig, logLevel: "normal" as const },
        { ...mockConfig, logLevel: "verbose" as const },
      ];

      configs.forEach((config) => {
        expect(() => new I18nScanner(config)).not.toThrow();
      });
    });
  });

  describe("service composition", () => {
    it("should compose all required services", () => {
      const services = [
        "fileScanner",
        "fileTransformer",
        "translationManager",
        "googleSheetsSync",
        "unusedKeyAnalyzer",
        "deleteService",
        "scanProgress",
      ];

      services.forEach((serviceName) => {
        expect((scanner as any)[serviceName]).toBeDefined();
      });
    });

    it("should initialize DeleteService with proper dependencies", () => {
      const deleteService = (scanner as any).deleteService;
      const translationManager = (scanner as any).translationManager;
      const unusedKeyAnalyzer = (scanner as any).unusedKeyAnalyzer;

      expect(deleteService).toBeDefined();
      expect(translationManager).toBeDefined();
      expect(unusedKeyAnalyzer).toBeDefined();

      expect(typeof deleteService.detectUnusedKeysAndGenerateRecord).toBe(
        "function"
      );
      expect(typeof deleteService.cleanupPreviewFiles).toBe("function");
    });
  });
});
