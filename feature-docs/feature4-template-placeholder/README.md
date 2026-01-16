# Feature: 模板字符串占位符支持

## 需求描述

支持带变量占位符的翻译，例如：
`` `~${1}kkkk~` `` → 转换为带变量的 I18n 调用

## 规则

### 不提取：纯变量
`` `~${1}~` `` - 只有变量，无可翻译内容 → **不提取**
`` `~${user.name}~` `` - 只有变量 → **不提取**

### 提取：变量 + 静态文本
`` `~${1}kkkk~` `` → **提取**，转换为 `I18n.t("kkkk", { var0: 1 })`
`` `~Hello ${user}!~` `` → **提取**，转换为 `I18n.t("Hello !", { var0: user })`

## 示例

### 输入
```tsx
export default function Page({ name, count }) {
  const greeting = `~Hello ${name}!~`;
  const message = `~${count} items~`;  // 纯变量，不提取
  return <div>{greeting} {message}</div>;
}
```

### 输出
```tsx
import { I18nUtil as I18n } from "@utils";

export default function Page({ name, count }) {
  const greeting = I18n.t("Hello !", { var0: name });
  const message = `~${count} items~`;  // 保持不变
  return <div>{greeting} {message}</div>;
}
```

## 实现计划

1. `TemplateExtractor` 已存在，集成到 `Scanner`
2. `CodeTransformer` 支持模板字符串转换
3. 生成带变量的翻译记录

## 翻译格式

```
{
  "Hello !": "Hello %{var0}!",
  "items": "%{var0} items"
}
```
