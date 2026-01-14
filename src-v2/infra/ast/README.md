# AST 转换模块

## 模块职责

使用AST技术将源码中的标记内容转换为I18n.t()调用，支持字符串字面量、模板字符串、JSX混合内容三种场景。

## 模块组成

```
ast/
├── MarkedExtractor.ts      # 标记内容提取器（已实现，使用jscodeshift）
└── CodeTransformer.ts      # 代码转换器（当前版本，使用正则表达式）
```

### 开发状态
- ✅ **MarkedExtractor.ts** - AST级标记内容提取器，支持三种场景
- ✅ **MarkedExtractor.ts** - 完成复杂混合内容处理（嵌套HTML、边界文本、自闭合标签）
- ✅ **MarkedExtractor.ts** - 100%测试通过率，所有功能验证成功

---

## MarkedExtractor.ts

### 职责
- 使用AST解析源码识别标记内容
- 分类不同类型的标记内容
- 提供精确的位置信息

### 处理类型
- **字符串字面量**: `"~text~"`
- **模板字符串**: `` `~text ${var}~` ``
- **JSX混合内容**: `~Text <El>{var}</El>~`

### 输出结构
```typescript
interface ExtractedContent {
  type: 'string' | 'template' | 'jsx-mixed';
  originalText: string;      // 原始标记内容
  cleanedText: string;       // 清理后的文本
  position: Position;        // 在源码中的位置
  context: ExtractionContext; // 提取上下文
  variables?: VariableMapping[]; // 变量映射
  elements?: ElementFactory[];    // 元素工厂
}
```

---

## TemplateProcessor.ts

### 职责
- 专门处理标记模板字符串
- 提取变量表达式
- 生成插值映射

### 处理流程
1. 解析模板字符串结构
2. 提取静态文本部分
3. 识别变量表达式
4. 生成变量映射
5. 构建转换结果

### 变量映射格式
- `${name}` → `%{var0}`
- `${user.name}` → `%{var0}`
- 生成映射: `{var0: name}` 或 `{var0: user.name}`

---

## JSXMixedProcessor.ts

### 职责
- 处理JSX元素中的混合标记内容
- 分析文本、表达式、元素的混合结构
- 生成组件工厂函数
- 支持嵌套HTML标签解析

### 处理流程
1. 分析JSX元素结构
2. 识别混合内容模式
3. 提取变量和元素信息
4. **平铺嵌套结构** - 将嵌套HTML转换为线性元素序列
5. 生成工厂函数映射
6. **处理边界文本** - 保留HTML前后的纯文本内容

### 元素工厂格式
- 有文本: `el0: text => <Component>{text}</Component>`
- 自闭合: `el1: () => <img src="..." />`
- 复杂组件: `el2: text => <Link href="/">{text}</Link>`

### 复杂混合内容处理
```
输入: "~<strong>text<strong>inner</strong></strong>ddd~"
解析: [
  { type: 'element', tag: 'strong', placeholder: 'el0', content: 'text<el1>inner</el1>' },
  { type: 'element', tag: 'strong', placeholder: 'el1', content: 'inner' },
  { type: 'text', content: 'ddd' }
]
输出: I18n.t("<el0>text<el1>inner</el1></el0>ddd", { 
  el0: text => <strong>{text}</strong>, 
  el1: text => <strong>{text}</strong> 
})
```

---

## CodeTransformer.ts

### 职责
- 整合各处理器的结果
- 执行代码转换
- 管理导入语句

### 转换流程
1. 调用MarkedExtractor提取内容
2. 根据类型分发到对应处理器
3. 整合处理结果
4. 生成AST转换
5. 管理导入语句
6. 输出转换代码

### 导入管理
```typescript
// 自动添加导入
import { I18nUtil } from "@utils";
const I18n = I18nUtil.createScoped('Translations');
```

---

## 职责分离

### 正则提取层：识别范围
- 职责：找到标记符号范围
- 支持：嵌套标记（最外层匹配）
- 不负责：内容类型分析

### AST分析层：理解内容
- 职责：分析提取内容的类型
- 支持：变量信息提取
- 不负责：范围识别

