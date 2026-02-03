/**
 * 复杂嵌套组件提取测试
 *
 * 测试实际 Nested Demo 页面的文案提取与转换
 *
 * 预期提取的翻译 keys：
 * - dsdsdad (完整标记)
 * - ~ (不完整标记，单独的 ~ 符号)
 * - Nested Components Demo (JSX 纯文本)
 * - This page demonstrates 5 levels of component nesting (JSX 纯文本)
 * - sdsd~ (不完整标记)
 * - split (JSX 纯文本)
 * - This page demonstrates 5 levels of component ~ nesting (JSX 纯文本，包含 ~ 但不完整)
 * - ~asd (不完整标记)
 * - asda (JSX 纯文本)
 * - dddd (JSX 纯文本)
 * - ~ (不完整标记)
 * - d (JSX 纯文本)
 * - ddd (JSX 纯文本)
 * - 11 (JSX 属性中的完整标记)
 */

import { JSXTextExtractor } from '../../domain/collect/JSXTextExtractor';
import { MarkExtractor } from '../../domain/collect/MarkExtractor';
import { TemplateExtractor } from '../../domain/collect/TemplateExtractor';
import { CodeTransformer } from '../../infra/ast/CodeTransformer';
import type { I18nConfig } from '../../types/config';

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

describe('复杂嵌套组件提取测试', () => {
  const sourceCode = `
  /**
   * Nested Demo Page - 五层组件嵌套演示
   */
  import { Level1 } from "@/components/nested/Level1";

  export default function NestedDemoPage() {
    const a=\`~\${1}~\`
    const b= '~dsdsdad~'
    return (
      <div className="nested-demo-page">
      {a}
      {b}
      ~<h1>Nested Components Demo</h1>
      <p>This page demonstrates 5 levels of component nesting</p>sdsd~
      <div>split</div>
      ~<h1>Nested Components Demo</h1>
      <p>This page demonstrates 5 levels of component ~ nesting</p>sdsd~
      <div>split</div>
      ~asd<h1>~Nested Components Demo~</h1>asda<span>dddd</span>~
      <div>split</div>
      ~<Level1 title='~11~' />d<div>ddd</div>~
      </div>
    )
  }`;

  describe('JSXTextExtractor 提取测试', () => {
    it('应该提取所有纯 JSX 文本节点', () => {
      const extractor = new JSXTextExtractor(mockConfig);
      const results = extractor.extract(sourceCode, 'test.tsx');

      console.log('JSXTextExtractor 提取结果:');
      results.forEach(r => console.log(`  - "${r.cleanedText}" (原始: "${r.originalText.trim()}")`));

      // 预期提取的纯文本 keys（不包括单独的 ~，因为它是纯符号）
      const expectedKeys = [
        'Nested Components Demo',  // <h1> 标签内
        'This page demonstrates 5 levels of component nesting',
        'sdsd~',  // 不完整标记（包含英文字母）
        'split',
        'This page demonstrates 5 levels of component ~ nesting',  // 包含 ~ 但不完整
        '~asd',  // 不完整标记（包含英文字母）
        'asda',
        'dddd',
        'd',
        'ddd',
      ];

      for (const key of expectedKeys) {
        const found = results.find(r => r.cleanedText === key);
        expect(found).toBeDefined();
      }

      // 单独的 ~ 不应该被提取（不包含英文字母）
      const singleTilde = results.find(r => r.cleanedText === '~');
      expect(singleTilde).toBeUndefined();

      console.log(`✓ 提取了 ${results.length} 个 JSX 文本节点`);
    });

    it('应该跳过纯变量模板字符串', () => {
      const extractor = new JSXTextExtractor(mockConfig);
      const results = extractor.extract(sourceCode, 'test.tsx');

      // `~${1}~` 只有变量没有静态文本，应该被跳过
      const pureVarMark = results.find(r => r.cleanedText.includes('%{var0}'));
      expect(pureVarMark).toBeUndefined();
    });
  });

  describe('MarkExtractor 提取测试', () => {
    it('应该提取所有完整标记', () => {
      const extractor = new MarkExtractor();
      const results = extractor.extractWithInfo(sourceCode, '~', '~');

      console.log('MarkExtractor 提取结果:');
      results.forEach(r => console.log(`  - ${r.text} -> "${r.cleanedText}"`));

      // 预期提取的完整标记
      const expectedMarks = [
        '~dsdsdad~',  // 变量声明中
        '~Nested Components Demo~',  // 混合内容中
        '~11~',  // JSX 属性中
      ];

      for (const mark of expectedMarks) {
        const found = results.find(r => r.text === mark);
        expect(found).toBeDefined();
      }

      console.log(`✓ 提取了 ${results.length} 个完整标记`);
    });
  });

  describe('TemplateExtractor 提取测试', () => {
    it('应该提取带变量的模板字符串', () => {
      const extractor = new TemplateExtractor(mockConfig);
      const results = extractor.extract(sourceCode, 'test.tsx');

      console.log('TemplateExtractor 提取结果:');
      results.forEach(r => console.log(`  - "${r.cleanedText}" (原始: "${r.originalText}")`));

      // `~${1}~` 应该被跳过（只有变量，没有静态文本）
      const withVar = results.find(r => r.cleanedText.includes('%{var0}'));
      expect(withVar).toBeUndefined();
    });
  });

  describe('CodeTransformer 转换测试', () => {
    it('应该正确转换所有标记（保留不完整标记的 ~ 符号）', () => {
      const transformer = new CodeTransformer();

      // 汇总所有提取的 keys（不包括单独的 ~，因为它没有英文字符）
      const allKeys = [
        // 完整标记（去掉 ~）
        'dsdsdad',
        'Nested Components Demo',
        '11',
        // JSX 纯文本
        'This page demonstrates 5 levels of component nesting',
        'split',
        'This page demonstrates 5 levels of component ~ nesting',
        'asda',
        'dddd',
        'd',
        'ddd',
        // 不完整标记（保留 ~）
        'sdsd~',
        '~asd',
      ];

      const result = transformer.transform(sourceCode, allKeys, true, 'app');

      console.log('转换后的代码:');
      console.log(result.code);

      // 验证完整标记被转换（去掉 ~）
      expect(result.code).toContain('I18n.t("dsdsdad")');
      expect(result.code).toContain('I18n.t("11")');

      // 验证不完整标记被转换（保留 ~）
      expect(result.code).toContain('{I18n.t("sdsd~")}');
      expect(result.code).toContain('{I18n.t("~asd")}');

      // 验证 JSX 纯文本被转换
      expect(result.code).toContain('{I18n.t("Nested Components Demo")}');
      expect(result.code).toContain('{I18n.t("split")}');
      expect(result.code).toContain('{I18n.t("asda")}');
      expect(result.code).toContain('{I18n.t("dddd")}');
      expect(result.code).toContain('{I18n.t("d")}');
      expect(result.code).toContain('{I18n.t("ddd")}');

      // 不应该有带 ~ 的完整标记 key（被转换掉了）
      expect(result.code).not.toContain('~dsdsdad~');
      expect(result.code).not.toContain('~Nested Components Demo~');
      expect(result.code).not.toContain('~11~');

      console.log('✓ 转换完成，生成了 ' + result.keyCount + ' 个 I18n.t() 调用');
    });
  });

  describe('完整流程测试', () => {
    it('提取和转换的完整流程应该一致', () => {
      // 1. 使用各提取器提取内容
      const jsxExtractor = new JSXTextExtractor(mockConfig);
      const markExtractor = new MarkExtractor();
      const templateExtractor = new TemplateExtractor(mockConfig);

      const jsxResults = jsxExtractor.extract(sourceCode, 'test.tsx');
      const markResults = markExtractor.extractWithInfo(sourceCode, '~', '~');
      const templateResults = templateExtractor.extract(sourceCode, 'test.tsx');

      // 2. 汇总所有 keys
      const allKeys = new Set<string>();

      // MarkExtractor 提供完整标记的清理后文本
      markResults.forEach(r => allKeys.add(r.cleanedText));

      // JSXTextExtractor 提供纯文本
      jsxResults.forEach(r => allKeys.add(r.cleanedText));

      // TemplateExtractor 提供模板文本
      templateResults.forEach(r => allKeys.add(r.cleanedText));

      console.log('完整流程 - 汇总的所有 keys:');
      allKeys.forEach(key => console.log(`  - "${key}"`));

      // 3. 使用 CodeTransformer 转换
      const transformer = new CodeTransformer();
      const transformResult = transformer.transform(
        sourceCode,
        Array.from(allKeys),
        true,
        'app'
      );

      // 4. 验证转换结果
      expect(transformResult.hasChanges).toBe(true);

      // 验证关键标记被正确转换
      expect(transformResult.code).toContain('{I18n.t("sdsd~")}');  // 不完整标记保留 ~
      expect(transformResult.code).toContain('{I18n.t("~asd")}');   // 不完整标记保留 ~
      expect(transformResult.code).toContain('I18n.t("dsdsdad")');  // 完整标记去掉 ~

      console.log('\n✓ 完整流程测试通过');
      console.log(`  提取了 ${allKeys.size} 个唯一 keys`);
      console.log(`  转换了 ${transformResult.keyCount} 个 I18n.t() 调用`);
    });
  });

  describe('边界情况测试', () => {
    it('应该正确处理包含 ~ 但不完整的文本', () => {
      const extractor = new JSXTextExtractor(mockConfig);
      const results = extractor.extract(sourceCode, 'test.tsx');

      // "This page demonstrates 5 levels of component ~ nesting"
      // 包含 ~ 但不是完整标记，应该作为普通文本提取
      const withMiddleTilde = results.find(r =>
        r.cleanedText.includes('component ~ nesting')
      );
      expect(withMiddleTilde).toBeDefined();
      // ~ 应该被保留在 key 中
      expect(withMiddleTilde?.cleanedText).toContain(' ~ ');
    });

    it('应该跳过单独的 ~ 符号（没有英文字符）', () => {
      const extractor = new JSXTextExtractor(mockConfig);
      const results = extractor.extract(sourceCode, 'test.tsx');

      // 源码中有多个单独的 ~（如 ~<h1> 和 </h1>~）
      // 但这些不包含英文字符，应该被跳过
      const singleTildes = results.filter(r => r.cleanedText === '~');
      expect(singleTildes.length).toBe(0);
      console.log(`  ✓ 单独的 ~ 符号被正确跳过（不包含英文字符）`);
    });

    it('应该跳过纯变量模板', () => {
      const extractor = new TemplateExtractor(mockConfig);
      const results = extractor.extract(sourceCode, 'test.tsx');

      // `~${1}~` 只有变量没有静态文本，应该被跳过
      const hasPureVarTemplate = results.some(r =>
        r.cleanedText === '%{var0}' || r.cleanedText === '~%{var0}~'
      );
      expect(hasPureVarTemplate).toBe(false);
    });

    it('单独的 ~ 不会被转换为 I18n.t() 调用', () => {
      const transformer = new CodeTransformer();
      const allKeys = [
        'dsdsdad',
        'Nested Components Demo',
        '11',
        'sdsd~',
        '~asd',
        'asda',
        'dddd',
        'split',
        'd',
        'ddd',
        'This page demonstrates 5 levels of component nesting',
        'This page demonstrates 5 levels of component ~ nesting',
      ];

      const result = transformer.transform(sourceCode, allKeys, true, 'app');

      // 单独的 ~ 不会被转换（因为没有对应的 key）
      // 转换后的代码中应该保留原始的 ~ 符号
      expect(result.code).toMatch(/\{I18n\.t\("sdsd~"\)\}/);  // 不完整标记被转换
      expect(result.code).toMatch(/\{I18n\.t\("~asd"\)\}/);   // 不完整标记被转换
      // 单独的 ~ 会被保留（因为不在 keys 列表中）
      expect(result.code).toMatch(/~<h1>/);  // 单独的 ~ 在开头
      expect(result.code).toMatch(/<\/span>~/);  // 单独的 ~ 在结尾
    });
  });
});
