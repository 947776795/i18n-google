// Test for unused key deletion and Google Sheets sync workflow todo 目前此测试用例跑不通
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock("../src/utils/StringUtils", () => ({
  Logger: mockLogger,
}));

// Mock UserInteraction
const mockSelectKeysForDeletion = jest.fn();
const mockConfirmDeletion = jest.fn();
const mockConfirmRemoteSync = jest.fn();

jest.mock("../src/ui/UserInteraction", () => ({
  UserInteraction: {
    selectKeysForDeletion: mockSelectKeysForDeletion,
    confirmDeletion: mockConfirmDeletion,
    confirmRemoteSync: mockConfirmRemoteSync,
  },
}));

// Mock googleapis
const mockUpdate = jest.fn();
const mockGet = jest.fn();

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
          update: mockUpdate,
          get: mockGet,
        },
      },
    })),
  },
}));

// Mock fs
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();
const mockMkdir = jest.fn();
const mockAccess = jest.fn();
const mockUnlink = jest.fn();

jest.mock("fs", () => ({
  promises: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
    access: mockAccess,
    unlink: mockUnlink,
  },
  constants: {
    F_OK: 0,
  },
}));

import { DeleteService } from "../src/core/DeleteService";
import { TranslationManager } from "../src/core/TranslationManager";
import { GoogleSheetsSync } from "../src/core/GoogleSheetsSync";
import { PreviewFileService } from "../src/core/PreviewFileService";
import type { I18nConfig } from "../src/types";
import type { ExistingReference } from "../src/core/AstTransformer";
import type { CompleteTranslationRecord } from "../src/core/TranslationManager";

