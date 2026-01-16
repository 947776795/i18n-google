/**
 * ReferenceCollector 测试用例
 * 现有 I18n.t() 调用收集功能
 */

import { ReferenceCollector } from '../../domain/collect/ReferenceCollector';
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

describe('ReferenceCollector', () => {
  let collector: ReferenceCollector;

  beforeEach(() => {
    collector = new ReferenceCollector(mockConfig);
  });

  describe('正向测试 - 应该收集的场景', () => {
    test('应该收集字符串字面量参数的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('Welcome');
      expect(results[0].filePath).toBe('test.tsx');
    });

    test('应该收集模板字面量参数的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t(${'`Login`'})}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('Login');
      expect(results[0].filePath).toBe('test.tsx');
    });

    test('应该收集多个 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          return <div>
            {I18n.t("Welcome")}
            {I18n.t("Login")}
            {I18n.t("Logout")}
          </div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(3);
      expect(results.map(r => r.key)).toEqual(['Welcome', 'Login', 'Logout']);
    });

    test('应该收集在 JSX 表达式中的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Hello")}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('Hello');
    });

    test('应该收集在变量赋值中的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          const title = I18n.t("Page Title");
          return <div>{title}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('Page Title');
    });

    test('应该收集在数组中的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          const items = [
            I18n.t("Item 1"),
            I18n.t("Item 2")
          ];
          return <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.key)).toEqual(['Item 1', 'Item 2']);
    });

    test('应该收集在对象属性中的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          const config = {
            title: I18n.t("Welcome"),
            description: I18n.t("Description")
          };
          return <div>{config.title}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.key)).toEqual(['Welcome', 'Description']);
    });

    test('应该收集带有选项的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          const name = "John";
          return <div>{I18n.t("Hello", { name })}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('Hello');
    });

    test('应该收集嵌套调用中的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          return <div>{format(I18n.t("Welcome"))}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('Welcome');
    });
  });

  describe('负向测试 - 不应该收集的场景', () => {
    test('不应该收集非 I18n 的调用', () => {
      const source = String.raw`
        function Component() {
          return <div>{Other.t("Welcome")}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该收集不同方法的调用', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.translate("Welcome")}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该收集变量参数的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          const key = "Welcome";
          return <div>{I18n.t(key)}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该收集表达式参数的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t(getKey())}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('不应该收集没有参数的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t()}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });
  });

  describe('边界情况测试', () => {
    test('应该正确处理空文件', () => {
      const source = '';

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('应该正确处理只有注释的文件', () => {
      const source = String.raw`
        // This is a comment
        /* This is a block comment */
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(0);
    });

    test('应该正确处理重复的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          return <div>
            {I18n.t("Welcome")}
            {I18n.t("Welcome")}
          </div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('Welcome');
    });

    test('应该正确处理混合的调用', () => {
      const source = String.raw`
        function Component() {
          return <div>
            {I18n.t("Welcome")}
            {Other.t("Not I18n")}
            {I18n.t("Login")}
          </div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.key)).toEqual(['Welcome', 'Login']);
    });

    test('应该正确处理在函数中的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          function getTitle() {
            return I18n.t("Page Title");
          }
          return <div>{getTitle()}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('Page Title');
    });

    test('应该正确处理在箭头函数中的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          const getTitle = () => I18n.t("Page Title");
          return <div>{getTitle()}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('Page Title');
    });

    test('应该正确处理在条件表达式中的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          return <div>{isLoading ? I18n.t("Loading") : I18n.t("Done")}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.key)).toEqual(['Loading', 'Done']);
    });

    test('应该正确处理在逻辑表达式中的 I18n.t 调用', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Welcome") || I18n.t("Hello")}</div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      expect(results).toHaveLength(2);
      expect(results.map(r => r.key)).toEqual(['Welcome', 'Hello']);
    });
  });

  describe('去重测试', () => {
    test('应该正确处理相同 key 的多次引用', () => {
      const source = String.raw`
        function Component() {
          return <div>
            {I18n.t("Welcome")}
            {I18n.t("Welcome")}
            {I18n.t("Welcome")}
          </div>;
        }
      `;

      const results = collector.collect(source, 'test.tsx');

      // 按照简化版本的设计，每个文件中相同 key 只记录一次
      expect(results).toHaveLength(1);
      expect(results[0].key).toBe('Welcome');
      expect(results[0].filePath).toBe('test.tsx');
    });
  });

  describe('多文件测试', () => {
    test('应该正确收集不同文件的引用', () => {
      const source1 = String.raw`
        function Component1() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const source2 = String.raw`
        function Component2() {
          return <div>{I18n.t("Login")}</div>;
        }
      `;

      const results1 = collector.collect(source1, 'file1.tsx');
      const results2 = collector.collect(source2, 'file2.tsx');

      expect(results1).toHaveLength(1);
      expect(results1[0].key).toBe('Welcome');
      expect(results1[0].filePath).toBe('file1.tsx');

      expect(results2).toHaveLength(1);
      expect(results2[0].key).toBe('Login');
      expect(results2[0].filePath).toBe('file2.tsx');
    });
  });
});
