/**
 * Feature 5: 并发场景测试 - 推送前远端有更新
 *
 * 测试场景：
 * 1. 本地已有翻译记录
 * 2. 拉取远端 V1 时有更新
 * 3. 扫描时有新增翻译
 * 4. 检测到无用 key，用户选择删除
 * 5. 推送前，远端又有新更新 V2
 * 6. 期望：最终推送的远端翻译是正确的（包含 V2 更新 + 本地新增）
 */

import * as fs from 'fs';
import * as path from 'path';
import { Scanner } from '../../core/Scanner';
import { GoogleSheetsSync } from '../../infra/sync/GoogleSheetsSync';
import { setTestMode } from '../../ui/UserPrompt';
import { TranslationRecord } from '../../types/record';
import type { I18nConfig } from '../../types/config';

const mockConfig: I18nConfig = {
  rootDir: './src',
  languages: ['en', 'ko'],
  include: ['js', 'jsx', 'ts', 'tsx'],
  ignore: ['**/node_modules/**'],
  outputDir: './src/translate',
  startMarker: '~',
  endMarker: '~',
  logLevel: 'silent',
  spreadsheetId: 'test-spreadsheet-id',
  sheetName: 'i18n',
  keyFile: './test-key-file.json',
  apiKey: 'test-api-key',
  sheetsReadRange: 'A1:Z100',
  sheetsMaxRows: 1000,
};

// Mock Google Sheets API
jest.mock('googleapis');

