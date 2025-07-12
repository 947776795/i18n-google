const fs = require('fs');
const path = require('path');

/**
 * 数据迁移脚本：为现有的 i18n-complete-record.json 添加 _lastUsed 字段（时间戳格式）
 */
function migrateCompleteRecord() {
  // 配置路径（根据你的项目调整）
  const recordPath = './src/translate/i18n-complete-record.json';
  
  console.log('🔄 开始迁移 i18n-complete-record.json...');
  
  try {
    // 1. 检查文件是否存在
    if (!fs.existsSync(recordPath)) {
      console.log('❌ 文件不存在:', recordPath);
      return;
    }
    
    // 2. 备份原文件
    const backupPath = recordPath.replace('.json', '-backup.json');
    fs.copyFileSync(recordPath, backupPath);
    console.log('💾 已创建备份文件:', backupPath);
    
    // 3. 读取原文件
    const content = fs.readFileSync(recordPath, 'utf-8');
    const record = JSON.parse(content);
    
    // 4. 添加时间戳字段
    const currentTimestamp = Date.now(); // 使用时间戳格式
    let totalKeys = 0;
    let migratedKeys = 0;
    
    for (const [modulePath, moduleKeys] of Object.entries(record)) {
      for (const [key, keyData] of Object.entries(moduleKeys)) {
        totalKeys++;
        
        // 如果没有 _lastUsed 字段，添加当前时间戳
        if (!keyData._lastUsed) {
          keyData._lastUsed = currentTimestamp;
          migratedKeys++;
          console.log(`  ✅ [${modulePath}][${key}] -> ${currentTimestamp} (${new Date(currentTimestamp).toISOString()})`);
        } else {
          console.log(`  ⏭️  [${modulePath}][${key}] 已有时间字段，跳过`);
        }
      }
    }
    
    // 5. 保存迁移后的文件
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
    
    // 6. 输出统计信息
    console.log('\n📊 迁移完成统计:');
    console.log(`   总key数量: ${totalKeys}`);
    console.log(`   迁移key数量: ${migratedKeys}`);
    console.log(`   跳过key数量: ${totalKeys - migratedKeys}`);
    console.log(`   使用时间戳: ${currentTimestamp}`);
    console.log(`   对应时间: ${new Date(currentTimestamp).toISOString()}`);
    console.log('\n✅ 迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
  }
}

// 执行迁移
migrateCompleteRecord();