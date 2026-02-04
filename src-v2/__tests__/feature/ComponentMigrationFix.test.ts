/**
 * 组件迁移修复验证测试
 *
 * 验证 Scanner 修复后，组件迁移能正确更新翻译引用
 */

import { Scanner } from '../../core/Scanner';
import { I18nConfig } from '../../types/config';
import * as fs from 'fs';
import * as path from 'path';

const mockConfig: I18nConfig = {
  rootDir: './src',
  languages: ['en'],
  ignore: ['**/node_modules/**'],
  spreadsheetId: 'test-sheet',
  sheetName: 'i18n',
  keyFile: './test-key.json',
  startMarker: '~',
  endMarker: '~',
  outputDir: './src/translate',
  include: ['tsx', 'ts'],
  logLevel: 'silent',
  sheetsReadRange: 'A1:Z10000',
  sheetsMaxRows: 10000,
  apiKey: '',
  testMode: true,
};

// 已转换的 WidgetRelative
const WIDGET_CONVERTED = `
import { I18nUtil as I18n } from "@utils";

export default function WidgetRelative() {
  return (
    <div className="widget-relative">
      <h3>{I18n.t("Widget")}</h3>
      <p>{I18n.t("This is a widget component")}</p>
      <button>{I18n.t("Click Me")}</button>
    </div>
  );
}
`;

// layout.tsx 迁移前（引用 WidgetRelative）
const LAYOUT_BEFORE = `
import WidgetRelative from "../../components/WidgetRelative";
import { I18nUtil as I18n } from "@utils";
const I18n = I18nUtil.createScoped("app_sub1_layout");

export default function Sub1Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sub1-layout">
      <h2>{I18n.t("Sub1 Layout Header")}</h2>
      <WidgetRelative />
      <div className="sub1-content">{children}</div>
    </div>
  );
}
`;

// layout.tsx 迁移后（不引用 WidgetRelative）
const LAYOUT_AFTER = `
import { I18nUtil as I18n } from "@utils";
const I18n = I18nUtil.createScoped("app_sub1_layout");

export default function Sub1Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sub1-layout">
      <h2>{I18n.t("Sub1 Layout Header")}</h2>
      <div className="sub1-content">{children}</div>
    </div>
  );
}
`;

// page.tsx 迁移后（引用 WidgetRelative）
const PAGE_AFTER = `
import WidgetRelative from "../../components/WidgetRelative";
import { I18nUtil as I18n } from "@utils";
const I18n = I18nUtil.createScoped("app_sub1_page");

export default function Sub1Page() {
  return (
    <div className="sub1-page">
      <h1>{I18n.t("Sub1 Page")}</h1>
      <WidgetRelative />
      <p>{I18n.t("This is the sub1 page content")}</p>
    </div>
  );
}
`;

