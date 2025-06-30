import OpenAI from "openai";
import { Logger } from "./StringUtils";

/**
 * 使用 Qwen 大模型进行翻译（通过 OpenAI 兼容 dashscope 接口）
 * @param text 原文
 * @param from 源语言（如 'en'）
 * @param to 目标语言（如 'zh-Hans'）
 * @param config 配置对象，需包含 apiKey
 */
export async function llmTranslate(
  text: string,
  from: string,
  to: string,
  apiKey: string
): Promise<string> {
  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });
  const prompt = `请将以下内容从${from}翻译为${to}，只返回翻译结果：${text}`;
  const completion = await openai.chat.completions.create({
    model: "qwen-plus",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt },
    ],
  });
  const translated = completion.choices[0]?.message.content?.trim() || "";
  Logger.info(`🤖 [AI翻译] 正在将 "${text}" 从 ${from} 翻译为 ${to} ...`);
  Logger.info(`🤖 [AI翻译] 翻译结果: ${translated}`);
  return translated;
}