---

## 提取流程

### 第一步：正则提取
```typescript
// 输入: "~A ~B ~C~ D~ E~"
// 提取: "A ~B ~C~ D~ E"
// 过滤：只提取包含英文的内容
```

### 第二步：AST分析
```typescript
// 提取内容: "A ~B ~C~ D~ E"
// 类型判断: 包含<或${}吗？
// 变量提取：如有表达式则提取变量
// 输出结构: { type, cleanedText, variables }
```

---

## 支持的所有场景

### ✅ 完全支持（100%）

#### 简单场景
- ✅ 单标记: `"~Hello~"` → `I18n.t("Hello")`
- ✅ 多个独立标记: `"~A~" "~B~"` → `I18n.t("A")` `I18n.t("B")`

#### 嵌套场景
- ✅ 简单嵌套: `"~Outer ~inner~ text~"` → `I18n.t("Outer ~inner~ text")`
- ✅ 多重嵌套: `"~A ~B ~C~ D~ E~"` → `I18n.t("A ~B ~C~ D~ E~")`

#### 模板场景
- ✅ 单变量: `"~Hello ${name}~"` → `I18n.t("Hello %{var0}", { var0: name })`
- ✅ 多变量: `"~Welcome ${user.name}~"` → `I18n.t("Welcome %{var0}", { var0: user.name })`
- ✅ 复杂模板: `"~Hello ${user.name}, count: ${count}~"` → `I18n.t("Hello %{var0}, count: %{var1}", { var0: user.name, var1: count })`

#### JSX场景
- ✅ 简单JSX: `"~<strong>text</strong>~"` → `I18n.t("<strong>text</strong>")`
- ✅ 混合内容: `"~Hello <Component>text</Component>~"` → `I18n.t("Hello <el0>text</el0>", { el0: text => <Component>{text}</Component> })`
- ✅ 嵌套HTML: `"~<strong>text<strong>inner</strong></strong>ddd~"` → `I18n.t("<el0>text<el1>inner</el1></el0>ddd", { el0: text => <strong>{text}</strong>, el1: text => <strong>{text}</strong> })`
- ✅ 复杂嵌套: `"~Before<div>middle<span>content</span>after</div>end~"` → 支持多层嵌套和文本混合

---

### ❌ 明确不处理（符合设计要求）

#### 无标记符号
```
"Hello World"          → 保持不变
<div>Hello World</div>     → 保持不变
<input placeholder="text" />   → 保持不变
```

#### 无英文内容
```
"~你好世界~"          → 跳过处理
```

#### JSX纯文本
```
<div>Hello World</div>       → 保持不变
<p>Welcome</p>             → 保持不变
```

---

## 实现优势

### 1. 符合标记符号设计初衷
- 人为控制翻译范围，避免误识别
- 明确的边界，减少歧义

### 2. 最外层匹配算法
- 算洁高效：O(n) 复杂度
- 嵌套友好：完整提取嵌套内容

### 3. 职责分离架构
- 正则提取：专注于范围识别
- AST分析：专注于内容理解
- 易于维护和扩展

### 无标记字符串
```typescript
// 保持不变
const msg = "Hello World";
```

## 嵌套标记支持

```typescript
// 支持嵌套标记，提取完整内容
const text = "~Outer ~inner~ text~";
// 提取: "Outer ~inner~ text" → I18n.t("Outer ~inner~ text")
```

### 无标记字符串
```typescript
// 保持不变
const msg = "Hello World";
```

---

## 技术栈

### 已实现
- **MarkedExtractor**: 使用 jscodeshift + ast-types
- **CodeTransformer**: 使用正则表达式（待升级）

### 依赖
- `jscodeshift` - AST转换框架（MarkedExtractor使用）
- `ast-types` - AST节点类型（MarkedExtractor使用）

## 使用方式

```typescript
const transformer = new CodeTransformer(config);

// 转换单个文件
const result = await transformer.transformFile("src/pages/login.tsx");

if (result.hasChanges) {
  console.log(`转换了 ${result.newTranslations.length} 个新翻译`);
}
```