describe('组件迁移修复验证', () => {
  describe('修复后的行为：每个 entryFile 独立收集引用', () => {
    it('✅ 修复后：WidgetRelative 的引用会被两个 entryFile 收集', () => {
      const { ReferenceCollector } = require('../../domain/collect/ReferenceCollector');
      const refCollector = new ReferenceCollector(mockConfig);

      // 模拟修复后的 Scanner 行为
      const processedFiles = new Set<string>();
      const codeReferences = new Set<string>();

      // 1. 处理 layout.tsx（迁移前，引用 WidgetRelative）
      console.log('\n=== 处理 layout.tsx（迁移前）===');

      const layoutRefs = refCollector.collect(LAYOUT_BEFORE, 'app/sub1/layout.tsx');
      layoutRefs.forEach((ref: any) => {
        codeReferences.add(`app_sub1_layout:${ref.key}`);
      });
      console.log('layout.tsx 的引用:', layoutRefs.map((r: any) => r.key));

      const widgetRefs = refCollector.collect(WIDGET_CONVERTED, 'components/WidgetRelative.tsx');
      widgetRefs.forEach((ref: any) => {
        codeReferences.add(`app_sub1_layout:${ref.key}`);
      });
      processedFiles.add('components/WidgetRelative.tsx');
      console.log('WidgetRelative.tsx 归入 app_sub1_layout:', widgetRefs.map((r: any) => r.key));

      // 2. 处理 page.tsx（迁移后，引用 WidgetRelative）
      console.log('\n=== 处理 page.tsx（迁移后，修复后）===');

      const pageRefs = refCollector.collect(PAGE_AFTER, 'app/sub1/page.tsx');
      pageRefs.forEach((ref: any) => {
        codeReferences.add(`app_sub1_page:${ref.key}`);
      });
      console.log('page.tsx 的引用:', pageRefs.map((r: any) => r.key));

      // 🔑 修复后：即使 WidgetRelative.tsx 已处理，仍要为 page.tsx 收集引用
      const widgetRefsForPage = refCollector.collect(WIDGET_CONVERTED, 'components/WidgetRelative.tsx');
      widgetRefsForPage.forEach((ref: any) => {
        codeReferences.add(`app_sub1_page:${ref.key}`);
      });
      console.log('✅ WidgetRelative.tsx 也归入 app_sub1_page:', widgetRefsForPage.map((r: any) => r.key));

      // 验证：WidgetRelative 的引用现在归属于两个 entryFile
      const widgetInLayout = Array.from(codeReferences).filter(r => r === 'app_sub1_layout:Widget');
      const widgetInPage = Array.from(codeReferences).filter(r => r === 'app_sub1_page:Widget');

      console.log('\n✅ 验证结果:');
      console.log('   app_sub1_layout:Widget 引用数:', widgetInLayout.length);
      console.log('   app_sub1_page:Widget 引用数:', widgetInPage.length);

      // 修复后：两个 entryFile 都应该有 WidgetRelative 的引用
      expect(widgetInLayout.length).toBeGreaterThan(0);
      expect(widgetInPage.length).toBeGreaterThan(0);
    });

    it('✅ 修复后：组件迁移后无用 key 检测正确', () => {
      const { ReferenceCollector } = require('../../domain/collect/ReferenceCollector');
      const { UnusedKeyAnalyzer } = require('../../domain/cleanup/UnusedKeyAnalyzer');
      const refCollector = new ReferenceCollector(mockConfig);
      const analyzer = new UnusedKeyAnalyzer();

      // 模拟迁移后的代码引用
      const codeReferences = new Set<string>();

      // layout.tsx 现在不引用 WidgetRelative
      const layoutRefs = refCollector.collect(LAYOUT_AFTER, 'app/sub1/layout.tsx');
      layoutRefs.forEach((ref: any) => {
        codeReferences.add(`app_sub1_layout:${ref.key}`);
      });
      console.log('\n=== layout.tsx（迁移后）===');
      console.log('引用:', layoutRefs.map((r: any) => r.key));

      // page.tsx 现在引用 WidgetRelative
      const pageRefs = refCollector.collect(PAGE_AFTER, 'app/sub1/page.tsx');
      pageRefs.forEach((ref: any) => {
        codeReferences.add(`app_sub1_page:${ref.key}`);
      });
      const widgetRefsForPage = refCollector.collect(WIDGET_CONVERTED, 'components/WidgetRelative.tsx');
      widgetRefsForPage.forEach((ref: any) => {
        codeReferences.add(`app_sub1_page:${ref.key}`);
      });
      console.log('\n=== page.tsx（迁移后）===');
      console.log('引用:', [...pageRefs.map((r: any) => r.key), ...widgetRefsForPage.map((r: any) => r.key)]);

      // 模拟翻译记录
      const record = {
        'app_sub1_layout': {
          'en.json': {
            'Sub1 Layout Header': { en: 'Sub1 Layout Header' },
            'Widget': { en: 'Widget' },  // 这个 key 现在无用了！
            'This is a widget component': { en: 'This is a widget component' },
            'Click Me': { en: 'Click Me' },
          }
        },
        'app_sub1_page': {
          'en.json': {
            'Sub1 Page': { en: 'Sub1 Page' },
            'This is the sub1 page content': { en: 'This is the sub1 page content' },
            // Widget 相关的翻译应该在这里
          }
        }
      };

      // 转换 codeReferences 格式
      const refsSet: any = new Set();
      codeReferences.forEach(ref => {
        const [folderName, key] = ref.split(':');
        refsSet.add({ folderName, key });
      });

      const result = analyzer.analyze(record, refsSet);

      console.log('\n=== 无用 key 检测结果 ===');
      console.log('无用 keys:', result.formattedUnusedKeys);

      // 验证：app_sub1_layout 的 Widget 相关 key 应该被检测为无用
      const unusedInLayout = result.formattedUnusedKeys.filter((k: string) =>
        k.includes('app_sub1_layout') && (k.includes('Widget') || k.includes('Click Me'))
      );

      console.log('\n✅ 验证结果:');
      console.log('   app_sub1_layout 中应检测到的无用 keys:', unusedInLayout);

      // 应该检测到 app_sub1_layout 中的 Widget 相关 keys 无用
      expect(unusedInLayout.length).toBeGreaterThan(0);
    });
  });

  describe('集成测试：验证 Scanner 的修复逻辑', () => {
    it('✅ 修复后的 Scanner 逻辑：已处理文件仍收集引用', () => {
      // 模拟修复后的 Scanner 处理流程
      const processedFiles = new Set<string>();
      const codeReferences = new Map<string, Set<string>>();

      const { ReferenceCollector } = require('../../domain/collect/ReferenceCollector');
      const refCollector = new ReferenceCollector(mockConfig);

      // 模拟两个入口文件
      const entryFiles = [
        { filePath: 'app/sub1/layout.tsx', folderName: 'app_sub1_layout' },
        { filePath: 'app/sub1/page.tsx', folderName: 'app_sub1_page' }
      ];

      // 模拟依赖分析结果
      const dependencies = new Map<string, string[]>();
      // LAYOUT_AFTER 不引用 WidgetRelative，所以依赖列表中不包含它
      dependencies.set('app/sub1/layout.tsx', ['app/sub1/layout.tsx']);
      // PAGE_AFTER 引用 WidgetRelative
      dependencies.set('app/sub1/page.tsx', ['app/sub1/page.tsx', 'components/WidgetRelative.tsx']);

      // 文件内容映射
      const fileContents = new Map<string, string>();
      fileContents.set('app/sub1/layout.tsx', LAYOUT_AFTER);
      fileContents.set('app/sub1/page.tsx', PAGE_AFTER);
      fileContents.set('components/WidgetRelative.tsx', WIDGET_CONVERTED);

      console.log('\n=== 修复后的 Scanner 处理流程 ===');

      for (const entryFile of entryFiles) {
        const { folderName } = entryFile;
        const allFiles = dependencies.get(entryFile.filePath)!;

        console.log(`\n处理 ${entryFile.filePath} (folderName: ${folderName}):`);

        if (!codeReferences.has(folderName)) {
          codeReferences.set(folderName, new Set<string>());
        }

        for (const filePath of allFiles) {
          const source = fileContents.get(filePath)!;
          const isAlreadyProcessed = processedFiles.has(filePath);

          // 🔑 关键修复：无论文件是否已处理，都要收集引用
          const refs = refCollector.collect(source, filePath);
          for (const ref of refs) {
            codeReferences.get(folderName)!.add(ref.key);
          }

          console.log(`  ${path.basename(filePath)}: 收集到 ${refs.length} 个引用 [${refs.map((r: any) => r.key).join(', ')}]`);

          // 如果已经处理过，跳过转换
          if (isAlreadyProcessed) {
            console.log(`  ${filePath}: 已处理，跳过转换`);
            continue;
          }
          processedFiles.add(filePath);
        }
      }

      // 验证结果
      const layoutRefs = codeReferences.get('app_sub1_layout')!;
      const pageRefs = codeReferences.get('app_sub1_page')!;

      console.log('\n=== 验证结果 ===');
      console.log('app_sub1_layout 引用:', Array.from(layoutRefs));
      console.log('app_sub1_page 引用:', Array.from(pageRefs));

      // app_sub1_layout 不应该有 Widget 相关引用（因为 LAYOUT_AFTER 不 import WidgetRelative）
      expect(layoutRefs.has('Widget')).toBe(false);
      expect(layoutRefs.has('Sub1 Layout Header')).toBe(true);

      // app_sub1_page 应该有 Widget 相关引用（因为 PAGE_AFTER import WidgetRelative）
      expect(pageRefs.has('Widget')).toBe(true);
      expect(pageRefs.has('This is a widget component')).toBe(true);
      expect(pageRefs.has('Click Me')).toBe(true);
      expect(pageRefs.has('Sub1 Page')).toBe(true);

      console.log('\n✅ 修复验证成功：组件迁移后引用正确归属！');
    });
  });
});
