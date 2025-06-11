export interface I18nConfig {
  rootDir: string;
  languages: string[];
  ignore: string[];
  spreadsheetId: string;
  sheetName: string;
  keyFile: string;
  startMarker: string; // 开始标记符号
  endMarker: string; // 结尾标记符号
  include: string[];
  outputDir: string;
}
