#!/usr/bin/env node

/**
 * 国际化
 * 1. 文件名与languages 中的语言对应,查看指定outputDir 文件夹下是否有对应的json文件,如果没有则创建
 * 2. 递归读取指定文件夹下文件, 并过滤掉不需要的文件夹与文件
 * 3. 根据配置文件内容读取文件内容, 并提取出需要国际化的文案
 * 4. 生成国际化文案的唯一key
 * 5. 使用 jscodeshift 查看代码中是否有 I18n.t(key)，如果有替换为 I18n.t(key)，将替换的内容以{key: 翻译}的格式存储到内存中
 * 6. 使用 jscodeshift 查看代码中是否有 I18n 的导入，如果没有添加 import { I18n } from "@utils";
 * 7. 完成所有文件的替换后，将内存中的内容写入到指定outputDir 的文件夹下的的指定languages文件夹下生成对应的json文件，key为文案内容，value为翻译
 * 8. 使用googleapis 读取远程翻译内容,key 相同的进行替换,key 不相同的进行添加
 * 9. 最后将本地的翻译内容推送到远程翻译文件中
 *
 * 说明
 * 1. i18n.config.js 包含所有配置
 * 2. 谷歌表格的读写参考i18n-manager.mjs
 */

import type { I18nConfig } from "./types";
import { I18nScanner } from "./core/I18nScanner";
import { Logger } from "./utils/StringUtils";
import * as path from "path";

// 从当前工作目录加载配置文件
const configPath = path.join(process.cwd(), "i18n.config.js");
const config: I18nConfig = require(configPath);

const scanner = new I18nScanner(config);

if (require.main === module) {
  scanner.scan().catch((error) => {
    Logger.error("❌ 扫描失败:", error);
    process.exit(1);
  });
}
