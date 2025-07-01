# i18n 模块化翻译改造方案

## 核心目标

将现有的单一翻译文件结构改造为模块化翻译系统：

1. **修改 JSON 文件生成逻辑**：从单一语言文件改为按模块路径分组的文件结构
2. **修改完整记录格式**：从现有格式改为按翻译路径分组的新格式
3. **原文案作为 Key**：提高可读性和维护性
4. **保持其他逻辑不变**：扫描、转换、同步等核心流程完全不修改

## 数据结构设计

### 1. 新的完整记录格式

```typescript
// i18n-complete-record.json
{
  "翻译路径": {
    "翻译的key（原文案）": {
      "语言代码": "翻译内容"
    }
  }
}

// 示例
{
  "src/components/Header": {
    "Welcome to our website": {
      "en": "Welcome to our website",
      "zh-CN": "欢迎来到我们的网站"
    }
  },
  "src/pages/home": {
    "Get Started": {
      "en": "Get Started",
      "zh-CN": "开始使用"
    }
  }
}

// 对应的文件结构：
// translate/
// ├── src/
// │   ├── components/
// │   │   └── Header/
// │   │       └── index.ts
// │   └── pages/
// │       └── home/
// │           └── index.ts
// └── i18n-complete-record.json
```

### 2. 模块化翻译文件格式

```typescript
// translate/src/components/Header/index.ts
export const headerTranslations = {
  en: {
    "Welcome to our website": "Welcome to our website",
    "User Profile": "User Profile",
  },
  "zh-CN": {
    "Welcome to our website": "欢迎来到我们的网站",
    "User Profile": "用户资料",
  },
};
```

## 核心修改点

### 1. 修改 TranslationManager

```typescript
class TranslationManager {
  // ========== 现有功能保持不变 ==========
  private translations: TranslationData = {};
  addTranslation(result: TransformResult): void; // 不变
  getTranslations(): TranslationData; // 不变
  updateTranslations(remoteTranslations: TranslationData): void; // 不变

  // ========== 修改文件生成逻辑 ==========
  // 修改：不再生成 zh.json, en.json，改为生成模块化文件
  saveTranslations(
    allReferences: Map<string, ExistingReference[]>
  ): Promise<void>;

  // 新增：生成新格式的完整记录文件
  saveCompleteRecord(
    allReferences: Map<string, ExistingReference[]>
  ): Promise<void>;

  // 新增：按模块路径分组翻译数据
  private groupTranslationsByModule(
    allReferences: Map<string, ExistingReference[]>
  ): ModularTranslationData;

  // 新增：生成每个模块的翻译文件
  private generateModuleTranslationFiles(
    modularData: ModularTranslationData
  ): Promise<void>;
}
```

### 2. 修改 RecordManager

```typescript
class RecordManager {
  // 修改：生成新格式的记录文件
  generateCompleteRecord(
    references: Map<string, ExistingReference[]>,
    newTranslations: TransformResult[],
    currentTranslations: any
  ): Promise<void>; // 修改实现，生成按翻译路径分组的记录

  // 新增：构建新格式记录数据
  private buildModularRecord(
    translations: TranslationData,
    references: Map<string, ExistingReference[]>
  ): NewCompleteRecord;

  // 新增：确定翻译key所属模块路径
  private getModulePath(key: string, references: ExistingReference[]): string;
}
```

### 3. 修改 I18nScanner 主流程

```typescript
class I18nScanner {
  async scan() {
    // 前3步保持不变（初始化、扫描文件、处理文件）...
    await this.translationManager.initialize();
    const files = await this.fileScanner.scanFiles();
    const { allReferences, newTranslations } = await this.processFiles(files);

    // 第一步：生成完整记录（作为数据中心）
    await this.translationManager.saveCompleteRecord(allReferences);

    // 第二步：与远端同步翻译
    const remoteTranslations = await this.googleSheetsSync.syncFromSheet();
    this.translationManager.updateTranslations(remoteTranslations);

    // 第三步：更新完整记录（合并远程翻译后）
    await this.translationManager.saveCompleteRecord(allReferences);

    // 第四步：检测无用Key并二次确认
    const allDefinedKeys = this.getAllDefinedKeys();
    if (await this.hasUnusedKeys(allDefinedKeys, allReferences)) {
      await this.keyDeletionService.detectAndHandleUnusedKeys(
        allDefinedKeys,
        allReferences
      );
      // 删除后重新生成完整记录
      await this.translationManager.saveCompleteRecord(allReferences);
    }

    // 第五步：基于完整记录生成模块化翻译文件
    await this.translationManager.generateModularFilesFromCompleteRecord();

    // 第六步：同步到Google Sheets
    await this.googleSheetsSync.syncToSheet(
      this.translationManager.getTranslations()
    );
  }
}
```

