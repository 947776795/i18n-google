/**
 * JSXTextExtractor 测试用例
 * JSX 纯文本翻译提取功能
 */

import { JSXTextExtractor } from '../../domain/collect/JSXTextExtractor';
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

describe('JSXTextExtractor', () => {
  let extractor: JSXTextExtractor;

  beforeEach(() => {
    extractor = new JSXTextExtractor(mockConfig);
  });

  describe('正向测试 - 应该提取的场景', () => {
    test('应该提取简单的 JSX 纯文本', () => {
      const source = String.raw`
        function Component() {
          return <div>Welcome</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('jsx-text');
      expect(results[0].cleanedText).toBe('Welcome');
      expect(results[0].translationKey).toBe('Welcome');
      expect(results[0].hasEnglish).toBe(true);
    });

    test('应该提取多个 JSX 纯文本', () => {
      const source = String.raw`
        function Component() {
          return <div>
            <h1>Welcome</h1>
            <p>This is a description</p>
          </div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.cleanedText)).toEqual(['Welcome', 'This is a description']);
    });

    test('应该提取在嵌套 JSX 中的文本', () => {
      const source = String.raw`
        function Component() {
          return <div>
            <span>Hello</span>
            <span>World</span>
          </div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.cleanedText)).toEqual(['Hello', 'World']);
    });

    test('应该正确清理空格和换行', () => {
      const source = String.raw`
        function Component() {
          return <div>
            Welcome  
            to  
            our  
            site
          </div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Welcome to our site');
    });
  });

  describe('负向测试 - 不应该提取的场景', () => {
    test('不应该提取不含英文字符的文本', () => {
      const source = String.raw`
        function Component() {
          return <div>你好世界</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该提取纯空白的文本', () => {
      const source = String.raw`
        function Component() {
          return <div>   </div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该提取只有标点符号的文本', () => {
      const source = String.raw`
        function Component() {
          return <div>!!!</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该提取数字和标点的文本', () => {
      const source = String.raw`
        function Component() {
          return <div>123!!!</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该提取 JSX 表达式容器', () => {
      const source = String.raw`
        function Component() {
          const name = "John";
          return <div>{name}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('应该提取带标记的文本（Feature 3 新行为）', () => {
      const source = String.raw`
        function Component() {
          return <div>~Hello World~</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      // Feature 3: JSXTextExtractor 现在也提取带标记的文本，会自动去除标记
      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello World');
    });

    test('不应该提取字符串字面量', () => {
      const source = String.raw`
        function Component() {
          return <div>{'Hello World'}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该提取模板字符串', () => {
      const source = String.raw`
        function Component() {
          const name = "John";
          return <div>{String(\`Hello \${name}\`)}</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });
  });

  describe('边界情况测试', () => {
    test('应该正确处理带有属性的 JSX 元素', () => {
      const source = String.raw`
        function Component() {
          return <div className="container">Welcome</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Welcome');
    });

    test('应该正确处理自闭合元素', () => {
      const source = String.raw`
        function Component() {
          return <div>
            Welcome<br/>
            to our site
          </div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.cleanedText)).toEqual(['Welcome', 'to our site']);
    });

    test('应该正确处理 JSX 片段', () => {
      const source = String.raw`
        function Component() {
          return (
            <>
              <span>Hello</span>
              <span>World</span>
            </>
          );
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.cleanedText)).toEqual(['Hello', 'World']);
    });

    test('应该正确处理包含 HTML 特殊字符的文本', () => {
      const source = String.raw`
        function Component() {
          return <div>Hello &amp; World</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello & World');
    });

    test('应该正确处理包含表情符号的文本', () => {
      const source = String.raw`
        function Component() {
          return <div>Hello 👋</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello 👋');
    });

    test('应该正确处理空字符串', () => {
      const source = String.raw`
        function Component() {
          return <div></div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('应该正确处理只有文本的元素', () => {
      const source = String.raw`
        function Component() {
          return <div>Text only</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Text only');
    });

    test('应该正确处理深层嵌套', () => {
      const source = String.raw`
        function Component() {
          return (
            <div>
              <div>
                <div>
                  <span>Hello</span>
                </div>
              </div>
            </div>
          );
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].cleanedText).toBe('Hello');
    });
  });

  describe('上下文信息测试', () => {
    test('应该正确设置提取上下文', () => {
      const source = String.raw`
        function Component() {
          return <div>Welcome</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].context.filePath).toBe('test.tsx');
      expect(results[0].context.nodeType).toBe('JSXText');
    });

    test('应该正确判断是否在 JSX 上下文中', () => {
      const source = String.raw`
        function Component() {
          return <div>Welcome</div>;
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
          return <div>Welcome</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].translationKey).toBe('Welcome');
    });

    test('应该为清理后的文本生成翻译键', () => {
      const source = String.raw`
        function Component() {
          return <div>  Welcome  </div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].translationKey).toBe('Welcome');
    });
  });

  describe('英文字符检测测试', () => {
    test('应该正确检测包含英文字符的文本', () => {
      const source = String.raw`
        function Component() {
          return <div>Hello World</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].hasEnglish).toBe(true);
    });

    test('应该正确检测不包含英文字符的文本', () => {
      const source = String.raw`
        function Component() {
          return <div>你好世界</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('应该正确检测混合语言的文本', () => {
      const source = String.raw`
        function Component() {
          return <div>Hello 你好</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].hasEnglish).toBe(true);
    });
  });

  describe('变量映射测试', () => {
    test('JSX 文本不应该有变量映射', () => {
      const source = String.raw`
        function Component() {
          return <div>Welcome</div>;
        }
      `;

      const results = extractor.extract(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].variables).toBeUndefined();
    });
  });
});
