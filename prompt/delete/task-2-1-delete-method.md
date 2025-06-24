# Task 2.1: 在 TranslationManager 中添加删除方法

我需要在 core/TranslationManager.ts 中添加删除翻译 Key 的功能。

## 需求

1. 添加一个 deleteTranslations 方法，接收要删除的 Key 数组
2. 从所有语言的翻译数据中删除指定的 Key
3. 提供详细的删除日志，显示从哪个语言文件删除了哪个 Key
4. 方法应该是同步的，不直接保存文件（保存由调用者控制）

## 当前数据结构

- this.translations: TranslationData（语言 -> Key -> 文本的映射）
- this.config.languages: string[]（支持的语言列表）

## 请提供

1. deleteTranslations 方法的完整实现
2. 适当的类型定义

## 验收标准

- 方法能正确删除指定的 Key
- 提供清晰的操作日志
- 不直接修改文件系统
- 错误处理完善