## 前端使用方式

### I18n 工具类

```typescript
class I18nUtil {
  static getCurrentLocale(): string {
    const params = new URLSearchParams(window.location.search);
    return params.get("lang") || "en";
  }

  static createScoped(translations: ModuleTranslations) {
    const locale = this.getCurrentLocale();
    return {
      t: (key: string) => translations[locale]?.[key] || key,
    };
  }

  static switchLocale(newLocale: string): void {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", newLocale);
    window.location.href = url.toString();
  }
}
```

### 组件使用示例

```typescript
import { I18nUtil } from "@utils";
import { headerTranslations } from "../translate/src/components/Header";

function Header() {
  const I18n = I18nUtil.createScoped(headerTranslations);

  return (
    <div>
      <h1>{I18n.t("Welcome to our website")}</h1>
      <span>{I18n.t("User Profile")}</span>
    </div>
  );
}
```

## 新的主流程总结

根据您的要求，新的主流程将严格按以下顺序执行：

```
1. 扫描和转换代码 (原有逻辑)
   ↓
2. **生成完整记录** (作为数据中心)
   ↓
3. **与远端同步翻译** (Google Sheets)
   ↓
4. **更新完整记录** (合并远程翻译)
   ↓
5. **检测无用Key** + **二次确认**
   ↓
6. **删除确认的无用Key** (更新完整记录)
   ↓
7. **基于完整记录生成模块化翻译文件**
   ↓
8. 同步到远端 (原有逻辑)
```

## 关键要点

1. **完整记录作为数据中心**：所有操作都基于完整记录进行
2. **最小化修改**：主要修改文件生成逻辑和数据流顺序
3. **向后兼容**：扫描、转换等核心逻辑完全不变
4. **数据一致性**：确保删除、同步、生成都基于同一数据源
5. **简化维护**：基于 URL 参数的语言控制，无复杂状态管理

## 实施步骤

### 第一步：修改 AstTransformer 支持原文案作为 Key

**目标**：将哈希 Key 系统改为原文案 Key 系统
**文件**：`core/AstTransformer.ts`

**修改内容**：

```typescript
// 当前实现：使用哈希值作为key
private generateTranslationKey(text: string, filePath: string): string {
  return StringUtils.generateKey(text, filePath); // 生成哈希
}

// 新实现：直接使用原文案作为key
private generateTranslationKey(text: string, filePath: string): string {
  return text; // 直接返回原文案
}
```

**注意事项**：

- 处理原文案中的特殊字符（引号、换行符等）
- 考虑过长文案的处理策略

### 第二步：修改 AstTransformer 支持新的调用模式

**目标**：保持 `I18n.t("key")` 调用不变，但改为使用模块化翻译和 scoped I18n 实例
**文件**：`core/AstTransformer.ts`

**关键修改点**：

1. **修改调用表达式生成**：

```typescript
// utils/AstUtils.ts - 保持 createI18nCall 方法不变
static createI18nCall(
  key: string,
  options?: n.ObjectExpression
): n.CallExpression {
  const callArgs: (n.Expression | n.SpreadElement)[] = options
    ? [b.literal(key), options]
    : [b.literal(key)];

  // 保持：继续使用 I18n.t 调用方式
  return b.callExpression(
    b.memberExpression(b.identifier("I18n"), b.identifier("t")),
    callArgs as any
  );
}
```

2. **修改导入逻辑** - 替换 `addI18nImport` 方法：