describe("Unused Key Deletion and Sync Workflow", () => {
  let deleteService: DeleteService;
  let translationManager: TranslationManager;
  let googleSheetsSync: GoogleSheetsSync;
  let previewFileService: PreviewFileService;
  let mockConfig: I18nConfig;

  const existingCompleteRecord: CompleteTranslationRecord = {
    "components/Header.ts": {
      Hello: {
        en: "Hello",
        zh: "你好",
        ja: "こんにちは",
        mark: 1,
      } as any,
      UnusedKey1: {
        en: "Unused Key 1",
        zh: "未使用键1",
        ja: "未使用キー1",
        mark: 0,
      } as any,
      UnusedKey2: {
        en: "Unused Key 2",
        zh: "未使用键2",
        ja: "未使用キー2",
        mark: 0,
      } as any,
    },
    "components/Footer.ts": {
      Copyright: {
        en: "Copyright",
        zh: "版权",
        ja: "著作権",
        mark: 1,
      } as any,
      UnusedKey3: {
        en: "Unused Key 3",
        zh: "未使用键3",
        ja: "未使用キー3",
        mark: 0,
      } as any,
    },
    "pages/Home.ts": {
      UnusedKey4: {
        en: "Unused Key 4",
        zh: "未使用键4",
        ja: "未使用キー4",
        mark: 0,
      } as any,
      UnusedKey5: {
        en: "Unused Key 5",
        zh: "未使用键5",
        ja: "未使用キー5",
        mark: 0,
      } as any,
    },
  };

  // Current references (only used keys)
  const currentReferences = new Map<string, ExistingReference[]>([
    [
      "Hello",
      [
        {
          key: "Hello",
          filePath: "src/components/Header.tsx",
          lineNumber: 5,
          columnNumber: 10,
          callExpression: "I18n.t('Hello')",
        },
      ],
    ],
    [
      "Copyright",
      [
        {
          key: "Copyright",
          filePath: "src/components/Footer.tsx",
          lineNumber: 8,
          columnNumber: 15,
          callExpression: "I18n.t('Copyright')",
        },
      ],
    ],
  ]);

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      rootDir: "/test-root",
      spreadsheetId: "test-spreadsheet-id",
      sheetName: "test-sheet",
      languages: ["en", "zh", "ja"],
      sheetsReadRange: "A1:Z10000",
      sheetsMaxRows: 10000,
      outputDir: "test-output",
      ignore: [],
      keyFile: "test-key.json",
      startMarker: "{t('",
      endMarker: "')}",
      include: [".ts", ".tsx"],
      apiKey: "test-api-key",
    };

    translationManager = new TranslationManager(mockConfig);
    googleSheetsSync = new GoogleSheetsSync(mockConfig);
    previewFileService = new PreviewFileService(mockConfig);
    deleteService = new DeleteService(mockConfig, translationManager);

    // Reset all mocks to default values before each test
    mockSelectKeysForDeletion.mockReset();
    mockConfirmDeletion.mockReset();
    mockConfirmRemoteSync.mockReset();

    // Set default mock values to prevent hanging
    mockSelectKeysForDeletion.mockResolvedValue([]);
    mockConfirmDeletion.mockResolvedValue(false);
    mockConfirmRemoteSync.mockResolvedValue(false);

    // Setup default mock responses
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("i18n-complete-record.json")) {
        return Promise.resolve(JSON.stringify(existingCompleteRecord));
      }
      if (filePath.includes("delete-preview")) {
        // Mock preview file content with unused keys to delete
        const previewRecord = {
          "components/Header.ts": {
            UnusedKey1:
              existingCompleteRecord["components/Header.ts"].UnusedKey1,
            UnusedKey2:
              existingCompleteRecord["components/Header.ts"].UnusedKey2,
          },
          "components/Footer.ts": {
            UnusedKey3:
              existingCompleteRecord["components/Footer.ts"].UnusedKey3,
          },
          "pages/Home.ts": {
            UnusedKey4: existingCompleteRecord["pages/Home.ts"].UnusedKey4,
            UnusedKey5: existingCompleteRecord["pages/Home.ts"].UnusedKey5,
          },
        };
        return Promise.resolve(JSON.stringify(previewRecord));
      }
      return Promise.resolve("{}");
    });

    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);

    // Mock Google Sheets responses
    mockGet.mockResolvedValue({
      data: { values: [["key", "en", "zh", "ja", "mark"]] },
    });
    mockUpdate.mockResolvedValue({ data: {} });
  });

  describe("Complete Unused Key Deletion and Sync Workflow", () => {
    it("should detect unused keys, allow user to select all for deletion, and verify deleted keys don't sync to remote", async () => {
      // Mock user interactions: select all keys for deletion and confirm deletion
      const expectedUnusedKeys = [
        "[components/Header.ts][UnusedKey1]",
        "[components/Header.ts][UnusedKey2]",
        "[components/Footer.ts][UnusedKey3]",
        "[pages/Home.ts][UnusedKey4]",
        "[pages/Home.ts][UnusedKey5]",
      ];

      // Set specific mock values for this test
      mockSelectKeysForDeletion.mockResolvedValue(expectedUnusedKeys);
      mockConfirmDeletion.mockResolvedValue(true);
      mockConfirmRemoteSync.mockResolvedValue(true);

      try {
        // Execute the deletion workflow
        const result = await deleteService.detectUnusedKeysAndGenerateRecord(
          currentReferences
        );

        // Verify user was prompted with correct unused keys
        expect(mockSelectKeysForDeletion).toHaveBeenCalledWith(
          expectedUnusedKeys
        );
        expect(mockConfirmDeletion).toHaveBeenCalled();

        // Verify that processedRecord doesn't contain the unused keys
        expect(result.processedRecord).toBeDefined();
        expect(result.totalUnusedKeys).toBe(0); // Should be 0 after deletion
        expect(result.previewFilePath).toBeDefined();

        // Verify the final record structure (should only contain used keys)
        const finalRecord = result.processedRecord;
        expect(finalRecord["components/Header.ts"]).toEqual({
          Hello: existingCompleteRecord["components/Header.ts"].Hello,
        });
        expect(finalRecord["components/Footer.ts"]).toEqual({
          Copyright: existingCompleteRecord["components/Footer.ts"].Copyright,
        });
        expect(finalRecord["pages/Home.ts"]).toBeUndefined(); // Should be completely removed as all keys were unused

        // Now test the Google Sheets sync
        await googleSheetsSync.syncCompleteRecordToSheet(finalRecord, []);

        // Verify that the data sent to Google Sheets doesn't contain deleted keys
        expect(mockUpdate).toHaveBeenCalled();
        const syncedData = mockUpdate.mock.calls[0][0].resource.values;

        // Extract the key column (first column) from synced data, excluding header
        const syncedKeys = syncedData
          .slice(1)
          .map((row: string[]) => row[0])
          .filter((key: string) => key && key.trim() !== "");

        // Verify that none of the deleted keys are in the synced data
        const deletedKeyNames = [
          "UnusedKey1",
          "UnusedKey2",
          "UnusedKey3",
          "UnusedKey4",
          "UnusedKey5",
        ];
        deletedKeyNames.forEach((deletedKey) => {
          expect(syncedKeys).not.toContain(expect.stringContaining(deletedKey));
        });

        // Verify that used keys are still in the synced data
        expect(syncedKeys).toEqual(
          expect.arrayContaining([expect.stringContaining("Hello")])
        );
        expect(syncedKeys).toEqual(
          expect.arrayContaining([expect.stringContaining("Copyright")])
        );
      } catch (error) {
        console.error("Test failed with error:", error);
        throw error;
      }
    }, 10000); // 10 second timeout

    it("should handle user selecting partial deletion", async () => {
      // User selects only some keys for deletion
      const selectedKeysForDeletion = [
        "[components/Header.ts][UnusedKey1]",
        "[pages/Home.ts][UnusedKey4]",
      ];

      // Set specific mock values for this test
      mockSelectKeysForDeletion.mockResolvedValue(selectedKeysForDeletion);
      mockConfirmDeletion.mockResolvedValue(true);
      mockConfirmRemoteSync.mockResolvedValue(true);

      try {
        const result = await deleteService.detectUnusedKeysAndGenerateRecord(
          currentReferences
        );

        // Verify user was prompted with all unused keys
        const allUnusedKeys = [
          "[components/Header.ts][UnusedKey1]",
          "[components/Header.ts][UnusedKey2]",
          "[components/Footer.ts][UnusedKey3]",
          "[pages/Home.ts][UnusedKey4]",
          "[pages/Home.ts][UnusedKey5]",
        ];
        expect(mockSelectKeysForDeletion).toHaveBeenCalledWith(allUnusedKeys);
        expect(mockConfirmDeletion).toHaveBeenCalled();

        // Verify the final record structure
        const finalRecord = result.processedRecord;
        expect(finalRecord["components/Header.ts"]).toEqual({
          Hello: existingCompleteRecord["components/Header.ts"].Hello,
          // UnusedKey2 should still be present as it wasn't selected for deletion
          UnusedKey2: existingCompleteRecord["components/Header.ts"].UnusedKey2,
        });
        expect(finalRecord["components/Footer.ts"]).toEqual({
          Copyright: existingCompleteRecord["components/Footer.ts"].Copyright,
          // UnusedKey3 should still be present as it wasn't selected for deletion
          UnusedKey3: existingCompleteRecord["components/Footer.ts"].UnusedKey3,
        });
        expect(finalRecord["pages/Home.ts"]).toEqual({
          // UnusedKey5 should still be present as it wasn't selected for deletion
          UnusedKey5: existingCompleteRecord["pages/Home.ts"].UnusedKey5,
        });

        // Verify that only selected keys were deleted
        expect(
          finalRecord["components/Header.ts"]["UnusedKey1"]
        ).toBeUndefined();
        expect(finalRecord["pages/Home.ts"]["UnusedKey4"]).toBeUndefined();

        // Test Google Sheets sync
        await googleSheetsSync.syncCompleteRecordToSheet(finalRecord, []);

        expect(mockUpdate).toHaveBeenCalled();
        const syncedData = mockUpdate.mock.calls[0][0].resource.values;
        const syncedKeys = syncedData
          .slice(1)
          .map((row: string[]) => row[0])
          .filter((key: string) => key && key.trim() !== "");

        // Verify that only the selected keys were removed from sync
        expect(syncedKeys).not.toContain(expect.stringContaining("UnusedKey1"));
        expect(syncedKeys).not.toContain(expect.stringContaining("UnusedKey4"));

        // Verify that non-selected unused keys are still present
        expect(syncedKeys).toEqual(
          expect.arrayContaining([expect.stringContaining("UnusedKey2")])
        );
        expect(syncedKeys).toEqual(
          expect.arrayContaining([expect.stringContaining("UnusedKey3")])
        );
        expect(syncedKeys).toEqual(
          expect.arrayContaining([expect.stringContaining("UnusedKey5")])
        );
      } catch (error) {
        console.error("Test failed with error:", error);
        throw error;
      }
    }, 10000);

    it("should handle user canceling deletion", async () => {
      const allUnusedKeys = [
        "[components/Header.ts][UnusedKey1]",
        "[components/Header.ts][UnusedKey2]",
        "[components/Footer.ts][UnusedKey3]",
        "[pages/Home.ts][UnusedKey4]",
        "[pages/Home.ts][UnusedKey5]",
      ];

      // Set specific mock values for this test
      mockSelectKeysForDeletion.mockResolvedValue(allUnusedKeys);
      mockConfirmDeletion.mockResolvedValue(false); // User cancels deletion
      mockConfirmRemoteSync.mockResolvedValue(true);

      try {
        const result = await deleteService.detectUnusedKeysAndGenerateRecord(
          currentReferences
        );

        expect(mockSelectKeysForDeletion).toHaveBeenCalledWith(allUnusedKeys);
        expect(mockConfirmDeletion).toHaveBeenCalled();

        // Since user canceled deletion, all keys should still be present
        const finalRecord = result.processedRecord;
        expect(finalRecord["components/Header.ts"]).toEqual(
          existingCompleteRecord["components/Header.ts"]
        );
        expect(finalRecord["components/Footer.ts"]).toEqual(
          existingCompleteRecord["components/Footer.ts"]
        );
        expect(finalRecord["pages/Home.ts"]).toEqual(
          existingCompleteRecord["pages/Home.ts"]
        );

        // Verify that totalUnusedKeys reflects the canceled deletion
        expect(result.totalUnusedKeys).toBe(allUnusedKeys.length);
        expect(result.deletedKeys).toEqual([]);

        // Test Google Sheets sync - should include all keys
        await googleSheetsSync.syncCompleteRecordToSheet(finalRecord, []);

        expect(mockUpdate).toHaveBeenCalled();
        const syncedData = mockUpdate.mock.calls[0][0].resource.values;
        const syncedKeys = syncedData
          .slice(1)
          .map((row: string[]) => row[0])
          .filter((key: string) => key && key.trim() !== "");

        // All keys should still be present in the sync
        expect(syncedKeys).toEqual(
          expect.arrayContaining([expect.stringContaining("Hello")])
        );
        expect(syncedKeys).toEqual(
          expect.arrayContaining([expect.stringContaining("Copyright")])
        );
        expect(syncedKeys).toEqual(
          expect.arrayContaining([expect.stringContaining("UnusedKey1")])
        );
        expect(syncedKeys).toEqual(
          expect.arrayContaining([expect.stringContaining("UnusedKey2")])
        );
        expect(syncedKeys).toEqual(
          expect.arrayContaining([expect.stringContaining("UnusedKey3")])
        );
        expect(syncedKeys).toEqual(
          expect.arrayContaining([expect.stringContaining("UnusedKey4")])
        );
        expect(syncedKeys).toEqual(
          expect.arrayContaining([expect.stringContaining("UnusedKey5")])
        );
      } catch (error) {
        console.error("Test failed with error:", error);
        throw error;
      }
    }, 10000);

    it("should handle user skipping deletion entirely", async () => {
      const allUnusedKeys = [
        "[components/Header.ts][UnusedKey1]",
        "[components/Header.ts][UnusedKey2]",
        "[components/Footer.ts][UnusedKey3]",
        "[pages/Home.ts][UnusedKey4]",
        "[pages/Home.ts][UnusedKey5]",
      ];

      // Set specific mock values for this test - user selects no keys
      mockSelectKeysForDeletion.mockResolvedValue([]); // User selects nothing
      mockConfirmDeletion.mockResolvedValue(false);
      mockConfirmRemoteSync.mockResolvedValue(true);

      try {
        const result = await deleteService.detectUnusedKeysAndGenerateRecord(
          currentReferences
        );

        expect(mockSelectKeysForDeletion).toHaveBeenCalledWith(allUnusedKeys);
        // confirmDeletion should not be called since no keys were selected
        expect(mockConfirmDeletion).not.toHaveBeenCalled();

        // Since no keys were selected for deletion, all should remain
        expect(result.totalUnusedKeys).toBe(allUnusedKeys.length);
        expect(result.deletedKeys).toEqual([]);

        const finalRecord = result.processedRecord;
        expect(finalRecord["components/Header.ts"]).toEqual(
          existingCompleteRecord["components/Header.ts"]
        );
        expect(finalRecord["components/Footer.ts"]).toEqual(
          existingCompleteRecord["components/Footer.ts"]
        );
        expect(finalRecord["pages/Home.ts"]).toEqual(
          existingCompleteRecord["pages/Home.ts"]
        );
      } catch (error) {
        console.error("Test failed with error:", error);
        throw error;
      }
    }, 10000);

    it("should handle no unused keys scenario", async () => {
      // All keys are currently in use
      const allUsedReferences = new Map<string, ExistingReference[]>([
        [
          "Hello",
          [
            {
              key: "Hello",
              filePath: "src/components/Header.tsx",
              lineNumber: 5,
              columnNumber: 10,
              callExpression: "I18n.t('Hello')",
            },
          ],
        ],
        [
          "Copyright",
          [
            {
              key: "Copyright",
              filePath: "src/components/Footer.tsx",
              lineNumber: 8,
              columnNumber: 15,
              callExpression: "I18n.t('Copyright')",
            },
          ],
        ],
        // Include all previously "unused" keys as used
        [
          "UnusedKey1",
          [
            {
              key: "UnusedKey1",
              filePath: "src/test.tsx",
              lineNumber: 1,
              columnNumber: 1,
              callExpression: "I18n.t('UnusedKey1')",
            },
          ],
        ],
        [
          "UnusedKey2",
          [
            {
              key: "UnusedKey2",
              filePath: "src/test.tsx",
              lineNumber: 2,
              columnNumber: 1,
              callExpression: "I18n.t('UnusedKey2')",
            },
          ],
        ],
        [
          "UnusedKey3",
          [
            {
              key: "UnusedKey3",
              filePath: "src/test.tsx",
              lineNumber: 3,
              columnNumber: 1,
              callExpression: "I18n.t('UnusedKey3')",
            },
          ],
        ],
        [
          "UnusedKey4",
          [
            {
              key: "UnusedKey4",
              filePath: "src/test.tsx",
              lineNumber: 4,
              columnNumber: 1,
              callExpression: "I18n.t('UnusedKey4')",
            },
          ],
        ],
        [
          "UnusedKey5",
          [
            {
              key: "UnusedKey5",
              filePath: "src/test.tsx",
              lineNumber: 5,
              columnNumber: 1,
              callExpression: "I18n.t('UnusedKey5')",
            },
          ],
        ],
      ]);

      try {
        const result = await deleteService.detectUnusedKeysAndGenerateRecord(
          allUsedReferences
        );

        // No user interaction should occur since there are no unused keys
        expect(mockSelectKeysForDeletion).not.toHaveBeenCalled();
        expect(mockConfirmDeletion).not.toHaveBeenCalled();

        expect(result.totalUnusedKeys).toBe(0);
        expect(result.deletedKeys).toEqual([]);

        // All keys should be preserved in the final record
        const finalRecord = result.processedRecord;
        expect(Object.keys(finalRecord)).toContain("components/Header.ts");
        expect(Object.keys(finalRecord)).toContain("components/Footer.ts");
        expect(Object.keys(finalRecord)).toContain("pages/Home.ts");
      } catch (error) {
        console.error("Test failed with error:", error);
        throw error;
      }
    }, 10000);
  });
});
