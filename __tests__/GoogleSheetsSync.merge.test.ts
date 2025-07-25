// GoogleSheetsSync merge functionality test
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock("../src/utils/StringUtils", () => ({
  Logger: mockLogger,
}));

import { GoogleSheetsSync } from "../src/core/GoogleSheetsSync";
import type { CompleteTranslationRecord } from "../src/core/TranslationManager";
import type { I18nConfig } from "../src/types";

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

describe("GoogleSheetsSync - Merge Functionality", () => {
  let googleSheetsSync: GoogleSheetsSync;
  let mockConfig: I18nConfig;

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

    googleSheetsSync = new GoogleSheetsSync(mockConfig);
  });

  it("should pull remote data, merge with local data, and push to remote", async () => {
    // Mock remote data from Google Sheets
    const remoteData = {
      data: {
        values: [
          ["key", "en", "zh", "ja", "mark"],
          ["[components/Header.ts][Hello]", "Hello", "你好", "こんにちは", "1"],
          ["[components/Header.ts][World]", "World", "世界", "世界", "0"],
          [
            "[components/Footer.ts][Copyright]",
            "Copyright",
            "版权",
            "著作権",
            "1",
          ],
        ],
      },
    };

    mockGet.mockResolvedValue(remoteData);
    mockUpdate.mockResolvedValue({ data: {} });

    // Local data to be synced (has some overlap and new data)
    const localRecord = {
      "components/Header.ts": {
        Hello: {
          en: "Hello Updated", // Updated translation
          zh: "你好更新", // Updated translation
          ja: "こんにちは", // Same as remote
          mark: 2, // Updated mark
        },
        Goodbye: {
          // New key not in remote
          en: "Goodbye",
          zh: "再见",
          ja: "さようなら",
          mark: 0,
        },
      },
      "components/Button.ts": {
        // New module not in remote
        Click: {
          en: "Click",
          zh: "点击",
          ja: "クリック",
          mark: 1,
        },
      },
    } as unknown as CompleteTranslationRecord;

    await googleSheetsSync.syncCompleteRecordToSheet(localRecord);

    // Verify that remote data was fetched first
    expect(mockGet).toHaveBeenCalledWith({
      spreadsheetId: "test-spreadsheet-id",
      range: "test-sheet!A1:Z10000",
    });

    // Verify that update was called with merged data
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.spreadsheetId).toBe("test-spreadsheet-id");
    expect(updateCall.valueInputOption).toBe("RAW");

    const values = updateCall.resource.values;
    expect(values[0]).toEqual(["key", "en", "zh", "ja", "mark"]);

    // Check that merged data is present
    const dataRows = values
      .slice(1)
      .filter((row: string[]) => row[0] && row[0] !== "");

    // Should contain merged Hello (remote data should win for conflicts)
    const helloRow = dataRows.find((row: string[]) =>
      row[0].includes("[Hello]")
    );
    expect(helloRow).toBeDefined();
    expect(helloRow[0]).toBe("[components/Header.ts][Hello]"); // Key should remain stable
    expect(helloRow[1]).toBe("Hello"); // Remote version wins
    expect(helloRow[2]).toBe("你好"); // Remote version wins
    expect(helloRow[4]).toBe("1"); // Remote mark wins

    // Should contain remote-only data (World)
    const worldRow = dataRows.find((row: string[]) =>
      row[0].includes("[World]")
    );
    expect(worldRow).toBeDefined();
    expect(worldRow[1]).toBe("World");
    expect(worldRow[2]).toBe("世界");

    // Should contain remote-only data (Copyright)
    const copyrightRow = dataRows.find((row: string[]) =>
      row[0].includes("[Copyright]")
    );
    expect(copyrightRow).toBeDefined();
    expect(copyrightRow[1]).toBe("Copyright");

    // Should contain local-only data (Goodbye)
    const goodbyeRow = dataRows.find((row: string[]) =>
      row[0].includes("[Goodbye]")
    );
    expect(goodbyeRow).toBeDefined();
    expect(goodbyeRow[1]).toBe("Goodbye");

    // Should contain local-only module (Button)
    const clickRow = dataRows.find((row: string[]) =>
      row[0].includes("[Click]")
    );
    expect(clickRow).toBeDefined();
    expect(clickRow[1]).toBe("Click");
  });

  it("should handle empty remote data gracefully", async () => {
    // Mock empty remote data
    mockGet.mockResolvedValue({ data: { values: [] } });
    mockUpdate.mockResolvedValue({ data: {} });

    const localRecord = {
      "components/Header.ts": {
        Hello: {
          en: "Hello",
          zh: "你好",
          mark: 0,
        },
      },
    } as unknown as CompleteTranslationRecord;

    await googleSheetsSync.syncCompleteRecordToSheet(localRecord);

    // Should still work and upload local data
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const values = mockUpdate.mock.calls[0][0].resource.values;
    expect(values[0]).toEqual(["key", "en", "zh", "ja", "mark"]);

    const dataRows = values
      .slice(1)
      .filter((row: string[]) => row[0] && row[0] !== "");
    expect(dataRows.length).toBeGreaterThan(0);
  });

  it("should handle remote fetch errors gracefully", async () => {
    // Mock remote fetch error
    mockGet.mockRejectedValue(new Error("Network error"));
    mockUpdate.mockResolvedValue({ data: {} });

    const localRecord = {
      "components/Header.ts": {
        Hello: {
          en: "Hello",
          zh: "你好",
          mark: 0,
        },
      },
    } as unknown as CompleteTranslationRecord;

    await googleSheetsSync.syncCompleteRecordToSheet(localRecord);

    // Should fallback to uploading local data only
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("从 Google Sheets 同步失败"),
      expect.any(Error)
    );
  });

  it("should keep keys stable when remote English translations are modified", async () => {
    // Mock remote data where English translation has been modified
    const remoteData = {
      data: {
        values: [
          ["key", "en", "zh", "ja", "mark"],
          // Original key was "Hello", but English translation was modified to "Hello World"
          [
            "[components/Header.ts][Hello]",
            "Hello World",
            "你好",
            "こんにちは",
            "1",
          ],
          [
            "[components/Header.ts][Goodbye]",
            "Goodbye Updated",
            "再见更新",
            "さようなら",
            "0",
          ],
        ],
      },
    };

    mockGet.mockResolvedValue(remoteData);
    mockUpdate.mockResolvedValue({ data: {} });

    // Local data with the original translation keys
    const localRecord = {
      "components/Header.ts": {
        Hello: {
          en: "Hello", // Original English text
          zh: "你好",
          ja: "こんにちは",
          mark: 0,
        },
        Goodbye: {
          en: "Goodbye", // Original English text
          zh: "再见",
          ja: "さようなら",
          mark: 0,
        },
        Welcome: {
          // New key only in local
          en: "Welcome",
          zh: "欢迎",
          ja: "ようこそ",
          mark: 0,
        },
      },
    } as unknown as CompleteTranslationRecord;

    await googleSheetsSync.syncCompleteRecordToSheet(localRecord);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const values = mockUpdate.mock.calls[0][0].resource.values;
    const dataRows = values
      .slice(1)
      .filter((row: string[]) => row[0] && row[0] !== "");

    // Verify that keys remain stable even when English translations change
    const helloRow = dataRows.find((row: string[]) =>
      row[0].includes("[Hello]")
    );
    expect(helloRow).toBeDefined();
    expect(helloRow[0]).toBe("[components/Header.ts][Hello]"); // Key should remain "Hello", not "Hello World"
    expect(helloRow[1]).toBe("Hello World"); // But content should be from remote (remote wins)

    const goodbyeRow = dataRows.find((row: string[]) =>
      row[0].includes("[Goodbye]")
    );
    expect(goodbyeRow).toBeDefined();
    expect(goodbyeRow[0]).toBe("[components/Header.ts][Goodbye]"); // Key should remain "Goodbye", not "Goodbye Updated"
    expect(goodbyeRow[1]).toBe("Goodbye Updated"); // But content should be from remote (remote wins)

    // New local key should be added
    const welcomeRow = dataRows.find((row: string[]) =>
      row[0].includes("[Welcome]")
    );
    expect(welcomeRow).toBeDefined();
    expect(welcomeRow[0]).toBe("[components/Header.ts][Welcome]");
    expect(welcomeRow[1]).toBe("Welcome");
  });
});