```typescript
// core/AstTransformer.ts
private addModularImports(
  j: JSCodeshiftAPI,
  root: JSCodeshiftCollection,
  filePath: string
): void {
  // 1. 添加翻译文件导入
  const modulePath = this.getModulePathForFile(filePath);
  const translationImportPath = this.getTranslationImportPath(modulePath);
  const translationVarName = this.getTranslationVarName(modulePath);

  this.addTranslationImport(j, root, translationVarName, translationImportPath);

  // 2. 添加 I18nUtil 导入
  this.addI18nUtilImport(j, root);

  // 3. 在组件/函数开头添加 scoped 初始化
  this.addScopedInitialization(j, root, translationVarName);
}

private addTranslationImport(
  j: JSCodeshiftAPI,
  root: JSCodeshiftCollection,
  varName: string,
  importPath: string
): void {
  const hasTranslationImport = root
    .find(j.ImportDeclaration)
    .some((path: ASTPath<n.ImportDeclaration>) => {
      return path.node.source?.value === importPath;
    });

  if (!hasTranslationImport) {
    const importDecl = j.importDeclaration(
      [j.importSpecifier(j.identifier(varName), j.identifier(varName))],
      j.literal(importPath)
    );
    root.get().node.program.body.unshift(importDecl);
  }
}

private addI18nUtilImport(j: JSCodeshiftAPI, root: JSCodeshiftCollection): void {
  const hasI18nUtilImport = root
    .find(j.ImportDeclaration)
    .some((path: ASTPath<n.ImportDeclaration>) => {
      const nodeSource = path.node.source;
      const nodeSpecs = path.node.specifiers;

      return !!(
        nodeSource?.value === "@utils" &&
        nodeSpecs?.some(spec =>
          n.ImportSpecifier.check(spec) && spec.imported.name === "I18nUtil"
        )
      );
    });

  if (!hasI18nUtilImport) {
    root.get().node.program.body.unshift(
      j.importDeclaration(
        [j.importSpecifier(j.identifier("I18nUtil"), j.identifier("I18nUtil"))],
        j.literal("@utils")
      )
    );
  }
}

private addScopedInitialization(
  j: JSCodeshiftAPI,
  root: JSCodeshiftCollection,
  translationVarName: string
): void {
  // 查找函数组件或类组件
  const components = this.findComponentDefinitions(j, root);

  components.forEach(componentPath => {
    // 在组件/函数开头添加: const I18n = I18nUtil.createScoped(headerTranslations);
    const scopedInit = this.createScopedInitStatement(j, translationVarName);
    this.insertStatementAtBeginning(componentPath, scopedInit);
  });
}

private createScopedInitStatement(
  j: JSCodeshiftAPI,
  translationVarName: string
): n.VariableDeclaration {
  return j.variableDeclaration("const", [
    j.variableDeclarator(
      j.identifier("I18n"),
      j.callExpression(
        j.memberExpression(
          j.identifier("I18nUtil"),
          j.identifier("createScoped")
        ),
        [j.identifier(translationVarName)]
      )
    )
  ]);
}

private findComponentDefinitions(
  j: JSCodeshiftAPI,
  root: JSCodeshiftCollection
): ASTPath<n.Node>[] {
  const components: ASTPath<n.Node>[] = [];

  // 查找函数组件 (function declarations)
  root.find(j.FunctionDeclaration).forEach(path => {
    if (this.isReactComponent(path.node)) {
      components.push(path);
    }
  });

  // 查找箭头函数组件 (const Component = () => {})
  root.find(j.VariableDeclarator).forEach(path => {
    if (n.ArrowFunctionExpression.check(path.node.init)) {
      const func = path.node.init;
      if (this.isReactComponent(func)) {
        components.push(path);
      }
    }
  });

  return components;
}

private isReactComponent(node: n.Function | n.ArrowFunctionExpression): boolean {
  // 简单检查：如果函数返回JSX，认为是React组件
  // 这里可以根据实际需要完善逻辑
  return true; // 简化实现
}

private getModulePathForFile(filePath: string): string {
  // src/components/Header.tsx -> src/components/Header
  return filePath.replace(/\.(tsx?|jsx?)$/, '');
}

private getTranslationImportPath(modulePath: string): string {
  // src/components/Header -> ../translate/src/components/Header
  // 需要根据当前文件位置计算相对路径
  return `../translate/${modulePath}`;
}

```

3. **修改主转换逻辑**：

