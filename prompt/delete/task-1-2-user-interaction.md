# Task 1.2: 增强 AstTransformer 收集现有 I18n 引用

我需要增强 core/AstTransformer.ts，使其能够在扫描过程中收集文件中现有的 I18n.t() 调用。

## 核心思路

在现有的 AST 转换基础上，新增收集现有 I18n 引用的功能：

1. 识别文件中已存在的 `I18n.t("8a709a33")` 调用
2. 提取这些调用中的 Key 值和位置信息
3. 记录 Key 与文件的引用关系
4. 为后续的完整记录生成提供数据支持

## 当前状态

- AstTransformer 只处理新的翻译转换
- 没有收集现有 I18n 引用的功能
- TransformResult 接口只包含新生成的翻译信息

## 期望实现

### 1. 新增引用相关接口

```typescript
export interface ExistingReference {
  key: string; // I18n Key
  filePath: string; // 文件路径
  lineNumber: number; // 行号
  columnNumber: number; // 列号
  callExpression: string; // 完整的调用表达式 "I18n.t('8a709a33')"
}

export interface FileAnalysisResult {
  existingReferences: ExistingReference[]; // 现有的引用
  newTranslations: TransformResult[]; // 新生成的翻译
  transformedCode: string; // 转换后的代码
}
```

### 2. 新增 collectExistingI18nCalls 方法

```typescript
public collectExistingI18nCalls(source: string, filePath: string): ExistingReference[]
```

该方法应该：

- 解析源码的 AST
- 查找所有 `I18n.t()` 调用表达式
- 提取 Key 值（支持字符串字面量）
- 记录精确的位置信息

### 3. 扩展现有方法（可选）

可以考虑扩展 `transformSource` 方法，使其同时返回现有引用：

```typescript
public transformSource(source: string, filePath: string): FileAnalysisResult
```

## 实现要点

### AST 节点识别

需要识别以下形式的 I18n 调用：

```typescript
// 直接调用
I18n.t("8a709a33");

// 带参数调用
I18n.t("8a709a33", { name: "John" });

// 不同引号形式
I18n.t("8a709a33");
I18n.t(`8a709a33`);
```

### Key 值提取策略

- **字符串字面量**: 直接从 Literal 节点提取
- **模板字符串**: 如果是纯字符串（无变量），也可提取
- **变量引用**: 暂时跳过，不参与引用记录（避免复杂性）

### 位置信息记录

记录准确的位置信息：

- 文件路径
- 行号（node.loc.start.line）
- 列号（node.loc.start.column）
- 完整调用表达式（用于调试和验证）

## 请提供

1. ExistingReference 接口定义
2. collectExistingI18nCalls 方法的完整实现
3. 相关的辅助方法和工具函数
4. 适当的错误处理和边界情况处理
5. 如果需要，扩展现有的 transformSource 方法

## 验收标准

- 能够准确识别各种形式的 I18n.t() 调用
- 正确提取字符串字面量形式的 Key 值
- 记录准确的位置信息（文件路径、行号、列号）
- 不影响原有的翻译转换功能
- 处理边界情况（如语法错误、非字符串参数等）
- 提供清晰的数据结构，便于后续处理
- 性能优化，合理复用 AST 解析结果

## 测试用例

应该能够处理以下测试场景：

```typescript
// 测试文件内容示例
const testCode = `
import { I18n } from '@utils';

function Component() {
  const title = I18n.t("8a709a33");
  const msg = I18n.t('bf3c2d4e', { name: user.name });
  
  return (
    <div>
      <h1>{I18n.t("12345678")}</h1>
      <p>{I18n.t(\`abcdefgh\`)}</p>
    </div>
  );
}
`;

// 预期结果：应该识别出4个I18n.t调用及其Key值
```
