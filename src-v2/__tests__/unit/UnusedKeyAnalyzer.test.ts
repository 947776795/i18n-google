/**
 * UnusedKeyAnalyzer 单元测试
 */

import { UnusedKeyAnalyzer } from '../../domain/cleanup/UnusedKeyAnalyzer';
import { TranslationRecord } from '../../types/record';
import { CodeReference } from '../../types/sync';

describe('UnusedKeyAnalyzer', () => {
  describe('analyze - 分析无用的 keys', () => {
    it('应该正确识别未被引用的 keys', () => {
      const analyzer = new UnusedKeyAnalyzer();

      // 翻译记录
      const record: TranslationRecord = {
        'app': {
          'en.json': {
            'Welcome': 'Welcome',
            'Login': 'Login',
            'OldKey': 'Old Key',
          },
        },
        'components': {
          'en.json': {
            'Title': 'Title',
            'Deprecated': 'Deprecated',
          },
        },
      };

      // 当前代码引用
      const references = new Set<CodeReference>([
        { folderName: 'app', key: 'Welcome' },
        { folderName: 'app', key: 'Login' },
        { folderName: 'components', key: 'Title' },
      ]);

      const result = analyzer.analyze(record, references);

      // 应该识别出两个无用的 keys
      expect(result.total).toBe(2);
      expect(result.formattedUnusedKeys).toContain('[app][OldKey]');
      expect(result.formattedUnusedKeys).toContain('[components][Deprecated]');
    });

    it('应该返回空结果当所有 keys 都在使用中', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const record: TranslationRecord = {
        'app': {
          'en.json': {
            'Welcome': 'Welcome',
            'Login': 'Login',
          },
        },
      };

      const references = new Set<CodeReference>([
        { folderName: 'app', key: 'Welcome' },
        { folderName: 'app', key: 'Login' },
      ]);

      const result = analyzer.analyze(record, references);

      expect(result.total).toBe(0);
      expect(result.formattedUnusedKeys).toHaveLength(0);
    });

    it('应该处理空记录', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const record: TranslationRecord = {};
      const references = new Set<CodeReference>();

      const result = analyzer.analyze(record, references);

      expect(result.total).toBe(0);
      expect(result.formattedUnusedKeys).toHaveLength(0);
    });

    it('应该使用直接子路径匹配规则', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const record: TranslationRecord = {
        'app': {
          'en.json': {
            'Welcome': 'Welcome',
          },
        },
      };

      // 代码引用的路径是直接子路径（app_sub）
      const references = new Set<CodeReference>([
        { folderName: 'app_sub', key: 'Welcome' },
      ]);

      const result = analyzer.analyze(record, references);

      // 应该匹配上（app 是 app_sub 的父路径前缀）
      expect(result.total).toBe(0);
    });
  });

  describe('isKeyUsed - 检查 key 是否被使用', () => {
    it('应该精确匹配 folderName 和 key', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const references = new Set<CodeReference>([
        { folderName: 'app', key: 'Welcome' },
      ]);

      // 精确匹配
      expect(analyzer.isKeyUsed('app', 'Welcome', references)).toBe(true);

      // folderName 不匹配
      expect(analyzer.isKeyUsed('components', 'Welcome', references)).toBe(false);

      // key 不匹配
      expect(analyzer.isKeyUsed('app', 'Login', references)).toBe(false);
    });

    it('应该使用直接子路径匹配', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const references = new Set<CodeReference>([
        { folderName: 'app_sub_page', key: 'Welcome' },
      ]);

      // 直接子路径匹配：app 匹配 app_sub_page
      expect(analyzer.isKeyUsed('app', 'Welcome', references)).toBe(true);
    });

    it('不应该使用后缀匹配（避免误匹配）', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const references = new Set<CodeReference>([
        { folderName: 'src_app', key: 'Welcome' },
      ]);

      // src_app 不应该匹配 app（因为 src_app 不是以 app_ 开头的子路径）
      expect(analyzer.isKeyUsed('app', 'Welcome', references)).toBe(false);
    });

    it('不应该使用同名文件匹配（避免误匹配）', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const references = new Set<CodeReference>([
        { folderName: 'app_sub1_layout', key: 'Welcome' },
      ]);

      // app_sub1_layout 不应该匹配 app_sub1_deep_layout
      expect(analyzer.isKeyUsed('app_sub1_deep_layout', 'Welcome', references)).toBe(false);
    });
  });
});