```typescript
// core/AstTransformer.ts - 修改 transformSource 方法
public transformSource(
  source: string,
  filePath: string
): { results: TransformResult[]; transformedCode: string } {
  const j = jscodeshift.withParser("tsx");
  const root = j(source);
  const results: TransformResult[] = [];

  // 查找需要翻译的字符串字面量（带标记符号）
  this.transformStringLiterals(root, j, filePath, results);

  // 查找需要翻译的模板字符串（带标记符号）
  this.transformTemplateLiterals(root, j, filePath, results);

  // 查找需要翻译的JSX文本节点（纯文本）
  this.transformJSXTextNodes(root, j, filePath, results);

  // 添加模块化导入和初始化（替代原来的 addI18nImport）
  if (results.length > 0) {
    this.addModularImports(j, root, filePath);
  }

  const transformedCode = root.toSource();

  return { results, transformedCode };
}
```

4. **现有引用检测逻辑保持不变**：

```typescript
// core/AstTransformer.ts - isI18nTCall 方法保持原有逻辑
private isI18nTCall(callExpr: n.CallExpression): boolean {
  const callee = callExpr.callee;

  if (n.MemberExpression.check(callee)) {
    const object = callee.object;
    const property = callee.property;

    // 检查 I18n.t() 调用模式
    if (n.Identifier.check(object) && object.name === "I18n") {
      if (n.Identifier.check(property) && property.name === "t") {
        return true;
      }
    }
  }

  return false;
}
```

### 第三步：扩展 TranslationManager 的数据结构定义

**目标**：添加模块化数据相关的类型定义
**文件**：`core/TranslationManager.ts`

**新增类型定义**：

```typescript
interface ModuleTranslations {
  [locale: string]: { [key: string]: string };
}

interface ModularTranslationData {
  [modulePath: string]: ModuleTranslations;
}

// 新的完整记录格式
interface CompleteTranslationRecord {
  [translationPath: string]: {
    [translationKey: string]: {
      [languageKey: string]: string;
    };
  };
}
```

### 第四步：实现 TranslationManager 的模块分组逻辑

**目标**：添加按模块路径分组翻译数据的方法
**文件**：`core/TranslationManager.ts`

**新增方法**：

```typescript
private groupTranslationsByModule(
  allReferences: Map<string, ExistingReference[]>
): ModularTranslationData {
  const modularData: ModularTranslationData = {};

  // 遍历所有翻译key
  Object.keys(this.translations.zh || {}).forEach(key => {
    // 根据引用信息确定模块路径
    const modulePath = this.getModulePathForKey(key, allReferences);

    // 初始化模块数据
    if (!modularData[modulePath]) {
      modularData[modulePath] = {};
    }

    // 为每种语言添加翻译
    this.config.languages.forEach(lang => {
      if (!modularData[modulePath][lang]) {
        modularData[modulePath][lang] = {};
      }
      if (this.translations[lang] && this.translations[lang][key]) {
        modularData[modulePath][lang][key] = this.translations[lang][key];
      }
    });
  });

  return modularData;
}

private getModulePathForKey(
  key: string,
  allReferences: Map<string, ExistingReference[]>
): string {
  const refs = allReferences.get(key);
  if (!refs || refs.length === 0) {
    return 'common'; // 默认路径
  }

  // 使用第一个引用的文件路径来确定模块路径
  const filePath = refs[0].filePath;
  // 转换文件路径为模块路径：src/components/Header.tsx -> src/components/Header
  return filePath.replace(/\.(tsx?|jsx?)$/, '');
}
```

### 第五步：实现模块翻译文件生成逻辑

**目标**：生成每个模块的 index.ts 文件
**文件**：`core/TranslationManager.ts`

**新增方法**：

