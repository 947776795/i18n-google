/**
 * 不完整标记测试
 *
 * 期望行为：当 JSX 文本包含不完整的标记符号时：
 * - "sdsd~" 应该提取为 key "sdsd~"（保留结尾的 ~）
 * - "~asd" 应该提取为 key "~asd"（保留开头的 ~）
 * - 转换后应该是 {I18n.t("sdsd~")} 和 {I18n.t("~asd")}
 * - 翻译文件中应该有 "sdsd~" 和 "~asd" 这两个 keys
 *
 * 修复前的问题：
 * 1. JSXTextExtractor 会去掉开头或结尾的 ~，将 "sdsd~" 变成 "sdsd"
 * 2. CodeTransformer 转换成 I18n.t("sdsd")，但原代码中的 "sdsd~" 没有被正确替换
 * 3. 结果：记录中有 key "sdsd"，但代码中没有 I18n.t("sdsd") → 被检测为无用 key
 */

import { JSXTextExtractor } from '../../domain/collect/JSXTextExtractor';
import { MarkExtractor } from '../../domain/collect/MarkExtractor';
import { CodeTransformer } from '../../infra/ast/CodeTransformer';
import { ReferenceCollector } from '../../domain/collect/ReferenceCollector';
import type { I18nConfig } from '../../types/config';

// 模拟配置（符合 I18nConfig 类型）
const mockConfig: I18nConfig = {
  rootDir: './src',
  languages: ['en'],
  ignore: [],
  spreadsheetId: 'test-sheet',
  sheetName: 'i18n',
  keyFile: './test-key.json',
  startMarker: '~',
  endMarker: '~',
  outputDir: './src/translate',
  include: ['tsx', 'ts'],
  logLevel: 'normal',
  sheetsReadRange: 'A1:Z10000',
  sheetsMaxRows: 10000,
  apiKey: '',
  testMode: true,
};

