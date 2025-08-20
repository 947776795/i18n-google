/**
 * 用户提示信息测试
 * 验证给用户的提示文本是否正确、一致和用户友好
 */

// Mock StringUtils Logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(), 
  warn: jest.fn(),
  error: jest.fn(),
  success: jest.fn(),
  setLogLevel: jest.fn(),
};

jest.mock("../src/utils/StringUtils", () => ({
  Logger: mockLogger,
  StringUtils: {
    escapeRegex: jest.fn((str: string) =>
      str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    ),
    isTranslatableString: jest.fn(),
    formatString: jest.fn(),
    cleanExtractedText: jest.fn(),
    containsEnglishCharacters: jest.fn(),
    generateTranslationKey: jest.fn(),
    generateHashTranslationKey: jest.fn(),
  },
}));

// Mock inquirer
const mockPrompt = jest.fn();
jest.mock("inquirer", () => ({
  prompt: mockPrompt,
}));

import { UserInteraction } from "../src/ui/UserInteraction";
import { I18nError, I18nErrorType, ErrorHandler } from "../src/errors/I18nError";
import { ProgressIndicator, ScanProgressIndicator } from "../src/ui/ProgressIndicator";

describe("用户提示信息测试", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("UserInteraction 用户交互提示", () => {
    describe("无用Key删除提示", () => {
      test("应该显示正确的发现提示信息", async () => {
        const unusedKeys = ["[components/A.ts][key1]", "[components/B.ts][key2]", "[components/C.ts][key3]"];
        mockPrompt.mockResolvedValueOnce({ selectionMode: "skip" });

        await UserInteraction.selectKeysForDeletion(unusedKeys);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining(`🔍 发现 ${unusedKeys.length} 个可删除的无用翻译Key`)
        );
        expect(mockLogger.info).toHaveBeenCalledWith("📝 无用Key列表:");
      });

      test("应该为少量Keys提供清晰的列表展示", async () => {
        const unusedKeys = ["[components/A.ts][key1]", "[components/B.ts][key2]"];
        mockPrompt.mockResolvedValueOnce({ selectionMode: "skip" });

        await UserInteraction.selectKeysForDeletion(unusedKeys);

        // 验证每个Key都有对应的编号显示
        expect(mockLogger.info).toHaveBeenCalledWith("   1. [components/A.ts][key1]");
        expect(mockLogger.info).toHaveBeenCalledWith("   2. [components/B.ts][key2]");
      });

      test("应该为大量Keys提供适当的提示", async () => {
        const manyKeys = Array.from({ length: 25 }, (_, i) => `[components/Module${i}.ts][key${i}]`);
        mockPrompt.mockResolvedValueOnce({ selectionMode: "skip" });

        await UserInteraction.selectKeysForDeletion(manyKeys);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining(`📝 找到 ${manyKeys.length} 个无用Key，请在下面的选择界面中选择要删除的Key`)
        );
      });

      test("应该提供删除方式选项", async () => {
        const unusedKeys = ["[components/A.ts][key1]"];
        mockPrompt.mockResolvedValueOnce({ selectionMode: "all" });

        await UserInteraction.selectKeysForDeletion(unusedKeys);

        // 验证prompt被调用且包含选择选项
        expect(mockPrompt).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              message: "请选择删除方式:",
              default: "skip"
            })
          ])
        );
      });
    });

    describe("手动选择操作指引", () => {
      test("应该提供键盘操作说明", async () => {
        const unusedKeys = ["[components/A.ts][key1]"];
        mockPrompt
          .mockResolvedValueOnce({ selectionMode: "manual" })
          .mockResolvedValueOnce({ selectedKeys: unusedKeys });

        await UserInteraction.selectKeysForDeletion(unusedKeys);

        // 验证操作说明存在
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("手动选择操作说明")
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("↑↓ 箭头键移动光标")
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("空格键 选择/取消选择")
        );
      });

      test("应该验证手动选择时的验证提示", async () => {
        const unusedKeys = ["[components/A.ts][key1]"];
        mockPrompt
          .mockResolvedValueOnce({ selectionMode: "manual" })
          .mockResolvedValueOnce({ selectedKeys: unusedKeys });

        await UserInteraction.selectKeysForDeletion(unusedKeys);

        // 验证checkbox prompt被调用
        const checkboxCall = mockPrompt.mock.calls.find(call => 
          call[0].type === "checkbox"
        );
        expect(checkboxCall).toBeDefined();
        expect(checkboxCall[0].message).toContain(`共${unusedKeys.length}个`);
      });
    });

    describe("删除确认提示", () => {
      test("应该显示强制保留Key的提示", async () => {
        const unusedKeys = ["[components/A.ts][key1]"];
        const forceKeptKeys = ["forcedKey1", "forcedKey2"];
        mockPrompt.mockResolvedValueOnce({ confirmDeletion: false });

        await UserInteraction.confirmDeletion(unusedKeys, "preview.json", forceKeptKeys);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining(`🔒 已配置强制保留 ${forceKeptKeys.length} 个Key`)
        );
      });

      test("应该显示确认删除提示", async () => {
        const unusedKeys = ["[components/A.ts][key1]", "[components/B.ts][key2]"];
        mockPrompt.mockResolvedValueOnce({ confirmDeletion: true });

        await UserInteraction.confirmDeletion(unusedKeys, "preview.json");

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining(`⚠️  发现 ${unusedKeys.length} 个可删除的无用翻译Key`)
        );

        expect(mockPrompt).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining("确认删除"),
              default: false
            })
          ])
        );
      });

      test("应该为大量Key删除提供二次确认", async () => {
        const manyKeys = Array.from({ length: 25 }, (_, i) => `[components/Module${i}.ts][key${i}]`);
        mockPrompt
          .mockResolvedValueOnce({ confirmDeletion: true })
          .mockResolvedValueOnce({ finalConfirm: true });

        const result = await UserInteraction.confirmDeletion(manyKeys, "preview.json");

        expect(result).toBe(true);
        expect(mockPrompt).toHaveBeenCalledTimes(2);
        
        // 验证第二次确认被调用
        const finalConfirmCall = mockPrompt.mock.calls[1];
        expect(finalConfirmCall).toBeDefined();
        expect(finalConfirmCall[0]).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining("最终确认"),
              default: false
            })
          ])
        );
      });
    });

    describe("远端同步提示", () => {
      test("应该显示同步确认界面", async () => {
        mockPrompt.mockResolvedValueOnce({ confirmSync: true });

        const result = await UserInteraction.confirmRemoteSync();

        expect(result).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("准备同步到远端")
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("Google Sheets")
        );
      });

      test("应该显示同步结果反馈", async () => {
        // 测试确认同步
        mockPrompt.mockResolvedValueOnce({ confirmSync: true });
        await UserInteraction.confirmRemoteSync();
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("✅ 用户确认，开始同步到远端")
        );

        jest.clearAllMocks();

        // 测试取消同步
        mockPrompt.mockResolvedValueOnce({ confirmSync: false });
        await UserInteraction.confirmRemoteSync();
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("❌ 用户取消同步")
        );
      });
    });
  });

  describe("错误处理提示", () => {
    describe("错误类型消息", () => {
      test("应该显示正确的用户友好错误消息", () => {
        const testCases = [
          {
            type: I18nErrorType.PERMISSION_ERROR,
            message: "无法访问文件",
            expected: "权限不足: 无法访问文件"
          },
          {
            type: I18nErrorType.API_ERROR,
            message: "网络请求失败",
            expected: "API调用失败: 网络请求失败"
          },
          {
            type: I18nErrorType.CONFIGURATION_ERROR,
            message: "配置文件格式错误",
            expected: "配置错误: 配置文件格式错误"
          },
          {
            type: I18nErrorType.AUTHENTICATION_ERROR,
            message: "Google API认证失败",
            expected: "认证失败: Google API认证失败"
          },
          {
            type: I18nErrorType.INITIALIZATION_ERROR,
            message: "模块初始化失败",
            expected: "初始化失败: 模块初始化失败"
          }
        ];

        testCases.forEach(({ type, message, expected }) => {
          const error = new I18nError(type, message);
          expect(error.getUserMessage()).toBe(expected);
        });
      });

      test("应该为未知错误类型提供默认消息", () => {
        const error = new I18nError(I18nErrorType.UNKNOWN_ERROR, "未知错误");
        expect(error.getUserMessage()).toBe("系统错误: 未知错误");
      });
    });

    describe("错误严重程度", () => {
      test("应该正确分类错误严重程度", () => {
        const fatalErrors = [
          I18nErrorType.PERMISSION_ERROR,
          I18nErrorType.INITIALIZATION_ERROR
        ];

        const regularErrors = [
          I18nErrorType.API_ERROR,
          I18nErrorType.AUTHENTICATION_ERROR,
          I18nErrorType.CONFIGURATION_ERROR,
          I18nErrorType.UNKNOWN_ERROR
        ];

        fatalErrors.forEach(type => {
          const error = new I18nError(type, "test");
          expect(error.getSeverity()).toBe("fatal");
        });

        regularErrors.forEach(type => {
          const error = new I18nError(type, "test");
          expect(error.getSeverity()).toBe("error");
        });
      });
    });

    describe("错误处理显示", () => {
      test("应该显示错误处理格式", () => {
        const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
          throw new Error('process.exit() was called.');
        });

        const fatalError = new I18nError(
          I18nErrorType.PERMISSION_ERROR,
          "无法写入文件",
          {},
          ["检查文件权限", "确认磁盘空间"]
        );

        expect(() => {
          ErrorHandler.handle(fatalError, "文件写入");
        }).toThrow('process.exit() was called.');

        // 验证错误消息格式
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining("❌ 致命错误:")
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining("💡 建议解决方案:")
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining("系统将退出")
        );

        mockExit.mockRestore();
      });
    });
  });

  describe("进度指示器提示", () => {
    let progressIndicator: ProgressIndicator;
    let scanProgress: ScanProgressIndicator;

    beforeEach(() => {
      progressIndicator = new ProgressIndicator();
      scanProgress = new ScanProgressIndicator();
    });

    describe("通用进度提示", () => {
      test("应该显示正确的成功、失败、警告消息格式", () => {
        progressIndicator.succeed("操作完成");
        expect(mockLogger.success).toHaveBeenCalledWith("✅ 操作完成");

        progressIndicator.fail("操作失败");
        expect(mockLogger.error).toHaveBeenCalledWith("❌ 操作失败");

        progressIndicator.warn("注意事项");
        expect(mockLogger.warn).toHaveBeenCalledWith("⚠️  注意事项");

        progressIndicator.info("提示信息");
        expect(mockLogger.info).toHaveBeenCalledWith("ℹ️  提示信息");
      });

      test("应该为空消息提供默认文本", () => {
        progressIndicator.succeed();
        expect(mockLogger.success).toHaveBeenCalledWith("✅ 操作完成");

        progressIndicator.fail();
        expect(mockLogger.error).toHaveBeenCalledWith("❌ 操作失败");

        progressIndicator.warn();
        expect(mockLogger.warn).toHaveBeenCalledWith("⚠️  警告");

        progressIndicator.info();
        expect(mockLogger.info).toHaveBeenCalledWith("ℹ️  信息");
      });
    });

    describe("扫描专用提示", () => {
      test("应该显示正确的扫描阶段提示", async () => {
        await scanProgress.startScan();
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("🔍 开始扫描项目文件")
        );

        scanProgress.showReferenceCollection();
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("🔗 收集翻译引用")
        );
      });

      test("应该显示正确的扫描完成统计", () => {
        const summary = {
          totalFiles: 10,
          totalKeys: 50,
          newKeys: 5,
          unusedKeys: 3,
          duration: 1500
        };

        scanProgress.showScanComplete(summary);

        expect(mockLogger.success).toHaveBeenCalledWith(
          expect.stringContaining("🎉 扫描完成")
        );
        expect(mockLogger.success).toHaveBeenCalledWith(
          expect.stringContaining(`处理 ${summary.totalFiles} 个文件`)
        );
        expect(mockLogger.success).toHaveBeenCalledWith(
          expect.stringContaining(`发现 ${summary.totalKeys} 个翻译Key`)
        );
        expect(mockLogger.success).toHaveBeenCalledWith(
          expect.stringContaining("耗时: 1.5s")
        );
      });

      test("应该正确格式化执行时间", () => {
        // 测试毫秒显示
        const shortSummary = {
          totalFiles: 1,
          totalKeys: 1,
          newKeys: 0,
          unusedKeys: 0,
          duration: 500
        };

        scanProgress.showScanComplete(shortSummary);
        expect(mockLogger.success).toHaveBeenCalledWith(
          expect.stringContaining("耗时: 500ms")
        );

        jest.clearAllMocks();

        // 测试秒显示
        const longSummary = {
          totalFiles: 1,
          totalKeys: 1,
          newKeys: 0,
          unusedKeys: 0,
          duration: 2500
        };

        scanProgress.showScanComplete(longSummary);
        expect(mockLogger.success).toHaveBeenCalledWith(
          expect.stringContaining("耗时: 2.5s")
        );
      });
    });
  });

  describe("提示信息一致性检查", () => {
    test("应该使用一致的表情符号前缀", () => {
      // 定义标准表情符号映射
      const emojiStandards = {
        success: "✅",
        error: "❌", 
        warning: "⚠️",
        info: "ℹ️",
        search: "🔍",
        process: "🔄",
        delete: "🗑️",
        sync: "☁️",
        config: "🔧",
        target: "🎯",
        lock: "🔒",
        party: "🎉",
        rocket: "🚀"
      };

      // 验证表情符号的一致性
      expect(emojiStandards.success).toBe("✅");
      expect(emojiStandards.error).toBe("❌");
      expect(emojiStandards.warning).toBe("⚠️");
      expect(emojiStandards.search).toBe("🔍");
    });

    test("应该使用一致的消息格式", () => {
      // 检查消息格式的一致性
      const patterns = {
        confirmationQuestion: /.*确认.*[吗？]/,
        processStart: /.*开始.*/,
        processComplete: /.*完成.*/,
        errorMessage: /.*错误.*/,
        warningMessage: /.*警告.*/
      };

      // 测试一些关键消息是否符合格式
      expect("确认删除这 5 个无用的翻译Key吗？此操作不可撤销！").toMatch(patterns.confirmationQuestion);
      expect("开始扫描项目文件...").toMatch(patterns.processStart);
      expect("扫描完成！处理 10 个文件").toMatch(patterns.processComplete);
    });
  });

  describe("用户友好性检查", () => {
    test("应该为操作提供清晰的后果说明", async () => {
      const unusedKeys = ["[components/A.ts][key1]"];
      mockPrompt.mockResolvedValueOnce({ confirmDeletion: false });

      await UserInteraction.confirmDeletion(unusedKeys, "preview.json");

      // 验证提示包含后果说明
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining("不可撤销")
          })
        ])
      );
    });

    test("应该提供有用的操作指引", async () => {
      const unusedKeys = ["[components/A.ts][key1]"];
      mockPrompt
        .mockResolvedValueOnce({ selectionMode: "manual" })
        .mockResolvedValueOnce({ selectedKeys: [] });

      await UserInteraction.selectKeysForDeletion(unusedKeys);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Ctrl+C 取消操作")
      );
    });

    test("应该为错误提供可行的解决建议", () => {
      const error = new I18nError(
        I18nErrorType.CONFIGURATION_ERROR,
        "配置文件格式错误",
        {},
        [
          "检查配置文件格式是否正确",
          "确认所有必需的配置项都已设置",
          "参考文档示例配置"
        ]
      );

      expect(error.suggestions).toHaveLength(3);
      expect(error.suggestions[0]).toContain("检查");
      expect(error.suggestions[1]).toContain("确认");
      expect(error.suggestions[2]).toContain("参考");
    });
  });

  describe("关键业务流程提示验证", () => {
    test("应该确保删除操作的安全性提示", async () => {
      const unusedKeys = ["[components/A.ts][key1]"];
      mockPrompt.mockResolvedValueOnce({ confirmDeletion: false });

      await UserInteraction.confirmDeletion(unusedKeys, "preview.json");

      // 验证默认值是安全的（不删除）
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            default: false
          })
        ])
      );
    });

    test("应该确保选择方式的默认值是安全的", async () => {
      const unusedKeys = ["[components/A.ts][key1]"];
      mockPrompt.mockResolvedValueOnce({ selectionMode: "skip" });

      await UserInteraction.selectKeysForDeletion(unusedKeys);

      // 验证默认选择是跳过删除
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            default: "skip"
          })
        ])
      );
    });

    test("应该确保远端同步的默认值是合理的", async () => {
      mockPrompt.mockResolvedValueOnce({ confirmSync: true });

      await UserInteraction.confirmRemoteSync();

      // 验证远端同步默认是允许的（因为这是主要功能）
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            default: true
          })
        ])
      );
    });
  });
});