```typescript
// 基于完整记录生成模块文件的主方法
async generateModularFilesFromCompleteRecord(): Promise<void> {
  // 读取完整记录
  const completeRecord = await this.loadCompleteRecord();

  // 生成模块文件
  await this.generateModuleFilesFromRecord(completeRecord);
}

private async generateModuleFilesFromRecord(
  completeRecord: CompleteTranslationRecord
): Promise<void> {
  for (const [modulePath, moduleKeys] of Object.entries(completeRecord)) {
    // 创建模块目录（在translate文件夹下）
    const moduleDir = path.join(this.config.outputDir, 'translate', modulePath);
    await fs.promises.mkdir(moduleDir, { recursive: true });

    // 生成模块名（用于导出变量名）
    const moduleName = this.getModuleName(modulePath);

    // 构建模块翻译数据
    const moduleTranslations = this.buildModuleTranslations(moduleKeys);

    // 生成翻译文件内容
    const content = this.generateModuleFileContent(moduleName, moduleTranslations);

    // 写入index.ts文件
    const filePath = path.join(moduleDir, 'index.ts');
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }
}

private buildModuleTranslations(moduleKeys: Record<string, Record<string, string>>): ModuleTranslations {
  const result: ModuleTranslations = {};

  // 初始化所有语言
  this.config.languages.forEach(lang => {
    result[lang] = {};
  });

  // 填充翻译数据
  Object.entries(moduleKeys).forEach(([key, translations]) => {
    Object.entries(translations).forEach(([lang, translation]) => {
      if (result[lang]) {
        result[lang][key] = translation;
      }
    });
  });

  return result;
}

private getModuleName(modulePath: string): string {
  // src/components/Header -> headerTranslations
  const pathParts = modulePath.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  return `${lastPart.toLowerCase()}Translations`;
}

private generateModuleFileContent(
  moduleName: string,
  moduleTranslations: ModuleTranslations
): string {
  const jsonContent = JSON.stringify(moduleTranslations, null, 2);
  return `export const ${moduleName} = ${jsonContent};\n`;
}
```

### 第六步：新增 saveCompleteRecord 方法

**目标**：实现新格式的完整记录保存
**文件**：`core/TranslationManager.ts`

**新增方法**：

```typescript
async saveCompleteRecord(allReferences: Map<string, ExistingReference[]>): Promise<void> {
  const completeRecord = this.buildCompleteRecord(allReferences);

  const outputPath = path.join(this.config.outputDir, 'translate', 'i18n-complete-record.json');
  await fs.promises.writeFile(
    outputPath,
    JSON.stringify(completeRecord, null, 2),
    'utf-8'
  );
}

private buildCompleteRecord(allReferences: Map<string, ExistingReference[]>): CompleteTranslationRecord {
  const record: CompleteTranslationRecord = {};

  // 遍历所有翻译key
  Object.keys(this.translations.zh || {}).forEach(key => {
    // 获取模块路径
    const modulePath = this.getModulePathForKey(key, allReferences);

    // 初始化模块
    if (!record[modulePath]) {
      record[modulePath] = {};
    }

    // 初始化key
    if (!record[modulePath][key]) {
      record[modulePath][key] = {};
    }

    // 添加所有语言的翻译
    this.config.languages.forEach(lang => {
      if (this.translations[lang] && this.translations[lang][key]) {
        record[modulePath][key][lang] = this.translations[lang][key];
      }
    });
  });

  return record;
}

private async loadCompleteRecord(): Promise<CompleteTranslationRecord> {
  const filePath = path.join(this.config.outputDir, 'translate', 'i18n-complete-record.json');

  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('完整记录文件不存在或读取失败，返回空记录');
    return {};
  }
}
```

### 第七步：修改其他服务适配新流程

**目标**：修改 UnusedKeyAnalyzer 和 KeyDeletionService 适配新数据结构
**文件**：`core/UnusedKeyAnalyzer.ts`, `core/KeyDeletionService.ts`

**修改要点**：

```typescript
// UnusedKeyAnalyzer - 基于原文案进行检测
class UnusedKeyAnalyzer {
  analyzeUnusedKeys(
    allDefinedKeys: Set<string>,
    allReferences: Map<string, ExistingReference[]>
  ): string[] {
    const usedKeys = new Set<string>();

    // 从引用中收集已使用的 key（现在是原文案）
    allReferences.forEach((refs, key) => {
      if (refs.length > 0) {
        usedKeys.add(key);
      }
    });

    // 找出未使用的 key
    return Array.from(allDefinedKeys).filter((key) => !usedKeys.has(key));
  }
}

// KeyDeletionService - 基于完整记录删除
class KeyDeletionService {
  async deleteKeysFromCompleteRecord(keysToDelete: string[]): Promise<void> {
    // 读取完整记录
    const completeRecord = await this.translationManager.loadCompleteRecord();

    // 从完整记录中删除指定的keys
    Object.keys(completeRecord).forEach((modulePath) => {
      keysToDelete.forEach((keyToDelete) => {
        delete completeRecord[modulePath][keyToDelete];
      });
    });

    // 保存更新后的完整记录
    await this.translationManager.saveCompleteRecordDirect(completeRecord);
  }
}
```

