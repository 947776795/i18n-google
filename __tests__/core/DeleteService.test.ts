import { DeleteService } from "../../core/DeleteService";
import { TranslationManager } from "../../core/TranslationManager";
import { UnusedKeyAnalyzer } from "../../core/UnusedKeyAnalyzer";
import { UserInteraction } from "../../ui/UserInteraction";
import type { I18nConfig } from "../../types";
import type { ExistingReference } from "../../core/AstTransformer";
import type { CompleteTranslationRecord } from "../../core/TranslationManager";

// Mock dependencies
jest.mock("../../core/TranslationManager");
jest.mock("../../core/UnusedKeyAnalyzer");
jest.mock("../../ui/UserInteraction");

const mockTranslationManager = TranslationManager as jest.MockedClass<
  typeof TranslationManager
>;
const mockUnusedKeyAnalyzer = UnusedKeyAnalyzer as jest.MockedClass<
  typeof UnusedKeyAnalyzer
>;
const mockUserInteraction = UserInteraction as jest.Mocked<
  typeof UserInteraction
>;

describe("DeleteService", () => {
  let deleteService: DeleteService;
  let mockConfig: I18nConfig;
  let translationManagerInstance: jest.Mocked<TranslationManager>;
  let unusedKeyAnalyzerInstance: jest.Mocked<UnusedKeyAnalyzer>;

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
    };

    // Create mock instances
    translationManagerInstance = {
      loadCompleteRecord: jest.fn(),
      saveCompleteRecord: jest.fn(),
      saveCompleteRecordDirect: jest.fn(),
      mergeWithExistingRecord: jest.fn(),
    } as any;

    unusedKeyAnalyzerInstance = {
      isKeyForceKeptInCompleteRecord: jest.fn(),
    } as any;

    deleteService = new DeleteService(
      mockConfig,
      translationManagerInstance,
      unusedKeyAnalyzerInstance
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("detectUnusedKeysAndGenerateRecord", () => {
    const mockAllReferences = new Map<string, ExistingReference[]>([
      [
        "key1",
        [
          {
            key: "key1",
            filePath: "App.ts",
            lineNumber: 1,
            columnNumber: 1,
            callExpression: "I18n.t('key1')",
          },
        ],
      ],
      [
        "key2",
        [
          {
            key: "key2",
            filePath: "Header.ts",
            lineNumber: 2,
            columnNumber: 1,
            callExpression: "I18n.t('key2')",
          },
        ],
      ],
    ]);

    it("should handle empty existing complete record", async () => {
      translationManagerInstance.loadCompleteRecord.mockResolvedValue(
        {} as any
      );
      translationManagerInstance.saveCompleteRecord.mockResolvedValue(
        undefined
      );
      translationManagerInstance.loadCompleteRecord
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({});

      const result = await deleteService.detectUnusedKeysAndGenerateRecord(
        mockAllReferences
      );

      expect(result.totalUnusedKeys).toBe(0);
      expect(result.processedRecord).toEqual({});
      expect(
        translationManagerInstance.saveCompleteRecord
      ).toHaveBeenCalledWith(mockAllReferences);
    });

    it("should detect and handle unused keys with user confirmation", async () => {
      const existingCompleteRecord: CompleteTranslationRecord = {
        "App.ts": {
          key1: { en: "Hello", zh: "你好" }, // Still used
          key3: { en: "Unused", zh: "未使用" }, // Unused
        },
        "Header.ts": {
          key2: { en: "Header", zh: "标题" }, // Still used
          key4: { en: "Old", zh: "旧的" }, // Unused
        },
      };

      translationManagerInstance.loadCompleteRecord
        .mockResolvedValueOnce(existingCompleteRecord)
        .mockResolvedValueOnce({
          "App.ts": { key1: { en: "Hello", zh: "你好" } },
          "Header.ts": { key2: { en: "Header", zh: "标题" } },
        });

      unusedKeyAnalyzerInstance.isKeyForceKeptInCompleteRecord.mockReturnValue(
        false
      );
      mockUserInteraction.confirmDeletion.mockResolvedValue(true);

      translationManagerInstance.saveCompleteRecordDirect.mockResolvedValue(
        undefined
      );
      translationManagerInstance.mergeWithExistingRecord.mockResolvedValue(
        undefined
      );

      const result = await deleteService.detectUnusedKeysAndGenerateRecord(
        mockAllReferences
      );

      expect(result.totalUnusedKeys).toBe(0); // After deletion
      expect(mockUserInteraction.confirmDeletion).toHaveBeenCalledWith(
        ["[App.ts][key3]", "[Header.ts][key4]"],
        expect.stringMatching(/delete-preview-.*\.json$/)
      );
      expect(
        translationManagerInstance.saveCompleteRecordDirect
      ).toHaveBeenCalled();
      expect(
        translationManagerInstance.mergeWithExistingRecord
      ).toHaveBeenCalledWith(mockAllReferences);
    });

    it("should preserve unused keys when user cancels deletion", async () => {
      const existingCompleteRecord: CompleteTranslationRecord = {
        "App.ts": {
          key1: { en: "Hello", zh: "你好" }, // Still used
          key3: { en: "Unused", zh: "未使用" }, // Unused
        },
      };

      translationManagerInstance.loadCompleteRecord
        .mockResolvedValueOnce(existingCompleteRecord)
        .mockResolvedValueOnce(existingCompleteRecord);

      unusedKeyAnalyzerInstance.isKeyForceKeptInCompleteRecord.mockReturnValue(
        false
      );
      mockUserInteraction.confirmDeletion.mockResolvedValue(false);

      translationManagerInstance.mergeWithExistingRecord.mockResolvedValue(
        undefined
      );

      const result = await deleteService.detectUnusedKeysAndGenerateRecord(
        mockAllReferences
      );

      expect(result.totalUnusedKeys).toBe(1); // Preserved unused key
      expect(
        translationManagerInstance.saveCompleteRecordDirect
      ).not.toHaveBeenCalled();
      expect(
        translationManagerInstance.mergeWithExistingRecord
      ).toHaveBeenCalledWith(mockAllReferences);
    });

    it("should handle force kept keys correctly", async () => {
      const existingCompleteRecord: CompleteTranslationRecord = {
        "App.ts": {
          key1: { en: "Hello", zh: "你好" }, // Still used
          key3: { en: "Force Keep", zh: "强制保留" }, // Unused but force kept
          key4: { en: "Delete", zh: "删除" }, // Unused and deletable
        },
      };

      translationManagerInstance.loadCompleteRecord
        .mockResolvedValueOnce(existingCompleteRecord)
        .mockResolvedValueOnce({
          "App.ts": {
            key1: { en: "Hello", zh: "你好" },
            key3: { en: "Force Keep", zh: "强制保留" }, // Should be preserved
          },
        });

      // Mock force keep for key3
      unusedKeyAnalyzerInstance.isKeyForceKeptInCompleteRecord.mockImplementation(
        (key) => key === "key3"
      );
      mockUserInteraction.confirmDeletion.mockResolvedValue(true);

      translationManagerInstance.saveCompleteRecordDirect.mockResolvedValue(
        undefined
      );
      translationManagerInstance.mergeWithExistingRecord.mockResolvedValue(
        undefined
      );

      const result = await deleteService.detectUnusedKeysAndGenerateRecord(
        mockAllReferences
      );

      expect(result.totalUnusedKeys).toBe(0);
      expect(mockUserInteraction.confirmDeletion).toHaveBeenCalledWith(
        ["[App.ts][key4]"], // Only key4 should be in deletion list
        expect.stringMatching(/delete-preview-.*\.json$/)
      );
    });

    it("should handle no unused keys scenario", async () => {
      const existingCompleteRecord: CompleteTranslationRecord = {
        "App.ts": {
          key1: { en: "Hello", zh: "你好" },
          key2: { en: "World", zh: "世界" },
        },
      };

      translationManagerInstance.loadCompleteRecord
        .mockResolvedValueOnce(existingCompleteRecord)
        .mockResolvedValueOnce(existingCompleteRecord);

      translationManagerInstance.saveCompleteRecord.mockResolvedValue(
        undefined
      );

      const result = await deleteService.detectUnusedKeysAndGenerateRecord(
        mockAllReferences
      );

      expect(result.totalUnusedKeys).toBe(0);
      expect(mockUserInteraction.confirmDeletion).not.toHaveBeenCalled();
      expect(
        translationManagerInstance.saveCompleteRecord
      ).toHaveBeenCalledWith(mockAllReferences);
    });

    it("should handle errors gracefully", async () => {
      translationManagerInstance.loadCompleteRecord.mockRejectedValue(
        new Error("Load failed")
      );
      translationManagerInstance.saveCompleteRecord.mockResolvedValue(
        undefined
      );

      const result = await deleteService.detectUnusedKeysAndGenerateRecord(
        mockAllReferences
      );

      expect(result.totalUnusedKeys).toBe(0);
      expect(result.processedRecord).toEqual({});
      expect(
        translationManagerInstance.saveCompleteRecord
      ).toHaveBeenCalledWith(mockAllReferences);
    });
  });

  describe("cleanupPreviewFiles", () => {
    it("should delegate to preview file service", async () => {
      const previewFilePaths = [
        "/path/to/preview1.json",
        "/path/to/preview2.json",
      ];

      // Since PreviewFileService is created internally, we can't easily mock it
      // But we can test that the method doesn't throw
      await expect(
        deleteService.cleanupPreviewFiles(previewFilePaths)
      ).resolves.not.toThrow();
    });
  });

  describe("analyzeUnusedKeys", () => {
    it("should correctly identify unused keys", async () => {
      const existingCompleteRecord: CompleteTranslationRecord = {
        "App.ts": {
          key1: { en: "Hello", zh: "你好" }, // Used
          key2: { en: "Unused", zh: "未使用" }, // Unused
        },
        "Header.ts": {
          key3: { en: "Header", zh: "标题" }, // Unused
        },
      };

      const allReferences = new Map<string, ExistingReference[]>([
        [
          "key1",
          [
            {
              key: "key1",
              filePath: "App.ts",
              lineNumber: 1,
              columnNumber: 1,
              callExpression: "I18n.t('key1')",
            },
          ],
        ],
      ]);

      translationManagerInstance.loadCompleteRecord.mockResolvedValue(
        existingCompleteRecord
      );
      unusedKeyAnalyzerInstance.isKeyForceKeptInCompleteRecord.mockReturnValue(
        false
      );
      mockUserInteraction.confirmDeletion.mockResolvedValue(false);
      translationManagerInstance.mergeWithExistingRecord.mockResolvedValue(
        undefined
      );
      translationManagerInstance.loadCompleteRecord.mockResolvedValueOnce(
        existingCompleteRecord
      );

      const result = await deleteService.detectUnusedKeysAndGenerateRecord(
        allReferences
      );

      expect(result.totalUnusedKeys).toBe(2); // key2 and key3 are unused
      expect(mockUserInteraction.confirmDeletion).toHaveBeenCalledWith(
        ["[App.ts][key2]", "[Header.ts][key3]"],
        expect.stringMatching(/delete-preview-.*\.json$/)
      );
    });
  });
});
