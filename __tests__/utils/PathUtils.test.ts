import { PathUtils } from "../../utils/PathUtils";
import type { I18nConfig } from "../../types";

describe("PathUtils", () => {
  const mockConfig: I18nConfig = {
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

  describe("convertFilePathToModulePath", () => {
    beforeEach(() => {
      // Mock process.cwd() to return a consistent path
      jest.spyOn(process, "cwd").mockReturnValue("/Users/test/project");
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should convert file path to module path correctly", () => {
      const filePath = "/Users/test/project/demo/src/components/Header.tsx";
      const result = PathUtils.convertFilePathToModulePath(
        filePath,
        mockConfig
      );
      expect(result).toBe("components/Header.ts");
    });

    it("should handle files in root directory", () => {
      const filePath = "/Users/test/project/demo/src/App.tsx";
      const result = PathUtils.convertFilePathToModulePath(
        filePath,
        mockConfig
      );
      expect(result).toBe("App.ts");
    });

    it("should handle files with empty rootDir config", () => {
      const configWithoutRoot = { ...mockConfig, rootDir: "" };
      const filePath = "/Users/test/project/src/components/Button.tsx";
      const result = PathUtils.convertFilePathToModulePath(
        filePath,
        configWithoutRoot
      );
      expect(result).toBe("src/components/Button.ts");
    });

    it("should convert different file extensions to .ts", () => {
      const testCases = [
        { input: "/Users/test/project/demo/src/test.jsx", expected: "test.ts" },
        { input: "/Users/test/project/demo/src/test.js", expected: "test.ts" },
        { input: "/Users/test/project/demo/src/test.ts", expected: "test.ts" },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = PathUtils.convertFilePathToModulePath(input, mockConfig);
        expect(result).toBe(expected);
      });
    });
  });

  describe("getTranslationVarName", () => {
    it("should generate correct variable name for simple module", () => {
      const modulePath = "TestComponent.ts";
      const result = PathUtils.getTranslationVarName(modulePath, mockConfig);
      expect(result).toBe("testComponentTranslations");
    });

    it("should generate correct variable name for nested module", () => {
      const modulePath = "components/Header.ts";
      const result = PathUtils.getTranslationVarName(modulePath, mockConfig);
      expect(result).toBe("headerTranslations");
    });

    it("should handle camelCase conversion correctly", () => {
      const testCases = [
        { input: "MyComponent.ts", expected: "myComponentTranslations" },
        { input: "ButtonGroup.ts", expected: "buttonGroupTranslations" },
        { input: "header2.ts", expected: "header2Translations" },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = PathUtils.getTranslationVarName(input, mockConfig);
        expect(result).toBe(expected);
      });
    });
  });

  describe("getTranslationImportPath", () => {
    it("should generate correct import path for component", () => {
      const currentFilePath =
        "/Users/test/project/demo/src/components/Header.tsx";
      const modulePath = "components/Header.ts";
      const result = PathUtils.getTranslationImportPath(
        currentFilePath,
        modulePath,
        mockConfig
      );
      expect(result).toBe("@translate/Header");
    });

    it("should handle files in root directory", () => {
      const currentFilePath = "/Users/test/project/demo/src/App.tsx";
      const modulePath = "App.ts";
      const result = PathUtils.getTranslationImportPath(
        currentFilePath,
        modulePath,
        mockConfig
      );
      expect(result).toBe("@translate/App");
    });

    it("should remove file extensions from import path", () => {
      const currentFilePath = "/Users/test/project/demo/src/TestComponent.tsx";
      const modulePath = "TestComponent.ts";
      const result = PathUtils.getTranslationImportPath(
        currentFilePath,
        modulePath,
        mockConfig
      );
      expect(result).toBe("@translate/TestComponent");
    });
  });

  describe("getModulePathForFile", () => {
    it("should remove file extension correctly", () => {
      const testCases = [
        {
          input: "src/components/Header.tsx",
          expected: "src/components/Header",
        },
        { input: "src/utils/helper.ts", expected: "src/utils/helper" },
        { input: "src/App.jsx", expected: "src/App" },
        { input: "src/index.js", expected: "src/index" },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = PathUtils.getModulePathForFile(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe("convertModulePathToFilePath", () => {
    it("should return module path as is", () => {
      const testCases = [
        "TestModular.ts",
        "page/home.ts",
        "components/Header2.ts",
      ];

      testCases.forEach((input) => {
        const result = PathUtils.convertModulePathToFilePath(input);
        expect(result).toBe(input);
      });
    });
  });
});
