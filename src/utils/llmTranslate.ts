import OpenAI from "openai";
import { Logger } from "./StringUtils";
import { TranslationOptions, GlossaryMap } from "../types";

// 批量翻译的返回类型
export type BatchTranslationResult = Record<string, Record<string, string>>;


/**
 * 使用 Qwen 大模型进行翻译（增强版本，支持重试、术语表和错误恢复）
 * @param text 原文
 * @param from 源语言（如 'en'）
 * @param to 目标语言（如 'zh-Hans'）
 * @param apiKey API密钥
 * @param options 翻译选项
 */
export async function llmTranslate(
  text: string,
  from: string,
  to: string,
  apiKey: string,
  options: TranslationOptions = {}
): Promise<string> {
  // 早期返回：空文本或仅空白字符
  if (!text || !text.trim()) {
    return text;
  }

  const {
    retries = 3,
    timeout = 30000,
    temperature = 0.2,
    model = "qwen-turbo",
  } = options;

  Logger.info(`🤖 [AI翻译] 正在将 "${text}" 从 ${from} 翻译为 ${to} ...`);

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });

  // 构建专业翻译提示
  const prompt = `请将以下英文翻译为${to}，保持语义专业、格式不变、不要过度翻译：

${text.trim()}`;

  // 重试逻辑
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      Logger.debug(`🔄 [AI翻译] 尝试第 ${attempt}/${retries} 次...`);

      const completion = await Promise.race([
        openai.chat.completions.create({
          model,
          messages: [
            { 
              role: "system", 
              content: "You are a professional translator. Translate accurately while preserving formatting and avoiding over-translation." 
            },
            { role: "user", content: prompt },
          ],
          temperature,
        }),
        // 超时处理
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), timeout)
        ),
      ]);

      const translated = completion.choices[0]?.message.content?.trim();
      
      if (translated) {
        Logger.info(`✅ [AI翻译] 翻译成功: ${translated}`);
        return translated;
      } else {
        Logger.warn(`⚠️ [AI翻译] 第 ${attempt} 次尝试返回空结果`);
        if (attempt === retries) {
          Logger.warn(`❌ [AI翻译] 所有尝试失败，返回原文: ${text}`);
          return text; // 降级到原文
        }
      }
    } catch (error) {
      Logger.warn(`⚠️ [AI翻译] 第 ${attempt} 次尝试失败: ${error instanceof Error ? error.message : String(error)}`);
      
      if (attempt === retries) {
        Logger.warn(`❌ [AI翻译] 所有尝试失败，返回原文: ${text}`);
        return text; // 降级到原文
      }
      
      // 短暂等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  return text; // 兜底返回原文
}

/**
 * 检查英文key是否在术语表中完全匹配
 * @param englishKey 英文key
 * @param glossary 术语表映射
 * @returns 是否存在完全匹配
 */
export function isTermInGlossary(
  englishKey: string,
  glossary: GlossaryMap
): boolean {
  // 检查任意语言的术语表中是否包含该英文key
  for (const langGlossary of Object.values(glossary)) {
    if (langGlossary[englishKey]) {
      return true;
    }
  }
  return false;
}

/**
 * 从术语表获取指定语言的翻译
 * @param englishKey 英文key（完全匹配）
 * @param languageCode 目标语言代码
 * @param glossary 术语表映射
 * @returns 术语表中的翻译，如果不存在返回null
 */
export function getTermTranslation(
  englishKey: string,
  languageCode: string,
  glossary: GlossaryMap
): string | null {
  const langGlossary = glossary[languageCode];
  if (!langGlossary) {
    return null;
  }
  return langGlossary[englishKey] || null;
}

/**
 * 带术语表支持的翻译函数（重新设计版本）
 *
 * 新逻辑：
 * 1. 如果英文key在术语表中完全匹配，直接返回术语表的翻译，不调用LLM
 * 2. 如果不匹配，使用LLM进行翻译
 *
 * @param text 原文（英文key）
 * @param from 源语言
 * @param to 目标语言
 * @param apiKey API密钥
 * @param options 翻译选项
 * @param glossary 术语表（可选）
 */
export async function translateWithGlossary(
  text: string,
  from: string,
  to: string,
  apiKey: string,
  options: TranslationOptions = {},
  glossary?: GlossaryMap
): Promise<string> {
  // 新逻辑：如果启用术语表且术语表可用，先检查是否完全匹配
  if (options.enableGlossary && glossary) {
    const termTranslation = getTermTranslation(text, to, glossary);

    if (termTranslation) {
      Logger.info(`📚 [术语表] 使用术语表翻译: "${text}" -> "${termTranslation}"`);
      return termTranslation;
    }
  }

  // 如果术语表中没有匹配，使用LLM翻译
  const translated = await llmTranslate(text, from, to, apiKey, options);
  return translated;
}

