# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-01-15

### 🎉 Major Feature Release

### Added

- **🧹 智能键清理系统** - 全新的未使用翻译键清理功能

  - `KeyDeletionService` - 核心键删除服务
  - `UnusedKeyAnalyzer` - 深度代码分析，识别未使用的翻译键
  - `RecordManager` - 翻译记录状态管理
  - 支持强制保留键配置 (`forceKeepKeys`)

- **💬 交互式用户界面** - 友好的命令行交互体验

  - `UserInteraction` - 用户确认和选择界面
  - `ProgressIndicator` - 实时进度显示和状态反馈
  - 支持多种操作模式选择

- **🛡️ 安全机制** - 完善的数据保护

  - 自动备份机制，删除前创建时间戳备份
  - 一键恢复功能，支持从备份恢复
  - 详细的操作日志和清理报告

- **⚙️ 增强功能**
  - `I18nError` - 统一错误处理和报告系统
  - 异步操作支持，提升性能
  - 详细的操作统计和分析报告

### Dependencies

- **Added**: `inquirer@^12.6.3` - 交互式命令行界面
- **Added**: `ora@^6.3.1` - 终端进度指示器
- **Added**: `@types/inquirer@^9.0.8` - TypeScript 类型支持
- **Added**: `@types/ora@^3.2.0` - TypeScript 类型支持

### Changed

- **📦 版本升级**: `0.0.1` → `0.1.0`
- **🔧 TypeScript 配置**:
  - 禁用声明文件生成 (`declaration: false`)
  - 排除测试文件从编译范围
- **📋 配置扩展**: 新增 `forceKeepKeys` 配置选项

### Breaking Changes

- **翻译文件简化**: 演示项目的翻译文件从 171 个键简化为 2 个测试键
- **新依赖要求**: 新增运行时依赖可能影响包体积
- **交互式需求**: 部分功能需要终端交互支持

### Documentation

- **📖 README 更新**: 添加智能键清理功能的详细文档
- **📊 流程图**: 新增键清理流程的可视化说明
- **🔧 配置说明**: 更新配置选项和使用示例
- **📁 项目结构**: 更新项目目录结构说明

### Files Changed

- **新增文件**: 42 个文件变更
- **代码变更**: +4654 行新增, -1568 行删除
- **新增模块**: 7 个核心功能模块
- **文档更新**: 11 个任务文档文件

---

## [0.0.1] - 2024-01-01

### Added

- **🚀 初始版本发布**
- **基础国际化功能**

  - 自动代码转换，将文本替换为 `I18n.t()` 调用
  - 支持字符串字面量、模板字符串和 JSX 文本节点
  - 智能 JSX 和 JavaScript 上下文处理
  - 灵活的标记符号配置系统

- **📊 Google Sheets 集成**

  - 双向同步翻译内容
  - 支持多语言翻译文件生成
  - 自动生成 MD5 哈希键

- **⚙️ 核心功能**
  - TypeScript 完整支持
  - 基于 AST 的代码转换
  - 文件扫描和处理系统
  - 多种文件格式支持

### Core Modules

- `I18nScanner` - 主扫描器
- `FileScanner` - 文件扫描器
- `AstTransformer` - AST 转换器
- `TranslationManager` - 翻译管理器
- `GoogleSheetsSync` - Google Sheets 同步

---

## 版本计划

### [0.2.0] - 计划中

- **🔄 增量更新功能** - 支持增量翻译更新
- **🌐 更多语言支持** - 扩展语言检测和处理
- **📊 统计和分析** - 详细的翻译覆盖率分析
- **🎯 性能优化** - 大型项目处理性能提升

### [1.0.0] - 长期计划

- **🎨 图形化界面** - Web 界面管理工具
- **🔌 插件系统** - 支持第三方扩展
- **☁️ 云端服务** - 在线翻译管理平台
- **🤖 AI 辅助** - 智能翻译建议和优化

---

_有关详细的技术变更，请参考 git commit 历史和相关文档。_
