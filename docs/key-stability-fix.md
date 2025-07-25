# Key 稳定性问题修复

## 问题描述

当远端 Google Sheets 中的英文翻译被修改后，运行同步脚本会导致翻译 key 发生变化，从而产生重复的条目和数据不一致的问题。

## 问题原因

### 原始代码问题

在 `src/core/GoogleSheetsSync.ts` 的 `syncCompleteRecordToSheet` 方法中，构建 Google Sheets 第一列 key 的逻辑是：

```typescript
// 有问题的原始代码
const enText = translations["en"] || translationKey; // 优先使用英文翻译
const uploadKey = `[${filePath}][${enText}]`;
```

### 问题流程

1. **初始状态**: Google Sheets 中有数据 `[components/Header.ts][Hello]`，英文列是 "Hello"
2. **远端修改**: 用户在 Google Sheets 中将英文翻译从 "Hello" 改为 "Hello World"
3. **运行脚本**:
   - 脚本从远端拉取数据: `{en: "Hello World", zh: "你好", ...}`
   - 构建新 key 时使用 `translations["en"]` (即 "Hello World")
   - 生成新 key: `[components/Header.ts][Hello World]`
4. **结果**: 原来的行仍然存在，但又新增了一行，造成重复

## 解决方案

### 修复后的代码

```typescript
// 修复后的代码
const uploadKey = `[${filePath}][${translationKey}]`;
```

**关键改变**: 使用固定的 `translationKey` 而不是动态的英文翻译内容作为 key 的组成部分。

### 修复原理

- **稳定性**: `translationKey` 是从代码中提取的固定标识符，不会因为翻译内容的变化而改变
- **一致性**: 确保同一个翻译条目在不同同步操作中保持相同的 key
- **可靠性**: 避免因为翻译内容修改导致的重复条目问题

## 测试验证

新增了专门的测试用例来验证 key 稳定性：

```typescript
it("should keep keys stable when remote English translations are modified", async () => {
  // 远端数据: 英文翻译已被修改
  const remoteData = {
    values: [
      [
        "[components/Header.ts][Hello]",
        "Hello World",
        "你好",
        "こんにちは",
        "1",
      ],
    ],
  };

  // 本地数据: 原始的翻译key
  const localRecord = {
    "components/Header.ts": {
      Hello: { en: "Hello", zh: "你好", mark: 0 },
    },
  };

  // 验证: key保持稳定，内容使用远端版本
  expect(resultKey).toBe("[components/Header.ts][Hello]"); // key稳定
  expect(resultContent).toBe("Hello World"); // 内容使用远端版本
});
```

## 影响范围

- **修复前**: 远端英文修改会导致 key 变化，产生重复条目
- **修复后**: key 保持稳定，只有翻译内容会根据合并策略更新
- **向后兼容**: 不影响现有数据结构，只修复同步逻辑

## 部署建议

1. 在部署此修复前，建议先备份 Google Sheets 数据
2. 部署后第一次同步可能会清理一些重复的条目
3. 建议在测试环境先验证修复效果

## 相关文件

- `src/core/GoogleSheetsSync.ts` - 主要修复文件
- `__tests__/GoogleSheetsSync.merge.test.ts` - 相关测试用例