/**
 * 批量翻译方法 - 专为批量处理设计
 * 将JSON格式的多个待翻译内容一次性送给AI，AI完整处理后返回所有翻译
 * 
 * @param keysToTranslate { "key1": "en", "key2": "en", ... }
 * @param targetLanguages ["zh-CN", "ko", "ja", ...]
 * @param apiKey Qwen API密钥
 * @param retries 重试次数
 * @param timeout 超时时间（毫秒）
 * @param model LLM模型名称
 * @returns { "key1": { "zh-CN": "翻译1", "ko": "번역1" }, ... }
 */
export async function batchTranslateKeys(
  keysToTranslate: Record<string, string>,
  targetLanguages: string[],
  apiKey: string,
  retries: number = 3,
  timeout: number = 30000,
  model: string = "qwen-turbo"
): Promise<BatchTranslationResult> {
  if (!keysToTranslate || Object.keys(keysToTranslate).length === 0) {
    Logger.info("✅ 无需翻译的内容");
    return {};
  }

  const sourceLanguage = "en";
  const keysArray = Object.keys(keysToTranslate);

  Logger.info(
    `🌍 [批量翻译] 开始翻译 ${keysArray.length} 个key 到 ${targetLanguages.length} 种语言`
  );

  const openai = new OpenAI({
    apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });

  // 构建JSON格式的待翻译内容
  const translationInput = keysArray.reduce(
    (acc, key) => {
      acc[key] = keysToTranslate[key];
      return acc;
    },
    {} as Record<string, string>
  );

  const inputJson = JSON.stringify(translationInput, null, 2);
  const languagesList = targetLanguages.join(", ");

  // 构建翻译提示词
  const prompt = `你是一个专业的翻译器。请将下面JSON中的所有key从${sourceLanguage}翻译为以下目标语言: ${languagesList}

要求:
1. 保持专业、准确的语义
2. 格式不变，不要过度翻译
3. 返回有效的JSON格式

待翻译的key (JSON格式):
\`\`\`json
${inputJson}
\`\`\`

请返回纯JSON（无markdown包装、无额外文本），格式必须如下:
\`\`\`json
{
  "key1": {
    "zh-CN": "翻译结果",
    "ko": "번역결과",
    "ja": "翻訳結果"
  },
  "key2": {
    "zh-CN": "翻译结果2",
    "ko": "번역결과2",
    "ja": "翻訳結果2"
  }
}
\`\`\``;

  // 重试逻辑
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      Logger.debug(`🔄 [批量翻译] 第 ${attempt}/${retries} 次尝试...`);

      const response = await Promise.race([
        openai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are a professional translator. Return only valid JSON without any markdown formatting or additional text.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Translation request timeout")),
            timeout
          )
        ),
      ]);

      const responseText = response.choices[0]?.message.content?.trim();

      if (!responseText) {
        throw new Error("Empty response from LLM");
      }

      // 尝试提取JSON
      let result: BatchTranslationResult;
      try {
        // 移除可能的markdown代码块标记
        let jsonStr = responseText;
        if (jsonStr.includes("```json")) {
          jsonStr = jsonStr.split("```json")[1].split("```")[0];
        } else if (jsonStr.includes("```")) {
          jsonStr = jsonStr.split("```")[1].split("```")[0];
        }
        jsonStr = jsonStr.trim();

        result = JSON.parse(jsonStr);
      } catch (e) {
        Logger.warn(
          `⚠️ [批量翻译] 第 ${attempt} 次：JSON解析失败 - ${
            (e as Error).message
          }`
        );
        if (attempt === retries) {
          // 最后一次尝试失败，使用降级方案
          return buildFallbackTranslations(keysArray, targetLanguages);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      // 验证结果完整性
      const missingKeys = keysArray.filter((key) => !result[key]);
      if (missingKeys.length > 0) {
        Logger.warn(
          `⚠️ [批量翻译] 返回结果缺少keys: ${missingKeys.join(", ")}`
        );
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        // 对缺失的key进行降级
        missingKeys.forEach((key) => {
          result[key] = {};
          targetLanguages.forEach((lang) => {
            result[key][lang] = key;
          });
        });
      }

      Logger.info(`✅ [批量翻译] 成功，共 ${keysArray.length} 个key`);
      return result;
    } catch (error) {
      Logger.warn(
        `⚠️ [批量翻译] 第 ${attempt} 次失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      if (attempt === retries) {
        Logger.warn(`❌ [批量翻译] 全部重试失败，使用原文降级`);
        return buildFallbackTranslations(keysArray, targetLanguages);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  return buildFallbackTranslations(keysArray, targetLanguages);
}

/**
 * 构建降级结果（所有语言使用原key）
 */
function buildFallbackTranslations(
  keys: string[],
  languages: string[]
): BatchTranslationResult {
  const result: BatchTranslationResult = {};
  keys.forEach((key) => {
    result[key] = {};
    languages.forEach((lang) => {
      result[key][lang] = key;
    });
  });
  return result;
}