### 第八步：修改无用 Key 扫描适配新的调用模式

**⚠️ 重要说明**：由于调用方式保持 `I18n.t()` 不变，无用 Key 扫描的主要适配点在于：

**问题分析**：

1. **调用检测逻辑**：继续检测 `I18n.t()` 调用
2. **Key 格式变化**：完全使用原文案作为 Key，不考虑旧的哈希 Key 兼容
3. **统一处理**：所有组件都使用新的 scoped 模式，无需考虑混合状态

**文件**：`core/AstTransformer.ts`

**关键修改**：

1. **`isI18nTCall` 方法保持原有逻辑**：

```typescript
// core/AstTransformer.ts - isI18nTCall 方法保持不变
private isI18nTCall(callExpr: n.CallExpression): boolean {
  const callee = callExpr.callee;

  if (n.MemberExpression.check(callee)) {
    const object = callee.object;
    const property = callee.property;

    // 检查 I18n.t() 调用模式（仅支持新的 scoped 模式）
    if (n.Identifier.check(object) && object.name === "I18n") {
      if (n.Identifier.check(property) && property.name === "t") {
        return true;
      }
    }
  }

  return false;
}
```

2. **`callExpression` 字段生成保持不变**：

```typescript
// core/AstTransformer.ts - collectExistingI18nCalls 方法中的引用生成逻辑保持不变
if (loc && loc.start) {
  const ref = {
    key,
    filePath,
    lineNumber: loc.start.line,
    columnNumber: loc.start.column,
    callExpression: `I18n.t("${key}")`,
  };
  references.push(ref);
}

// 注：所有调用都使用新的 scoped I18n.t() 格式
// key 为原文案格式，不包含旧的哈希Key
```

3. **混合状态处理逻辑简化**：

```typescript
// core/AstTransformer.ts - 收集逻辑基本保持不变
public collectExistingI18nCalls(
  source: string,
  filePath: string
): ExistingReference[] {
  const j = jscodeshift.withParser("tsx");
  const root = j(source);
  const references: ExistingReference[] = [];

  // 查找所有新的 scoped I18n.t() 调用
  root.find(j.CallExpression).forEach((path: ASTPath<n.CallExpression>) => {
    const callExpr = path.node;

    // 检查是否是 I18n.t() 调用
    if (this.isI18nTCall(callExpr)) {
      const keyArg = callExpr.arguments[0];

      // 处理字符串字面量参数（仅处理原文案格式的Key）
      if (n.Literal.check(keyArg) && typeof keyArg.value === "string") {
        const key = keyArg.value;
        const loc = callExpr.loc;

        if (loc && loc.start) {
          const ref = {
            key,
            filePath,
            lineNumber: loc.start.line,
            columnNumber: loc.start.column,
            callExpression: `I18n.t("${key}")`,
          };
          references.push(ref);
        }
      }
      // 处理模板字面量参数...
    }
  });

  return references;
}
```

4. **ExistingReference 接口保持不变**：

```typescript
// core/AstTransformer.ts - 接口定义保持原有结构
export interface ExistingReference {
  key: string; // I18n Key (现在是原文案)
  filePath: string; // 文件路径
  lineNumber: number; // 行号
  columnNumber: number; // 列号
  callExpression: string; // 完整的调用表达式 "I18n.t('原文案')"
}
```

**实施注意事项**：

1. **完全重构**：不考虑旧的哈希 Key 兼容，所有组件统一使用新的 scoped 模式
2. **Key 格式统一**：所有 Key 都是原文案格式，确保收集到的引用 key 与翻译文件中的 key 格式完全一致
3. **特殊字符处理**：原文案中可能包含引号、换行符等特殊字符，需要统一处理规则
4. **简化逻辑**：无需考虑新旧模式混合，大幅简化了检测和处理逻辑

