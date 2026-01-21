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

    test('应该提取嵌套组件中的所有文本', () => {
      const source = `export default function NestedDemo() {
  return (
    <div className="nested-demo-container">
      <h1>Nested Component Demo</h1>
      <p className="main-intro">
        This layout demonstrates four levels of component nesting for i18n
        extraction testing.
      </p>
    </div>
  );
}`;

      const results = extractor.extract(source, 'NestedDemo.tsx');

      // 应该提取到 2 个文本
      expect(results.length).toBe(2);

      const cleanedTexts = results.map((r) => r.cleanedText);
      expect(cleanedTexts).toContain('Nested Component Demo');

      // 验证跨行文本被正确提取（保留换行符和空格）
      const multiLineText = cleanedTexts.find((t) =>
        t.includes('four levels of component nesting') &&
        t.includes('extraction testing.')
      );
      expect(multiLineText).toBeDefined();
      // 跨行文本应包含原始的换行和空格
      expect(multiLineText).toMatch(/for i18n\s+extraction testing\./);
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

    test('应该正确提取并转换嵌套 JSX 结构（保留空格和格式）', () => {
      const source = `<body>
        <div className="nested-demo-container">
          <h1>Nested Component Demo</h1>
          <p className="main-intro">
            This layout demonstrates four levels of component nesting for i18n
            extraction testing.
          </p>
        </div>
      </body>`;

      // keys 应该是单行的，因为 StringUtils.cleanExtractedText 会把换行符替换成空格
      const keys = [
        'Nested Component Demo',
        'This layout demonstrates four levels of component nesting for i18n extraction testing.'
      ];

      const result = transformer.transform(source, keys, true, 'nested_demo');

      // 验证所有文本都被正确提取
      expect(result.hasChanges).toBe(true);

      // 验证换行和缩进被保留
      expect(result.code).toContain('<body>\n        <div className="nested-demo-container">');

      // 验证 h1 文本被转换
      expect(result.code).toContain('<h1>{I18n.t("Nested Component Demo")}</h1>');

      // 验证 p 标签的跨行文本被转换（recast 可能会将长字符串格式化成多行）
      expect(result.code).toContain('<p className="main-intro">');
      expect(result.code).toContain('I18n.t(');
      expect(result.code).toContain('four levels of component nesting for i18n extraction testing');
      // 验证原始的跨行文本不在结果中（已被替换为 I18n.t 调用）
      expect(result.code).not.toContain('extraction testing.\n          </p>');
    });

    test('应该正确转换跨行 JSX 文本（修复 bug）', () => {
      // 模拟实际场景：源码中跨行的文本
      const source = `<div className="nested-demo-container">
          <h1>Nested Component Demo</h1>
          <p className="main-intro">
            This layout demonstrates four levels of component nesting for i18n
            extraction testing.
          </p>
        </div>`;

      // keys 是提取后单行化的文本（cleanExtractedText 把换行符替换成空格）
      const keys = [
        'Nested Component Demo',
        'This layout demonstrates four levels of component nesting for i18n extraction testing.'
      ];

      const result = transformer.transform(source, keys, true, 'nested_demo');

      // 验证两个文本都被转换了
      expect(result.hasChanges).toBe(true);

      // h1 应该被转换
      expect(result.code).toContain('I18n.t("Nested Component Demo")');

      // p 标签的跨行文本也应该被转换（这是核心修复点）
      expect(result.code).toContain('I18n.t(');
      expect(result.code).toContain('four levels of component nesting for i18n extraction testing');

      // 验证原始的跨行文本不在结果中（已被替换）
      expect(result.code).not.toContain('extraction testing.\n          </p>');
    });

    test('应该保留 JSX 文本前后的空白结构', () => {
      // 测试带有前后空白的文本
      const source = `<div>
  <p>  Hello World  </p>
</div>`;

      const keys = ['Hello World'];

      const result = transformer.transform(source, keys, true, 'test');

      expect(result.hasChanges).toBe(true);

      // I18n.t() 应该被正确插入
      expect(result.code).toContain('I18n.t("Hello World")');

      // 验证周围的换行和缩进被保留
      expect(result.code).toContain('<div>\n');
      expect(result.code).toContain('<p>');
    });

    test('应该保留跨行文本的外部换行结构', () => {
      // 测试跨行文本，应该保留外部的换行结构
      const source = `<div className="container">
          <h1>Title</h1>
          <p className="description">
            This is a long text that spans
            across multiple lines in the source code.
          </p>
        </div>`;

      const keys = [
        'Title',
        'This is a long text that spans across multiple lines in the source code.'
      ];

      const result = transformer.transform(source, keys, true, 'test');

      expect(result.hasChanges).toBe(true);

      // 验证 I18n.t() 调用被正确插入
      expect(result.code).toContain('I18n.t("Title")');
      expect(result.code).toContain('I18n.t(');
      expect(result.code).toContain('long text that spans');

      // 验证外部的换行和缩进结构被保留
      expect(result.code).toContain('<div className="container">\n');
      expect(result.code).toContain('<h1>');
      expect(result.code).toContain('<p className="description">');
    });
  });
});
