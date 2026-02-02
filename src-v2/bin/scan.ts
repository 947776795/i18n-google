/**
 * CLI 入口
 * I18n 扫描转换工具
 */

import * as path from 'path';
import { Scanner, RunOptions } from '../core/Scanner';

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: RunOptions = {
  projectRoot: process.cwd(),  // 默认为当前工作目录
  skipConfirm: undefined,      // 默认需要确认删除
};

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 I18n 扫描转换工具');
  console.log('='.repeat(50));

  // 解析命令行参数
  const args = process.argv.slice(2);
  const options: RunOptions = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--project-root':
      case '-p':
        options.projectRoot = path.resolve(args[++i]);
        break;
      case '--app-dir':
      case '-a':
        options.appDir = args[++i];
        break;
      case '--translate-dir':
      case '-t':
        options.translateDir = args[++i];
        break;
      case '--locales':
      case '-l':
        options.locales = args[++i].split(',');
        break;
      case '--yes':
      case '-y':
        options.skipConfirm = true;
        break;
      case '--no':
      case '-n':
        options.skipConfirm = false;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`未知参数: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  try {
    const scanner = new Scanner();
    const result = await scanner.run(options);
    scanner.printSummary(result);
  } catch (error) {
    console.error('\n❌ 错误:');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

/**
 * 打印帮助信息
 */
function printHelp(): void {
  console.log(`
用法: i18n-scan [选项]

选项:
  -p, --project-root <path>   项目根目录 (默认: 当前工作目录)
  -a, --app-dir <path>        扫描的源码目录 (可选，覆盖配置文件)
  -t, --translate-dir <path>  输出的翻译目录 (可选，覆盖配置文件)
  -l, --locales <list>        支持的语言列表，逗号分隔 (可选，覆盖配置文件)
  -y, --yes                   自动确认删除无用 keys
  -n, --no                    自动保留无用 keys（不删除）
  -h, --help                  显示帮助信息

说明:
  配置从项目根目录的 i18n.config.js 文件读取。
  命令行参数可覆盖配置文件中的对应设置。

示例:
  i18n-scan                                    # 使用当前目录的配置（交互式确认）
  i18n-scan -p /path/to/project               # 指定项目目录
  i18n-scan -a src/app -l en,es,fr            # 覆盖扫描目录和语言
  i18n-scan -y                                 # 自动删除无用 keys
  i18n-scan -n                                 # 自动保留无用 keys

在项目中运行:
  npx ts-node src-v2/bin/scan.ts
`);
}

// 运行主函数
main().catch(console.error);
