# I18nScanner V2 架构设计

## 目录结构

```
src-v2/
├── types/                      # 类型定义
│   ├── config.ts               # 配置类型
│   ├── record.ts               # 数据结构
│   └── index.ts                # 统一导出
│
├── core/                       # 核心编排层
│   ├── Scanner.ts              # 主编排器（9步流程）
│   └── Workflow.ts             # 流程定义
│
├── domain/                     # 业务逻辑层
│   ├── scan/                   # 扫描模块
│   │   ├── FileScanner.ts      # 文件扫描
│   │   └── PathMapper.ts       # 路径映射
│   │
│   ├── collect/                # 收集模块
│   │   ├── TranslationCollector.ts  # 翻译收集
│   │   └── DependencyAnalyzer.ts    # 依赖分析
│   │
│   ├── record/                 # 记录模块
│   │   ├── RecordManager.ts    # 记录管理
│   │   └── RecordRepository.ts # 记录存储
│   │
│   ├── translate/              # 翻译模块
│   │   └── LLMTranslator.ts    # LLM翻译
│   │
│   └── analyze/                # 分析模块
│       ├── KeyAnalyzer.ts      # Key分析
│       └── DeleteService.ts    # 删除服务
│
├── infra/                      # 基础设施层
│   ├── sheets/                 # Google Sheets
│   │   └── SheetsSync.ts
│   │
│   └── ast/                    # AST操作
│       └── CodeTransformer.ts
│
├── ui/                         # 用户交互
│   ├── UIService.ts
│   ├── InteractiveMode.ts
│   └── AutoMode.ts
│
└── utils/                      # 工具
    ├── Logger.ts
    └── FileUtil.ts
```

---

## 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                        core/Scanner.ts                       │
│                      （主编排器 - 9步流程）                   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   domain/     │    │    infra/     │    │     ui/       │
│  业务逻辑层   │    │  基础设施层   │    │  用户交互层   │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ • scan/       │    │ • sheets/     │    │ • UIService   │
│ • collect/    │    │ • ast/        │    │ • Interactive │
│ • record/     │    │               │    │ • Auto        │
│ • translate/  │    │               │    │               │
│ • analyze/    │    │               │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │
        └─────────────────────┴─────────────────────┐
                      │                             │
                      ▼                             ▼
                ┌─────────────┐              ┌─────────────┐
                │   types/    │              │   utils/    │
                │  类型定义   │              │   工具层    │
                └─────────────┘              └─────────────┘
```

---

## 数据结构

### 三层结构

```
i18n-complete-record.json
│
├── 文件夹名称（路由路径_拼接）
│   ├── en.json
│   │   ├── Key: Value
│   │   └── Key: Value
│   └── es.json
│       ├── Key: Value
│       └── Key: Value
```

### TypeScript 定义

```typescript
interface CompleteTranslationRecord {
  [folderName: string]: FolderTranslations;
}

interface FolderTranslations {
  [languageFile: string]: LanguageTranslations;
}

interface LanguageTranslations {
  [key: string]: string;
}
```

### 示例数据

```json
{
  "pages_login": {
    "en.json": {
      "Welcome": "Welcome",
      "Login": "Login"
    },
    "es.json": {
      "Welcome": "Bienvenido",
      "Login": "Iniciar sesión"
    }
  },
  "components_header": {
    "en.json": {
      "Title": "My App"
    },
    "es.json": {
      "Title": "Mi Aplicación"
    }
  }
}
```

---

## 主流程（9步）

| 步骤 | 说明 | 模块 |
|------|------|------|
| 1 | ☁️ 远端拉取并合并 | `SheetsSync.pull()` |
| 2 | 🔧 初始化 | `RecordManager.init()` |
| 3 | 📁 扫描文件 | `FileScanner.scan()` |
| 4 | 🔍 收集翻译 | `TranslationCollector.collect()` |
| 5 | 🔍 检测无用 Key | `KeyAnalyzer.detect()` |
| 6 | 🔧 生成记录 | `RecordManager.save()` |
| 7 | 🔧 生成翻译文件 | `RecordManager.generateFiles()` |
| 8 | 🤔 确认远端同步 | `UIService.confirm()` |
| 9 | ☁️ 同步到远端 | `SheetsSync.push()` |

---

## 渐进式开发计划

### 阶段1：基础骨架 ✅
- 创建目录结构
- 类型定义
- 工具类

### 阶段2：扫描模块
- `domain/scan/PathMapper.ts` - 路径映射
- `domain/scan/FileScanner.ts` - 文件扫描

### 阶段3：收集模块
- `domain/collect/TranslationCollector.ts` - 翻译收集
- `domain/collect/DependencyAnalyzer.ts` - 依赖分析

### 阶段4：记录模块
- `domain/record/RecordRepository.ts` - 记录仓储
- `domain/record/RecordManager.ts` - 记录管理

### 阶段5：翻译模块
- `domain/translate/LLMTranslator.ts` - LLM翻译

### 阶段6：分析模块
- `domain/analyze/KeyAnalyzer.ts` - Key分析
- `domain/analyze/DeleteService.ts` - 删除服务

### 阶段7：基础设施
- `infra/sheets/SheetsSync.ts` - Sheets同步
- `infra/ast/CodeTransformer.ts` - 代码转换

### 阶段8：用户交互
- `ui/UIService.ts` - UI服务
- `ui/InteractiveMode.ts` - 交互模式
- `ui/AutoMode.ts` - 自动模式

### 阶段9：主编排
- `core/Workflow.ts` - 流程定义
- `core/Scanner.ts` - 主编排器

---

## 关键设计决策

1. **完全重新开发**：在 `src-v2/` 目录，不影响现有代码
2. **移除术语表**：简化翻译逻辑，纯 LLM 翻译
3. **三层数据结构**：文件夹 → 语言文件 → Key-Value
4. **分层架构**：业务逻辑与基础设施分离
5. **渐进式开发**：每阶段可独立验证
