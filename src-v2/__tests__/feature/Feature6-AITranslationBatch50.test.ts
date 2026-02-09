/**
 * Feature 6: AI 翻译 - 50 个文案批量翻译测试
 *
 * 使用真实 API 测试批量翻译功能
 * 运行前需要设置 API_KEY 环境变量
 */

import { TranslationService } from '../../domain/translate/TranslationService';
import { I18nConfig } from '../../types/config';

// 跳过真实 API 测试（除非设置了环境变量）
const describeIf = process.env.API_KEY ? describe : describe.skip;

describeIf('Feature 6: AI 翻译 - 50 个文案批量翻译 (真实 API)', () => {
  let config: I18nConfig;
  let translationService: TranslationService;

  beforeAll(() => {
    // 基于 demo/vite 的配置
    config = {
      rootDir: './test',
      languages: ['en', 'ko', 'zh-CN', 'es', 'de', 'vi', 'tr', 'zh-TC'],
      ignore: ['**/test/**', '**/node_modules/**'],
      spreadsheetId: '1UbZdMrqQ38XnbYBrxxdkmk9uS5sVxz1APtRELPYMQOM',
      sheetName: 'i18n',
      keyFile: './serviceAccountKeyFile.json',
      startMarker: '~',
      endMarker: '~',
      include: ['ts', 'tsx'],
      outputDir: './translate',
      apiKey: process.env.API_KEY || '',
      llmRetries: 2,
      llmTimeout: 30000,
      llmTemperature: 0.2,
      llmModel: 'qwen-turbo',
      llmBatchSize: 10,  // 每批 10 个
      llmBatchDelay: 500, // 批次间延迟 500ms
      logLevel: 'verbose',
    };

    translationService = new TranslationService(config);
  });

  it('应该成功翻译 50 个新 keys', async () => {
    // 生成 50 个测试文案
    const testKeys = [
      'Welcome to our application',
      'Please sign in to continue',
      'Create a new account',
      'Forgot your password?',
      'Remember me',
      'Settings',
      'Profile',
      'Logout',
      'Save changes',
      'Cancel',
      'Delete',
      'Edit',
      'View details',
      'Back to home',
      'Search...',
      'Loading...',
      'No results found',
      'An error occurred',
      'Please try again',
      'Success',
      'Warning',
      'Information',
      'Confirm',
      'Yes',
      'No',
      'Maybe',
      'All',
      'None',
      'Other',
      'Select an option',
      'Upload file',
      'Download',
      'Share',
      'Copy',
      'Paste',
      'Cut',
      'Undo',
      'Redo',
      'Bold',
      'Italic',
      'Underline',
      'Align left',
      'Align center',
      'Align right',
      'Justify',
      'Numbered list',
      'Bullet list',
      'Indent',
      'Outdent',
      'Insert image',
    ];

    expect(testKeys.length).toBe(50);

    console.log(`\n🚀 开始测试 ${testKeys.length} 个文案的 AI 翻译...`);
    console.log(`📋 目标语言: ${config.languages.filter(l => l !== 'en').join(', ')}`);
    console.log(`⚙️  配置: batchSize=${config.llmBatchSize}, batchDelay=${config.llmBatchDelay}ms\n`);

    const startTime = Date.now();

    // 调用翻译服务
    const result = await translationService.translateNewKeys(
      testKeys,
      config.languages
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 验证结果
    expect(result.size).toBe(50);

    // 验证每个 key 都有所有语言的翻译
    for (const key of testKeys) {
      const translations = result.get(key);
      expect(translations).toBeDefined();

      // 英文应该是原文
      expect(translations!.en).toBe(key);

      // 其他语言应该有翻译（非空）
      for (const lang of config.languages) {
        if (lang !== 'en') {
          expect(translations![lang]).toBeDefined();
          expect(translations![lang]).not.toBe('');
          console.log(`✅ [${lang}] "${key.substring(0, 30)}..." → "${translations![lang]}"`);
        }
      }
    }

    console.log(`\n✅ 测试完成！`);
    console.log(`⏱️  总耗时: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
    console.log(`📊 平均每个 key: ${(duration / 50).toFixed(0)}ms`);
    console.log(`📦 批次数: ${Math.ceil(50 / (config.llmBatchSize || 15))}`);
  }, 120000); // 2 分钟超时

  it('应该显示翻译进度日志', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const testKeys = Array.from({ length: 25 }, (_, i) => `Test key ${i + 1}`);

    await translationService.translateNewKeys(testKeys, ['en', 'ko', 'zh-CN']);

    // 验证包含进度日志
    const logs = consoleLogSpy.mock.calls.map(call => call.join(' '));
    const progressLogs = logs.filter(log => log.includes('进度') || log.includes('批次'));

    expect(progressLogs.length).toBeGreaterThan(0);

    consoleLogSpy.mockRestore();
  }, 60000);
});
