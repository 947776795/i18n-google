/**
 * Feature 3: 纯 JSX 文本提取 - TDD 测试用例
 *
 * 需求：提取 <div>fff</div> 中的纯英文文本（即使没有 ~ 标记）
 */

import { JSXTextExtractor } from '../../domain/collect/JSXTextExtractor';
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

describe('Feature 3: 纯 JSX 文本提取', () => {
  describe('JSXTextExtractor - 提取纯 JSX 文本', () => {
    let extractor: JSXTextExtractor;

    beforeEach(() => {
      extractor = new JSXTextExtractor(mockConfig);
    });

    test('应该提取纯英文 JSX 文本（无标记）', () => {
      const source = `
        export default function Page() {
          return <div>Welcome</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].cleanedText).toBe('Welcome');
      expect(results[0].type).toBe('jsx-text');
    });

    test('应该提取多个纯英文 JSX 文本', () => {
      const source = `
        export default function Page() {
          return (
            <div>
              <h1>Welcome</h1>
              <p>This is a test</p>
            </div>
          );
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results.length).toBe(2);
      const cleanedTexts = results.map(r => r.cleanedText);
      expect(cleanedTexts).toContain('Welcome');
      expect(cleanedTexts).toContain('This is a test');
    });

    test('应该跳过纯空白 JSX 文本', () => {
      const source = `
        export default function Page() {
          return (
            <div>
              <h1>Welcome</h1>
              <p>   </p>
            </div>
          );
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results.length).toBe(1);
      expect(results[0].cleanedText).toBe('Welcome');
    });

    test('应该跳过没有英文字符的 JSX 文本', () => {
      const source = `
        export default function Page() {
          return <div>欢迎</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results.length).toBe(0);
    });

    test('应该提取带标记的 JSX 文本（标记优先）', () => {
      const source = `
        export default function Page() {
          return <div>~Welcome~</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      // 带标记的文本应该被提取
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].cleanedText).toBe('Welcome');
    });

    test('应该跳过 I18n.t() 调用中的文本', () => {
      const source = `
        export default function Page() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results.length).toBe(0);
    });
  });

  describe('CodeTransformer - 转换 JSX 文本节点', () => {
    let transformer: CodeTransformer;

    beforeEach(() => {
      transformer = new CodeTransformer();
    });

    test('应该将 JSX 文本转换为 {I18n.t("key")}', () => {
      const source = `<div>Welcome</div>`;
      const keys = ['Welcome'];

      const result = transformer.transform(source, keys, false, 'test');

      expect(result.code).toContain('{I18n.t("Welcome")}');
      expect(result.hasChanges).toBe(true);
    });

    test('应该保持导入语句格式', () => {
      const source = `<div>Welcome</div>`;
      const keys = ['Welcome'];

      const result = transformer.transform(source, keys, true, 'app_page');

      expect(result.code).toContain('import { I18nUtil } from "@utils"');
      expect(result.code).toContain("const I18n = I18nUtil.createScoped('app_page')");
    });

    test('应该保持原有代码格式（换行、缩进）', () => {
      const source = `export default function Page() {
  return (
    <div>
      <h1>Welcome</h1>
      <p>This is a test</p>
    </div>
  );
}`;

      const keys = ['Welcome', 'This is a test'];

      const result = transformer.transform(source, keys, true, 'app_page');

      // 验证原始换行和缩进被保留
      expect(result.code).toContain('\n  return (');
      expect(result.code).toContain('<h1>{I18n.t("Welcome")}</h1>');
      expect(result.code).toContain('<p>{I18n.t("This is a test")}</p>');
    });
  });
});