describe('不完整标记测试', () => {
  describe('问题 1: sdsd~ 应该保留 ~ 符号作为 key', () => {
    const sourceWithTrailingMark = `
      export default function TestPage() {
        return (
          <div>
            <p>Hello</p>sdsd~
          </div>
        );
      }
    `;

    it('JSXTextExtractor 应该提取 "sdsd~" 作为翻译 key（保留 ~ 符号）', () => {
      const extractor = new JSXTextExtractor(mockConfig);
      const results = extractor.extract(sourceWithTrailingMark, 'test.tsx');

      console.log('提取结果:', results.map(r => ({ cleanedText: r.cleanedText, originalText: r.originalText })));

      // 应该提取为 "sdsd~"（保留结尾的 ~ 符号）
      const sdsdResult = results.find(r => r.cleanedText === 'sdsd~');
      expect(sdsdResult).toBeDefined();
    });

    it('CodeTransformer 应该转换为 I18n.t("sdsd~")', () => {
      const transformer = new CodeTransformer();
      const marks = ['sdsd~']; // 修复后会保留 ~ 符号

      const result = transformer.transform(sourceWithTrailingMark, marks, true, 'test');

      // 应该转换成 {I18n.t("sdsd~")}
      expect(result.code).toContain('{I18n.t("sdsd~")}');
      // 不应该有 I18n.t("sdsd")（没有 ~ 符号）
      expect(result.code).not.toContain('I18n.t("sdsd")');
    });
  });

  describe('问题 2: ~asd 应该保留 ~ 符号作为 key', () => {
    const sourceWithLeadingMark = `
      export default function TestPage() {
        return (
          <div>
            ~asd<h1>Title</h1>
          </div>
        );
      }
    `;

    it('JSXTextExtractor 应该提取 "~asd" 作为翻译 key（保留 ~ 符号）', () => {
      const extractor = new JSXTextExtractor(mockConfig);
      const results = extractor.extract(sourceWithLeadingMark, 'test.tsx');

      console.log('提取结果:', results.map(r => ({ cleanedText: r.cleanedText, originalText: r.originalText })));

      // 应该提取为 "~asd"（保留开头的 ~ 符号）
      const asdResult = results.find(r => r.cleanedText === '~asd');
      expect(asdResult).toBeDefined();
    });

    it('CodeTransformer 应该转换为 I18n.t("~asd")', () => {
      const transformer = new CodeTransformer();
      const marks = ['~asd']; // 修复后会保留 ~ 符号

      const result = transformer.transform(sourceWithLeadingMark, marks, true, 'test');

      // 应该转换成 {I18n.t("~asd")}
      expect(result.code).toContain('{I18n.t("~asd")}');
      // 不应该有 I18n.t("asd")（没有 ~ 符号）
      expect(result.code).not.toContain('I18n.t("asd")');
    });
  });

  describe('完整标记应该正常工作', () => {
    const sourceWithCompleteMark = `
      export default function TestPage() {
        return (
          <div>
            <p>~Hello World~</p>
          </div>
        );
      }
    `;

    it('MarkExtractor 应该提取完整的 ~Hello World~ 标记', () => {
      const extractor = new MarkExtractor();
      const results = extractor.extractWithInfo(sourceWithCompleteMark, '~', '~');

      expect(results.length).toBe(1);
      expect(results[0].cleanedText).toBe('Hello World');
      expect(results[0].text).toBe('~Hello World~');
    });

    it('CodeTransformer 应该转换完整的标记', () => {
      const transformer = new CodeTransformer();
      const marks = ['Hello World'];

      const result = transformer.transform(sourceWithCompleteMark, marks, true, 'test');

      expect(result.code).not.toContain('~Hello World~');
      expect(result.code).toContain('{I18n.t("Hello World")}');
    });
  });

  describe('混合场景：实际的 Nested/page.tsx 片段', () => {
    const actualSource = `
      export default function NestedDemoPage() {
        return (
          <div className="nested-demo-page">
            {b}~<h1>Nested Components Demo</h1>
            <p>This page demonstrates 5 levels of component nesting</p>sdsd~
            <div>split</div>
            ~asd<h1>~Nested Components Demo~</h1>asda<span>dddd</span>~
          </div>
        );
      }
    `;

    it('应该正确识别完整标记和不完整标记', () => {
      const extractor = new JSXTextExtractor(mockConfig);
      const results = extractor.extract(actualSource, 'test.tsx');

      console.log('提取结果:', results.map(r => ({ cleanedText: r.cleanedText, originalText: r.originalText })));

      // 应该提取 "sdsd~"（保留结尾的 ~）
      const sdsdTildeResult = results.find(r => r.cleanedText === 'sdsd~');
      expect(sdsdTildeResult).toBeDefined();

      // 应该提取 "~asd"（保留开头的 ~）
      const asdTildeResult = results.find(r => r.cleanedText === '~asd');
      expect(asdTildeResult).toBeDefined();

      // 不应该提取 "sdsd"（没有 ~ 符号）
      const sdsdResult = results.find(r => r.cleanedText === 'sdsd');
      expect(sdsdResult).toBeUndefined();

      // 不应该提取 "asd"（没有 ~ 符号）
      const asdResult = results.find(r => r.cleanedText === 'asd');
      expect(asdResult).toBeUndefined();
    });

    it('转换后应该有 I18n.t("sdsd~") 和 I18n.t("~asd")', () => {
      const transformer = new CodeTransformer();
      // 修复后：会保留不完整的标记符号
      const marks = ['Nested Components Demo', 'split', 'asda', 'dddd', 'sdsd~', '~asd'];

      const result = transformer.transform(actualSource, marks, true, 'test');

      // 不完整的标记应该被转换（保留 ~ 符号）
      expect(result.code).toContain('{I18n.t("sdsd~")}');
      expect(result.code).toContain('{I18n.t("~asd")}');

      // 完整标记应该被转换（去掉 ~ 符号）
      expect(result.code).toContain('{I18n.t("Nested Components Demo")}');
      expect(result.code).toContain('{I18n.t("split")}');
      expect(result.code).toContain('{I18n.t("asda")}');
      expect(result.code).toContain('{I18n.t("dddd")}');

      // 不应该有 I18n.t("sdsd") 或 I18n.t("asd")（没有 ~ 符号的版本）
      expect(result.code).not.toContain('{I18n.t("sdsd")}');
      expect(result.code).not.toContain('{I18n.t("asd")}');
    });
  });
});
