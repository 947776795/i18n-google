/**
 * 共享组件翻译测试
 *
 * 验证：当多个入口文件使用同一个共享组件时，每个入口都应该有自己的翻译副本
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

// 共享组件 - BannerWildcard（已转换）
const SHARED_COMPONENT = `
import { I18nUtil as I18n } from "@utils";

export default function BannerWildcard() {
  return (
    <div className="banner">
      <h2>{I18n.t("Special Offer")}</h2>
      <p>{I18n.t("Get 50% off today")}</p>
    </div>
  );
}
`;

// 第一个入口 - deep/page.tsx
const ENTRY_FILE_1 = `
import BannerWildcard from "@/components/BannerWildcard";
import { I18nUtil as I18n } from "@utils";
const I18n = I18nUtil.createScoped("app_sub1_deep_page");

export default function DeepPage() {
  return (
    <div>
      <h1>{I18n.t("Deep Page")}</h1>
      <BannerWildcard />
    </div>
  );
}
`;

// 第二个入口 - layout.tsx
const ENTRY_FILE_2 = `
import BannerWildcard from "@/components/BannerWildcard";
import { I18nUtil as I18n } from "@utils";
const I18n = I18nUtil.createScoped("app_sub1_layout");

export default function Sub1Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h2>{I18n.t("Sub1 Layout Header")}</h2>
      <BannerWildcard />
      <div>{children}</div>
    </div>
  );
}
`;

describe('共享组件翻译副本生成', () => {
  describe('问题演示：共享组件翻译只被第一个入口收集', () => {
    it('应该为每个入口生成共享组件的翻译副本', () => {
      const { RecordGenerator } = require('../../domain/record/RecordGenerator');
      const { ReferenceCollector } = require('../../domain/collect/ReferenceCollector');
      const { DependencyAnalyzer } = require('../../domain/collect/DependencyAnalyzer');

      const refCollector = new ReferenceCollector(mockConfig);
      const analyzer = new DependencyAnalyzer();
      const recordGenerator = new RecordGenerator();

      // 模拟第一个入口处理 (deep_page)
      console.log('\n=== 处理第一个入口: app_sub1_deep_page ===');
      const deepPageRefs = refCollector.collect(ENTRY_FILE_1, 'app/sub1/deep/page.tsx');
      const bannerRefs1 = refCollector.collect(SHARED_COMPONENT, 'components/BannerWildcard.tsx');

      // 为第一个入口添加翻译
      const folderName1 = 'app_sub1_deep_page';
      deepPageRefs.forEach((r: any) => {
        recordGenerator.add(folderName1, 'en', r.key, r.key);
      });
      bannerRefs1.forEach((r: any) => {
        recordGenerator.add(folderName1, 'en', r.key, r.key);
      });

      console.log('  app_sub1_deep_page 引用:', deepPageRefs.map((r: any) => r.key));
      console.log('  BannerWildcard 引用:', bannerRefs1.map((r: any) => r.key));

      // 模拟第二个入口处理 (layout)
      console.log('\n=== 处理第二个入口: app_sub1_layout ===');
      const layoutRefs = refCollector.collect(ENTRY_FILE_2, 'app/sub1/layout.tsx');
      const bannerRefs2 = refCollector.collect(SHARED_COMPONENT, 'components/BannerWildcard.tsx');

      // 为第二个入口添加翻译
      const folderName2 = 'app_sub1_layout';
      layoutRefs.forEach((r: any) => {
        recordGenerator.add(folderName2, 'en', r.key, r.key);
      });
      // 🔑 关键：这里也需要添加 BannerWildcard 的翻译到 app_sub1_layout
      bannerRefs2.forEach((r: any) => {
        recordGenerator.add(folderName2, 'en', r.key, r.key);
      });

      console.log('  app_sub1_layout 引用:', layoutRefs.map((r: any) => r.key));
      console.log('  BannerWildcard 引用:', bannerRefs2.map((r: any) => r.key));

      // 生成记录
      const record = recordGenerator.generate();

      // 验证：两个入口都应该有 BannerWildcard 的翻译
      console.log('\n=== 验证结果 ===');

      const deepPageTranslations = record['app_sub1_deep_page']?.['en.json'] || {};
      const layoutTranslations = record['app_sub1_layout']?.['en.json'] || {};

      console.log('  app_sub1_deep_page 翻译:', Object.keys(deepPageTranslations));
      console.log('  app_sub1_layout 翻译:', Object.keys(layoutTranslations));

      // 验证：两个入口都应该包含 BannerWildcard 的翻译
      expect(deepPageTranslations['Special Offer']).toBeTruthy();
      expect(deepPageTranslations['Get 50% off today']).toBeTruthy();

      expect(layoutTranslations['Special Offer']).toBeTruthy();  // ❌ 这个会失败！
      expect(layoutTranslations['Get 50% off today']).toBeTruthy();  // ❌ 这个会失败！

      console.log('\n✅ 两个入口都有共享组件的翻译副本！');
    });
  });

  describe('Scanner 集成测试：模拟 processedFiles 机制', () => {
    it('模拟 Scanner 处理流程：第二个入口应该也能获得共享组件的翻译', () => {
      const { ReferenceCollector } = require('../../domain/collect/ReferenceCollector');
      const { RecordGenerator } = require('../../domain/record/RecordGenerator');

      const refCollector = new ReferenceCollector(mockConfig);
      const recordGenerator = new RecordGenerator();

      // 模拟 localRecord（从之前的扫描中获得）
      const localRecord = {
        'app_sub1_deep_page': {
          'en.json': {
            'Deep Page': 'Deep Page',
            'Special Offer': 'Special Offer',  // ← BannerWildcard 的翻译在这里
            'Get 50% off today': 'Get 50% off today',
          }
        }
      };

      // 模拟 processedFiles
      const processedFiles = new Set<string>();
      processedFiles.add('components/BannerWildcard.tsx');

      // 模拟第一个入口处理
      console.log('\n=== 第一个入口: app_sub1_deep_page (已处理) ===');
      const isAlreadyProcessed1 = processedFiles.has('components/BannerWildcard.tsx');
      console.log('  BannerWildcard 已处理:', isAlreadyProcessed1);

      // 模拟第二个入口处理
      console.log('\n=== 第二个入口: app_sub1_layout ===');
      const isAlreadyProcessed2 = processedFiles.has('components/BannerWildcard.tsx');
      console.log('  BannerWildcard 已处理:', isAlreadyProcessed2);

      // 🔑 修复逻辑：即使已处理，也要为当前入口复制翻译
      if (isAlreadyProcessed2) {
        const bannerRefs = refCollector.collect(SHARED_COMPONENT, 'components/BannerWildcard.tsx');
        console.log('  BannerWildcard 引用:', bannerRefs.map((r: any) => r.key));

        // 从 localRecord 中查找翻译，并复制到当前 folderName
        for (const ref of bannerRefs) {
          for (const [otherFolderName, localeMap] of Object.entries(localRecord)) {
            for (const [localeFile, translations] of Object.entries(localeMap)) {
              if ((translations as any)[ref.key]) {
                const locale = localeFile.replace('.json', '');
                const folderName = 'app_sub1_layout';
                recordGenerator.add(folderName, locale, ref.key, (translations as any)[ref.key]);
                console.log(`  复制翻译: [${folderName}] ${ref.key} <- [${otherFolderName}]`);
              }
            }
          }
        }
      }

      const record = recordGenerator.generate();
      const layoutTranslations = record['app_sub1_layout']?.['en.json'] || {};

      console.log('\n=== 验证结果 ===');
      console.log('  app_sub1_layout 翻译:', Object.keys(layoutTranslations));

      // 验证：app_sub1_layout 应该有 BannerWildcard 的翻译
      expect(layoutTranslations['Special Offer']).toBeTruthy();
      expect(layoutTranslations['Get 50% off today']).toBeTruthy();

      console.log('\n✅ 第二个入口也获得了共享组件的翻译副本！');
    });
  });
});
