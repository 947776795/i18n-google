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

    // 保存 deletedKeys 的引用，用于验证
    let capturedDeletedKeys: string[] = [];

    // Mock localToRemote - 捕获转换后的数据（用于 pushWithMerge）
    // 同时模拟过滤 deletedKeys 的逻辑
    jest.spyOn(GoogleSheetsSync.prototype as any, 'localToRemote')
      .mockImplementation(function (this: any, ...args: unknown[]) {
        const record = args[0] as TranslationRecord;
        const deletedKeys = (args[1] || []) as string[];
        capturedDeletedKeys = deletedKeys;

        // 模拟过滤逻辑：从 record 中移除 deletedKeys
        const deletedSet = new Set(deletedKeys);
        const filtered: TranslationRecord = {};

        for (const [folderName, localeMap] of Object.entries(record)) {
          filtered[folderName] = {};
          for (const [locale, translations] of Object.entries(localeMap)) {
            filtered[folderName][locale] = {};
            for (const [key, value] of Object.entries(translations)) {
              // 🔑 修复后：deletedKeys 格式是 [folderName/page.tsx][key]
              const filePath = `${folderName}/page.tsx`;
              const combinedKey = `[${filePath}][${key}]`;

              // 过滤掉被删除的 key
              if (!deletedSet.has(combinedKey)) {
                filtered[folderName][locale][key] = value;
              }
            }
          }
        }

        pushData = filtered; // 捕获过滤后的记录
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
      <p>~Welcome~</p>
      <p>~NewRemote~</p>
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

      // 测试文件（新增翻译 + Welcome 引用）
      const pageContent = `
export default function Page() {
  return (
    <div>
      <h1>~NewLocal~</h1>
      <p>~Welcome~</p>
      <p>~NewRemote~</p>
    </div>
  );
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

    it('应该正确过滤远端需要删除的 keys', async () => {
      /**
       * 关键场景：远端有需要删除的 key
       *
       * 1. 本地和远端 V1 都有 OldKey
       * 2. 本地检测到 OldKey 无用，用户确认删除
       * 3. 推送前，远端 V2 仍有 OldKey
       * 4. 期望：最终推送的数据不包含 OldKey（即使远端有）
       */

      // 1. 准备初始本地记录（包含 OldKey）
      const recordPath = path.join(translateDir, 'i18n-complete-record.json');
      const localRecord: TranslationRecord = {
        app_page: {
          'en': {
            Welcome: 'Welcome Local',
            OldKey: 'Old Key Local', // 将被检测为无用并删除
          },
          'ko': {
            Welcome: '환영',
            OldKey: '구 키',
          },
        },
      };
      fs.writeFileSync(recordPath, JSON.stringify(localRecord, null, 2), 'utf-8');

      // 2. 创建测试文件（不使用 OldKey，所以它会被检测为无用）
      const pageContent = `
export default function Page() {
  return (
    <div>
      <h1>~NewLocal~</h1>
      <p>~Welcome~</p>
      <p>~NewRemote~</p>
    </div>
  );
}
`;
      const pagePath = path.join(appDir, 'page.tsx');
      fs.writeFileSync(pagePath, pageContent, 'utf-8');

      // 3. 创建配置
      const configContent = `module.exports = ${JSON.stringify(mockConfig, null, 2)};`;
      fs.writeFileSync(configPath, configContent, 'utf-8');

      // 4. 设置 pull() 返回的数据：远端也有 OldKey
      const remoteWithOldKey: TranslationRecord = {
        app_page: {
          'en': {
            Welcome: 'Welcome Remote',
            OldKey: 'Old Key Remote', // 远端也有 OldKey！
            NewRemote: 'New Remote',
          },
          'ko': {
            Welcome: '환영 Remote',
            OldKey: '구 키 Remote',
            NewRemote: '새로운 Remote',
          },
        },
      };

      pullResults.push(remoteWithOldKey); // 第一次拉取
      pullResults.push(remoteWithOldKey); // 第二次拉取（推送前，仍有 OldKey）

      // 5. 启用测试模式（自动确认删除）
      setTestMode(true);

      // 6. 运行扫描
      const scanner = new Scanner();
      const result = await scanner.run({ projectRoot: tempDir });

      // 7. 验证结果
      expect(pullSpy).toHaveBeenCalledTimes(2);
      expect(pushData).not.toBeNull();

      const pushedEn = pushData!.app_page!['en'];
      const pushedKo = pushData!.app_page!['ko'];

      // ✅ 远端的更新应该保留
      expect(pushedEn['Welcome']).toBe('Welcome Remote');
      expect(pushedEn['NewRemote']).toBe('New Remote');

      // ✅ 本地新增应该保留
      expect(pushedEn['NewLocal']).toBe('NewLocal');

      // ✅ 关键验证：即使远端有 OldKey，也应该被过滤掉
      expect(pushedEn['OldKey']).toBeUndefined();
      expect(pushedKo['OldKey']).toBeUndefined();

      // 验证统计
      expect(result.deletedKeys).toBeGreaterThanOrEqual(1); // 至少删除了 OldKey
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

    it('应该过滤掉 deletedKeys 中的 keys（即使远端有）', () => {
      const sync = new GoogleSheetsSync(mockConfig);

      const remote: TranslationRecord = {
        app_page: {
          'en': {
            Key1: 'Remote V1',
            Key2: 'Remote V2',
            ToDelete: 'Remote ToDelete', // 远端有这个 key
          },
        },
      };

      const local: TranslationRecord = {
        app_page: {
          'en': {
            Key1: 'Local V1',
            Key3: 'Local V3',
          },
        },
      };

      // 设置要删除的 keys（直接使用 folderName）
      const deletedKeys = new Set(['[app_page][ToDelete]']);

      const result = sync['mergeForPush'](remote, local, deletedKeys);

      // 远端优先
      expect(result.app_page!['en']['Key1']).toBe('Remote V1');
      expect(result.app_page!['en']['Key2']).toBe('Remote V2');

      // 本地新增
      expect(result.app_page!['en']['Key3']).toBe('Local V3');

      // 关键验证：ToDelete 应该被过滤掉（即使远端有）
      expect(result.app_page!['en']['ToDelete']).toBeUndefined();
    });

    it('应该正确过滤深层嵌套路径的 deletedKeys', () => {
      const sync = new GoogleSheetsSync(mockConfig);

      const remote: TranslationRecord = {
        app_sub1_deep_page: {
          'en': {
            DeepKey: 'Remote Deep',
            ToDelete: 'Remote ToDelete',
          },
        },
      };

      const local: TranslationRecord = {
        app_sub1_deep_page: {
          'en': {
            DeepKey: 'Local Deep',
            NewKey: 'Local New',
          },
        },
      };

      // 设置要删除的 keys（直接使用 folderName）
      const deletedKeys = new Set(['[app_sub1_deep_page][ToDelete]']);

      const result = sync['mergeForPush'](remote, local, deletedKeys);

      // 远端优先
      expect(result.app_sub1_deep_page!['en']['DeepKey']).toBe('Remote Deep');

      // 本地新增
      expect(result.app_sub1_deep_page!['en']['NewKey']).toBe('Local New');

      // 关键验证：ToDelete 应该被过滤掉
      expect(result.app_sub1_deep_page!['en']['ToDelete']).toBeUndefined();
    });

    it('应该正确解析远端 key 格式 [folderName][key]', () => {
      const sync = new GoogleSheetsSync(mockConfig);

      // 模拟远端数据格式（从 Google Sheets 读取）
      const remoteData: Record<string, Record<string, string>> = {
        '[app_page][Welcome]': {
          'en': 'Welcome Remote',
          'ko': '환영 Remote',
        },
        '[app_sub1_page][Hello]': {
          'en': 'Hello Remote',
        },
      };

      // 调用 remoteToLocal 转换
      const result = sync['remoteToLocal'](remoteData);

      // 验证 folderName 正确解析（不使用 filePathToFolderName 转换）
      expect(result['app_page']).toBeDefined();
      expect(result['app_page']['en']['Welcome']).toBe('Welcome Remote');
      expect(result['app_page']['ko']['Welcome']).toBe('환영 Remote');

      expect(result['app_sub1_page']).toBeDefined();
      expect(result['app_sub1_page']['en']['Hello']).toBe('Hello Remote');

      // 验证没有错误地创建 'app' 或 'app_sub1' 这样的 key
      expect(result['app']).toBeUndefined();
      expect(result['app_sub1']).toBeUndefined();
    });
  });

  describe('Bug 修复：远端更新后语言文件同步', () => {
    /**
     * 测试场景：远端更新后，en.json 等语言文件应该同步更新
     *
     * 问题背景：
     * - pushWithMerge 返回合并后的远端更新数据
     * - 之前只保存了 i18n-complete-record.json
     * - 但没有重新生成 en.json 等语言文件
     *
     * 期望行为：
     * - 远端更新应该同时同步到 i18n-complete-record.json 和 en.json
     */
    it('应该将远端更新同步到 en.json 等语言文件', async () => {
      // 1. 准备初始本地记录
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

      // 2. 创建测试文件
      const pageContent = `
export default function Page() {
  return (
    <div>
      <h1>~Welcome~</h1>
    </div>
  );
}
`;
      const pagePath = path.join(appDir, 'page.tsx');
      fs.writeFileSync(pagePath, pageContent, 'utf-8');

      // 3. 创建配置
      const configContent = `module.exports = ${JSON.stringify(mockConfig, null, 2)};`;
      fs.writeFileSync(configPath, configContent, 'utf-8');

      // 4. 设置远端更新数据（第二次拉取时有新更新）
      const remoteV1: TranslationRecord = {
        app_page: {
          'en': { Welcome: 'Welcome V1' },
          'ko': { Welcome: '환영 V1' },
        },
      };

      const remoteV2: TranslationRecord = {
        app_page: {
          'en': {
            Welcome: 'Welcome V2 Updated', // 远端更新
            NewKey: 'New Remote Key', // 远端新增 key
          },
          'ko': {
            Welcome: '환영 V2 업데이트',
            NewKey: '새로운 키',
          },
        },
      };

      pullResults.push(remoteV1);
      pullResults.push(remoteV2);

      // 5. 启用测试模式
      setTestMode(true);

      // 6. 运行扫描
      const scanner = new Scanner();
      await scanner.run({ projectRoot: tempDir });

      // 7. 验证 i18n-complete-record.json 包含远端更新
      const finalRecord: TranslationRecord = JSON.parse(
        fs.readFileSync(recordPath, 'utf-8')
      );

      expect(finalRecord.app_page!['en']['Welcome']).toBe('Welcome V2 Updated');
      expect(finalRecord.app_page!['ko']['Welcome']).toBe('환영 V2 업데이트');

      // 8. 验证 en.json 等语言文件也包含远端更新（🔴 关键验证）
      const enJsonPath = path.join(translateDir, 'app_page', 'en.json');
      const koJsonPath = path.join(translateDir, 'app_page', 'ko.json');

      expect(fs.existsSync(enJsonPath)).toBe(true);
      expect(fs.existsSync(koJsonPath)).toBe(true);

      const enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf-8'));
      const koJson = JSON.parse(fs.readFileSync(koJsonPath, 'utf-8'));

      // ✅ 远端更新应该反映在语言文件中
      expect(enJson['Welcome']).toBe('Welcome V2 Updated');
      expect(koJson['Welcome']).toBe('환영 V2 업데이트');

      // ✅ 远端新增的 key 也应该在语言文件中
      expect(enJson['NewKey']).toBe('New Remote Key');
      expect(koJson['NewKey']).toBe('새로운 키');
    });

    it('应该在删除无用 key 后同步语言文件', async () => {
      /**
       * 场景：
       * 1. 本地有 OldKey
       * 2. 远端也有 OldKey
       * 3. 检测到 OldKey 无用，用户确认删除
       * 4. 推送前远端又有其他更新
       * 5. 期望：语言文件中 OldKey 被删除，远端更新被添加
       */

      // 1. 准备初始本地记录（包含 OldKey）
      const recordPath = path.join(translateDir, 'i18n-complete-record.json');
      const localRecord: TranslationRecord = {
        app_page: {
          'en': {
            Welcome: 'Welcome Local',
            OldKey: 'Old Key',
          },
          'ko': {
            Welcome: '환영',
            OldKey: '구 키',
          },
        },
      };
      fs.writeFileSync(recordPath, JSON.stringify(localRecord, null, 2), 'utf-8');

      // 2. 创建测试文件（不使用 OldKey）
      const pageContent = `
export default function Page() {
  return (
    <div>
      <h1>~Welcome~</h1>
    </div>
  );
}
`;
      const pagePath = path.join(appDir, 'page.tsx');
      fs.writeFileSync(pagePath, pageContent, 'utf-8');

      const configContent = `module.exports = ${JSON.stringify(mockConfig, null, 2)};`;
      fs.writeFileSync(configPath, configContent, 'utf-8');

      // 3. 设置远端数据（也有 OldKey，并且有新更新）
      const remoteV2: TranslationRecord = {
        app_page: {
          'en': {
            Welcome: 'Welcome V2',
            OldKey: 'Old Key Remote', // 远端也有
          },
          'ko': {
            Welcome: '환영 V2',
            OldKey: '구 키 Remote',
          },
        },
      };

      pullResults.push(localRecord);
      pullResults.push(remoteV2);

      setTestMode(true);

      // 4. 运行扫描
      const scanner = new Scanner();
      const result = await scanner.run({ projectRoot: tempDir });

      // 5. 验证删除了无用 key
      expect(result.deletedKeys).toBeGreaterThanOrEqual(1);

      // 6. 验证语言文件中 OldKey 被删除，远端更新被应用
      const enJsonPath = path.join(translateDir, 'app_page', 'en.json');
      const koJsonPath = path.join(translateDir, 'app_page', 'ko.json');

      const enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf-8'));
      const koJson = JSON.parse(fs.readFileSync(koJsonPath, 'utf-8'));

      // ✅ OldKey 应该被删除（即使远端有）
      expect(enJson['OldKey']).toBeUndefined();
      expect(koJson['OldKey']).toBeUndefined();

      // ✅ 远端更新应该保留
      expect(enJson['Welcome']).toBe('Welcome V2');
      expect(koJson['Welcome']).toBe('환영 V2');
    });
  });
});
