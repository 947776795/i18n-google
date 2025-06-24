# Task 2.2: 生成删除预览文件

我需要实现生成删除预览文件的功能，让用户可以预览将要删除的翻译内容。

## 核心思路

当检测到无用 Key 时，生成一个临时的预览文件：

1. **收集删除信息**：获取要删除的 Key 及其翻译内容
2. **生成预览文件**：创建包含删除详情的 JSON 文件
3. **用户友好格式**：以易读的格式展示删除内容
4. **临时文件管理**：删除操作完成后清理预览文件

## 当前状态

- 删除检测功能已在前面任务中实现
- 需要添加预览文件生成功能
- 缺少用户友好的删除内容展示

## 期望实现

### 1. 预览文件数据结构

```typescript
export interface DeletePreview {
  timestamp: string; // 生成时间
  totalKeysToDelete: number; // 待删除Key数量
  keysToDelete: Array<{
    key: string; // Key值
    translations: Record<string, string>; // 各语言翻译内容
    reason: string; // 删除原因
  }>;
  affectedLanguages: string[]; // 受影响的语言
}
```

### 2. 在 I18nScanner 中添加方法

```typescript
// 生成删除预览文件
private async generateDeletePreview(unusedKeys: string[]): Promise<string>;

// 清理预览文件
private async cleanupPreviewFile(previewPath: string): Promise<void>;

// 格式化预览内容
private formatDeletePreview(unusedKeys: string[]): DeletePreview;
```

### 3. 预览文件生成逻辑

```typescript
private async generateDeletePreview(unusedKeys: string[]): Promise<string> {
  const preview = this.formatDeletePreview(unusedKeys);

  // 生成预览文件路径
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const previewPath = path.join(
    this.config.outputDir,
    `delete-preview-${timestamp}.json`
  );

  // 保存预览文件
  await fs.promises.writeFile(
    previewPath,
    JSON.stringify(preview, null, 2)
  );

  console.log(`\n📄 删除预览已生成: ${previewPath}`);
  console.log(`   请查看文件以确认删除内容`);

  return previewPath;
}
```

### 4. 格式化预览内容

```typescript
private formatDeletePreview(unusedKeys: string[]): DeletePreview {
  const translations = this.translationManager.getTranslations();
  const timestamp = new Date().toISOString();

  const keysToDelete = unusedKeys.map(key => ({
    key,
    translations: this.getKeyTranslations(key, translations),
    reason: "未在代码中找到引用"
  }));

  const affectedLanguages = Object.keys(translations);

  return {
    timestamp,
    totalKeysToDelete: unusedKeys.length,
    keysToDelete,
    affectedLanguages
  };
}
```

## 实现要点

### 文件命名规则

- **格式**: `delete-preview-{timestamp}.json`
- **时间戳**: ISO 格式，替换特殊字符
- **位置**: 配置的 outputDir 目录

### 用户交互增强

```typescript
private async promptUserForDeletion(unusedKeys: string[]): Promise<void> {
  // 生成预览文件
  const previewPath = await this.generateDeletePreview(unusedKeys);

  console.log(`\n⚠️  发现 ${unusedKeys.length} 个无用的翻译Key：\n`);

  // 显示简要信息
  this.displayUnusedKeysDetails(unusedKeys);

  // 询问用户
  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmDelete',
      message: `是否要删除这 ${unusedKeys.length} 个无用的翻译Key？`,
      default: false
    }
  ]);

  if (answer.confirmDelete) {
    await this.executeKeyDeletion(unusedKeys);
    // 删除完成后清理预览文件
    await this.cleanupPreviewFile(previewPath);
  } else {
    console.log("❌ 用户取消删除操作");
    console.log(`💡 预览文件保留在: ${previewPath}`);
  }
}
```

### 预览文件清理

```typescript
private async cleanupPreviewFile(previewPath: string): Promise<void> {
  try {
    await fs.promises.unlink(previewPath);
    console.log(`🗑️  预览文件已清理: ${previewPath}`);
  } catch (error) {
    console.warn(`⚠️  清理预览文件失败: ${error}`);
  }
}
```

## 请提供

1. DeletePreview 接口的完整定义
2. generateDeletePreview 方法的实现
3. formatDeletePreview 方法的实现
4. cleanupPreviewFile 方法的实现
5. 修改后的 promptUserForDeletion 方法
6. 必要的导入语句和类型定义

## 验收标准

- 能够生成包含删除详情的预览文件
- 预览文件格式清晰，便于用户查看
- 文件命名规范，避免冲突
- 删除操作完成后自动清理预览文件
- 用户取消删除时保留预览文件
- 错误处理完善，文件操作安全
- 提供清晰的用户提示和文件路径信息

## 预览文件示例

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "totalKeysToDelete": 2,
  "keysToDelete": [
    {
      "key": "8a709a33",
      "translations": {
        "en": "Hello World",
        "zh": "你好世界"
      },
      "reason": "未在代码中找到引用"
    },
    {
      "key": "bf3c2d4e",
      "translations": {
        "en": "Welcome",
        "zh": "欢迎"
      },
      "reason": "未在代码中找到引用"
    }
  ],
  "affectedLanguages": ["en", "zh"]
}
```

## 使用流程

1. **检测阶段**: 扫描发现无用 Key
2. **预览生成**: 自动生成预览文件
3. **用户确认**: 查看预览文件后做决定
4. **执行删除**: 确认后执行删除并清理预览文件
5. **保留预览**: 取消删除时保留预览文件供后续参考
