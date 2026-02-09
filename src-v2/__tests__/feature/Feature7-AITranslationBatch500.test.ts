/**
 * Feature 7: AI 翻译 - 500 个文案批量翻译测试
 *
 * 验证大规模翻译的可扩展性
 * 运行前需要设置 API_KEY 环境变量
 */

import { TranslationService } from '../../domain/translate/TranslationService';
import { I18nConfig } from '../../types/config';

// 跳过真实 API 测试（除非设置了环境变量）
const describeIf = process.env.API_KEY ? describe : describe.skip;

describeIf('Feature 7: AI 翻译 - 500 个文案批量翻译 (真实 API)', () => {
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

  it('应该成功翻译 500 个新 keys', async () => {
    // 生成 500 个测试文案 - 常见 UI 文本和变化组合
    const commonWords = [
      'Welcome', 'Login', 'Register', 'Settings', 'Profile', 'Home', 'Dashboard',
      'Search', 'Filter', 'Sort', 'Add', 'Edit', 'Delete', 'Save', 'Cancel',
      'Submit', 'Confirm', 'Close', 'Back', 'Next', 'Previous', 'Finish', 'Start',
      'Loading', 'Error', 'Success', 'Warning', 'Info', 'Help', 'Support',
      'Contact', 'About', 'Terms', 'Privacy', 'Logout', 'Sign in', 'Sign out',
      'Create', 'Update', 'Remove', 'Copy', 'Paste', 'Cut', 'Undo', 'Redo',
      'Upload', 'Download', 'Share', 'Export', 'Import', 'Print', 'Email',
      'Message', 'Notification', 'Alert', 'Modal', 'Dialog', 'Tooltip',
    ];

    const actions = [
      'Click', 'Tap', 'Press', 'Select', 'Choose', 'Type', 'Enter', 'Input',
      'Drag', 'Drop', 'Swipe', 'Scroll', 'Zoom', 'Pinch', 'Rotate', 'Resize',
    ];

    const qualifiers = [
      'new', 'existing', 'all', 'selected', 'available', 'required', 'optional',
      'active', 'inactive', 'enabled', 'disabled', 'visible', 'hidden',
    ];

    const testKeys: string[] = [];

    // 1. 添加常见 UI 文本 (约 50 个)
    testKeys.push(...commonWords);

    // 2. 添加常见短语组合 (约 100 个)
    const phrases = [
      'Welcome to our application', 'Please sign in to continue',
      'Create a new account', 'Forgot your password?', 'Remember me',
      'Save changes', 'Delete this item', 'View details', 'Back to home',
      'No results found', 'An error occurred', 'Please try again',
      'Are you sure?', 'This action cannot be undone', 'Loading...',
      'Processing your request', 'Operation completed successfully',
      'Invalid input', 'Required field', 'Optional field', 'File upload',
    ];
    testKeys.push(...phrases);

    // 3. 添加组合变化 (约 350 个)
    let index = 0;
    while (testKeys.length < 500) {
      // 组合模式: Action + Qualifier + Word
      const action = actions[index % actions.length];
      const qualifier = qualifiers[(index * 2) % qualifiers.length];
      const word = commonWords[(index * 3) % commonWords.length];

      const combinations = [
        `${action} ${word}`,
        `${qualifier} ${word}`,
        `${word} ${action}`,
        `${action} ${qualifier} ${word}`,
        `Please ${action.toLowerCase()} ${word.toLowerCase()}`,
        `${word} has been ${action.toLowerCase()}ed`,
        `Failed to ${action.toLowerCase()} ${word.toLowerCase()}`,
      ];

      for (const combo of combinations) {
        if (testKeys.length < 500 && !testKeys.includes(combo)) {
          testKeys.push(combo);
        }
      }
      index++;
    }

    // 确保正好 500 个
    const finalKeys = testKeys.slice(0, 500);

    expect(finalKeys.length).toBe(500);

    console.log(`\n🚀 开始测试 ${finalKeys.length} 个文案的 AI 翻译...`);
    console.log(`📋 目标语言: ${config.languages.filter(l => l !== 'en').join(', ')}`);
    console.log(`⚙️  配置: batchSize=${config.llmBatchSize}, batchDelay=${config.llmBatchDelay}ms`);
    console.log(`📦 预计批次数: ${Math.ceil(500 / (config.llmBatchSize || 10))}\n`);

    const startTime = Date.now();

    // 调用翻译服务
    const result = await translationService.translateNewKeys(
      finalKeys,
      config.languages
    );

    const endTime = Date.now();
    const duration = endTime - startTime;
    const durationSeconds = (duration / 1000).toFixed(2);
    const avgPerKey = (duration / 500).toFixed(0);

    // 验证结果
    expect(result.size).toBe(500);

    // 验证每个 key 都有所有语言的翻译
    let successCount = 0;
    let failureCount = 0;

    for (const key of finalKeys) {
      const translations = result.get(key);
      expect(translations).toBeDefined();

      // 英文应该是原文
      expect(translations!.en).toBe(key);

      // 其他语言应该有翻译（非空）
      for (const lang of config.languages) {
        if (lang !== 'en') {
          expect(translations![lang]).toBeDefined();
          expect(translations![lang]).not.toBe('');

          if (translations![lang] && translations![lang] !== key) {
            successCount++;
          } else if (translations![lang] === key) {
            // 翻译结果等于原文，可能翻译失败
            failureCount++;
          }
        }
      }
    }

    console.log(`\n✅ 测试完成！`);
    console.log(`⏱️  总耗时: ${duration}ms (${durationSeconds}s)`);
    console.log(`📊 平均每个 key: ${avgPerKey}ms`);
    console.log(`📦 批次数: ${Math.ceil(500 / (config.llmBatchSize || 10))}`);
    console.log(`✅ 成功翻译: ${successCount} 条`);
    console.log(`⚠️  可能失败: ${failureCount} 条 (降级到原文)`);

    // 验证至少 90% 的翻译是成功的（不是原文）
    const totalTranslations = 500 * (config.languages.length - 1); // 排除英文
    const successRate = (successCount / totalTranslations) * 100;
    console.log(`📈 翻译成功率: ${successRate.toFixed(1)}%`);
    expect(successRate).toBeGreaterThanOrEqual(90);
  }, 600000); // 10 分钟超时

  it('应该显示翻译进度日志', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    // 使用较小的测试集验证进度日志
    const testKeys = Array.from({ length: 35 }, (_, i) => `Test key ${i + 1}`);

    await translationService.translateNewKeys(testKeys, ['en', 'ko', 'zh-CN']);

    // 验证包含进度日志
    const logs = consoleLogSpy.mock.calls.map(call => call.join(' '));
    const progressLogs = logs.filter(log => log.includes('进度') || log.includes('批次'));

    expect(progressLogs.length).toBeGreaterThan(0);

    consoleLogSpy.mockRestore();
  }, 120000);
});