**测试用例补充**：

```typescript
// 测试统一的新模式文件
const newModeTestCode = `
import { I18nUtil } from "@utils";
import { headerTranslations } from "../translate/src/components/Header";

function NewComponent() {
  const I18n = I18nUtil.createScoped(headerTranslations);
  
  return (
    <div>
      <h1>{I18n.t("Welcome to our website")}</h1>
      <p>{I18n.t("This is a description text")}</p>
      <span>{I18n.t("User Profile")}</span>
    </div>
  );
}
`;

// 预期结果：应该识别出3个 I18n.t() 调用，所有Key都是原文案格式
```

**Key 格式一致性的关键问题**：

由于完全使用原文案作为 Key，无用 key 检测的准确性完全依赖于：

1. **字符串处理一致性**：

```typescript
// 确保转换时和收集时使用相同的字符串处理逻辑
const key = StringUtils.generateTranslationKey(filePath, text); // 转换时
const key = keyArg.value; // 收集时

// 必须确保两者结果完全一致！
```

2. **特殊字符处理**：

```typescript
// 原文案: "Hello "world""  (包含引号)
// 转换时: StringUtils.formatString() 处理
// 收集时: 直接从 AST 节点提取

// 需要确保处理结果一致，否则会导致误判为无用key
```

3. **空白字符处理**：

```typescript
// 原文案: "  Hello World  " (包含前后空格)
// JSX文本: 可能被 trim() 处理
// 字符串字面量: 保持原样

// 需要统一的规范化处理
```

**建议的解决方案**：

在 `StringUtils` 中添加统一的 key 规范化方法：

```typescript
// utils/StringUtils.ts
class StringUtils {
  // 统一的key规范化方法，用于转换和收集时
  static normalizeTranslationKey(text: string): string {
    return text
      .trim() // 去除前后空白
      .replace(/\s+/g, " ") // 压缩多个空白为单个空格
      .replace(/"/g, '\\"'); // 转义引号
  }

  static generateTranslationKey(filePath: string, text: string): string {
    // 使用原文案作为key，但先规范化
    return this.normalizeTranslationKey(text);
  }
}

// core/AstTransformer.ts - 收集引用时也使用相同规范化
if (n.Literal.check(keyArg) && typeof keyArg.value === "string") {
  const rawKey = keyArg.value;
  const normalizedKey = StringUtils.normalizeTranslationKey(rawKey);
  // 使用规范化后的key进行匹配
}
```

这样确保转换生成的翻译 key 和收集到的引用 key 格式完全一致，无用 key 检测才能正确工作。

### 第九步：AST 转换后的代码示例

**目标**：展示经过新 AST 转换逻辑处理后的代码结果

**转换前的代码**：

```typescript
// src/components/Header.tsx (转换前)
import React from "react";

export const Header = () => {
  return (
    <div>
      <h1>Welcome to our website</h1>
      <span>User Profile</span>
      <p>
        Hello {userName}, you have {count} messages
      </p>
    </div>
  );
};
```

**转换后的代码**：

```typescript
// src/components/Header.tsx (转换后)
import { headerTranslations } from "../translate/src/components/Header";
import { I18nUtil } from "@utils";
import React from "react";

export const Header = () => {
  const I18n = I18nUtil.createScoped(headerTranslations);

  return (
    <div>
      <h1>{I18n.t("Welcome to our website")}</h1>
      <span>{I18n.t("User Profile")}</span>
      <p>
        {I18n.t("Hello %{var0}, you have %{var1} messages", {
          var0: userName,
          var1: count,
        })}
      </p>
    </div>
  );
};
```

**生成的翻译文件**：

```typescript
// translate/src/components/Header/index.ts
export const headerTranslations = {
  en: {
    "Welcome to our website": "Welcome to our website",
    "User Profile": "User Profile",
    "Hello %{var0}, you have %{var1} messages":
      "Hello %{var0}, you have %{var1} messages",
  },
  "zh-CN": {
    "Welcome to our website": "欢迎来到我们的网站",
    "User Profile": "用户资料",
    "Hello %{var0}, you have %{var1} messages":
      "你好 %{var0}，你有 %{var1} 条消息",
  },
};
```

**关键变化点**：

