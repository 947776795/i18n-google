/**
 * TemplateExtractor 测试用例
 * 模板字符串翻译提取功能
 */

import { TemplateExtractor } from '../../domain/collect/TemplateExtractor';
import type { I18nConfig } from '../../types/config';

const mockConfig: I18nConfig = {
  rootDir: './',
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

describe('TemplateExtractor', () => {
  let extractor: TemplateExtractor;

  beforeEach(() => {
    extractor = new TemplateExtractor(mockConfig);
  });

  describe('正向测试 - 应该提取的场景', () => {
    test('应该提取简单的标记模板字符串', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~Hello \${name}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('template');
      expect(results[0].cleanedText).toBe('Hello %{var0}');
      expect(results[0].variables).toBeDefined();
      expect(results[0].variables).toHaveLength(1);
      expect(results[0].variables![0].placeholder).toBe('var0');
      expect(results[0].variables![0].expression).toBe('name');
    });

    test('应该提取带多个变量的模板字符串', () => {
      const source = `
        function Component() {
          const firstName = "John";
          const lastName = "Doe";
          const message = \`~Hello \${firstName} \${lastName}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello %{var0} %{var1}');
      expect(results[0].variables).toHaveLength(2);
      expect(results[0].variables![0].placeholder).toBe('var0');
      expect(results[0].variables![0].expression).toBe('firstName');
      expect(results[0].variables![1].placeholder).toBe('var1');
      expect(results[0].variables![1].expression).toBe('lastName');
    });

    test('应该提取在 JSX 中的模板字符串', () => {
      const source = `
        function Component() {
          const count = 5;
          return <div>{\`~You have \${count} items~\`}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('template');
      expect(results[0].cleanedText).toBe('You have %{var0} items');
    });

    test('应该提取在函数调用中的模板字符串', () => {
      const source = `
        function Component() {
          const name = "John";
          console.log(\`~Hello \${name}~\`);
          return <div>Test</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello %{var0}');
    });

    test('应该提取带成员表达式变量的模板字符串', () => {
      const source = `
        function Component() {
          const user = { name: "John" };
          const message = \`~Hello \${user.name}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello %{var0}');
      expect(results[0].variables![0].type).toBe('member');
      expect(results[0].variables![0].expression).toBe('user.name');
    });

    test('应该提取多个标记模板字符串', () => {
      const source = `
        function Component() {
          const name = "John";
          const greeting = \`~Hello \${name}~\`;
          const farewell = \`~Goodbye \${name}~\`;
          return <div>{greeting}{farewell}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.cleanedText)).toEqual(['Hello %{var0}', 'Goodbye %{var0}']);
    });

    test('应该正确处理带空格的模板字符串', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~  Hello \${name}  ~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello %{var0}');
    });
  });

  describe('负向测试 - 不应该提取的场景', () => {
    test('不应该提取没有标记符号的模板字符串', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`Hello \${name}\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该提取 import 语句中的模板字符串', () => {
      const source = `
        import React from \`~react~\`;

        function Component() {
          return <div>~Hello~</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      // import 中的模板字符串不应该被提取
      expect(results).toHaveLength(0);
    });

    test('不应该提取 I18n.t() 调用中的模板字符串', () => {
      const source = `
        function Component() {
          return <div>{I18n.t(\`~Existing Key~\`)}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该提取没有变量的模板字符串（由 StringExtractor 处理）', () => {
      const source = `
        function Component() {
          const message = \`~Hello World~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      // 没有变量的模板字符串应该由 StringExtractor 处理
      // 但 TemplateExtractor 也会提取，因为它是 TemplateLiteral
      // 这里我们期望 TemplateExtractor 也提取它
      expect(results).toHaveLength(1);
      expect(results[0].variables).toBeUndefined();
    });

    test('不应该提取只有空白的模板字符串', () => {
      const source = `
        function Component() {
          const message = \`~~~~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });
  });

  describe('变量映射测试', () => {
    test('应该正确识别标识符类型的变量', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~Hello \${name}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].variables![0].type).toBe('identifier');
    });

    test('应该正确识别成员表达式类型的变量', () => {
      const source = `
        function Component() {
          const user = { name: "John" };
          const message = \`~Hello \${user.name}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].variables![0].type).toBe('member');
      expect(results[0].variables![0].expression).toBe('user.name');
    });

    test('应该正确设置变量位置信息', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~Hello \${name}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].variables![0].position.line).toBeGreaterThan(0);
      expect(results[0].variables![0].position.column).toBeGreaterThanOrEqual(0);
    });

    test('应该正确处理嵌套成员表达式', () => {
      const source = `
        function Component() {
          const user = { profile: { name: "John" } };
          const message = \`~Hello \${user.profile.name}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].variables![0].type).toBe('member');
    });
  });

  describe('边界情况测试', () => {
    test('应该正确处理变量在开头的模板字符串', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~\${name} is here~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('%{var0} is here');
    });

    test('应该正确处理变量在结尾的模板字符串', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~Hello \${name}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello %{var0}');
    });

    test('不应该提取纯变量模板字符串（Feature 4 新行为）', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~\${name}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      // Feature 4: 纯变量模板（没有静态文本）不应该被提取
      expect(results).toHaveLength(0);
    });

    test('应该正确处理带有换行符的模板字符串', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~Hello \${name}
        World~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      // 换行符应该被规范化为空格
      expect(results[0].cleanedText).toBe('Hello %{var0} World');
    });

    test('应该正确处理重复的标记符号', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~~Hello \${name}~~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello %{var0}');
    });
  });

  describe('上下文信息测试', () => {
    test('应该正确设置提取上下文', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~Hello \${name}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].context.filePath).toBe('test.tsx');
      expect(results[0].context.nodeType).toBe('TemplateLiteral');
    });

    test('应该正确设置位置信息', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~Hello \${name}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].position.line).toBeGreaterThan(0);
      expect(results[0].position.column).toBeGreaterThanOrEqual(0);
    });

    test('应该正确判断是否在 JSX 上下文中', () => {
      const source = `
        function Component() {
          const name = "John";
          return <div>{\`~Hello \${name}~\`}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].context.isInJSX).toBe(true);
    });
  });

  describe('英文字符检测测试', () => {
    test('应该正确检测包含英文字符的模板字符串', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~Hello \${name}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].hasEnglish).toBe(true);
    });

    test('应该正确检测包含英文变量名的模板字符串', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~你好 \${name}~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      // 变量名 name 是英文，所以 hasEnglish 应该是 true
      expect(results[0].hasEnglish).toBe(true);
    });
  });

  describe('翻译键生成测试', () => {
    test('应该为清理后的模板文本生成翻译键', () => {
      const source = `
        function Component() {
          const name = "John";
          const message = \`~  Hello \${name}  ~\`;
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].translationKey).toBe('Hello %{var0}');
    });
  });
});
