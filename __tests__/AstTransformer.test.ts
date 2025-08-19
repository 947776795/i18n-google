// Mock Logger to keep output clean
jest.mock("../src/utils/StringUtils", () => ({
  Logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setLogLevel: jest.fn(),
  },
  StringUtils: jest.requireActual("../src/utils/StringUtils").StringUtils,
}));

import path from "path";
import { AstTransformer } from "../src/core/AstTransformer";
import type { I18nConfig } from "../src/types";

const rootDir = path.join(process.cwd(), "proj", "src");
const abs = (p: string) => path.join(rootDir, p);

const baseConfig: I18nConfig = {
  rootDir,
  outputDir: path.join(process.cwd(), "test-translate"),
  include: ["ts", "tsx"],
  ignore: [],
  languages: ["en", "zh-Hans"],
  apiKey: "test",
  spreadsheetId: "sheet",
  sheetName: "Sheet1",
  keyFile: "key.json",
  startMarker: "/* I18N_START */",
  endMarker: "/* I18N_END */",
  forceKeepKeys: {},
};

describe("AstTransformer", () => {
  test("transformSource: 标记的字符串与模板、JSX文本均被转换并注入导入", () => {
    const transformer = new AstTransformer(baseConfig);
    const filePath = abs("components/Simple/index.tsx");
    const source = `
      import React from "react";
      export default function Simple({name}:{name:string}) {
        const already = I18n.t("Kept");
        return (
          <div>
            <div>/* I18N_START */Hello/* I18N_END */</div>
            <span>{\`/* I18N_START */Hi \${name}/* I18N_END */\`}</span>
            <p>Pure English Text</p>
          </div>
        );
      }
    `;

    const { results, transformedCode } = transformer.transformSource(
      source,
      filePath
    );

    // 至少包含3条新翻译（标记字面量、标记模板、JSX文本）
    expect(results.length).toBeGreaterThanOrEqual(3);

    // 导入添加
    expect(transformedCode).toContain(
      'import Translations from "@translate/components/Simple/index"'
    );
    expect(transformedCode).toContain('import { I18nUtil } from "@utils/i18n"');
    expect(transformedCode).toContain(
      "const I18n = I18nUtil.createScoped(Translations)"
    );

    // I18n.t 调用存在
    expect(transformedCode).toContain('I18n.t("Hello")');
    expect(transformedCode).toContain('I18n.t("Pure English Text")');
  });

  test("collectExistingI18nCalls: 收集字符串与模板字面量的 key", () => {
    const transformer = new AstTransformer(baseConfig);
    const filePath = abs("components/A.tsx");
    const source =
      `
      const a = I18n.t("KeyA");
      const b = I18n.t(` +
      "`KeyB`" +
      `);
      const c = I18n.t("KeyC", {x:1});
      const not = console.log("KeyA");
    `;
    const refs = transformer.collectExistingI18nCalls(source, filePath);
    const keys = refs.map((r) => r.key).sort();
    expect(keys).toEqual(["KeyA", "KeyB", "KeyC"].sort());
    // 位置信息应存在
    refs.forEach((r) => {
      expect(typeof r.lineNumber).toBe("number");
      expect(typeof r.columnNumber).toBe("number");
    });
  });

  test("analyzeAndTransformSource: 有新翻译时会对转换后代码进行二次收集", () => {
    const transformer = new AstTransformer(baseConfig);
    const filePath = abs("components/B.tsx");
    const source = `
      import React from "react";
      export default function B(){
        return <div>/* I18N_START */Welcome/* I18N_END */</div>;
      }
    `;
    const result = transformer.analyzeAndTransformSource(source, filePath);
    expect(result.newTranslations.length).toBe(1);
    // 二次收集后的 existingReferences 至少包含我们刚刚插入的 I18n.t
    expect(result.existingReferences.length).toBeGreaterThanOrEqual(1);
    expect(result.transformedCode).toContain('I18n.t("Welcome")');
  });

  test("analyzeAndTransformSource: 没有新翻译时修复错误的 @translate 导入路径", () => {
    const transformer = new AstTransformer(baseConfig);
    const filePath = abs("components/Header/index.tsx");
    const source = `
      import Translations from "@translate/components/Wrong/index";
      import { I18nUtil } from "@utils/i18n";
      const I18n = I18nUtil.createScoped(Translations);
      export default function H(){
        return <h1>{I18n.t("Title")}</h1>;
      }
    `;
    const result = transformer.analyzeAndTransformSource(source, filePath);
    // 无新翻译
    expect(result.newTranslations.length).toBe(0);
    // 修复为正确路径
    expect(result.transformedCode).toContain(
      'import Translations from "@translate/components/Header/index"'
    );
    expect(result.transformedCode).not.toContain(
      'import Translations from "@translate/components/Wrong/index"'
    );
  });
});