1. **导入变化**：从单一的 `import { I18n } from "@utils"` 改为导入具体的翻译文件和工具类
2. **初始化变化**：组件开头添加 `const I18n = I18nUtil.createScoped(headerTranslations)`
3. **调用方式保持**：继续使用 `I18n.t("key")` 调用方式，但现在是 scoped 实例
4. **翻译 Key 变化**：从哈希值改为原文案
5. **文件结构变化**：翻译文件按模块路径组织

### 第十步：创建前端 I18n 工具类

**目标**：创建基于 URL 参数的 I18n 工具
**文件**：`demo/src/utils/i18n.ts`

**创建工具类**：

```typescript
interface ModuleTranslations {
  [locale: string]: { [key: string]: string };
}

class I18nUtil {
  static getCurrentLocale(): string {
    if (typeof window === "undefined") return "en"; // SSR支持
    const params = new URLSearchParams(window.location.search);
    return params.get("lang") || "en";
  }

  static createScoped(translations: ModuleTranslations) {
    const locale = this.getCurrentLocale();
    return {
      t: (key: string) => translations[locale]?.[key] || key,
    };
  }

  static switchLocale(newLocale: string): void {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", newLocale);
    window.location.href = url.toString();
  }
}

export { I18nUtil };
```

### 第十一步：测试和验证

**目标**：验证新功能正常工作

**测试步骤**：

1. 运行扫描流程，检查是否按正确顺序执行：
   - 先生成完整记录
   - 与远端同步
   - 检测无用 key 并二次确认
   - 最后生成模块化文件
2. 验证完整记录文件格式是否正确
3. 验证模块化翻译文件是否正确生成
4. 测试前端组件使用新的翻译文件
5. 验证语言切换功能
6. 确认无用 Key 检测基于新数据结构正常工作

### 第十二步：清理和优化

**目标**：清理临时代码，优化性能

**清理内容**：

1. 移除不再需要的旧翻译文件
2. 更新配置文件和文档
3. 添加错误处理和日志
4. 性能优化（如果需要）
5. 验证数据迁移的完整性

## 实施建议

1. **渐进测试**：每完成一个步骤都进行测试验证

## 重要注意事项

### 1. AST 转换的复杂性

新的 AST 转换逻辑比原来复杂得多，主要体现在：

- **智能导入计算**：需要根据当前文件路径计算翻译文件的相对导入路径
- **组件识别**：需要准确识别 React 组件定义位置，在正确的地方插入初始化代码
- **作用域管理**：确保 `const t = I18nUtil.createScoped()` 在组件作用域内正确放置
- **向后兼容**：需要同时支持新旧两种调用方式的检测

### 2. 路径计算挑战

```typescript
// 示例：当前文件在 src/components/Header.tsx
// 需要导入 translate/src/components/Header/index.ts
// 相对路径应该是 "../translate/src/components/Header"

// 但如果当前文件在 src/pages/home/index.tsx
// 需要导入 translate/src/pages/home/index.ts
// 相对路径应该是 "../../translate/src/pages/home"
```

路径计算逻辑需要考虑：

- 当前文件的嵌套深度
- translate 文件夹的相对位置
- 不同的项目结构布局

### 3. 潜在的实施风险

1. **代码生成错误**：复杂的 AST 操作可能产生语法错误的代码
2. **导入路径错误**：相对路径计算错误会导致运行时错误
3. **组件识别失败**：可能在错误的位置插入初始化代码
4. **性能影响**：新的转换逻辑比原来复杂，可能影响扫描速度

### 4. 测试建议

在实施过程中建议：

1. **小范围测试**：先在 1-2 个简单组件上测试转换逻辑
2. **手动验证**：仔细检查生成的代码是否正确
3. **编译验证**：确保转换后的代码能正常编译
4. **运行验证**：确保转换后的功能正常工作
5. **回滚方案**：保留原有逻辑作为备选方案

### 5. 简化的实施方案

由于不需要考虑向后兼容，实施方案大幅简化：

**统一实施**：直接实现完整的新模式

- Key 格式改造（原文案作为 Key）
- 模块化翻译文件生成
- AST 转换生成新的导入和初始化代码
- 保持 `I18n.t()` 调用方式不变

这样可以一次性完成所有改造，避免中间状态的复杂性。
