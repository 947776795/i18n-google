/**
 * Feature 5: 完整主流程测试 - TDD 测试用例
 *
 * 测试完整的扫描流程，包括：
 * 1. 加载配置
 * 2. Google Sheets 同步（拉取/推送）
 * 3. 三方数据合并（远端、本地、新扫描）
 * 4. 无用 key 检测与删除
 */

import * as fs from 'fs';
import * as path from 'path';
import { Scanner } from '../../core/Scanner';
import { GoogleSheetsSync } from '../../infra/sync/GoogleSheetsSync';
import { RecordMerger } from '../../domain/record/RecordMerger';
import { UnusedKeyAnalyzer } from '../../domain/cleanup/UnusedKeyAnalyzer';
import { UserPrompt, setTestMode } from '../../ui/UserPrompt';
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

describe('Feature 5: 完整主流程测试', () => {
  let tempDir: string;
  let appDir: string;
  let translateDir: string;
  let configPath: string;

  beforeEach(() => {
    // 创建临时测试目录
    tempDir = fs.mkdtempSync(path.join(__dirname, 'test-scanner-'));
    appDir = path.join(tempDir, 'src');
    // translateDir 需要与 config 中的 outputDir ('./src/translate') 匹配
    translateDir = path.join(tempDir, 'src', 'translate');
    configPath = path.join(tempDir, 'i18n.config.js');

    // 创建目录
    fs.mkdirSync(appDir, { recursive: true });
    fs.mkdirSync(translateDir, { recursive: true });
  });

  afterEach(() => {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('RecordMerger - 三方数据合并', () => {
    it('应该正确合并远端、本地和新扫描的数据', () => {
      const merger = new RecordMerger();

      // 远端数据
      const remote: TranslationRecord = {
        app: {
          'en.json': {
            Welcome: 'Welcome (Remote)',
            Login: 'Login (Remote)',
          },
        },
      };

      // 本地数据
      const local: TranslationRecord = {
        app: {
          'en.json': {
            Welcome: 'Welcome (Local)',
            Settings: 'Settings (Local)',
          },
        },
      };

      // 新扫描的 keys
      const newKeys = new Set(['Logout', 'Profile']);

      const result = merger.merge(remote, local, newKeys, 'app');

      // 验证：远端优先
      expect(result.mergedRecord['app']['en.json']['Welcome']).toBe('Welcome (Remote)');

      // 验证：远端有就采用远端
      expect(result.mergedRecord['app']['en.json']['Login']).toBe('Login (Remote)');

      // 验证：远端没有，本地有
      expect(result.mergedRecord['app']['en.json']['Settings']).toBe('Settings (Local)');

      // 验证：新 key 添加
      expect(result.mergedRecord['app']['en.json']['Logout']).toBe('Logout');
      expect(result.mergedRecord['app']['en.json']['Profile']).toBe('Profile');

      // 验证：统计
      expect(result.stats.fromRemote).toBe(2);
      expect(result.stats.fromLocal).toBe(1);
      expect(result.stats.newKeys).toBe(2);
    });
  });

  describe('UnusedKeyAnalyzer - 无用 key 检测', () => {
    it('应该正确识别未被引用的 keys', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const record: TranslationRecord = {
        app: {
          'en.json': {
            Welcome: 'Welcome',
            Login: 'Login',
            OldKey: 'Old Key',
          },
        },
      };

      const references = new Set<{ folderName: string; key: string }>([
        { folderName: 'app', key: 'Welcome' },
        { folderName: 'app', key: 'Login' },
      ]);

      const result = analyzer.analyze(record, references);

      expect(result.total).toBe(1);
      expect(result.formattedUnusedKeys).toContain('[app][OldKey]');
    });

    it('不应该使用后缀匹配（避免误匹配）', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const record: TranslationRecord = {
        app: {
          'en.json': {
            Welcome: 'Welcome',
          },
        },
      };

      // 代码引用路径后缀不匹配（src_app 不以 app_ 开头）
      const references = new Set<{ folderName: string; key: string }>([
        { folderName: 'src_app', key: 'Welcome' },
      ]);

      const result = analyzer.analyze(record, references);

      // 不应该匹配（src_app 不是 app 的直接子路径）
      expect(result.total).toBe(1);
    });
  });

  describe('GoogleSheetsSync - 远端同步', () => {
    it('应该在未初始化时返回空数据', async () => {
      const sync = new GoogleSheetsSync(mockConfig);

      const result = await sync.pull();

      expect(result).toEqual({});
    });

    it('应该正确转换本地数据为远端格式', () => {
      const sync = new GoogleSheetsSync(mockConfig);

      const record: TranslationRecord = {
        app: {
          'en.json': {
            Welcome: 'Welcome',
            Login: 'Login',
          },
          'ko.json': {
            Welcome: '환영',
            Login: '로그인',
          },
        },
      };

      // 测试 localToRemote 方法
      const remoteData = sync['localToRemote'](record, []);

      expect(remoteData.length).toBeGreaterThan(0);
      expect(remoteData[0]).toEqual(['key', 'en', 'ko']);
      expect(remoteData[1]).toEqual(['[app/page.tsx][Welcome]', 'Welcome', '환영']);
    });
  });

  describe('Scanner - 完整主流程集成测试', () => {
    it('应该完成完整的扫描流程', async () => {
      // 1. 创建测试文件
      const pageContent = `
export default function Page() {
  return (
    <div>
      <h1>~Welcome~</h1>
      <p>~Login to continue~</p>
    </div>
  );
}
`;
      const pagePath = path.join(appDir, 'page.tsx');
      fs.writeFileSync(pagePath, pageContent, 'utf-8');

      // 2. 创建配置文件
      const configContent = `module.exports = ${JSON.stringify(mockConfig, null, 2)};`;
      fs.writeFileSync(configPath, configContent, 'utf-8');

      // 3. 启用测试模式（自动确认）
      setTestMode(true);

      // 4. 运行扫描
      const scanner = new Scanner();
      const result = await scanner.run({
        projectRoot: tempDir,
      });

      // 5. 清理：关闭测试模式
      setTestMode(false);

      // 4. 验证结果
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.transformedFiles).toBeGreaterThan(0);
      expect(result.generatedFiles).toBeGreaterThan(0);

      // 5. 验证转换后的代码
      const transformedContent = fs.readFileSync(pagePath, 'utf-8');
      expect(transformedContent).toContain('I18n.t("Welcome")');
      expect(transformedContent).toContain('I18n.t("Login to continue")');

      // 6. 验证翻译文件生成
      const recordPath = path.join(translateDir, 'i18n-complete-record.json');
      expect(fs.existsSync(recordPath)).toBe(true);

      const record = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));
      expect(Object.keys(record)).toContain('app_page');
    });

    it('应该检测并处理无用 keys（第二次扫描场景）', async () => {
      // 1. 首次扫描：创建并转换代码
      const pageContent = `
export default function Page() {
  return <h1>~Welcome~</h1>;
}
`;
      const pagePath = path.join(appDir, 'page.tsx');
      fs.writeFileSync(pagePath, pageContent, 'utf-8');

      const configContent = `module.exports = ${JSON.stringify(mockConfig, null, 2)};`;
      fs.writeFileSync(configPath, configContent, 'utf-8');

      // 启用测试模式
      setTestMode(true);

      // 第一次扫描：转换代码并生成记录
      const scanner1 = new Scanner();
      await scanner1.run({ projectRoot: tempDir });

      // 验证转换后的代码包含 I18n.t() 调用
      let transformedContent = fs.readFileSync(pagePath, 'utf-8');
      expect(transformedContent).toContain('I18n.t("Welcome")');

      // 2. 手动添加一个无用 key 到记录中
      const recordPath = path.join(translateDir, 'i18n-complete-record.json');
      const record = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));
      // RecordGenerator 保存时将 "en.json" 转换为 "en"
      record['app_page']['en']['OldDeprecatedKey'] = 'Old Deprecated';
      fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf-8');

      // 3. Mock UserPrompt - 用户选择不删除
      const mockConfirmDelete = jest.spyOn(UserPrompt.prototype, 'confirmDeleteUnusedKeys')
        .mockResolvedValue(false);

      // 4. 第二次扫描：应该检测到 OldDeprecatedKey 是无用的
      const scanner2 = new Scanner();
      const result = await scanner2.run({ projectRoot: tempDir });

      // 5. 验证无用 key 被检测到
      expect(mockConfirmDelete).toHaveBeenCalled();
      const calls = mockConfirmDelete.mock.calls[0];
      expect(calls[0][0]).toContain('OldDeprecatedKey');

      mockConfirmDelete.mockRestore();
      setTestMode(false);
    });

    it('应该删除无用的 keys（用户确认删除）', async () => {
      // 1. 首次扫描：创建并转换代码
      const pageContent = `
export default function Page() {
  return <h1>~Welcome~</h1>;
}
`;
      const pagePath = path.join(appDir, 'page.tsx');
      fs.writeFileSync(pagePath, pageContent, 'utf-8');

      const configContent = `module.exports = ${JSON.stringify(mockConfig, null, 2)};`;
      fs.writeFileSync(configPath, configContent, 'utf-8');

      // 启用测试模式（自动确认）
      setTestMode(true);

      // 第一次扫描：转换代码并生成记录
      const scanner1 = new Scanner();
      await scanner1.run({ projectRoot: tempDir });

      // 2. 手动添加无用 keys 到记录中
      const recordPath = path.join(translateDir, 'i18n-complete-record.json');
      const record = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));
      record['app_page']['en']['OldKey1'] = 'Old Key 1';
      record['app_page']['en']['OldKey2'] = 'Old Key 2';
      record['app_page']['en']['OldKey3'] = 'Old Key 3';
      fs.writeFileSync(recordPath, JSON.stringify(record, null, 2), 'utf-8');

      // 3. 第二次扫描：应该检测到并删除无用 keys
      const scanner2 = new Scanner();
      const result = await scanner2.run({ projectRoot: tempDir });

      // 4. 验证无用 key 被删除
      expect(result.deletedKeys).toBe(3);

      // 验证记录文件中不再包含无用 keys
      const updatedRecord = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));
      expect(updatedRecord['app_page']['en']['OldKey1']).toBeUndefined();
      expect(updatedRecord['app_page']['en']['OldKey2']).toBeUndefined();
      expect(updatedRecord['app_page']['en']['OldKey3']).toBeUndefined();
      // Welcome 仍然存在
      expect(updatedRecord['app_page']['en']['Welcome']).toBeDefined();

      // 清理：关闭测试模式
      setTestMode(false);
    });
  });

  describe('完整流程 - 数据合并场景', () => {
    it('场景1: 远端有新翻译，应该采用远端翻译', () => {
      const merger = new RecordMerger();

      // 远端有更新的翻译
      const remote: TranslationRecord = {
        app: {
          'en.json': {
            Welcome: 'Welcome (Updated)',
          },
        },
      };

      const local: TranslationRecord = {
        app: {
          'en.json': {
            Welcome: 'Welcome (Old)',
          },
        },
      };

      const newKeys = new Set<string>();

      const result = merger.merge(remote, local, newKeys, 'app');

      expect(result.mergedRecord['app']['en.json']['Welcome']).toBe('Welcome (Updated)');
      expect(result.stats.fromRemote).toBe(1);
    });

    it('场景2: 只有本地有翻译，新扫描时应该保留', () => {
      const merger = new RecordMerger();

      const remote: TranslationRecord = {};
      const local: TranslationRecord = {
        app: {
          'en.json': {
            Welcome: 'Welcome',
          },
        },
      };

      const newKeys = new Set<string>();

      const result = merger.merge(remote, local, newKeys, 'app');

      expect(result.mergedRecord['app']['en.json']['Welcome']).toBe('Welcome');
      expect(result.stats.fromLocal).toBe(1);
    });

    it('场景3: 完全新 key，应该使用原文', () => {
      const merger = new RecordMerger();

      const remote: TranslationRecord = {};
      const local: TranslationRecord = {};
      const newKeys = new Set(['NewFeature']);

      const result = merger.merge(remote, local, newKeys, 'app');

      expect(result.mergedRecord['app']['en.json']['NewFeature']).toBe('NewFeature');
      expect(result.stats.newKeys).toBe(1);
    });
  });

  describe('完整流程 - 无用 key 删除场景', () => {
    it('场景1: 删除单个无用 key', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const record: TranslationRecord = {
        app: {
          'en.json': {
            ActiveKey: 'Active',
            UnusedKey: 'Unused',
          },
        },
      };

      const references = new Set<{ folderName: string; key: string }>([
        { folderName: 'app', key: 'ActiveKey' },
      ]);

      const result = analyzer.analyze(record, references);

      expect(result.total).toBe(1);
      expect(result.formattedUnusedKeys[0]).toBe('[app][UnusedKey]');
    });

    it('场景2: 删除多个无用 keys', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const record: TranslationRecord = {
        app: {
          'en.json': {
            ActiveKey: 'Active',
            UnusedKey1: 'Unused 1',
            UnusedKey2: 'Unused 2',
            UnusedKey3: 'Unused 3',
          },
        },
      };

      const references = new Set<{ folderName: string; key: string }>([
        { folderName: 'app', key: 'ActiveKey' },
      ]);

      const result = analyzer.analyze(record, references);

      expect(result.total).toBe(3);
      expect(result.formattedUnusedKeys).toHaveLength(3);
    });

    it('场景3: 没有无用 key 时不提示删除', () => {
      const analyzer = new UnusedKeyAnalyzer();

      const record: TranslationRecord = {
        app: {
          'en.json': {
            ActiveKey: 'Active',
          },
        },
      };

      const references = new Set<{ folderName: string; key: string }>([
        { folderName: 'app', key: 'ActiveKey' },
      ]);

      const result = analyzer.analyze(record, references);

      expect(result.total).toBe(0);
      expect(result.formattedUnusedKeys).toHaveLength(0);
    });
  });

  describe('完整流程 - 端到端测试', () => {
    it('应该完成从扫描到生成的完整流程', async () => {
      // 1. 创建多个测试文件
      const files = [
        {
          name: 'page.tsx',
          content: `
export default function Page() {
  return <h1>~Welcome~</h1>;
}`,
        },
        {
          name: 'layout.tsx',
          content: `
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header>~Site Title~</header>
      {children}
    </div>
  );
}`,
        },
      ];

      for (const file of files) {
        fs.writeFileSync(path.join(appDir, file.name), file.content, 'utf-8');
      }

      // 2. 创建配置
      const configContent = `module.exports = ${JSON.stringify(mockConfig, null, 2)};`;
      fs.writeFileSync(configPath, configContent, 'utf-8');

      // 3. 启用测试模式
      setTestMode(true);

      // 4. 运行扫描
      const scanner = new Scanner();
      const result = await scanner.run({
        projectRoot: tempDir,
      });

      // 5. 清理：关闭测试模式
      setTestMode(false);

      // 6. 验证统计
      expect(result.totalFiles).toBe(2);
      expect(result.transformedFiles).toBe(2);

      // 7. 验证记录文件
      const recordPath = path.join(translateDir, 'i18n-complete-record.json');
      const record = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));

      // 应该有两个文件夹
      expect(Object.keys(record).length).toBeGreaterThanOrEqual(2);

      // 6. 验证翻译文件生成
      const enFilePath = path.join(translateDir, 'app_page', 'en.json');
      expect(fs.existsSync(enFilePath)).toBe(true);

      const enContent = JSON.parse(fs.readFileSync(enFilePath, 'utf-8'));
      expect(enContent['Welcome']).toBe('Welcome');
    });
  });
});
