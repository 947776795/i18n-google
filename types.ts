export interface I18nConfig {
  rootDir: string;
  languages: string[];
  ignore: string[];
  spreadsheetId: string;
  sheetName: string;
  keyFile: string;
  check: {
    test: (value: string) => boolean;
  };
  format: (value: string) => string;
  include: string[];
  outputDir: string;
} 