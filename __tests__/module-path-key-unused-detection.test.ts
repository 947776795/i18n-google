// Validate unused key detection works at (modulePath, key) granularity

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

// Mock googleapis to avoid loading native modules
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
          update: jest.fn(),
          get: jest.fn(),
        },
      },
    })),
  },
}));

import { DeleteService } from "../src/core/DeleteService";
import { TranslationManager } from "../src/core/TranslationManager";
import { PreviewFileService } from "../src/core/PreviewFileService";
import type { I18nConfig } from "../src/types";
import type { ExistingReference } from "../src/core/AstTransformer";
import type { CompleteTranslationRecord } from "../src/core/TranslationManager";

describe("ModulePath+Key unused detection", () => {
  let deleteService: DeleteService;
  let translationManager: TranslationManager;
  let previewFileService: PreviewFileService;
  let mockConfig: I18nConfig;

  const existingCompleteRecord: CompleteTranslationRecord = {
    "components/A.ts": {
      SharedKey: { en: "SharedKey", zh: "共享", mark: 0 } as any,
      OnlyInA: { en: "OnlyInA", zh: "仅A", mark: 0 } as any,
    },
    "components/B.ts": {
      SharedKey: { en: "SharedKey", zh: "共享", mark: 0 } as any,
      OnlyInB: { en: "OnlyInB", zh: "仅B", mark: 0 } as any,
    },
  };

  // current references: SharedKey only used in B; OnlyInB used; A's SharedKey and OnlyInA are unused
  const currentReferences = new Map<string, ExistingReference[]>([
    [
      "SharedKey",
      [
        {
          key: "SharedKey",
          filePath: "/proj/src/components/B.tsx",
          lineNumber: 5,
          columnNumber: 10,
          callExpression: "I18n.t('SharedKey')",
        },
      ],
    ],
    [
      "OnlyInB",
      [
        {
          key: "OnlyInB",
          filePath: "/proj/src/components/B.tsx",
          lineNumber: 6,
          columnNumber: 10,
          callExpression: "I18n.t('OnlyInB')",
        },
      ],
    ],
  ]);

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      rootDir: "/proj/src",
      spreadsheetId: "test-spreadsheet-id",
      sheetName: "test-sheet",
      languages: ["en", "zh"],
      sheetsReadRange: "A1:Z10000",
      sheetsMaxRows: 10000,
      outputDir: "test-output",
      ignore: [],
      keyFile: "test-key.json",
      startMarker: "{t('",
      endMarker: "')}",
      include: [".ts", ".tsx"],
      apiKey: "test-api-key",
    } as any;

    translationManager = new TranslationManager(mockConfig);
    previewFileService = new PreviewFileService(mockConfig);
    deleteService = new DeleteService(mockConfig, translationManager);

    mockSelectKeysForDeletion.mockReset();
    mockConfirmDeletion.mockReset();
    mockConfirmRemoteSync.mockReset();

    mockSelectKeysForDeletion.mockResolvedValue([]);
    mockConfirmDeletion.mockResolvedValue(false);
    mockConfirmRemoteSync.mockResolvedValue(false);

    // fs mocks
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.includes("i18n-complete-record.json")) {
        return Promise.resolve(JSON.stringify(existingCompleteRecord));
      }
      if (filePath.includes("delete-preview")) {
        const previewRecord = {
          "components/A.ts": {
            SharedKey: existingCompleteRecord["components/A.ts"].SharedKey,
            OnlyInA: existingCompleteRecord["components/A.ts"].OnlyInA,
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
  });

  it("marks only [components/A.ts][SharedKey] and [components/A.ts][OnlyInA] as unused when same key is used in another module", async () => {
    // Expect A's two keys to be shown for deletion, but not B's SharedKey/OnlyInB
    const expectedUnused = [
      "[components/A.ts][SharedKey]",
      "[components/A.ts][OnlyInA]",
    ];

    mockSelectKeysForDeletion.mockResolvedValue(expectedUnused);
    mockConfirmDeletion.mockResolvedValue(true);

    const result = await deleteService.detectUnusedKeysAndGenerateRecord(
      currentReferences
    );

    // User saw the right options
    expect(mockSelectKeysForDeletion).toHaveBeenCalledWith(expectedUnused);

    // After deletion, A module should be removed entirely; B stays intact
    const finalRecord = result.processedRecord as CompleteTranslationRecord;
    expect(finalRecord["components/A.ts"]).toBeUndefined();
    expect(finalRecord["components/B.ts"]).toEqual(
      existingCompleteRecord["components/B.ts"]
    );
  });
});
