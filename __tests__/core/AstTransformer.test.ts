import { AstTransformer } from "../../core/AstTransformer";
import type { I18nConfig } from "../../types";

describe("AstTransformer - Import Path Handling", () => {
  let transformer: AstTransformer;
  let mockConfig: I18nConfig;

  beforeEach(() => {
    mockConfig = {
      rootDir: "./demo/src",
      languages: ["en", "zh"],
      ignore: ["**/node_modules/**", "**/dist/**"],
      spreadsheetId: "test-sheet-id",
      sheetName: "test-sheet",
      keyFile: "test-key.json",
      startMarker: "//t",
      endMarker: "",
      include: ["**/*.{ts,tsx,js,jsx}"],
      outputDir: "./demo/src/translate",
      logLevel: "normal",
    };

    transformer = new AstTransformer(mockConfig);
  });

  describe("addTranslationImport - File Path Change Handling", () => {
    it("should replace old import with new import when file path changes", () => {
      // 模拟文件移动前的状态：原本在 profile 目录
      const sourceWithOldImport = `
import React from 'react';
import Translations from "@translate/components/profile/AuraReferral";
import { I18nUtil } from "@utils";

const I18n = I18nUtil.createScoped(Translations);

export const AuraReferral = () => {
  return (
    <div>
      {I18n.t("Analyze")}
      {I18n.t("Welcome to our platform")}
    </div>
  );
};
`.trim();

      // 文件现在在 aura 目录下
      const newFilePath = "./demo/src/components/aura/AuraReferral.tsx";

      // 执行转换（应该更新导入路径）
      const result = transformer.analyzeAndTransformSource(
        sourceWithOldImport,
        newFilePath
      );

      // 验证结果
      expect(result.transformedCode).toContain(
        'import Translations from "@translate/components/aura/AuraReferral";'
      );

      // 确保旧的导入被移除
      expect(result.transformedCode).not.toContain(
        'import Translations from "@translate/components/profile/AuraReferral";'
      );

      // 确保现有的I18n调用被正确识别
      expect(result.existingReferences).toHaveLength(2);
      expect(result.existingReferences[0].key).toBe("Analyze");
      expect(result.existingReferences[1].key).toBe("Welcome to our platform");

      // 文件路径应该更新为新路径
      expect(result.existingReferences[0].filePath).toBe(newFilePath);
      expect(result.existingReferences[1].filePath).toBe(newFilePath);

      // 应该没有新的翻译（因为都是现有的I18n调用）
      expect(result.newTranslations).toHaveLength(0);
    });

    it("should not duplicate imports when correct import already exists", () => {
      // 文件已经有正确的导入路径
      const sourceWithCorrectImport = `
import React from 'react';
import Translations from "@translate/components/aura/AuraReferral";
import { I18nUtil } from "@utils";

const I18n = I18nUtil.createScoped(Translations);

export const AuraReferral = () => {
  return <div>{I18n.t("Analyze")}</div>;
};
`.trim();

      const filePath = "./demo/src/components/aura/AuraReferral.tsx";

      const result = transformer.analyzeAndTransformSource(
        sourceWithCorrectImport,
        filePath
      );

      // 应该保持一个正确的导入，不重复
      const importLines = result.transformedCode
        .split("\n")
        .filter((line) =>
          line.includes('import Translations from "@translate/')
        );

      expect(importLines).toHaveLength(1);
      expect(importLines[0]).toContain(
        "@translate/components/aura/AuraReferral"
      );
    });

    it("should handle multiple old translation imports correctly", () => {
      // 模拟错误状态：有多个翻译导入
      const sourceWithMultipleImports = `
import React from 'react';
import Translations from "@translate/components/profile/AuraReferral";
import OtherTranslations from "@translate/components/old/AuraReferral";
import { I18nUtil } from "@utils";

const I18n = I18nUtil.createScoped(Translations);

export const AuraReferral = () => {
  return <div>{I18n.t("Analyze")}</div>;
};
`.trim();

      const filePath = "./demo/src/components/aura/AuraReferral.tsx";

      const result = transformer.analyzeAndTransformSource(
        sourceWithMultipleImports,
        filePath
      );

      // 应该只有一个正确的 Translations 导入
      const translationImports = result.transformedCode
        .split("\n")
        .filter((line) =>
          line.includes('import Translations from "@translate/')
        );

      expect(translationImports).toHaveLength(1);
      expect(translationImports[0]).toContain(
        "@translate/components/aura/AuraReferral"
      );

      // 其他不是 "Translations" 变量名的导入应该保留
      expect(result.transformedCode).toContain("import OtherTranslations");
    });

    it("should preserve non-translation imports", () => {
      const sourceWithMixedImports = `
import React from 'react';
import Translations from "@translate/components/profile/AuraReferral";
import { someUtil } from "@translate/utils/helper";
import { I18nUtil } from "@utils";
import axios from 'axios';

const I18n = I18nUtil.createScoped(Translations);

export const AuraReferral = () => {
  return <div>{I18n.t("Analyze")}</div>;
};
`.trim();

      const filePath = "./demo/src/components/aura/AuraReferral.tsx";

      const result = transformer.analyzeAndTransformSource(
        sourceWithMixedImports,
        filePath
      );

      // 应该保留非 Translations 的导入
      expect(result.transformedCode).toContain("import React from 'react'");
      expect(result.transformedCode).toContain(
        'import { someUtil } from "@translate/utils/helper"'
      );
      expect(result.transformedCode).toContain(
        'import { I18nUtil } from "@utils"'
      );
      expect(result.transformedCode).toContain("import axios from 'axios'");

      // 只更新 Translations 导入
      expect(result.transformedCode).toContain(
        "@translate/components/aura/AuraReferral"
      );
      expect(result.transformedCode).not.toContain(
        "@translate/components/profile/AuraReferral"
      );
    });

    it("should collect existing references with updated file path", () => {
      const sourceWithI18nCalls = `
import Translations from "@translate/components/profile/AuraReferral";
import { I18nUtil } from "@utils";

const I18n = I18nUtil.createScoped(Translations);

export const AuraReferral = () => {
  const title = I18n.t("Analyze your data");
  const subtitle = I18n.t(\`Welcome to analytics\`);
  
  return (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {I18n.t("Get started")}
    </div>
  );
};
`.trim();

      const newFilePath = "./demo/src/components/aura/AuraReferral.tsx";

      const result = transformer.analyzeAndTransformSource(
        sourceWithI18nCalls,
        newFilePath
      );

      // 应该找到3个现有引用
      expect(result.existingReferences).toHaveLength(3);

      // 验证每个引用的文件路径都更新为新路径
      result.existingReferences.forEach((ref) => {
        expect(ref.filePath).toBe(newFilePath);
      });

      // 验证具体的key
      const keys = result.existingReferences.map((ref) => ref.key).sort();
      expect(keys).toEqual([
        "Analyze your data",
        "Get started",
        "Welcome to analytics",
      ]);
    });
  });

  describe("Integration Test - Complete File Path Change Scenario", () => {
    it("should handle complete file relocation scenario", () => {
      // 完整的文件重定位场景测试
      const originalSource = `
import React from 'react';
import Translations from "@translate/components/profile/AuraReferral";
import { I18nUtil } from "@utils";

const I18n = I18nUtil.createScoped(Translations);

export const AuraReferral = () => {
  return (
    <div>
      <h1>{I18n.t("Analyze")}</h1>
      <p>New content to translate</p>
      {I18n.t("Existing text")}
    </div>
  );
};
`.trim();

      // 文件从 profile 移动到 aura 目录
      const newFilePath = "./demo/src/components/aura/AuraReferral.tsx";

      const result = transformer.analyzeAndTransformSource(
        originalSource,
        newFilePath
      );

      // 1. 导入路径应该更新
      expect(result.transformedCode).toContain(
        'import Translations from "@translate/components/aura/AuraReferral";'
      );
      expect(result.transformedCode).not.toContain(
        'import Translations from "@translate/components/profile/AuraReferral";'
      );

      // 2. 现有的I18n调用应该被识别
      expect(result.existingReferences).toHaveLength(2);
      expect(result.existingReferences.map((ref) => ref.key)).toContain(
        "Analyze"
      );
      expect(result.existingReferences.map((ref) => ref.key)).toContain(
        "Existing text"
      );

      // 3. 新的可翻译内容应该被转换
      expect(result.newTranslations).toHaveLength(1);
      expect(result.newTranslations[0].text).toBe("New content to translate");

      // 4. 所有引用的文件路径都应该是新路径
      result.existingReferences.forEach((ref) => {
        expect(ref.filePath).toBe(newFilePath);
      });

      // 5. 转换后的代码应该包含新的I18n调用
      expect(result.transformedCode).toContain("I18n.t(");
    });
  });
});
