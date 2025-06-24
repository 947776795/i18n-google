import { PreviewFileService } from "../../core/PreviewFileService";
import type { I18nConfig } from "../../types";
import type { CompleteTranslationRecord } from "../../core/TranslationManager";
import fs from "fs/promises";
import path from "path";

// Mock fs
jest.mock("fs/promises", () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));
const mockFs = fs as jest.Mocked<typeof fs>;

describe("PreviewFileService", () => {
  let previewFileService: PreviewFileService;
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
    };

    previewFileService = new PreviewFileService(mockConfig);

    // Reset all mocks
    jest.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
  });

  describe("generateDeletePreviewFromCompleteRecord", () => {
    it("should generate preview file from complete record", async () => {
      const unusedKeys = ["key1", "key2"];
      const completeRecord: CompleteTranslationRecord = {
        "components/Header.ts": {
          key1: { en: "Hello", zh: "你好", ja: "こんにちは" },
          key2: { en: "World", zh: "世界", ja: "世界" },
          key3: { en: "Keep", zh: "保留", ja: "保持" }, // This should not be in preview
        },
        "App.ts": {
          key4: { en: "App", zh: "应用", ja: "アプリ" }, // This should not be in preview
        },
      };

      const result =
        await previewFileService.generateDeletePreviewFromCompleteRecord(
          unusedKeys,
          completeRecord
        );

      // Check that the preview file path is returned
      expect(result).toMatch(/delete-preview-.*\.json$/);

      // Check that mkdir was called
      expect(mockFs.mkdir).toHaveBeenCalledWith(mockConfig.outputDir, {
        recursive: true,
      });

      // Check that writeFile was called
      expect(mockFs.writeFile).toHaveBeenCalledTimes(1);

      // Get the written content
      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1] as string);

      // Verify the preview record contains only unused keys
      expect(writtenContent).toEqual({
        "components/Header.ts": {
          key1: { en: "Hello", zh: "你好", ja: "こんにちは" },
          key2: { en: "World", zh: "世界", ja: "世界" },
        },
      });
    });

    it("should handle empty unused keys", async () => {
      const unusedKeys: string[] = [];
      const completeRecord: CompleteTranslationRecord = {
        "App.ts": {
          key1: { en: "App", zh: "应用", ja: "アプリ" },
        },
      };

      const result =
        await previewFileService.generateDeletePreviewFromCompleteRecord(
          unusedKeys,
          completeRecord
        );

      expect(result).toMatch(/delete-preview-.*\.json$/);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1] as string);

      // Should be empty object
      expect(writtenContent).toEqual({});
    });
  });

  describe("generateDeletePreview", () => {
    it("should generate traditional format preview file", async () => {
      const unusedKeys = ["key1", "key2"];
      const translations = {
        en: {
          key1: "Hello",
          key2: "World",
        },
        zh: {
          key1: "你好",
          key2: "世界",
        },
      };

      const result = await previewFileService.generateDeletePreview(
        unusedKeys,
        translations
      );

      expect(result).toMatch(/delete-preview-.*\.json$/);

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1] as string);

      expect(writtenContent).toMatchObject({
        totalKeysToDelete: 2,
        keysToDelete: [
          {
            key: "key1",
            translations: { en: "Hello", zh: "你好" },
            reason: "未在代码中找到引用",
          },
          {
            key: "key2",
            translations: { en: "World", zh: "世界" },
            reason: "未在代码中找到引用",
          },
        ],
        affectedLanguages: ["en", "zh"],
      });
    });
  });

  describe("cleanupPreviewFiles", () => {
    it("should cleanup specified preview files", async () => {
      const filePaths = ["/path/to/preview1.json", "/path/to/preview2.json"];

      await previewFileService.cleanupPreviewFiles(filePaths);

      expect(mockFs.unlink).toHaveBeenCalledTimes(2);
      expect(mockFs.unlink).toHaveBeenCalledWith("/path/to/preview1.json");
      expect(mockFs.unlink).toHaveBeenCalledWith("/path/to/preview2.json");
    });

    it("should handle empty file paths array", async () => {
      await previewFileService.cleanupPreviewFiles([]);

      expect(mockFs.unlink).not.toHaveBeenCalled();
    });

    it("should continue cleanup even if some files fail to delete", async () => {
      const filePaths = [
        "/path/to/preview1.json",
        "/path/to/preview2.json",
        "/path/to/preview3.json",
      ];

      // Mock one file deletion to fail
      mockFs.unlink
        .mockResolvedValueOnce(undefined) // First file succeeds
        .mockRejectedValueOnce(new Error("File not found")) // Second file fails
        .mockResolvedValueOnce(undefined); // Third file succeeds

      await previewFileService.cleanupPreviewFiles(filePaths);

      expect(mockFs.unlink).toHaveBeenCalledTimes(3);
    });
  });

  describe("private methods behavior", () => {
    it("should build correct preview record structure", async () => {
      const unusedKeys = ["key1"];
      const completeRecord: CompleteTranslationRecord = {
        "components/Header.ts": {
          key1: { en: "Hello", zh: "你好" },
          key2: { en: "Keep", zh: "保留" }, // Should not be included
        },
        "App.ts": {
          key3: { en: "App", zh: "应用" }, // Should not be included
        },
      };

      await previewFileService.generateDeletePreviewFromCompleteRecord(
        unusedKeys,
        completeRecord
      );

      const writeCall = mockFs.writeFile.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1] as string);

      // Only modules with unused keys should be included
      expect(Object.keys(writtenContent)).toEqual(["components/Header.ts"]);
      expect(writtenContent["components/Header.ts"]).toEqual({
        key1: { en: "Hello", zh: "你好" },
      });
    });

    it("should generate correct timestamp format in filename", async () => {
      const unusedKeys = ["key1"];
      const completeRecord: CompleteTranslationRecord = {};

      const result =
        await previewFileService.generateDeletePreviewFromCompleteRecord(
          unusedKeys,
          completeRecord
        );

      // Check filename format: delete-preview-{timestamp}.json
      const filename = path.basename(result);
      expect(filename).toMatch(
        /^delete-preview-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/
      );
    });
  });
});
