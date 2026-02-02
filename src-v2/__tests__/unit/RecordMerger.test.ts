/**
 * RecordMerger 单元测试
 */

import { RecordMerger } from '../../domain/record/RecordMerger';
import { TranslationRecord } from '../../types/record';

describe('RecordMerger', () => {
  describe('merge - 三方数据合并', () => {
    it('应该正确合并远端、本地和新扫描的数据', () => {
      const merger = new RecordMerger();

      // 远端数据
      const remote: TranslationRecord = {
        'app': {
          'en.json': {
            'Welcome': 'Welcome (Remote)',
            'Login': 'Login (Remote)',
          },
        },
      };

      // 本地数据
      const local: TranslationRecord = {
        'app': {
          'en.json': {
            'Welcome': 'Welcome (Local)',
            'Settings': 'Settings (Local)',
          },
        },
      };

      // 新扫描的 keys
      const newKeys = new Set(['Logout']);

      const result = merger.merge(remote, local, newKeys, 'app');

      // 验证：远端优先
      expect(result.mergedRecord['app']['en.json']['Welcome']).toBe('Welcome (Remote)');

      // 验证：远端有就采用远端
      expect(result.mergedRecord['app']['en.json']['Login']).toBe('Login (Remote)');

      // 验证：远端没有，本地有，采用本地
      expect(result.mergedRecord['app']['en.json']['Settings']).toBe('Settings (Local)');

      // 验证：新 key 直接添加
      expect(result.mergedRecord['app']['en.json']['Logout']).toBe('Logout');

      // 验证：统计数据
      expect(result.stats.fromRemote).toBe(2);
      expect(result.stats.fromLocal).toBe(1);
      expect(result.stats.newKeys).toBe(1);
    });

    it('应该处理空远端数据的情况', () => {
      const merger = new RecordMerger();

      const remote: TranslationRecord = {};
      const local: TranslationRecord = {
        'app': {
          'en.json': {
            'Welcome': 'Welcome',
          },
        },
      };
      const newKeys = new Set(['Login']);

      const result = merger.merge(remote, local, newKeys, 'app');

      expect(result.mergedRecord['app']['en.json']['Welcome']).toBe('Welcome');
      expect(result.mergedRecord['app']['en.json']['Login']).toBe('Login');
      expect(result.stats.fromRemote).toBe(0);
      expect(result.stats.fromLocal).toBe(1);
      expect(result.stats.newKeys).toBe(1);
    });

    it('应该处理空本地数据的情况', () => {
      const merger = new RecordMerger();

      const remote: TranslationRecord = {
        'app': {
          'en.json': {
            'Welcome': 'Welcome (Remote)',
          },
        },
      };
      const local: TranslationRecord = {};
      const newKeys = new Set(['Login']);

      const result = merger.merge(remote, local, newKeys, 'app');

      expect(result.mergedRecord['app']['en.json']['Welcome']).toBe('Welcome (Remote)');
      expect(result.mergedRecord['app']['en.json']['Login']).toBe('Login');
      expect(result.stats.fromRemote).toBe(1);
      expect(result.stats.fromLocal).toBe(0);
      expect(result.stats.newKeys).toBe(1);
    });

    it('应该处理远端和本地都没有的新 key', () => {
      const merger = new RecordMerger();

      const remote: TranslationRecord = {};
      const local: TranslationRecord = {};
      const newKeys = new Set(['Welcome', 'Login']);

      const result = merger.merge(remote, local, newKeys, 'app');

      expect(result.mergedRecord['app']['en.json']['Welcome']).toBe('Welcome');
      expect(result.mergedRecord['app']['en.json']['Login']).toBe('Login');
      expect(result.stats.fromRemote).toBe(0);
      expect(result.stats.fromLocal).toBe(0);
      expect(result.stats.newKeys).toBe(2);
    });
  });

  describe('mergeKey - 单个 key 合并策略', () => {
    it('远端优先：当远端有翻译时，采用远端', () => {
      const merger = new RecordMerger();

      const remote: TranslationRecord = {
        'app': {
          'en.json': { 'Welcome': 'Welcome (Remote)' },
        },
      };
      const local: TranslationRecord = {
        'app': {
          'en.json': { 'Welcome': 'Welcome (Local)' },
        },
      };

      const result = merger.merge(remote, local, new Set(), 'app');

      expect(result.mergedRecord['app']['en.json']['Welcome']).toBe('Welcome (Remote)');
    });

    it('本地次之：当远端没有时，采用本地', () => {
      const merger = new RecordMerger();

      const remote: TranslationRecord = {};
      const local: TranslationRecord = {
        'app': {
          'en.json': { 'Welcome': 'Welcome (Local)' },
        },
      };

      const result = merger.merge(remote, local, new Set(), 'app');

      expect(result.mergedRecord['app']['en.json']['Welcome']).toBe('Welcome (Local)');
    });
  });
});
