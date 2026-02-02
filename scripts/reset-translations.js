#!/usr/bin/env node
/**
 * 重置翻译数据脚本
 * 用于删除本地和远端的翻译数据，方便初始化测试
 */

const fs = require('fs');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// 配置文件路径
const CONFIG_PATH = process.argv[2] || './demo/nextjs/i18n.config.js';

/**
 * 加载配置
 */
function loadConfig(configPath) {
  const absolutePath = path.resolve(process.cwd(), configPath);
  delete require.cache[require.resolve(absolutePath)];
  return require(absolutePath);
}

/**
 * 删除本地翻译文件
 */
function clearLocalTranslations(configPath, outputDir) {
  // 获取配置文件所在目录（通常是项目根目录）
  const configDir = path.dirname(path.resolve(process.cwd(), configPath));
  const translatePath = path.resolve(configDir, outputDir);

  if (fs.existsSync(translatePath)) {
    console.log(`\n🗑️  删除本地翻译目录: ${translatePath}`);
    fs.rmSync(translatePath, { recursive: true, force: true });
    console.log('   ✅ 本地翻译已删除');
  } else {
    console.log(`\nℹ️  本地翻译目录不存在: ${translatePath}`);
  }
}

/**
 * 清空 Google Sheets 数据
 */
async function clearGoogleSheets(config) {
  try {
    console.log('\n🗑️  清空 Google Sheets 数据...');
    console.log(`   Spreadsheet ID: ${config.spreadsheetId}`);
    console.log(`   Sheet Name: ${config.sheetName || 'i18n'}`);

    // 初始化 Google Sheets（直接在构造函数中传入 auth）
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null,
      key: process.env.GOOGLE_PRIVATE_KEY ? Buffer.from(process.env.GOOGLE_PRIVATE_KEY, 'base64').toString() : null,
      keyFile: config.keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = new GoogleSpreadsheet(config.spreadsheetId, serviceAccountAuth);

    // 加载文档信息
    await sheets.loadInfo();
    const targetSheet = sheets.sheetsByTitle[config.sheetName || 'i18n'];

    if (!targetSheet) {
      console.log('   ⚠️  目标工作表不存在');
      return;
    }

    console.log(`   工作表行数: ${targetSheet.rowCount}`);

    // 清空数据（只保留标题行，从第2行开始清空）
    await targetSheet.clearRows();

    console.log('   ✅ Google Sheets 已清空');
  } catch (error) {
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      console.log('   ⚠️  无法连接到 Google Sheets (404)');
    } else {
      console.error(`   ❌ 清空 Google Sheets 失败: ${error.message}`);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('==================================================');
  console.log('🔄 重置翻译数据');
  console.log('==================================================');

  try {
    // 1. 加载配置
    console.log(`\n📋 加载配置: ${CONFIG_PATH}`);
    const config = loadConfig(CONFIG_PATH);
    console.log(`   输出目录: ${config.outputDir}`);
    console.log(`   语言列表: ${config.languages ? config.languages.join(', ') : '未配置'}`);

    // 2. 删除本地翻译
    clearLocalTranslations(CONFIG_PATH, config.outputDir);

    // 3. 清空 Google Sheets（如果有配置）
    if (config.spreadsheetId) {
      await clearGoogleSheets(config);
    } else {
      console.log('\n⚠️  未配置 Google Sheets，跳过远端清理');
    }

    console.log('\n==================================================');
    console.log('✅ 重置完成');
    console.log('==================================================');
    console.log('\n💡 使用方法:');
    console.log('   npm run reset                    # 重置 demo/nextjs');
    console.log('   npm run reset -- ./path/to/config # 使用指定配置');

  } catch (error) {
    console.error(`\n❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

// 运行
main();
