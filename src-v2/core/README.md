# 核心编排模块 (Core Module)

## 职责

编排整个 i18n 扫描流程，协调各模块完成 9 步主流程。

## 模块组成

```
core/
├── Scanner.ts        # 主编排器
└── Workflow.ts       # 流程定义（可选）
```

---

## Scanner.ts

### 职责
主编排器，组装各模块并执行完整扫描流程

### 核心方法
```typescript
class Scanner {
  private fileScanner: FileScanner
  private collector: TranslationCollector
  private recordManager: RecordManager
  private keyAnalyzer: KeyAnalyzer
  private deleteService: DeleteService
  private sheetsSync: SheetsSync
  private ui: IUserInteraction

  // 主入口：执行扫描
  async scan(): Promise<ScanResult>

  // 初始化各模块
  private async init(): Promise<void>
}
```

---

## 主流程（9步）

```
1. ☁️ 远端拉取并合并
   └── sheetsSync.pull()

2. 🔧 初始化
   └── recordManager.init()

3. 📁 扫描文件
   └── fileScanner.scan()

4. 🔍 收集翻译
   └── collector.collect()

5. 🔍 检测无用 Key
   └── keyAnalyzer.detect()

6. 🔧 生成记录
   └── recordManager.save()

7. 🔧 生成翻译文件
   └── recordManager.generateFiles()

8. 🤔 确认远端同步
   └── ui.confirmRemoteSync()

9. ☁️ 同步到远端
   └── sheetsSync.push()
```

---

## 完整流程代码

```typescript
async scan(): Promise<void> {
  const startTime = Date.now()

  try {
    // 1. 远端拉取
    await this.sheetsSync.pull()

    // 2. 初始化
    await this.recordManager.init(this.config)

    // 3. 扫描文件
    const files = await this.fileScanner.scan()

    // 4. 收集翻译
    const collectResult = await this.collector.collect(files)

    // 5. 检测无用 Key
    const unusedKeys = await this.keyAnalyzer.detect(
      await this.recordManager.load(),
      collectResult.references
    )

    // 6-7. 处理删除并生成记录
    await this.deleteService.detectUnusedKeysAndGenerateRecord(
      collectResult.references
    )

    // 8. 确认远端同步
    const shouldSync = await this.ui.confirmRemoteSync()

    // 9. 同步到远端
    if (shouldSync) {
      await this.sheetsSync.push()
    }

    const duration = Date.now() - startTime
    this.showSummary({ duration, ...collectResult })

  } catch (error) {
    this.handleError(error)
    throw error
  }
}
```

---

## Workflow.ts（可选）

### 职责
将流程步骤抽离为配置，便于可视化和管理

### 流程定义
```typescript
interface WorkflowStep {
  name: string
  icon: string
  fn: (context: ScanContext) => Promise<void>
}

const SCAN_WORKFLOW: WorkflowStep[] = [
  {
    name: "pullRemote",
    icon: "☁️",
    fn: async (ctx) => {
      await ctx.sheetsSync.pull()
    }
  },
  {
    name: "initialize",
    icon: "🔧",
    fn: async (ctx) => {
      await ctx.recordManager.init(ctx.config)
    }
  },
  // ... 其他步骤
]
```

### 执行器
```typescript
class WorkflowExecutor {
  async execute(steps: WorkflowStep[], context: ScanContext): Promise<void> {
    for (const step of steps) {
      await this.executeStep(step, context)
    }
  }

  private async executeStep(step: WorkflowStep, context: ScanContext): Promise<void> {
    console.log(`${step.icon} ${step.name}...`)
    const start = Date.now()
    await step.fn(context)
    const duration = Date.now() - start
    console.log(`${step.icon} ${step.name} 完成 (${duration}ms)`)
  }
}
```

---

## 扫描结果

```typescript
interface ScanResult {
  /** 开始时间 */
  startTime: number

  /** 结束时间 */
  endTime: number

  /** 执行时长（毫秒） */
  duration: number

  /** 扫描的文件数量 */
  totalFiles: number

  /** 总 key 数量 */
  totalKeys: number

  /** 新增翻译数量 */
  newKeys: number

  /** 删除的 key 数量 */
  deletedKeys: number

  /** 无用 key 数量 */
  unusedKeys: number
}
```

---

## 错误处理

```typescript
private handleError(error: unknown): void {
  if (error instanceof I18nError) {
    Logger.error(error.message)
    if (error.suggestions.length > 0) {
      Logger.info("建议：")
      error.suggestions.forEach(s => Logger.info(`  - ${s}`))
    }
  } else {
    Logger.error("扫描过程中发生未知错误", error)
  }
}
```

---

## 进度显示

```typescript
class ScanProgress {
  private step = 0
  private totalSteps = 9

  start(): void {
    console.log(`\n🚀 开始扫描 (共 ${this.totalSteps} 步)...\n`)
  }

  update(message: string): void {
    this.step++
    console.log(`${this.step}/${this.totalSteps} ${message}`)
  }

  complete(result: ScanResult): void {
    console.log(`\n✅ 扫描完成！耗时 ${(result.duration / 1000).toFixed(2)}s\n`)
    console.log(`📊 统计：`)
    console.log(`   文件数: ${result.totalFiles}`)
    console.log(`   Key数: ${result.totalKeys}`)
    console.log(`   新增: ${result.newKeys}`)
    console.log(`   删除: ${result.deletedKeys}`)
  }
}
```

---

## 使用示例

```typescript
// 创建扫描器
const scanner = new Scanner(config)

// 执行扫描
await scanner.scan()

// 输出：
// 🚀 开始扫描 (共 9 步)...
//
// 1/9 ☁️ 远端拉取并合并...
// 2/9 🔧 初始化...
// 3/9 📁 扫描文件 (23 个文件)...
// 4/9 🔍 收集翻译...
// 5/9 🔍 检测无用 Key...
// 6/9 🔧 生成记录...
// 7/9 🔧 生成翻译文件...
// 8/9 🤔 确认远端同步...
// 9/9 ☁️ 同步到远端...
//
// ✅ 扫描完成！耗时 12.34s
//
// 📊 统计：
//    文件数: 23
//    Key数: 156
//    新增: 12
//    删除: 3
```

## 依赖

依赖所有其他模块：
- `domain/scan/*` - 扫描模块
- `domain/collect/*` - 收集模块
- `domain/record/*` - 记录模块
- `domain/translate/*` - 翻译模块
- `domain/analyze/*` - 分析模块
- `infra/sheets/*` - Sheets 同步
- `infra/ast/*` - AST 转换
- `ui/*` - 用户交互
- `utils/*` - 工具
