/**
 * StringExtractor 测试用例
 * 字符串字面量翻译提取功能
 */

import { StringExtractor } from '../../domain/collect/StringExtractor';
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

describe('StringExtractor', () => {
  let extractor: StringExtractor;

  beforeEach(() => {
    extractor = new StringExtractor(mockConfig);
  });

  describe('正向测试 - 应该提取的场景', () => {
    test('应该提取简单的标记字符串', () => {
      const source = String.raw`
        function Component() {
          const message = "~Hello World~";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('string');
      expect(results[0].cleanedText).toBe('Hello World');
      expect(results[0].translationKey).toBe('Hello World');
    });

    test('应该提取带空格的标记字符串', () => {
      const source = String.raw`
        function Component() {
          return <div>~  Welcome to our site  ~</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Welcome to our site');
    });

    test('应该提取多个标记字符串', () => {
      const source = String.raw`
        function Component() {
          const a = "~First~";
          const b = "~Second~";
          const c = "~Third~";
          return <div>{a}{b}{c}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(3);
      expect(results.map(r => r.cleanedText)).toEqual(['First', 'Second', 'Third']);
    });

    test('应该提取在 JSX 中的标记字符串', () => {
      const source = String.raw`
        function Component() {
          return <div>~Welcome~</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('string');
      expect(results[0].cleanedText).toBe('Welcome');
    });

    test('应该提取在 JS 表达式中的标记字符串', () => {
      const source = `
        function Component() {
          const loading = "~Loading~";
          return <div>{loading}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results.map(r => r.cleanedText)).toEqual(['Loading']);
    });

    test('应该提取在对象属性中的标记字符串', () => {
      const source = String.raw`
        function Component() {
          const config = {
            title: "~Welcome~",
            description: "~This is a description~"
          };
          return <div>{config.title}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.cleanedText)).toEqual(['Welcome', 'This is a description']);
    });

    test('应该提取在数组中的标记字符串', () => {
      const source = String.raw`
        function Component() {
          const items = ["~Item 1~", "~Item 2~", "~Item 3~"];
          return <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(3);
      expect(results.map(r => r.cleanedText)).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    test('应该提取在函数参数中的标记字符串', () => {
      const source = String.raw`
        function Component() {
          return <button onClick={handleClick("~Confirm~")}>Submit</button>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Confirm');
    });
  });

  describe('负向测试 - 不应该提取的场景', () => {
    test('不应该提取没有标记符号的字符串', () => {
      const source = String.raw`
        function Component() {
          const message = "Hello World";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该提取 import 语句中的字符串', () => {
      const source = String.raw`
        import React from "~react~";
        import { Component } from "~library~";

        function Test() {
          return <div>~Hello~</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      // 只应该提取 JSX 中的字符串，不提取 import 中的
      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello');
    });

    test('不应该提取 I18n.t() 调用中的字符串', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("~Existing Key~")}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该提取模板字符串', () => {
      // 使用 JavaScript 字符串构造函数来创建包含模板字符串的源码
      const source = String.raw`
        function Component() {
          const name = "John";
          const message = ${'`~Hello ${name}~`'};
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      // 模板字符串应该由 TemplateExtractor 处理，不是 StringExtractor 的职责
      expect(results).toHaveLength(0);
    });

    test('不应该提取空字符串', () => {
      const source = String.raw`
        function Component() {
          const empty = "~~~~";
          return <div>{empty}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该提取只有空白字符的字符串', () => {
      const source = String.raw`
        function Component() {
          const whitespace = "~   ~";
          return <div>{whitespace}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该提取只有结束标记的字符串', () => {
      const source = String.raw`
        function Component() {
          const message = "Hello World~";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该提取只有开始标记的字符串', () => {
      const source = String.raw`
        function Component() {
          const message = "~Hello World";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });
  });

  describe('边界情况测试', () => {
    test('应该正确处理标记符号在字符串内部的情况', () => {
      const source = String.raw`
        function Component() {
          const message = "Start ~Hello~ End";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      // 只有整个字符串被标记符号包围才提取
      expect(results).toHaveLength(0);
    });

    test('应该正确处理重复的标记符号', () => {
      const source = String.raw`
        function Component() {
          const message = "~~Hello World~~";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello World');
    });

    test('应该正确处理带有换行符的字符串', () => {
      const source = String.raw`
        function Component() {
          const message = "~Hello\nWorld~";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello World'); // 换行符被规范化为空格
    });

    test('应该正确处理特殊字符', () => {
      const source = String.raw`
        function Component() {
          const message = "~Hello! How are you? @#$%^&*()~";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello! How are you? @#$%^&*()');
    });

    test('应该正确提取在复杂嵌套结构中的字符串', () => {
      const source = String.raw`
        function Component() {
          const data = {
            nested: {
              deep: {
                message: "~Deep Message~"
              }
            }
          };
          return <div>{data.nested.deep.message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Deep Message');
    });

    test('应该正确处理在异步函数中的字符串', () => {
      const source = String.raw`
        async function Component() {
          const message = await fetchMessage("~Async Message~");
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Async Message');
    });
  });

  describe('上下文信息测试', () => {
    test('应该正确设置提取上下文', () => {
      const source = String.raw`
        function Component() {
          const message = "~Hello World~";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].context.filePath).toBe('test.tsx');
      expect(results[0].context.nodeType).toBe('StringLiteral');
    });

    test('应该正确设置位置信息', () => {
      const source = String.raw`
        function Component() {
          const message = "~Hello World~";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].position.line).toBeGreaterThan(0);
      expect(results[0].position.column).toBeGreaterThanOrEqual(0);
    });

    test('应该正确判断是否在 JSX 上下文中', () => {
      const source = String.raw`
        function Component() {
          return <div attr="~Attribute~" />
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].context.isInJSX).toBe(true);
    });
  });

  describe('翻译键生成测试', () => {
    test('应该使用原文作为翻译键', () => {
      const source = String.raw`
        function Component() {
          const message = "~Hello World~";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].translationKey).toBe('Hello World');
    });

    test('应该为清理后的文本生成翻译键', () => {
      const source = String.raw`
        function Component() {
          const message = "~  Hello   World  ~";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].translationKey).toBe('Hello World');
    });
  });

  describe('英文字符检测测试', () => {
    test('应该正确检测包含英文字符的字符串', () => {
      const source = String.raw`
        function Component() {
          const message = "~Hello World~";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].hasEnglish).toBe(true);
    });

    test('应该正确检测不包含英文字符的字符串', () => {
      const source = String.raw`
        function Component() {
          const message = "~你好世界~";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].hasEnglish).toBe(false);
    });
  });

  describe('变量映射测试', () => {
    test('字符串字面量不应该有变量映射', () => {
      const source = String.raw`
        function Component() {
          const message = "~Hello World~";
          return <div>{message}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].variables).toBeUndefined();
    });
  });
});
