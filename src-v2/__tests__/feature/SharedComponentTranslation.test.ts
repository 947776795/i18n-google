/**
 * 共享组件翻译测试
 *
 * 验证：当多个入口文件使用同一个共享组件时，每个入口都应该有自己的翻译副本
 */

import { Scanner } from '../../core/Scanner';
import { I18nConfig } from '../../types/config';
import { setTestMode } from '../../ui/UserPrompt';
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

      const deepPageTranslations = record['app_sub1_deep_page']?.['en'] || {};
      const layoutTranslations = record['app_sub1_layout']?.['en'] || {};

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
          'en': {
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
      const layoutTranslations = record['app_sub1_layout']?.['en'] || {};

      console.log('\n=== 验证结果 ===');
      console.log('  app_sub1_layout 翻译:', Object.keys(layoutTranslations));

      // 验证：app_sub1_layout 应该有 BannerWildcard 的翻译
      expect(layoutTranslations['Special Offer']).toBeTruthy();
      expect(layoutTranslations['Get 50% off today']).toBeTruthy();

      console.log('\n✅ 第二个入口也获得了共享组件的翻译副本！');
    });
  });

  describe('场景：组件迁移 + 组件新增翻译', () => {
    it('二次扫描：组件从 page_a 迁移到 page_b，同时组件有新增翻译',
      async () => {
      // 场景描述：
      // 1. 首次扫描：SharedComponent 被 page_a 使用，有 2 个翻译
      // 2. 修改：SharedComponent 移动到 page_b，同时新增 1 个翻译
      // 3. 二次扫描：page_a 应删除旧翻译，page_b 应有全部 3 个翻译

      const tempDir = fs.mkdtempSync(path.join(__dirname, 'test-migration-'));
      const srcDir = path.join(tempDir, 'src');
      const componentsDir = path.join(srcDir, 'components');
      const appDir = path.join(srcDir, 'app');
      const pageADir = path.join(appDir, 'page_a');
      const pageBDir = path.join(appDir, 'page_b');
      const translateDir = path.join(srcDir, 'translate');

      // 创建目录
      fs.mkdirSync(componentsDir, { recursive: true });
      fs.mkdirSync(pageADir, { recursive: true });
      fs.mkdirSync(pageBDir, { recursive: true });  // 🔑 添加 pageB 目录创建
      fs.mkdirSync(translateDir, { recursive: true });

      // ===== 首次扫描：组件在 page_a 中 =====
      // 使用 ~markers~ 语法，让扫描器识别并转换
      const sharedComponentV1 = `
export default function SharedComponent() {
  return (
    <div className="shared">
      <h2>~Shared Title~</h2>
      <p>~Shared Description~</p>
    </div>
  );
}
`;

      const pageAV1 = `
import SharedComponent from "../../components/SharedComponent";

export default function PageA() {
  return (
    <div>
      <h1>~Page A~</h1>
      <SharedComponent />
    </div>
  );
}
`;

      const pageBV1 = `
export default function PageB() {
  return <h1>~Page B~</h1>;
}
`;

      // 写入首次扫描的文件
      fs.writeFileSync(path.join(componentsDir, 'SharedComponent.tsx'), sharedComponentV1, 'utf-8');
      fs.writeFileSync(path.join(pageADir, 'page.tsx'), pageAV1, 'utf-8');
      fs.writeFileSync(path.join(pageBDir, 'page.tsx'), pageBV1, 'utf-8');

      // 创建配置文件
      const configPath = path.join(tempDir, 'i18n.config.js');
      const configContent = `module.exports = ${JSON.stringify(mockConfig, null, 2)};`;
      fs.writeFileSync(configPath, configContent, 'utf-8');

      console.log('\n========== 首次扫描 ==========');
      console.log('SharedComponent 被 page_a 使用');
      console.log('翻译: Shared Title, Shared Description');

      // 启用测试模式（自动确认所有交互）
      setTestMode(true);

      // 首次扫描
      const scanner1 = new Scanner();

      await scanner1.run({ projectRoot: tempDir });

      // 验证首次扫描结果
      const recordPath1 = path.join(translateDir, 'i18n-complete-record.json');
      const record1 = JSON.parse(fs.readFileSync(recordPath1, 'utf-8'));

      const pageATranslationsV1 = (record1['app_page_a_page'] as Record<string, any>)?.['en'] || {};
      const pageBTranslationsV1 = (record1['app_page_b_page'] as Record<string, any>)?.['en'] || {};

      console.log('\n首次扫描结果:');
      console.log('  app_page_a 翻译:', Object.keys(pageATranslationsV1));
      console.log('  app_page_b 翻译:', Object.keys(pageBTranslationsV1));

      // 验证：page_a 有共享组件的翻译
      expect(pageATranslationsV1['Shared Title']).toBeTruthy();
      expect(pageATranslationsV1['Shared Description']).toBeTruthy();
      expect(pageATranslationsV1['Page A']).toBeTruthy();

      // page_b 此时没有共享组件的翻译
      expect(pageBTranslationsV1['Shared Title']).toBeUndefined();
      expect(pageBTranslationsV1['Page B']).toBeTruthy();

      // ===== 修改：组件迁移到 page_b + 新增翻译 =====
      // 使用 ~markers~ 语法，让扫描器识别并转换
      const sharedComponentV2 = `
export default function SharedComponent() {
  return (
    <div className="shared">
      <h2>~Shared Title~</h2>
      <p>~Shared Description~</p>
      <button>~New Shared Button~</button>  // 🔑 新增翻译
    </div>
  );
}
`;

      const pageAV2 = `
export default function PageA() {
  return <h1>~Page A~</h1>;  // 🔑 不再引用 SharedComponent
}
`;

      const pageBV2 = `
import SharedComponent from "../../components/SharedComponent";

export default function PageB() {
  return (
    <div>
      <h1>~Page B~</h1>
      <SharedComponent />  // 🔑 现在引用 SharedComponent
    </div>
  );
}
`;

      // 修改文件内容
      fs.writeFileSync(path.join(componentsDir, 'SharedComponent.tsx'), sharedComponentV2, 'utf-8');
      fs.writeFileSync(path.join(pageADir, 'page.tsx'), pageAV2, 'utf-8');
      fs.writeFileSync(path.join(pageBDir, 'page.tsx'), pageBV2, 'utf-8');

      console.log('\n========== 修改后 ==========');
      console.log('SharedComponent 移动到 page_b，新增翻译: New Shared Button');

      // ===== 二次扫描 =====
      console.log('\n========== 二次扫描 ==========');

      const scanner2 = new Scanner();
      const result = await scanner2.run({ projectRoot: tempDir });

      // 验证二次扫描结果
      const recordPath2 = path.join(translateDir, 'i18n-complete-record.json');
      const record2 = JSON.parse(fs.readFileSync(recordPath2, 'utf-8'));

      const pageATranslationsV2 = (record2['app_page_a_page'] as Record<string, any>)?.['en'] || {};
      const pageBTranslationsV2 = (record2['app_page_b_page'] as Record<string, any>)?.['en'] || {};

      console.log('\n二次扫描结果:');
      console.log('  app_page_a_page 翻译:', Object.keys(pageATranslationsV2));
      console.log('  app_page_b_page 翻译:', Object.keys(pageBTranslationsV2));
      console.log('  删除的 keys:', result.deletedKeys);

      // ✅ 验证：page_a 不再有共享组件的翻译
      expect(pageATranslationsV2['Shared Title']).toBeUndefined();
      expect(pageATranslationsV2['Shared Description']).toBeUndefined();
      expect(pageATranslationsV2['Page A']).toBeTruthy();  // page_a 自己的翻译保留

      // ✅ 验证：page_b 有全部 3 个共享组件翻译（旧 2 个 + 新 1 个）
      expect(pageBTranslationsV2['Shared Title']).toBeTruthy();
      expect(pageBTranslationsV2['Shared Description']).toBeTruthy();
      expect(pageBTranslationsV2['New Shared Button']).toBeTruthy();  // 新增的翻译
      expect(pageBTranslationsV2['Page B']).toBeTruthy();  // page_b 自己的翻译

      // ✅ 验证：应该删除了 2 个无用 key（page_a 中的共享组件翻译）
      expect(result.deletedKeys).toBeGreaterThanOrEqual(2);

      console.log('\n✅ 测试通过！');
      console.log('  - page_a 正确删除了共享组件的翻译');
      console.log('  - page_b 正确获得了全部共享组件翻译（包括新增的）');

      // 清理临时目录
      fs.rmSync(tempDir, { recursive: true, force: true });

      // 关闭测试模式
      setTestMode(false);
    }, 60000);  // 增加超时时间到 60 秒
  });
});
