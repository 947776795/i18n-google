const fs = require('fs');
const path = require('path');

/**
 * Migrates missing `_lastUsed` timestamps in a translation record JSON file using a selectable time strategy.
 *
 * Reads the translation record file, creates a backup, and assigns a `_lastUsed` timestamp to each key that lacks one, based on the configured strategy (`current`, `conservative`, or `staggered`). Updates the file in place and logs migration statistics.
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
 * Returns a timestamp for a translation key based on the specified migration strategy.
 *
 * Depending on the strategy, the timestamp may represent the current time, a conservative past time (older than the expiration period), or a staggered time distributed across the expiration window to avoid simultaneous expiration of all keys.
 *
 * @param {string} strategy - The timestamp assignment strategy: 'current', 'conservative', or 'staggered'.
 * @param {number} expirationDays - The expiration period in days, used to calculate past timestamps.
 * @param {string} key - The translation key being processed.
 * @param {string} modulePath - The module path associated with the key.
 * @returns {number} The computed timestamp in milliseconds since the Unix epoch.
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
 * Computes a simple deterministic 32-bit integer hash for a given string.
 * @param {string} str - The input string to hash.
 * @return {number} The absolute value of the computed hash.
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