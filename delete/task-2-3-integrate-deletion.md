# Task 2.3: 集成删除功能到扫描流程（主流程最后一步）

我需要将删除功能集成到 I18nScanner 的主扫描流程中，确保删除检测和执行在完成所有翻译操作后作为最后一步进行。

## 核心思路

**流程末尾删除策略**：

1. 完成常规翻译流程（扫描、转换、远程同步、本地保存）
2. 作为最后一步检测无用 Key
3. 如果发现无用 Key，询问用户并执行删除
4. 删除完成后重新同步到远程

## 集成位置

在 core/I18nScanner.ts 的 scan 方法的最后阶段：

```typescript
public async scan(): Promise<void> {
  // ... 前面的常规流程 ...

  // 7. 同步到 Google Sheets
  await this.syncToRemote();

  // 8. 最后一步：检测无用Key并提供删除选项
  await this.detectAndHandleUnusedKeys();
}
```

## 当前状态

- I18nScanner.scan 方法按顺序完成翻译转换、远程同步、本地保存
- 没有在流程末尾集成删除检测
- TranslationManager 的删除方法已实现但未在主流程中调用
- 预览功能存在但没有在正确的时机触发

## 期望实现

### 1. 实现流程末尾的删除检测

在 I18nScanner 的 `detectAndHandleUnusedKeys` 方法中完成删除流程：

```typescript
private async detectAndHandleUnusedKeys(): Promise<void> {
  // 1. 获取所有定义的Key
  const allDefinedKeys = this.getAllDefinedKeys();

  // 2. 获取所有引用的Key
  const allReferencedKeys = Array.from(this.referencesMap.keys());

  // 3. 查找无用Key
  const unusedKeys = allDefinedKeys.filter(
    key => !allReferencedKeys.includes(key)
  );

  if (unusedKeys.length === 0) {
    console.log("✅ 没有发现无用的翻译Key");
    return;
  }

  // 4. 生成删除预览文件
  const previewPath = await this.generateDeletePreview(unusedKeys);

  // 5. 展示详细信息并询问用户
  const shouldDelete = await this.promptUserForDeletion(unusedKeys);

  // 6. 如果用户确认删除，执行删除并重新同步
  if (shouldDelete) {
    await this.executeKeyDeletion(unusedKeys);
    console.log("🔄 正在重新同步删除的Key到远程...");
    await this.syncToRemote();
    console.log("✅ 删除操作完成并已同步到远程");
    // 删除完成后清理预览文件
    await this.cleanupPreviewFile(previewPath);
  } else {
    console.log("❌ 用户取消删除操作");
    console.log(`💡 预览文件保留在: ${previewPath}`);
  }
}
```

### 2. 修改 promptUserForDeletion 方法

```typescript
private async promptUserForDeletion(unusedKeys: string[]): Promise<boolean> {
  console.log(`\n⚠️  发现 ${unusedKeys.length} 个无用的翻译Key：\n`);

  // 显示详细信息
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

  return answer.confirmDelete;
}
```

### 3. 实现 executeKeyDeletion 方法

```typescript
private async executeKeyDeletion(keysToDelete: string[]): Promise<void> {
  try {
    console.log("🔄 开始执行删除操作...");

    // 1. 执行删除
    console.log("1. 删除翻译Key...");
    const deleteResult = this.translationManager.deleteTranslations(keysToDelete);
    console.log(`已删除 ${deleteResult.deletedCount} 个Key`);

    // 2. 保存翻译文件
    console.log("2. 保存翻译文件...");
    await this.translationManager.saveTranslations();

    // 3. 更新完整记录（移除已删除的Key）
    console.log("3. 更新记录文件...");
    await this.updateRecordAfterDeletion(keysToDelete);

    // 4. 显示删除结果
    this.displayDeletionResults(keysToDelete, deleteResult);

  } catch (error) {
    console.error("❌ 删除操作失败:", error);
    throw error;
  }
}
```

