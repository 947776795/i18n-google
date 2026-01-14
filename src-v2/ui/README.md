# 用户交互模块 (UI Module)

## 职责

统一抽象用户交互，支持交互式和自动两种模式。

## 模块组成

```
ui/
├── UIService.ts        # 交互服务接口
├── InteractiveMode.ts  # 交互式实现
└── AutoMode.ts         # 自动模式实现
```

---

## UIService.ts

### 职责
定义用户交互的统一接口

### 接口定义
```typescript
interface IUserInteraction {
  // 选择要删除的 key
  selectKeysForDeletion(keys: string[]): Promise<string[]>

  // 确认删除操作
  confirmDeletion(
    keys: string[],
    previewPath?: string
  ): Promise<boolean>

  // 确认远端同步
  confirmRemoteSync(): Promise<boolean>
}
```

---

## InteractiveMode.ts

### 职责
使用 inquirer 实现真实用户交互

### 实现方式
```typescript
import inquirer from "inquirer"

class InteractiveMode implements IUserInteraction {
  async selectKeysForDeletion(keys: string[]): Promise<string[]> {
    // 显示选项
    const { selectionMode } = await inquirer.prompt([{
      type: "list",
      name: "selectionMode",
      message: "请选择删除方式:",
      choices: [
        { name: "🗑️ 全部删除", value: "all" },
        { name: "🎯 手动选择", value: "manual" },
        { name: "❌ 跳过删除", value: "skip" }
      ]
    }])

    // 根据选择执行
    switch (selectionMode) {
      case "all": return keys
      case "manual": return this.manualSelect(keys)
      case "skip": return []
    }
  }

  async confirmDeletion(keys: string[]): Promise<boolean> {
    const { confirm } = await inquirer.prompt([{
      type: "confirm",
      name: "confirm",
      message: `确认删除 ${keys.length} 个 key？`,
      default: false
    }])
    return confirm
  }

  async confirmRemoteSync(): Promise<boolean> {
    const { confirm } = await inquirer.prompt([{
      type: "confirm",
      name: "confirm",
      message: "确认同步到 Google Sheets？",
      default: true
    }])
    return confirm
  }
}
```

### 手动选择界面
```typescript
private async manualSelect(keys: string[]): Promise<string[]> {
  const { selected } = await inquirer.prompt([{
    type: "checkbox",
    name: "selected",
    message: "选择要删除的 key:",
    choices: keys.map(k => ({ name: k, value: k })),
    pageSize: 15
  }])
  return selected
}
```

---

## AutoMode.ts

### 职责
自动模式，用于 CI/CD 或非交互环境

### 实现方式
```typescript
class AutoMode implements IUserInteraction {
  constructor(private policy: AutoPolicy) {}

  async selectKeysForDeletion(keys: string[]): Promise<string[]> {
    // 根据策略自动选择
    switch (this.policy.selectionMode) {
      case "all": return keys
      case "skip": return []
      default: return []
    }
  }

  async confirmDeletion(): Promise<boolean> {
    // 根据策略自动确认
    return this.policy.autoConfirmDelete ?? false
  }

  async confirmRemoteSync(): Promise<boolean> {
    // 默认不同步
    return false
  }
}
```

### 策略配置
```typescript
interface AutoPolicy {
  /** 删除模式 */
  selectionMode?: "all" | "skip"

  /** 自动确认删除 */
  autoConfirmDelete?: boolean
}
```

---

## 模式选择

```typescript
class UIService {
  static create(config: I18nConfig): IUserInteraction {
    // 非交互环境：Jest、无 TTY、testMode
    const isNonInteractive =
      typeof jest !== "undefined" ||
      !process.stdout.isTTY ||
      config.testMode === true

    if (isNonInteractive) {
      return new AutoMode({
        selectionMode: "skip",
        autoConfirmDelete: true
      })
    }

    return new InteractiveMode()
  }
}
```

---

## 使用示例

```typescript
// 自动选择模式
const ui = UIService.create(config)

// 选择要删除的 key
const keysToDelete = await ui.selectKeysForDeletion(unusedKeys)

// 确认删除
const confirmed = await ui.confirmDeletion(keysToDelete)
if (confirmed) {
  await deleteKeys(keysToDelete)
}

// 确认远端同步
const shouldSync = await ui.confirmRemoteSync()
if (shouldSync) {
  await syncToRemote()
}
```

---

## 交互流程示例

### 删除确认流程

```
发现 15 个无用 key

? 请选择删除方式:
  ❌ 跳过删除
  🗑️ 全部删除 (15 个 key)
  🎯 手动选择

→ 选择 手动选择

? 选择要删除的 key (15 个):
  ◯ OldKey1
  ◯ OldKey2
  ✓ OldKey3
  ...

⚠️ 确认删除 5 个 key？此操作不可撤销！
 (y/N)

→ 确认删除

✅ 已删除 5 个 key
```

---

## 依赖

### InteractiveMode
- `inquirer` - 命令行交互

### AutoMode
- 无外部依赖

## 注意事项

1. **非交互环境自动选择 AutoMode**：
   - Jest 测试环境
   - CI/CD（无 TTY）
   - `testMode: true`

2. **AutoMode 默认安全策略**：
   - 删除模式：`skip`（不删除）
   - 自动确认：`false`（需要确认）

3. **InteractiveMode 需要TTY**：
   - 确保在终端中运行
   - 管道重定向时可能失效
