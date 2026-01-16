/**
 * Feature 4: 模板字符串占位符支持 - TDD 测试用例
 *
 * 需求：
 * - `~${1}kkkk~` → 提取并转换为 I18n.t("kkkk", { var0: 1 })
 * - `~${1}~` → 不提取（只有变量）
 */

import { TemplateExtractor } from '../../domain/collect/TemplateExtractor';
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

describe('Feature 4: 模板字符串占位符支持', () => {
  describe('TemplateExtractor - 区分纯变量和混合内容', () => {
    let extractor: TemplateExtractor;

    beforeEach(() => {
      extractor = new TemplateExtractor(mockConfig);
    });

    describe('只有变量的模板字符串不应该提取', () => {
      test('`${1}` 不应该被提取', () => {
        const source = `
          export default function Page() {
            const a = \`~\${1}~\`;
            return <div>{a}</div>;
          }
        `;

        const results = extractor.extract(source, 'test.tsx');

        // 只有变量，不应该提取
        expect(results.length).toBe(0);
      });

      test('`${user.name}` 不应该被提取', () => {
        const source = `
          export default function Page({ user }) {
            const a = \`~\${user.name}~\`;
            return <div>{a}</div>;
          }
        `;

        const results = extractor.extract(source, 'test.tsx');

        expect(results.length).toBe(0);
      });

      test('`${a}${b}` 不应该被提取', () => {
        const source = `
          export default function Page() {
            const a = \`~\${a}\${b}~\`;
            return <div>{a}</div>;
          }
        `;

        const results = extractor.extract(source, 'test.tsx');

        expect(results.length).toBe(0);
      });
    });

    describe('变量 + 静态文本应该提取', () => {
      test('`${1}kkkk` 应该被提取', () => {
        const source = `
          export default function Page() {
            const a = \`~\${1}kkkk~\`;
            return <div>{a}</div>;
          }
        `;

        const results = extractor.extract(source, 'test.tsx');

        expect(results.length).toBe(1);
        expect(results[0].cleanedText).toBe('%{var0}kkkk');
        expect(results[0].variables).toBeDefined();
        expect(results[0].variables!.length).toBe(1);
      });

      test('`Hello ${user}!` 应该被提取', () => {
        const source = `
          export default function Page({ user }) {
            const a = \`~Hello \${user}!~\`;
            return <div>{a}</div>;
          }
        `;

        const results = extractor.extract(source, 'test.tsx');

        expect(results.length).toBe(1);
        expect(results[0].cleanedText).toBe('Hello %{var0}!');
        expect(results[0].variables![0].expression).toBe('user');
      });

      test('`${1} items, ${2} total` 应该被提取', () => {
        const source = `
          export default function Page() {
            const a = \`~\${1} items, \${2} total~\`;
            return <div>{a}</div>;
          }
        `;

        const results = extractor.extract(source, 'test.tsx');

        expect(results.length).toBe(1);
        expect(results[0].cleanedText).toBe('%{var0} items, %{var1} total');
        expect(results[0].variables!.length).toBe(2);
      });
    });

    describe('变量映射信息', () => {
      test('应该正确记录标识符类型变量', () => {
        const source = `
          export default function Page({ name }) {
            const a = \`~Hello \${name}~\`;
            return <div>{a}</div>;
          }
        `;

        const results = extractor.extract(source, 'test.tsx');

        expect(results.length).toBe(1);
        expect(results[0].variables![0].type).toBe('identifier');
        expect(results[0].variables![0].expression).toBe('name');
      });

      test('应该正确记录成员表达式类型变量', () => {
        const source = `
          export default function Page({ user }) {
            const a = \`~Hello \${user.name}~\`;
            return <div>{a}</div>;
          }
        `;

        const results = extractor.extract(source, 'test.tsx');

        expect(results.length).toBe(1);
        expect(results[0].variables![0].type).toBe('member');
        expect(results[0].variables![0].expression).toBe('user.name');
      });
    });
  });

  describe('CodeTransformer - 模板字符串转换', () => {
    let transformer: CodeTransformer;

    beforeEach(() => {
      transformer = new CodeTransformer();
    });

    test('应该将带标记的模板字符串转换为 I18n.t() 调用', () => {
      const source = `
        export default function Page({ name }) {
          const a = \`~Hello \${name}~\`;
          return <div>{a}</div>;
        }
      `;

      // 传递清理后的 key（带占位符格式）
      // `~Hello ${name}~` → cleaned = "Hello %{var0}"
      const marks = ['Hello %{var0}'];

      const result = transformer.transform(source, marks, true, 'app_page');

      expect(result.code).toContain('I18n.t(');
      expect(result.hasChanges).toBe(true);
    });

    test('应该保持纯变量模板字符串不变', () => {
      const source = `
        export default function Page() {
          const a = \`~\${1}~\`;
          return <div>{a}</div>;
        }
      `;

      const marks: string[] = [];

      const result = transformer.transform(source, marks, true, 'app_page');

      // 纯变量应该保持不变
      expect(result.code).toContain('~${1}~');
    });
  });
});