### 4. 更新记录文件

```typescript
private async updateRecordAfterDeletion(deletedKeys: string[]): Promise<void> {
  const recordPath = path.join(this.config.outputDir, 'i18n-complete-record.json');

  try {
    // 读取当前记录
    const content = await fs.promises.readFile(recordPath, 'utf-8');
    const record: CompleteRecordFile = JSON.parse(content);

    // 删除对应的Key记录
    deletedKeys.forEach(key => {
      delete record.records[key];
    });

    // 更新统计信息
    const totalKeys = Object.keys(record.records).length;
    const usedKeys = Object.values(record.records).filter(
      r => r.files.length > 0
    ).length;

    record.metadata = {
      ...record.metadata,
      scanTime: new Date().toISOString(),
      totalKeys,
      usedKeys,
      unusedKeys: totalKeys - usedKeys
    };

    // 保存更新后的记录
    await fs.promises.writeFile(recordPath, JSON.stringify(record, null, 2));

  } catch (error) {
    console.warn("⚠️  更新记录文件失败:", error);
  }
}
```

### 5. 显示删除结果

```typescript
private displayDeletionResults(
  deletedKeys: string[],
  deleteResult: any
): void {
  console.log("\n✅ 删除操作完成！");
  console.log(`📊 删除统计:`);
  console.log(`   - 删除的Key数量: ${deletedKeys.length}`);
  console.log(`   - 受影响的语言: ${deleteResult.affectedLanguages.join(', ')}`);

  console.log(`\n📝 已删除的Key列表:`);
  deletedKeys.forEach((key, index) => {
    console.log(`   ${index + 1}. ${key}`);
  });
}
```

## 实现要点

### 删除流程的完整性

- **原子性操作**：确保删除过程中的数据一致性
- **错误处理**：任何步骤失败都应有合适的错误处理
- **状态同步**：翻译文件、记录文件、内存状态的同步更新

### 用户体验优化

```typescript
private displayUnusedKeysDetails(unusedKeys: string[]): void {
  const translations = this.translationManager.getTranslations();

  unusedKeys.forEach((key, index) => {
    console.log(`${index + 1}. Key: ${key}`);

    // 显示各语言的翻译内容
    Object.entries(translations).forEach(([lang, langTranslations]: [string, any]) => {
      if (langTranslations[key]) {
        console.log(`   ${lang}: "${langTranslations[key]}"`);
      }
    });

    console.log('');
  });
}
```

### 安全性保障

- **预览文件**：生成详细的删除预览文件
- **删除确认**：提供详细的删除预览
- **预览保留**：用户取消删除时保留预览文件供参考

## 请提供

1. detectAndHandleUnusedKeys 方法的完整实现
2. executeKeyDeletion 方法的完整实现
3. updateRecordAfterDeletion 方法实现
4. displayDeletionResults 和 displayUnusedKeysDetails 方法
5. 修改后的 promptUserForDeletion 方法
6. generateDeletePreview 和 cleanupPreviewFile 方法
7. getAllDefinedKeys 方法实现
8. 必要的错误处理和日志输出
9. 相关的类型定义和导入语句

## 验收标准

- 检测到无用 Key 时自动生成预览文件
- 用户确认后能够正确执行删除操作
- 同时更新翻译文件和记录文件
- 提供清晰的删除过程反馈和结果展示
- 删除完成后自动清理预览文件
- 用户取消删除时保留预览文件
- 错误处理完善，失败时有明确的错误信息
- 删除操作的原子性，避免部分删除导致的不一致状态

## 测试场景

应该能够处理以下测试场景：

1. **正常删除**：用户确认后成功删除无用 Key 并清理预览文件
2. **取消删除**：用户取消时不执行任何删除操作，保留预览文件
3. **部分失败**：某些文件删除失败时的处理
4. **预览文件生成失败**：预览文件创建失败时的处理
5. **空列表**：没有无用 Key 时的正确处理
