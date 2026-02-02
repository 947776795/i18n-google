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

    it('应该使用后缀匹配规则', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const record: TranslationRecord = {
        'app': {
          'en.json': {
            'Welcome': 'Welcome',
          },
        },
      };

      // 代码引用的路径可能不完全匹配，但后缀匹配
      const references = new Set<CodeReference>([
        { folderName: 'src_app', key: 'Welcome' },
      ]);

      const result = analyzer.analyze(record, references);

      // 应该匹配上（src_app 后缀是 app）
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

    it('应该使用后缀匹配', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const references = new Set<CodeReference>([
        { folderName: 'src_app', key: 'Welcome' },
      ]);

      // 后缀匹配：app 匹配 src_app
      expect(analyzer.isKeyUsed('app', 'Welcome', references)).toBe(true);
    });

    it('应该使用同名文件匹配', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const references = new Set<CodeReference>([
        { folderName: 'src_app_page', key: 'Welcome' },
      ]);

      // 同名文件匹配：page
      expect(analyzer.isKeyUsed('page', 'Welcome', references)).toBe(true);
    });
  });
});
