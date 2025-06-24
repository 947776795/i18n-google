# 国际化 Key 删除功能实现指南

本目录包含了实现国际化 Key 自动删除功能的完整提示词集合。

## 核心实现思路

基于引用记录与集成检测的删除方案：

### 实现原理

1. **扫描现有引用**：识别代码中已存在的 `I18n.t("8a709a33")` 调用并记录引用关系
2. **处理新翻译需求**：对符合替换规则的文案执行国际化转换，同时记录新增引用
3. **生成完整记录**：合并现有引用和新增引用，生成包含 key 值和所有翻译内容的 JSON 文件
4. **远程同步**：与 Google Sheets 进行翻译数据同步
5. **保存翻译文件**：保存本地翻译文件
6. **检测并删除无用 Key**：作为最后一步，检测无用 Key 并提供删除选项

### 数据流设计

```
源代码文件 → AST分析 → [现有引用记录] + [新翻译转换+引用记录] → 完整引用JSON → 远程同步 → 本地保存 → 检测无用Key → 删除确认 → 删除&同步更新
```

### 核心 JSON 文件结构

```typescript
// i18n-complete-record.json 结构
interface CompleteTranslationRecord {
  [key: string]: {
    files: string[]; // 引用该key的文件路径列表
    lastScanTime: string; // 最后扫描时间
  };
}
```

## 实施顺序

### 第一阶段：引用收集与记录功能

1. [Task 1.1: 添加用户交互依赖](./task-1-1-add-dependencies.md)
2. [Task 1.2: 增强 AstTransformer 收集现有 I18n 引用](./task-1-2-user-interaction.md)
3. [Task 1.3: 修改 scan 方法集成引用记录和删除检测](./task-1-3-async-support.md)
4. [Task 1.4: 实现完整翻译记录 JSON 生成](./task-1-4-collect-existing-references.md)

### 第二阶段：本地删除功能

1. [Task 2.1: 在 TranslationManager 中添加删除方法](./task-2-1-delete-method.md)
2. [Task 2.2: 生成删除预览文件](./task-2-2-backup-function.md)
3. [Task 2.3: 集成删除功能到扫描流程](./task-2-3-integrate-deletion.md)

### 第三阶段：错误处理机制

1. [Task 3.1: 完善错误处理机制](./task-4-1-error-handling.md)

### 第四阶段：用户体验优化

1. [Task 4.1: 添加进度提示和用户体验优化](./task-5-1-progress-indicators.md)
2. [Task 4.2: 添加详细的删除确认和预览](./task-5-2-detailed-confirmation.md)

## 核心技术实现

### 引用收集策略

- **现有引用扫描**：使用 AST 分析识别所有 `I18n.t("hash")` 调用
- **新翻译转换**：在转换过程中同步记录新增的引用关系
- **位置信息记录**：准确记录每个引用的文件路径、行号、列号
- **统一数据格式**：建立完整的翻译-引用关联记录

### 集成检测机制

```typescript
// 在主流程完成后进行删除检测
function scanWithFinalDeleteDetection() {
  // 1. 完成常规扫描流程（引用收集、翻译转换、远程同步、本地保存）
  await performMainScanFlow();

  // 2. 获取所有翻译定义
  const allTranslations = getAllTranslations();

  // 3. 获取所有引用记录
  const allReferences = loadReferencesFromRecord();

  // 4. 对比发现无用Key
  const unusedKeys = findUnusedKeys(allTranslations, allReferences);

  // 5. 如果发现无用Key，询问用户是否删除
  if (unusedKeys.length > 0) {
    await promptUserForDeletion(unusedKeys);
    // 如果用户确认删除，需要重新同步到远程
    if (deletionConfirmed) {
      await syncDeletionToRemote();
    }
  }
}
```

### 数据持久化策略

- **完整记录文件**：`i18n-complete-record.json` 包含 Key 的文件引用信息
- **简化结构**：只记录核心信息（key、文件路径、扫描时间）
- **增量更新**：每次扫描后更新引用信息，保持数据最新
- **删除预览**：生成临时文件展示待删除的内容

## 使用说明

1. **集成式扫描**: 一次扫描完成引用收集、翻译转换、远程同步、本地保存
2. **流程末尾检测**: 在完成主要翻译流程后，最后检测无用 Key
3. **数据完整性**: 生成的 JSON 文件包含完整的翻译和引用信息
4. **删除预览**: 生成预览文件展示待删除内容
5. **删除后同步**: 确认删除后需要重新同步到远程

## 风险提示

- 删除操作具有不可逆性，请确保充分测试
- Google Sheets 同步需要适当的 API 权限
- 建议在开发环境中完整测试后再应用到生产环境
- AST 分析可能遇到复杂的代码结构，需要合理处理边界情况

## 技术栈

- TypeScript/Node.js
- inquirer (用户交互)
- ora (进度提示，可选)
- Google Sheets API (远程同步)
- jscodeshift (AST 转换)
- 文件系统操作 (fs, path)

## 完整流程图

```
主流程开始
    ↓
初始化 TranslationManager
    ↓
扫描项目文件
    ↓
并行处理：收集现有引用 + 转换新翻译
    ↓
生成完整记录 JSON
    ↓
从 Google Sheets 同步翻译
    ↓
保存本地翻译文件
    ↓
同步到 Google Sheets
    ↓
【删除检测阶段】检测无用Key
    ↓
生成删除预览文件
    ↓
用户确认删除？
    ↓ 是
执行删除操作
    ↓
重新同步到远程
    ↓
清理预览文件
    ↓
主流程结束
```

这种设计确保了：

1. **完整性**：在所有翻译操作完成后才检测删除
2. **一致性**：删除后立即重新同步，保持本地和远程一致
3. **安全性**：删除在流程最后，减少对主要功能的影响
4. **用户友好**：提供清晰的删除预览和确认流程
