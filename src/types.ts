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
  forceKeepKeys?: string[]; // 强制保留的Key列表
  logLevel?: "silent" | "normal" | "verbose"; // 日志级别配置
  sheetsReadRange?: string; // Google Sheets 读取范围，默认 "A1:Z10000"
  apiKey: string;
  sheetsMaxRows?: number; // Google Sheets 最大行数，默认10000
}
