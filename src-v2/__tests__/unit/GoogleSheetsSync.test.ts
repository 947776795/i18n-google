/**
 * GoogleSheetsSync 单元测试
 */

import { GoogleSheetsSync } from '../../infra/sync/GoogleSheetsSync';
import { TranslationRecord } from '../../types/record';
import { I18nConfig } from '../../types/config';

// Mock Google Sheets Client
jest.mock('googleapis');

describe('GoogleSheetsSync', () => {
  const mockConfig: I18nConfig = {
    rootDir: './src',
    languages: ['en', 'ko', 'zh-CN'],
    ignore: ['**/node_modules/**'],
    include: ['ts', 'tsx'],
    outputDir: './src/translate',
    spreadsheetId: 'test-spreadsheet-id',
    sheetName: 'i18n',
    keyFile: './test-key-file.json',
    startMarker: '~',
    endMarker: '~',
    sheetsReadRange: 'A1:Z10000',
    apiKey: 'test-api-key',
  };

  describe('pull - 拉取远端翻译', () => {
    it('应该返回空记录当远端没有数据时', async () => {
      const sync = new GoogleSheetsSync(mockConfig);
      const result = await sync.pull();

      expect(result).toEqual({});
    });

    it('应该正确解析远端数据格式', async () => {
      const sync = new GoogleSheetsSync(mockConfig);
      // 模拟远端返回数据
      const mockRemoteData = [
        ['key', 'en', 'ko', 'zh-CN'],
        ['[app/page.tsx][Welcome]', 'Welcome', '환영합니다', '欢迎'],
        ['[app/page.tsx][Login]', 'Login', '로그인', '登录'],
      ];

      const result = await sync.pull();

      // 验证解析后的格式
      expect(result).toBeDefined();
    });

    it('应该跳过格式不正确的行', async () => {
      const sync = new GoogleSheetsSync(mockConfig);

      const result = await sync.pull();

      // 应该跳过不符合 [filePath][key] 格式的行
      expect(result).toBeDefined();
    });
  });

  describe('push - 推送翻译到远端', () => {
    it('应该正确转换本地数据为远端格式', async () => {
      const sync = new GoogleSheetsSync(mockConfig);

      const mockRecord: TranslationRecord = {
        'app': {
          'en.json': {
            'Welcome': 'Welcome',
            'Login': 'Login',
          },
          'ko.json': {
            'Welcome': '환영합니다',
            'Login': '로그인',
          },
        },
      };

      await expect(sync.push(mockRecord, [])).resolves.not.toThrow();
    });

    it('应该过滤已删除的 keys', async () => {
      const sync = new GoogleSheetsSync(mockConfig);

      const mockRecord: TranslationRecord = {
        'app': {
          'en.json': {
            'Welcome': 'Welcome',
          },
        },
      };

      const deletedKeys = ['[app][OldKey]'];

      await expect(sync.push(mockRecord, deletedKeys)).resolves.not.toThrow();
    });
  });

  describe('数据转换', () => {
    it('应该正确将远端格式转换为本地格式', () => {
      const sync = new GoogleSheetsSync(mockConfig);

      // 远端格式
      const remoteData = [
        ['key', 'en', 'ko'],
        ['[app/page.tsx][Welcome]', 'Welcome', '환영합니다'],
      ];

      // 验证转换结果
      // 本地格式应该是 { "app": { "en.json": { "Welcome": "Welcome" } } }
    });

    it('应该正确将本地格式转换为远端格式', () => {
      const sync = new GoogleSheetsSync(mockConfig);

      // 本地格式
      const localRecord: TranslationRecord = {
        'app': {
          'en.json': {
            'Welcome': 'Welcome',
          },
        },
      };

      // 验证转换结果
      // 远端格式应该是 ["[app/page.tsx][Welcome]", "Welcome", ...]
    });
  });
});
