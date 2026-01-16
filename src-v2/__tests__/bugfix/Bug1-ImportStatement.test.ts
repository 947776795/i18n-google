/**
 * Bug 1: import 语句被错误转换为 I18n.t() 调用
 *
 * 问题描述：
 * import { Level1 } from "@/components/nested/Level1";
 * 被错误地转换为：
 * import { Level1 } from I18n.t("d");
 *
 * 预期行为：
 * import 语句应该被跳过，不进行任何转换
 */

import { CodeTransformer } from '../../infra/ast/CodeTransformer';
import type { I18nConfig } from '../../types/config';

const mockConfig: I18nConfig = {
  rootDir: './src',
  languages: ['en', 'ko'],
  include: ['js', 'jsx', 'ts', 'tsx'],
  ignore: [],
  outputDir: './src/translate',
  startMarker: '~',
  endMarker: '~',
  logLevel: 'silent',
  spreadsheetId: 'test',
  sheetName: 'test',
  keyFile: 'test.json',
  apiKey: 'test',
};

describe('Bug 1: import 语句不应被转换', () => {
  let transformer: CodeTransformer;

  beforeEach(() => {
    transformer = new CodeTransformer();
  });

  test('import 语句中的路径应该保持不变', () => {
    const source = `import { Level1 } from "@/components/nested/Level1";`;

    // 传递空的 marks 列表，因为没有标记
    const marks: string[] = [];

    const result = transformer.transform(source, marks, false, 'app_page');

    // import 语句应该保持不变
    expect(result.code).toContain('from "@/components/nested/Level1"');
    expect(result.code).not.toContain('I18n.t(');
    expect(result.hasChanges).toBe(false);
  });

  test('import 语句即使包含类似标记的字符串也不应转换', () => {
    const source = `import { Level1 } from "@/components/nested/Level1";
import { Something } from "~some/path~";`;

    // 即使 marks 包含类似路径的字符串，import 也不应被转换
    const marks = ['~some/path~'];

    const result = transformer.transform(source, marks, false, 'app_page');

    // import 语句应该保持不变
    expect(result.code).toContain('from "@/components/nested/Level1"');
    expect(result.code).toContain('from "~some/path~"');
    expect(result.code).not.toContain('from I18n.t(');
  });

  test('只有字符串字面量（非 import）才应该被转换', () => {
    const source = `
import { Level1 } from "@/components/nested/Level1";

export default function Page() {
  const message = "~Hello World~";
  return <div>{message}</div>;
}
`;

    const marks = ['~Hello World~'];

    const result = transformer.transform(source, marks, false, 'app_page');

    // import 语句应该保持不变
    expect(result.code).toContain('from "@/components/nested/Level1"');

    // 变量声明中的字符串应该被转换
    expect(result.code).toContain('const message = I18n.t("Hello World")');
    expect(result.hasChanges).toBe(true);
  });

  test('带 from 关键字的字符串应该被识别为 import 并跳过', () => {
    const source = `
import { a } from "path1";
import { b } from '~path2~';
const c = "~text~";
`;

    const marks = ['~path2~', '~text~'];

    const result = transformer.transform(source, marks, false, 'app_page');

    // import 语句应该保持不变（包括带标记的路径）
    expect(result.code).toContain('from "path1"');
    expect(result.code).toContain('from \'~path2~\'');

    // 变量声明中的字符串应该被转换
    expect(result.code).toContain('const c = I18n.t("text")');
  });
});
