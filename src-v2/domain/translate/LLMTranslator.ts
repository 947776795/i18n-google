/**
 * Domain - Translate Module
 * LLM 翻译器 - 使用 LLM API 进行文本翻译
 */

import OpenAI from 'openai';
import { I18nConfig } from '../../types/config';
import { Logger } from '../../utils/Logger';

/**
 * LLM 翻译器
 *
 * 职责：
 * - 调用 LLM API 进行单个/批量翻译
 * - 支持重试机制
 * - 支持分批处理
 * - 翻译失败时降级到原文
 */
export class LLMTranslator {
  private openai: OpenAI;
  private batchSize: number;
  private batchDelay: number;

  constructor(private config: I18nConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
    this.batchSize = config.llmBatchSize ?? 15;
    this.batchDelay = config.llmBatchDelay ?? 500;
  }

  /**
   * 翻译单个文本
   *
   * @param text 原文
   * @param from 源语言代码
   * @param to 目标语言代码
   * @returns 翻译结果，失败时返回原文
   */
  async translate(text: string, from: string, to: string): Promise<string> {
    // 早期返回：空文本
    if (!text || !text.trim()) {
      return text;
    }

    // 源语言和目标语言相同时，直接返回原文
    if (from === to) {
      return text;
    }

    const retries = this.config.llmRetries ?? 3;
    const temperature = this.config.llmTemperature ?? 0.2;
    const model = this.config.llmModel ?? 'qwen-turbo';

    Logger.info(`🤖 [AI翻译] 正在将 "${text}" 从 ${from} 翻译为 ${to} ...`);

    // 重试逻辑
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        Logger.debug(`🔄 [AI翻译] 尝试第 ${attempt}/${retries} 次...`);

        const translated = await this.callLLM(text, from, to, model, temperature);

        if (translated) {
          Logger.info(`✅ [AI翻译] 翻译成功: ${translated}`);
          return translated;
        } else {
          Logger.warn(`⚠️ [AI翻译] 第 ${attempt} 次尝试返回空结果`);
          if (attempt === retries) {
            Logger.warn(`❌ [AI翻译] 所有尝试失败，返回原文: ${text}`);
            return text;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Logger.warn(`⚠️ [AI翻译] 第 ${attempt} 次尝试失败: ${message}`);

        if (attempt === retries) {
          Logger.warn(`❌ [AI翻译] 所有尝试失败，返回原文: ${text}`);
          return text;
        }

        // 短暂等待后重试
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    return text; // 兜底返回原文
  }

  /**
   * 调用 LLM API 进行翻译（内部方法，可 mock）
   *
   * @param text 原文
   * @param from 源语言代码
   * @param to 目标语言代码
   * @param model 模型名称
   * @param temperature 温度参数
   * @returns 翻译结果
   */
  protected async callLLM(
    text: string,
    from: string,
    to: string,
    model: string,
    temperature: number
  ): Promise<string> {
    const timeout = this.config.llmTimeout ?? 30000;

    const completion = await Promise.race([
      this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate accurately while preserving formatting and avoiding over-translation.',
          },
          {
            role: 'user',
            content: `请将以下文本翻译为${to}，保持语义专业、格式不变：\n\n${text.trim()}`,
          },
        ],
        temperature,
      }),
      // 超时处理
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]) as any;

    return completion.choices[0]?.message.content?.trim() || '';
  }

  /**
   * 清理 LLM 返回的 JSON 字符串
   *
   * @param jsonString LLM 返回的原始字符串
   * @returns 清理后的 JSON 字符串
   */
  private cleanJSON(jsonString: string): string {
    // 移除可能的 markdown 代码块标记
    let cleaned = jsonString.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    return cleaned.trim();
  }

  /**
   * 解析 LLM 返回的 JSON 翻译结果
   *
   * @param jsonString LLM 返回的 JSON 字符串
   * @param keys 原始 keys 列表（用于验证和填充缺失项）
   * @param targetLangs 目标语言列表
   * @returns Map<key, Record<langCode, translation>>
   */
  private parseTranslationJSON(
    jsonString: string,
    keys: string[],
    targetLangs: string[]
  ): Map<string, Record<string, string>> {
    const result = new Map<string, Record<string, string>>();

    try {
      const cleaned = this.cleanJSON(jsonString);
      const parsed = JSON.parse(cleaned);

      for (const key of keys) {
        const translations: Record<string, string> = {};

        if (parsed[key] && typeof parsed[key] === 'object') {
          for (const lang of targetLangs) {
            translations[lang] = parsed[key][lang] || key; // 缺失时使用原文
          }
        } else {
          // 该 key 没有翻译结果，使用原文
          for (const lang of targetLangs) {
            translations[lang] = key;
          }
        }

        result.set(key, translations);
      }
    } catch (error) {
      Logger.warn(`⚠️ [AI翻译] JSON 解析失败: ${error}，返回空结果`);
      // 返回空结果，让调用方降级处理
    }

    return result;
  }

  /**
   * 调用 LLM API 进行批量 JSON 翻译
   *
   * @param keys 待翻译的 keys
   * @param targetLangs 目标语言列表
   * @param model 模型名称
   * @param temperature 温度参数
   * @returns Map<key, Record<langCode, translation>>
   */
  protected async callLLMBatch(
    keys: string[],
    targetLangs: string[],
    model: string,
    temperature: number
  ): Promise<Map<string, Record<string, string>>> {
    const timeout = this.config.llmTimeout ?? 30000;

    // 构建批量翻译的 prompt
    const inputPayload = JSON.stringify({ keys, targetLanguages: targetLangs }, null, 2);
    const prompt = `你是一个专业翻译系统。请将以下 JSON 中的英文文本翻译为指定的目标语言。

输入格式：
{
  "keys": ["Welcome", "Login", "Sign up"],
  "targetLanguages": ["ko", "zh-CN", "es"]
}

要求：
1. 保持 JSON 格式输出，不要使用 markdown 代码块
2. 翻译要准确、专业
3. 保持占位符格式不变（如 %{variable}、\${variable}）
4. 每个文本要翻译到所有目标语言
5. 返回格式：
{
  "Welcome": {"ko": "환영합니다", "zh-CN": "欢迎", "es": "Bienvenido"},
  "Login": {"ko": "로그인", "zh-CN": "登录", "es": "Iniciar sesión"},
  "Sign up": {"ko": "회원가입", "zh-CN": "注册", "es": "Registrarse"}
}

请翻译以下内容：
${inputPayload}`;

    const completion = await Promise.race([
      this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional translation system. Return only valid JSON output.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
      }),
      // 超时处理
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]) as any;

    const responseText = completion.choices[0]?.message.content?.trim() || '';

    // 解析 JSON 响应
    return this.parseTranslationJSON(responseText, keys, targetLangs);
  }

  /**
   * 批量翻译
   *
   * @param keys 待翻译的 key 数组
   * @param fromLang 源语言代码
   * @param toLangs 目标语言代码数组
   * @returns Map<key, Record<langCode, translation>>
   */
  async translateBatch(
    keys: string[],
    fromLang: string,
    toLangs: string[]
  ): Promise<Map<string, Record<string, string>>> {
    const result = new Map<string, Record<string, string>>();

    if (keys.length === 0 || toLangs.length === 0) {
      return result;
    }

    const temperature = this.config.llmTemperature ?? 0.2;
    const model = this.config.llmModel ?? 'qwen-turbo';

    // 分批处理 - 使用批量 JSON 翻译
    const totalBatches = Math.ceil(keys.length / this.batchSize);
    let currentBatch = 0;

    for (let i = 0; i < keys.length; i += this.batchSize) {
      currentBatch++;
      const batch = keys.slice(i, i + this.batchSize);

      Logger.info(`📦 [AI翻译] 批次 ${currentBatch}/${totalBatches} - 批量翻译 ${batch.length} 个 keys 到 ${toLangs.length} 种语言`);

      try {
        // 使用批量 JSON 翻译（一次调用翻译一批 keys 到所有目标语言）
        const batchResult = await this.callLLMBatch(batch, toLangs, model, temperature);

        // 合并结果
        for (const [key, translations] of batchResult.entries()) {
          result.set(key, translations);
        }

        Logger.info(`✅ [AI翻译] 批次 ${currentBatch} 完成，获得 ${batchResult.size} 个 keys 的翻译`);
      } catch (error) {
        // 批量翻译失败，降级到逐个翻译
        Logger.warn(`⚠️ [AI翻译] 批量翻译失败，降级到逐个翻译: ${error}`);

        for (const key of batch) {
          const keyTranslations: Record<string, string> = {};
          for (const toLang of toLangs) {
            try {
              const translated = await this.translate(key, fromLang, toLang);
              keyTranslations[toLang] = translated;
            } catch (err) {
              Logger.warn(`⚠️ [AI翻译] ${key} 翻译到 ${toLang} 失败，使用原文: ${key}`);
              keyTranslations[toLang] = key;
            }
          }
          result.set(key, keyTranslations);
        }
      }

      // 更新进度
      const completed = Math.min(i + this.batchSize, keys.length);
      Logger.info(`📊 [AI翻译] 进度: ${completed}/${keys.length}`);

      // 批次间延迟（最后一批不需要延迟）
      if (i + this.batchSize < keys.length) {
        await new Promise((resolve) => setTimeout(resolve, this.batchDelay));
      }
    }

    Logger.info(`✅ [AI翻译] 批量翻译完成，共处理 ${keys.length} 个 keys`);
    return result;
  }

  /**
   * 为新 key 生成所有配置语言的翻译
   *
   * @param key 待翻译的 key
   * @param baseLang 基础语言（默认 'en'）
   * @param targetLocales 目标语言列表
   * @returns Record<langCode, translation>
   */
  async translateForAllLanguages(
    key: string,
    baseLang: string = 'en',
    targetLocales: string[]
  ): Promise<Record<string, string>> {
    const translations: Record<string, string> = {};

    // 基础语言直接使用原文
    translations[baseLang] = key;

    // 过滤掉基础语言
    const targetLangs = targetLocales.filter(
      (lang) => lang !== baseLang && !lang.endsWith('.json')
    );

    // 翻译其他语言
    for (const lang of targetLangs) {
      try {
        translations[lang] = await this.translate(key, baseLang, lang);
      } catch (error) {
        Logger.warn(`⚠️ [AI翻译] ${key} 翻译到 ${lang} 失败，使用原文`);
        translations[lang] = key;
      }
    }

    return translations;
  }
}