describe('Feature 5: 并发场景测试 - 推送前远端有更新', () => {
  let tempDir: string;
  let appDir: string;
  let translateDir: string;
  let configPath: string;
  let pullResults: TranslationRecord[];
  let pushData: any;
  let pullSpy: any;

  // 远端数据版本
  const remoteV1: TranslationRecord = {
    app_page: {
      'en': {
        Welcome: 'Welcome Remote V1',
        NewRemote: 'New Remote V1',
      },
      'ko': {
        Welcome: '환영 V1',
        NewRemote: '새로운 V1',
      },
    },
  };

  const remoteV2: TranslationRecord = {
    app_page: {
      'en': {
        Welcome: 'Welcome Remote V2', // 远端更新了
        NewRemote: 'New Remote V2', // 远端更新了
        AnotherKey: 'Another Key', // 远端新增
      },
      'ko': {
        Welcome: '환영 V2',
        NewRemote: '새로운 V2',
        AnotherKey: '또 다른 키',
      },
    },
  };

  beforeEach(() => {
    // 创建临时测试目录
    tempDir = fs.mkdtempSync(path.join(__dirname, 'test-concurrent-'));
    appDir = path.join(tempDir, 'src');
    translateDir = path.join(tempDir, 'src', 'translate');
    configPath = path.join(tempDir, 'i18n.config.js');

    // 创建目录
    fs.mkdirSync(appDir, { recursive: true });
    fs.mkdirSync(translateDir, { recursive: true });

    // 重置变量
    pullResults = [];
    pushData = null;

    // Mock initGoogleSheets - 模拟初始化成功
    jest.spyOn(GoogleSheetsSync.prototype as any, 'initGoogleSheets')
      .mockImplementation(async function (this: any) {
        this.isInitialized = true;
      });

    // Mock pull 方法 - 返回预设的数据
    pullSpy = jest.spyOn(GoogleSheetsSync.prototype, 'pull')
      .mockImplementation(async function () {
        return pullResults.shift() || {};
      });

    // Mock localToRemote - 捕获转换后的数据（用于 pushWithMerge）
    jest.spyOn(GoogleSheetsSync.prototype as any, 'localToRemote')
      .mockImplementation(function (...args: unknown[]) {
        const record = args[0] as TranslationRecord;
        pushData = record; // 捕获原始记录
        return []; // 返回空数组模拟转换结果
      });

    // Mock writeToSheets - 模拟写入成功
    jest.spyOn(GoogleSheetsSync.prototype as any, 'writeToSheets')
      .mockImplementation(async function () {});
  });

  afterEach(() => {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    // 关闭测试模式
    setTestMode(false);
    // 恢复所有 mock
    jest.restoreAllMocks();
  });

  describe('完整场景：推送前远端有更新', () => {
    it('应该正确合并推送前的远端更新', async () => {
      // 1. 准备初始本地记录（模拟已扫描过）
      const recordPath = path.join(translateDir, 'i18n-complete-record.json');
      const localRecord: TranslationRecord = {
        app_page: {
          'en': {
            Welcome: 'Welcome Local',
            OldKey: 'Old Key', // 将被删除
          },
          'ko': {
            Welcome: '환영',
            OldKey: '구 키',
          },
        },
      };
      fs.writeFileSync(recordPath, JSON.stringify(localRecord, null, 2), 'utf-8');

      // 2. 创建测试文件（新增翻译）
      const pageContent = `
export default function Page() {
  return (
    <div>
      <h1>~NewLocal~</h1>
      <p>I18n.t("Welcome")</p>
    </div>
  );
}
`;
      const pagePath = path.join(appDir, 'page.tsx');
      fs.writeFileSync(pagePath, pageContent, 'utf-8');

      // 3. 创建配置
      const configContent = `module.exports = ${JSON.stringify(mockConfig, null, 2)};`;
      fs.writeFileSync(configPath, configContent, 'utf-8');

      // 4. 设置 pull() 返回的数据：第一次 V1，第二次 V2
      pullResults.push(remoteV1); // 第一次拉取
      pullResults.push(remoteV2); // 第二次拉取（推送前）

      // 5. 启用测试模式（自动确认删除）
      setTestMode(true);

      // 6. 运行扫描
      const scanner = new Scanner();
      const result = await scanner.run({
        projectRoot: tempDir,
      });

      // 7. 验证结果
      expect(pullSpy).toHaveBeenCalledTimes(2); // 应该拉取两次：初始 + 推送前
      expect(pushData).not.toBeNull(); // 应该推送数据

      // 验证推送的数据
      const pushedEn = pushData!.app_page!['en'];
      const pushedKo = pushData!.app_page!['ko'];

      // ✅ 远端 V2 的更新应该保留
      expect(pushedEn['Welcome']).toBe('Welcome Remote V2');
      expect(pushedEn['NewRemote']).toBe('New Remote V2');

      // ✅ 本地新增应该保留
      expect(pushedEn['NewLocal']).toBe('NewLocal');

      // ✅ 远端新增应该保留
      expect(pushedEn['AnotherKey']).toBe('Another Key');

      // ✅ 无用 key 应该被删除
      expect(pushedEn['OldKey']).toBeUndefined();
      expect(pushedKo['OldKey']).toBeUndefined();

      // 验证统计
      expect(result.deletedKeys).toBeGreaterThanOrEqual(1); // 至少删除了 OldKey
    });

    it('应该在没有远端更新时正常工作', async () => {
      // 本地记录
      const recordPath = path.join(translateDir, 'i18n-complete-record.json');
      const localRecord: TranslationRecord = {
        app_page: {
          'en': {
            Welcome: 'Welcome Local',
          },
          'ko': {
            Welcome: '환영',
          },
        },
      };
      fs.writeFileSync(recordPath, JSON.stringify(localRecord, null, 2), 'utf-8');

      // 测试文件（新增翻译）
      const pageContent = `
export default function Page() {
  return <h1>~NewLocal~</h1>;
}
`;
      const pagePath = path.join(appDir, 'page.tsx');
      fs.writeFileSync(pagePath, pageContent, 'utf-8');

      const configContent = `module.exports = ${JSON.stringify(mockConfig, null, 2)};`;
      fs.writeFileSync(configPath, configContent, 'utf-8');

      // 设置 pull() 返回的数据：两次都返回 V1（没有远端更新）
      pullResults.push(remoteV1);
      pullResults.push(remoteV1);

      setTestMode(true);

      const scanner = new Scanner();
      await scanner.run({ projectRoot: tempDir });

      // 验证：即使远端没有更新，也应该正常工作
      expect(pullSpy).toHaveBeenCalledTimes(2);
      expect(pushData).not.toBeNull();

      const pushedEn = pushData!.app_page!['en'];

      // 远端优先
      expect(pushedEn['Welcome']).toBe('Welcome Remote V1');
      expect(pushedEn['NewRemote']).toBe('New Remote V1');

      // 本地新增
      expect(pushedEn['NewLocal']).toBe('NewLocal');
    });
  });

  describe('mergeForPush 方法单元测试', () => {
    it('应该正确合并远端和本地数据（远端优先）', () => {
      const sync = new GoogleSheetsSync(mockConfig);

      const remote: TranslationRecord = {
        app_page: {
          'en': {
            Key1: 'Remote V1',
            Key2: 'Remote V2',
            Key3: 'Remote V3',
          },
        },
      };

      const local: TranslationRecord = {
        app_page: {
          'en': {
            Key1: 'Local V1', // 远端有，应被覆盖
            Key2: 'Local V2', // 远端有，应被覆盖
            Key4: 'Local V4', // 本地新增，应保留
          },
        },
      };

      const result = sync['mergeForPush'](remote, local);

      // 远端优先
      expect(result.app_page!['en']['Key1']).toBe('Remote V1');
      expect(result.app_page!['en']['Key2']).toBe('Remote V2');
      expect(result.app_page!['en']['Key3']).toBe('Remote V3');

      // 本地新增
      expect(result.app_page!['en']['Key4']).toBe('Local V4');
    });

    it('应该处理多个文件夹和语言', () => {
      const sync = new GoogleSheetsSync(mockConfig);

      const remote: TranslationRecord = {
        app_page: {
          'en': { Key1: 'Remote EN' },
          'ko': { Key1: 'Remote KO' },
        },
        components: {
          'en': { Key2: 'Remote EN' },
        },
      };

      const local: TranslationRecord = {
        app_page: {
          'en': { Key1: 'Local EN', Key3: 'Local EN New' },
          'ko': { Key1: 'Local KO' },
        },
        components: {
          'en': { Key2: 'Local EN' },
        },
        utils: {
          'en': { Key4: 'Local EN' },
        },
      };

      const result = sync['mergeForPush'](remote, local);

      // 验证所有数据都被正确合并
      expect(result.app_page!['en']['Key1']).toBe('Remote EN');
      expect(result.app_page!['ko']['Key1']).toBe('Remote KO');
      expect(result.app_page!['en']['Key3']).toBe('Local EN New');
      expect(result.components!['en']['Key2']).toBe('Remote EN');
      expect(result.utils!['en']['Key4']).toBe('Local EN');
    });

    it('应该处理空数据', () => {
      const sync = new GoogleSheetsSync(mockConfig);

      // 远端空，本地有数据
      let result = sync['mergeForPush']({}, {
        app_page: {
          'en': { Key1: 'Local' },
        },
      });
      expect(result.app_page!['en']['Key1']).toBe('Local');

      // 远端有数据，本地空
      result = sync['mergeForPush']({
        app_page: {
          'en': { Key1: 'Remote' },
        },
      }, {});
      expect(result.app_page!['en']['Key1']).toBe('Remote');

      // 都为空
      result = sync['mergeForPush']({}, {});
      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
