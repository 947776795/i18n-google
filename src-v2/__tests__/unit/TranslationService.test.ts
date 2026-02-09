/**
 * TranslationService 单元测试
 */

import { TranslationService } from '../../domain/translate/TranslationService';
import { LLMTranslator } from '../../domain/translate/LLMTranslator';
import { I18nConfig } from '../../types/config';

// Mock LLMTranslator
jest.mock('../../domain/translate/LLMTranslator');

describe('TranslationService', () => {
  let mockConfig: I18nConfig;

  beforeEach(() => {
    // 清除所有 mocks
    jest.clearAllMocks();

    mockConfig = {
      rootDir: './test',
      languages: ['en', 'ko', 'zh-CN', 'es'],
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
      llmBatchSize: 3,
      llmBatchDelay: 100,
    };
  });

  describe('translateNewKeys - 翻译新 keys', () => {
    it('应该为所有新 keys 生成翻译', async () => {
      // Mock LLMTranslator.translateBatch
      const mockTranslateBatch = jest.spyOn(LLMTranslator.prototype, 'translateBatch')
        .mockResolvedValue(
          new Map([
            ['Welcome', { ko: '환영입니다', 'zh-CN': '欢迎', es: 'Bienvenido' }],
            ['Login', { ko: '로그인', 'zh-CN': '登录', es: 'Iniciar sesión' }],
          ])
        );

      const service = new TranslationService(mockConfig);

      const keys = ['Welcome', 'Login'];
      const result = await service.translateNewKeys(keys, ['ko', 'zh-CN', 'es']);

      expect(result.size).toBe(2);
      expect(result.get('Welcome')).toEqual({
        ko: '환영입니다',
        'zh-CN': '欢迎',
        es: 'Bienvenido',
      });
      expect(result.get('Login')).toEqual({
        ko: '로그인',
        'zh-CN': '登录',
        es: 'Iniciar sesión',
      });

      mockTranslateBatch.mockRestore();
    });

    it('英文语言应该使用原文作为翻译', async () => {
      // Mock 空的翻译结果
      jest.spyOn(LLMTranslator.prototype, 'translateBatch')
        .mockResolvedValue(new Map());

      const service = new TranslationService(mockConfig);

      const keys = ['Welcome', 'Login'];
      const result = await service.translateNewKeys(keys, ['en', 'ko']);

      // 英文应该使用原文
      expect(result.get('Welcome')?.en).toBe('Welcome');
      expect(result.get('Login')?.en).toBe('Login');

      // 其他语言因为mock返回空Map，应该也是原文
      expect(result.get('Welcome')?.ko).toBe('Welcome');
    });

    it('空 keys 数组应该返回空 Map', async () => {
      const service = new TranslationService(mockConfig);

      const result = await service.translateNewKeys([], ['ko']);

      expect(result.size).toBe(0);
    });

    it('应该过滤掉英文语言，不调用 LLM', async () => {
      const translateBatchSpy = jest.spyOn(LLMTranslator.prototype, 'translateBatch')
        .mockResolvedValue(new Map());

      const service = new TranslationService(mockConfig);

      await service.translateNewKeys(['Welcome'], ['en']);

      // 只包含英文时，不应该调用翻译
      expect(translateBatchSpy).not.toHaveBeenCalled();

      translateBatchSpy.mockRestore();
    });

    it('应该正确处理混合语言列表（包含 en）', async () => {
      jest.spyOn(LLMTranslator.prototype, 'translateBatch')
        .mockResolvedValue(
          new Map([
            ['Welcome', { ko: '환영입니다', 'zh-CN': '欢迎' }],
          ])
        );

      const service = new TranslationService(mockConfig);

      const keys = ['Welcome'];
      const result = await service.translateNewKeys(keys, ['en', 'ko', 'zh-CN']);

      expect(result.get('Welcome')).toEqual({
        en: 'Welcome',      // 原文
        ko: '환영입니다',    // 翻译
        'zh-CN': '欢迎',    // 翻译
      });
    });
  });

  describe('translateNewKeys - 错误处理', () => {
    it('翻译服务抛出错误时应该返回包含原文的结果', async () => {
      jest.spyOn(LLMTranslator.prototype, 'translateBatch')
        .mockRejectedValue(new Error('API Error'));

      const service = new TranslationService(mockConfig);

      const keys = ['Welcome', 'Login'];
      const result = await service.translateNewKeys(keys, ['ko', 'zh-CN']);

      // 错误时，所有语言都应该是原文
      expect(result.get('Welcome')).toEqual({
        ko: 'Welcome',
        'zh-CN': 'Welcome',
      });
      expect(result.get('Login')).toEqual({
        ko: 'Login',
        'zh-CN': 'Login',
      });
    });

    it('部分翻译失败时应该降级到原文', async () => {
      // 模拟部分失败
      jest.spyOn(LLMTranslator.prototype, 'translateBatch')
        .mockResolvedValue(
          new Map([
            ['Welcome', { ko: '환영입니다' } as Record<string, string>], // zh-CN 缺失
            ['Login', { ko: '로그인', 'zh-CN': '登录' }],
          ])
        );

      const service = new TranslationService(mockConfig);

      const keys = ['Welcome', 'Login'];
      const result = await service.translateNewKeys(keys, ['ko', 'zh-CN']);

      // Welcome 的 zh-CN 缺失时应该降级到原文
      expect(result.get('Welcome')).toEqual({
        ko: '환영입니다',
        'zh-CN': 'Welcome',  // 降级到原文
      });
      expect(result.get('Login')).toEqual({
        ko: '로그인',
        'zh-CN': '登录',
      });
    });
  });

  describe('translateNewKeys - 进度显示', () => {
    it('应该显示翻译进度日志', async () => {
      jest.spyOn(LLMTranslator.prototype, 'translateBatch')
        .mockResolvedValue(
          new Map([
            ['Welcome', { ko: '환영입니다' }],
            ['Login', { ko: '로그인' }],
          ])
        );

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const service = new TranslationService(mockConfig);

      await service.translateNewKeys(['Welcome', 'Login'], ['ko']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AI翻译]')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('2')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('filterNonEnglishLocales - 过滤非英文语言', () => {
    it('应该过滤掉 en 和 en.json', async () => {
      const service = new TranslationService(mockConfig);

      const locales = ['en', 'en.json', 'ko', 'zh-CN', 'es'];
      const result = await (service as any).filterNonEnglishLocales(locales);

      expect(result).toEqual(['ko', 'zh-CN', 'es']);
    });

    it('只有英文时应该返回空数组', async () => {
      const service = new TranslationService(mockConfig);

      const locales = ['en', 'en.json'];
      const result = await (service as any).filterNonEnglishLocales(locales);

      expect(result).toEqual([]);
    });

    it('没有英文时应该返回原数组', async () => {
      const service = new TranslationService(mockConfig);

      const locales = ['ko', 'zh-CN', 'es'];
      const result = await (service as any).filterNonEnglishLocales(locales);

      expect(result).toEqual(['ko', 'zh-CN', 'es']);
    });
  });

  describe('buildResultWithFallback - 构建带降级的结果', () => {
    it('应该合并原文和翻译结果', async () => {
      const service = new TranslationService(mockConfig);

      const translations = new Map([
        ['Welcome', { ko: '환영입니다' }],
      ]);

      const keys = ['Welcome'];
      const locales = ['en', 'ko', 'zh-CN'];

      const result = await (service as any).buildResultWithFallback(keys, locales, translations);

      expect(result.get('Welcome')).toEqual({
        en: 'Welcome',       // 原文
        ko: '환영입니다',    // 翻译
        'zh-CN': 'Welcome',  // 降级到原文
      });
    });
  });
});
