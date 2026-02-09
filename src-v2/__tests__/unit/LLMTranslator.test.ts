/**
 * LLMTranslator 单元测试
 */

import { LLMTranslator } from '../../domain/translate/LLMTranslator';
import { I18nConfig } from '../../types/config';

describe('LLMTranslator', () => {
  let mockConfig: I18nConfig;

  beforeEach(() => {
    mockConfig = {
      rootDir: './test',
      languages: ['en', 'ko', 'zh-CN'],
      ignore: [],
      spreadsheetId: 'test-sheet-id',
      sheetName: 'i18n',
      keyFile: './test-key.json',
      startMarker: '~',
      endMarker: '~',
      include: ['ts', 'tsx'],
      outputDir: './translate',
      apiKey: 'test-api-key',
      llmRetries: 2,
      llmTimeout: 5000,
      llmTemperature: 0.2,
      llmModel: 'qwen-turbo',
    };
  });

  describe('translate - 单个翻译', () => {
    it('应该成功翻译英文到韩文', async () => {
      const mockCallLLM = jest.spyOn(LLMTranslator.prototype as any, 'callLLM')
        .mockResolvedValue('환영입니다');

      const translator = new LLMTranslator(mockConfig);
      const result = await translator.translate('Welcome', 'en', 'ko');

      expect(result).toBe('환영입니다');
      mockCallLLM.mockRestore();
    });

    it('应该成功翻译英文到简体中文', async () => {
      const mockCallLLM = jest.spyOn(LLMTranslator.prototype as any, 'callLLM')
        .mockResolvedValue('欢迎');

      const translator = new LLMTranslator(mockConfig);
      const result = await translator.translate('Hello', 'en', 'zh-CN');

      expect(result).toBe('欢迎');
      mockCallLLM.mockRestore();
    });

    it('翻译失败时应该降级到原文', async () => {
      const mockCallLLM = jest.spyOn(LLMTranslator.prototype as any, 'callLLM')
        .mockRejectedValue(new Error('API Error'));

      const translator = new LLMTranslator(mockConfig);
      const result = await translator.translate('Welcome', 'en', 'ko');

      expect(result).toBe('Welcome');
      mockCallLLM.mockRestore();
    });

    it('空文本应该直接返回', async () => {
      const translator = new LLMTranslator(mockConfig);

      const result1 = await translator.translate('', 'en', 'ko');
      const result2 = await translator.translate('   ', 'en', 'ko');

      expect(result1).toBe('');
      expect(result2).toBe('   ');
    });

    it('源语言和目标语言相同时应该返回原文', async () => {
      const translator = new LLMTranslator(mockConfig);

      const result = await translator.translate('Welcome', 'en', 'en');

      expect(result).toBe('Welcome');
    });
  });

  describe('translate - 重试机制', () => {
    it('第一次失败后应该重试', async () => {
      const mockCallLLM = jest.spyOn(LLMTranslator.prototype as any, 'callLLM')
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('환영입니다');

      const translator = new LLMTranslator(mockConfig);
      const result = await translator.translate('Welcome', 'en', 'ko');

      expect(result).toBe('환영입니다');
      expect(mockCallLLM).toHaveBeenCalledTimes(2);
      mockCallLLM.mockRestore();
    });

    it('达到最大重试次数后应该降级到原文', async () => {
      const mockCallLLM = jest.spyOn(LLMTranslator.prototype as any, 'callLLM')
        .mockRejectedValue(new Error('API Error'));

      const translator = new LLMTranslator(mockConfig);
      const result = await translator.translate('Welcome', 'en', 'ko');

      expect(result).toBe('Welcome');
      mockCallLLM.mockRestore();
    });
  });

  describe('translateBatch - 批量翻译', () => {
    it('应该批量翻译多个 key 到多种语言', async () => {
      const mockCallLLM = jest.spyOn(LLMTranslator.prototype as any, 'callLLM')
        .mockResolvedValueOnce('환영입니다')  // Welcome -> ko
        .mockResolvedValueOnce('欢迎')        // Welcome -> zh-CN
        .mockResolvedValueOnce('로그인')      // Login -> ko
        .mockResolvedValueOnce('登录');       // Login -> zh-CN

      const translator = new LLMTranslator(mockConfig);
      const keys = ['Welcome', 'Login'];
      const result = await translator.translateBatch(keys, 'en', ['ko', 'zh-CN']);

      expect(result.get('Welcome')).toEqual({ ko: '환영입니다', 'zh-CN': '欢迎' });
      expect(result.get('Login')).toEqual({ ko: '로그인', 'zh-CN': '登录' });
      expect(result.size).toBe(2);
      mockCallLLM.mockRestore();
    });

    it('批量翻译时部分失败应该只返回成功的结果', async () => {
      const mockCallLLM = jest.spyOn(LLMTranslator.prototype as any, 'callLLM')
        .mockResolvedValueOnce('환영입니다')  // Welcome -> ko (success)
        .mockRejectedValueOnce(new Error('API Error')); // Welcome -> zh-CN (fail, fallback to original)

      const translator = new LLMTranslator(mockConfig);
      const result = await translator.translateBatch(['Welcome'], 'en', ['ko', 'zh-CN']);

      expect(result.get('Welcome')?.ko).toBe('환영입니다');
      expect(result.get('Welcome')?.['zh-CN']).toBe('Welcome'); // 降级到原文
      mockCallLLM.mockRestore();
    });

    it('空 keys 数组应该返回空 Map', async () => {
      const translator = new LLMTranslator(mockConfig);

      const result = await translator.translateBatch([], 'en', ['ko']);

      expect(result.size).toBe(0);
    });

    it('应该记录翻译进度', async () => {
      const mockCallLLM = jest.spyOn(LLMTranslator.prototype as any, 'callLLM')
        .mockResolvedValue('환영입니다');

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const translator = new LLMTranslator(mockConfig);
      await translator.translateBatch(['Welcome', 'Login'], 'en', ['ko']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('进度')
      );

      consoleLogSpy.mockRestore();
      mockCallLLM.mockRestore();
    });
  });

  describe('translateBatch - 分批处理', () => {
    it('应该使用批量 JSON 翻译', async () => {
      const mockCallLLMBatch = jest.spyOn(LLMTranslator.prototype as any, 'callLLMBatch')
        .mockResolvedValue(
          new Map([
            ['Key1', { ko: '번역1' }],
            ['Key2', { ko: '번역2' }],
            ['Key3', { ko: '번역3' }],
          ])
        );

      const translator = new LLMTranslator({ ...mockConfig, llmBatchSize: 3 });

      const keys = ['Key1', 'Key2', 'Key3'];
      const result = await translator.translateBatch(keys, 'en', ['ko']);

      expect(result.size).toBe(3);
      expect(result.get('Key1')?.ko).toBe('번역1');
      expect(mockCallLLMBatch).toHaveBeenCalledTimes(1);
      mockCallLLMBatch.mockRestore();
    });

    it('批量 JSON 翻译失败时应该降级到逐个翻译', async () => {
      const mockCallLLM = jest.spyOn(LLMTranslator.prototype as any, 'callLLM')
        .mockResolvedValue('번역됨');

      const mockCallLLMBatch = jest.spyOn(LLMTranslator.prototype as any, 'callLLMBatch')
        .mockRejectedValue(new Error('Batch failed'));

      const translator = new LLMTranslator({ ...mockConfig, llmBatchSize: 3 });

      const keys = ['Key1', 'Key2'];
      const result = await translator.translateBatch(keys, 'en', ['ko']);

      // 应该降级到逐个翻译
      expect(result.get('Key1')?.ko).toBe('번역됨');
      expect(result.get('Key2')?.ko).toBe('번역됨');
      expect(mockCallLLM).toHaveBeenCalledTimes(2);

      mockCallLLM.mockRestore();
      mockCallLLMBatch.mockRestore();
    });

    it('批次间应该有延迟', async () => {
      const mockCallLLMBatch = jest.spyOn(LLMTranslator.prototype as any, 'callLLMBatch')
        .mockResolvedValue(new Map());

      const translator = new LLMTranslator({ ...mockConfig, llmBatchSize: 2, llmBatchDelay: 100 });

      const startTime = Date.now();
      await translator.translateBatch(['Key1', 'Key2', 'Key3', 'Key4'], 'en', ['ko']);
      const endTime = Date.now();

      // 4个keys，batchSize=2，需要2批，至少100ms延迟
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
      mockCallLLMBatch.mockRestore();
    });
  });

  describe('callLLMBatch - 批量 JSON 翻译', () => {
    it('应该解析 LLM 返回的 JSON', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: '{"Welcome": {"ko": "환영입니다", "zh-CN": "欢迎"}, "Login": {"ko": "로그인", "zh-CN": "登录"}}'
                }
              }]
            })
          }
        }
      };

      const translator = new LLMTranslator(mockConfig);
      (translator as any).openai = mockOpenAI;

      const result = await (translator as any).callLLMBatch(
        ['Welcome', 'Login'],
        ['ko', 'zh-CN'],
        'qwen-turbo',
        0.2
      );

      expect(result.size).toBe(2);
      expect(result.get('Welcome')?.ko).toBe('환영입니다');
      expect(result.get('Welcome')?.['zh-CN']).toBe('欢迎');
      expect(result.get('Login')?.ko).toBe('로그인');
    });

    it('应该清理 markdown 代码块', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: '```json\n{"Welcome": {"ko": "환영입니다"}}\n```'
                }
              }]
            })
          }
        }
      };

      const translator = new LLMTranslator(mockConfig);
      (translator as any).openai = mockOpenAI;

      const result = await (translator as any).callLLMBatch(
        ['Welcome'],
        ['ko'],
        'qwen-turbo',
        0.2
      );

      expect(result.get('Welcome')?.ko).toBe('환영입니다');
    });

    it('JSON 解析失败时应该返回空 Map', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'invalid json'
                }
              }]
            })
          }
        }
      };

      const translator = new LLMTranslator(mockConfig);
      (translator as any).openai = mockOpenAI;

      const result = await (translator as any).callLLMBatch(
        ['Welcome'],
        ['ko'],
        'qwen-turbo',
        0.2
      );

      expect(result.size).toBe(0);
    });
  });
});
