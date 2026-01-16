# Feature: 纯 JSX 文本提取

## 需求描述

当前系统只提取带 `~` 标记的文本。但纯 JSX 文本节点中的英文内容也应该被提取，因为：

1. 文案范围确定（在 JSX 标签内）
2. 通常包含用户可见内容
3. 减少手动添加标记的工作

## 示例

### 输入
```tsx
export default function Page() {
  return (
    <div>
      <h1>Welcome</h1>
      <p>This is a test</p>
    </div>
  );
}
```

### 输出
```tsx
import { I18nUtil as I18n } from "@utils";

export default function Page() {
  return (
    <div>
      <h1>{I18n.t("Welcome")}</h1>
      <p>{I18n.t("This is a test")}</p>
    </div>
  );
}
```

## 规则

1. **只提取包含英文字符**的 JSX 文本
2. **跳过纯空白**
3. **跳过已包含 I18n.t() 的内容**
4. **保持代码格式**

## 实现计划

1. 修改 `JSXTextExtractor`：移除 "跳过带标记文本" 的逻辑
2. 集成 `JSXTextExtractor` 到 `Scanner`
3. `CodeTransformer` 支持 JSX 文本节点转换
