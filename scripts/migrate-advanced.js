const fs = require('fs');
const path = require('path');

/**
 * 高级数据迁移脚本：提供多种时间策略选择（时间戳格式）
 */
function migrateWithStrategy() {
  const recordPath = './src/translate/i18n-complete-record.json';
  
  // 配置区域 - 可以根据需要调整
  const config = {
    strategy: 'current', // 选择策略: 'current' | 'conservative' | 'staggered'
    expirationDays: 7,   // 过期天数配置
  };
  
  console.log(`🔄 开始迁移，使用策略: ${config.strategy}`);
  
  try {
    if (!fs.existsSync(recordPath)) {
      console.log('❌ 文件不存在:', recordPath);
      return;
    }
    
    // 备份
    const backupPath = recordPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.copyFileSync(recordPath, backupPath);
    console.log('💾 已创建备份文件:', backupPath);
    
    // 读取并迁移
    const content = fs.readFileSync(recordPath, 'utf-8');
    const record = JSON.parse(content);
    
    let totalKeys = 0;
    let migratedKeys = 0;
    
    for (const [modulePath, moduleKeys] of Object.entries(record)) {
      for (const [key, keyData] of Object.entries(moduleKeys)) {
        totalKeys++;
        
        if (!keyData._lastUsed) {
          const timestamp = getTimestampByStrategy(config.strategy, config.expirationDays, key, modulePath);
          keyData._lastUsed = timestamp;
          migratedKeys++;
          
          const daysAgo = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
          console.log(`  ✅ [${modulePath}][${key}] -> ${timestamp} (${new Date(timestamp).toISOString()}, ${daysAgo}天前)`);
        }
      }
    }
    
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
    
    console.log('\n📊 迁移完成统计:');
    console.log(`   策略: ${config.strategy}`);
    console.log(`   总key数量: ${totalKeys}`);
    console.log(`   迁移key数量: ${migratedKeys}`);
    console.log('\n✅ 迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
  }
}

/**
 * 根据策略获取时间戳
 */
function getTimestampByStrategy(strategy, expirationDays, key, modulePath) {
  const now = Date.now(); // 使用时间戳
  
  switch (strategy) {
    case 'current':
      // 当前时间：给所有key一个"重新开始"的机会
      return now;
      
    case 'conservative':
      // 保守策略：设置为过期+几天前，让真正无用的key在下次扫描时被检测出来
      const conservativeTime = now - (expirationDays + 3) * 24 * 60 * 60 * 1000;
      return conservativeTime;
      
    case 'staggered':
      // 分散策略：根据key的哈希值分散时间，避免所有key同时过期
      const hash = simpleHash(key + modulePath);
      const randomDays = hash % expirationDays; // 0 到 expirationDays-1 天前
      const staggeredTime = now - randomDays * 24 * 60 * 60 * 1000;
      return staggeredTime;
      
    default:
      return now;
  }
}

/**
 * 简单哈希函数
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// 执行迁移
migrateWithStrategy();