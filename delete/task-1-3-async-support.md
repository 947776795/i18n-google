# Task 1.3: 修改 scan 方法集成引用记录和删除检测

我需要修改 core/I18nScanner.ts 的 scan 方法，使其在一次扫描过程中完成引用收集、翻译转换和删除检测。

## 核心思路

基于集成式处理的扫描方案：

1. **扫描阶段**：同时收集现有 I18n 引用和处理新翻译需求
2. **记录阶段**：生成包含翻译内容和引用信息的完整 JSON 记录
3. **同步阶段**：完成远程同步和本地保存
4. **检测阶段**：作为最后一步检测无用 Key
5. **交互阶段**：发现无用 Key 时询问用户是否删除并重新同步

## 当前状态

- scan 方法按顺序处理：文件扫描 → 翻译转换 → 远程同步 → 保存
- 没有引用收集功能
- 没有集成的删除检测机制

## 期望实现

### 1. 修改 scan 方法流程

新的扫描流程：

```typescript
public async scan(): Promise<void> {
  // 1. 初始化
  await this.translationManager.initialize();

  // 2. 扫描文件
  const files = await this.fileScanner.scanFiles();

  // 3. 并行处理：收集引用 + 转换翻译
  const { allReferences, newTranslations } = await this.processFiles(files);

  // 4. 生成完整记录
  await this.generateCompleteRecord(allReferences, newTranslations);

  // 5. 从 Google Sheets 同步翻译
  await this.syncFromRemote();

  // 6. 保存翻译文件
  await this.translationManager.saveTranslations();

  // 7. 同步到 Google Sheets
  await this.syncToRemote();

  // 8. 最后一步：检测无用Key并提供删除选项
  await this.detectAndHandleUnusedKeys();
}
```

### 2. 新增辅助方法

```typescript
// 并行处理文件
private async processFiles(files: string[]): Promise<{
  allReferences: Map<string, ExistingReference[]>;
  newTranslations: TransformResult[];
}>;

// 生成完整记录JSON
private async generateCompleteRecord(
  references: Map<string, ExistingReference[]>,
  translations: TransformResult[]
): Promise<void>;

// 检测无用Key并处理删除（包括重新同步）
private async detectAndHandleUnusedKeys(): Promise<void>;
```

### 3. 数据结构设计

引用收集的数据结构：

```typescript
// 内存中的引用映射
private referencesMap: Map<string, ExistingReference[]> = new Map();

// 完整记录的数据结构
interface CompleteTranslationRecord {
  [key: string]: {
    files: string[]; // 引用该key的文件路径列表
    lastScanTime: string; // 最后扫描时间
  };
}
```

## 实现要点

### 并行文件处理

```typescript
private async processFiles(files: string[]) {
  const allReferences = new Map<string, ExistingReference[]>();
  const newTranslations: TransformResult[] = [];

  for (const file of files) {
    // 1. 收集现有引用
    const existingRefs = await this.collectFileReferences(file);
    existingRefs.forEach(ref => {
      if (!allReferences.has(ref.key)) {
        allReferences.set(ref.key, []);
      }
      allReferences.get(ref.key)!.push(ref);
    });

    // 2. 处理新翻译
    const transformResults = await this.fileTransformer.transformFile(file);
    transformResults.forEach(result => {
      this.translationManager.addTranslation(result);
      newTranslations.push(result);

      // 记录新翻译的引用
      this.addNewTranslationReference(result, file);
    });
  }

  return { allReferences, newTranslations };
}
```

### 流程末尾删除检测

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

  // 4. 展示详细信息并询问用户
  const shouldDelete = await this.promptUserForDeletion(unusedKeys);

  // 5. 如果用户确认删除，执行删除并重新同步
  if (shouldDelete) {
    await this.executeKeyDeletion(unusedKeys);
    console.log("🔄 正在重新同步删除的Key到远程...");
    await this.syncToRemote();
    console.log("✅ 删除操作完成并已同步到远程");
  }
}
```

### 用户交互设计

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

  if (answer.confirmDelete) {
    console.log("🗑️ 用户确认删除无用的Key");
    return true;
  } else {
    console.log("❌ 用户取消删除操作");
    return false;
  }
}
```

## 请提供

1. 修改后的 scan 方法完整实现
2. processFiles 方法实现
3. generateCompleteRecord 方法实现
4. detectAndHandleUnusedKeys 方法实现
5. executeKeyDeletion 方法实现
6. 相关的辅助方法和数据结构
7. 必要的导入语句和类型定义

## 验收标准

- scan 方法能够在一次运行中完成所有功能
- 正确收集现有引用和新增翻译的引用信息
- 生成完整的翻译记录 JSON 文件
- 能够准确检测无用的 Key
- 用户交互友好，信息展示清晰
- 不影响原有的翻译转换和同步功能
- 错误处理完善，支持部分失败的情况
- 性能优化，避免重复的文件读取和 AST 解析

## 数据持久化

生成的完整记录 JSON 应该保存为：

- 文件名：`i18n-complete-record.json`
- 位置：配置的 outputDir 目录
- 格式：便于版本控制和人工查看的格式化 JSON
- 内容：包含所有翻译内容和引用信息的完整记录
