/**
 * ImportManager 测试用例
 * 导入管理功能
 *
 * 规则：
 * - 入口文件（page.tsx/layout.tsx）：import { I18nUtil } from "@utils" + createScoped 初始化
 * - 非�口文件：import { I18nUtil as I18n } from "@utils"
 */

import { ImportManager } from '../../domain/transform/ImportManager';
import type { I18nConfig } from '../../types/config';

const mockConfig: I18nConfig = {
  rootDir: './src',
  languages: ['en', 'ko'],
  include: ['js', 'jsx', 'ts', 'tsx'],
  ignore: [],
  outputDir: './src/translate',
  startMarker: '~',
  endMarker: '~',
  logLevel: 'silent',
  spreadsheetId: 'test',
  sheetName: 'test',
  keyFile: 'test.json',
  apiKey: 'test',
};

describe('ImportManager', () => {
  let manager: ImportManager;

  beforeEach(() => {
    manager = new ImportManager(mockConfig);
  });

  describe('入口文件导入处理（page.tsx/layout.tsx）', () => {
    test('应该添加 I18nUtil 导入和 Scoped 初始化到 page.tsx', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/home/page.tsx', true);

      expect(result).toContain('import { I18nUtil } from "@utils"');
      expect(result).toContain('const I18n = I18nUtil.createScoped(');
      expect(result).toContain('app_home_page');
    });

    test('应该添加 I18nUtil 导入和 Scoped 初始化到 layout.tsx', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/layout.tsx', true);

      expect(result).toContain('import { I18nUtil } from "@utils"');
      expect(result).toContain('const I18n = I18nUtil.createScoped(');
      expect(result).toContain('app_layout');
    });

    test('应该为深层嵌套的 page.tsx 计算正确的 scoped 路径', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/shop/products/page.tsx', true);

      expect(result).toContain('import { I18nUtil } from "@utils"');
      expect(result).toContain('const I18n = I18nUtil.createScoped(');
      expect(result).toContain('app_shop_products_page');
    });

    test('应该移除旧的 I18nUtil 导入并添加新的', () => {
      const source = String.raw`
        import { I18nUtil } from "@utils/i18n";

        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/page.tsx', true);

      expect(result).toContain('import { I18nUtil } from "@utils"');
      expect(result).not.toContain('@utils/i18n"');
    });

    test('不应该重复添加 Scoped 初始化', () => {
      const source = String.raw`
        import { I18nUtil } from "@utils";

        const I18n = I18nUtil.createScoped('app_page');

        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/page.tsx', true);

      const matches = result.match(/const I18n = I18nUtil\.createScoped/g);
      expect(matches?.length).toBe(1);
    });

    test('应该在导入语句之后添加 Scoped 初始化', () => {
      const source = String.raw`
        import React from 'react';

        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/page.tsx', true);

      // 确认 import 在前面，const I18n 在后面
      const importIndex = result.indexOf('import { I18nUtil }');
      const scopedIndex = result.indexOf('const I18n = I18nUtil.createScoped');
      expect(importIndex).toBeLessThan(scopedIndex);
    });
  });

  describe('非入口文件导入处理（组件等）', () => {
    test('应该添加 I18nUtil as I18n 导入到普通组件', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/components/Header.tsx', true);

      expect(result).toContain('import { I18nUtil as I18n } from "@utils"');
      expect(result).not.toContain('const I18n = I18nUtil.createScoped');
    });

    test('应该添加 I18nUtil as I18n 导入到工具函数', () => {
      const source = String.raw`
        export function getText() {
          return I18n.t("Text");
        }
      `;

      const result = manager.manageImports(source, 'src/utils/text.ts', true);

      expect(result).toContain('import { I18nUtil as I18n } from "@utils"');
      expect(result).not.toContain('const I18n = I18nUtil.createScoped');
    });

    test('应该移除旧的 I18nUtil 导入并添加新的', () => {
      const source = String.raw`
        import { I18nUtil } from "@utils/i18n";

        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/components/Header.tsx', true);

      expect(result).toContain('import { I18nUtil as I18n } from "@utils"');
      expect(result).not.toContain('@utils/i18n"');
    });

    test('非入口文件不应该添加 Scoped 初始化', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/components/Header.tsx', true);

      expect(result).not.toContain('const I18n = I18nUtil.createScoped');
    });
  });

  describe('无 I18n 调用时的行为', () => {
    test('没有 I18n 调用时不应该添加导入', () => {
      const source = String.raw`
        function Component() {
          return <div>Hello World</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/page.tsx', true);

      expect(result).not.toContain('import');
      expect(result).not.toContain('const I18n');
    });

    test('没有 I18n 调用且 addImports=false 时应该返回原源码', () => {
      const source = String.raw`
        function Component() {
          return <div>Hello World</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/page.tsx', false);

      expect(result).toBe(source);
    });
  });

  describe('边界情况', () => {
    test('应该正确处理多个导入语句', () => {
      const source = String.raw`
        import React from 'react';
        import { useState } from 'react';
        import { useEffect } from 'react';

        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/page.tsx', true);

      // 应该只有一个 I18nUtil 导入
      const i18nUtilImports = result.match(/import \{ I18nUtil \}/g);
      expect(i18nUtilImports?.length).toBe(1);
    });

    test('应该保留其他非 I18n 相关的导入', () => {
      const source = String.raw`
        import React from 'react';
        import { Component } from './Component';

        function Test() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/components/Header.tsx', true);

      expect(result).toContain('import React from \'react\'');
      expect(result).toContain('import { Component } from \'./Component\'');
    });

    test('应该正确处理类型导入', () => {
      const source = String.raw`
        import type { ComponentProps } from './types';

        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/components/Header.tsx', true);

      expect(result).toContain('import type { ComponentProps }');
    });

    test('应该正确处理空文件', () => {
      const source = '';

      const result = manager.manageImports(source, 'src/app/page.tsx', false);

      expect(result).toBe('');
    });

    test('应该正确处理只有注释的文件', () => {
      const source = String.raw`
        // This is a comment
        /* This is a block comment */
      `;

      const result = manager.manageImports(source, 'src/app/page.tsx', false);

      expect(result).toBe(source);
    });
  });

  describe('路径计算测试', () => {
    test('根目录 page.tsx 应该生成正确的 scoped 路径', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/page.tsx', true);

      expect(result).toContain('"app_page"');
    });

    test('一级嵌套 page.tsx 应该生成正确的 scoped 路径', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/home/page.tsx', true);

      expect(result).toContain('"app_home_page"');
    });

    test('二级嵌套 page.tsx 应该生成正确的 scoped 路径', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/admin/users/page.tsx', true);

      expect(result).toContain('"app_admin_users_page"');
    });

    test('layout.tsx 应该生成正确的 scoped 路径', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/layout.tsx', true);

      expect(result).toContain('"app_layout"');
    });

    test('嵌套 layout.tsx 应该生成正确的 scoped 路径', () => {
      const source = String.raw`
        function Component() {
          return <div>{I18n.t("Welcome")}</div>;
        }
      `;

      const result = manager.manageImports(source, 'src/app/admin/layout.tsx', true);

      expect(result).toContain('"app_admin_layout"');
    });
  });
});
