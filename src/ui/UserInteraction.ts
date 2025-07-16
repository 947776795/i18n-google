import inquirer from "inquirer";
import { Logger } from "../utils/StringUtils";

export interface DeletionSummary {
  keysToDelete: string[];
  totalKeys: number;
  affectedLanguages: string[];
  previewFilePath?: string;
}

/**
 * 增强的用户交互工具类
 */
export class UserInteraction {
  /**
   * 用户选择要删除的无用Key（多选）
   * @param formattedUnusedKeys 格式化的无用Key列表 [模块路径][Key]
   * @returns 用户选择的Key列表
   */
  static async selectKeysForDeletion(
    formattedUnusedKeys: string[]
  ): Promise<string[]> {
    if (formattedUnusedKeys.length === 0) {
      return [];
    }

    Logger.info(
      `\n🔍 发现 ${formattedUnusedKeys.length} 个可删除的无用翻译Key\n`
    );

    // 如果Key数量很少，直接显示选项
    if (formattedUnusedKeys.length <= 20) {
      Logger.info("📝 无用Key列表:");
      formattedUnusedKeys.forEach((key, index) => {
        Logger.info(`   ${index + 1}. ${key}`);
      });
      Logger.info("");
    } else {
      Logger.info(
        `📝 找到 ${formattedUnusedKeys.length} 个无用Key，请在下面的选择界面中选择要删除的Key\n`
      );
    }

    // 提供选择选项
    const choices = [
      {
        name: `🗑️ 全部删除 (${formattedUnusedKeys.length} 个Key)`,
        value: "all",
      },
      {
        name: "🎯 手动选择要删除的Key",
        value: "manual",
      },
      {
        name: "❌ 跳过删除",
        value: "skip",
      },
    ];

    const { selectionMode } = await inquirer.prompt([
      {
        type: "list",
        name: "selectionMode",
        message: "请选择删除方式:",
        choices,
        default: "skip", // 默认选择跳过删除
      },
    ]);

    switch (selectionMode) {
      case "all":
        return formattedUnusedKeys;

      case "manual":
        return await this.manualSelectKeys(formattedUnusedKeys);

      case "skip":
        return [];

      default:
        return [];
    }
  }

  /**
   * 手动选择要删除的Key
   */
  private static async manualSelectKeys(
    formattedUnusedKeys: string[]
  ): Promise<string[]> {
    const pageSize = 15;

    // 为每个选项添加序号
    const choices = formattedUnusedKeys.map((key, index) => ({
      name: `${(index + 1).toString().padStart(3, " ")}. ${key}`,
      value: key,
      checked: false, // 默认不选中，让用户主动选择
    }));

    const { selectedKeys } = await inquirer.prompt({
      type: "checkbox",
      name: "selectedKeys",
      message: `请选择要删除的Key (共${formattedUnusedKeys.length}个`,
      choices,
      pageSize: pageSize, // 一次显示15个选项，可以用PageUp/PageDown翻页
      validate: (input: any) => {
        if (!input || input.length === 0) {
          return "请至少选择一个Key，或按 Ctrl+C 取消操作";
        }
        return true;
      },
    });

    if (selectedKeys.length > 0) {
      Logger.info(`\n✅ 已选择 ${selectedKeys.length} 个Key进行删除\n`);
    }

    return selectedKeys;
  }

  /**
   * 显示删除确认对话框（增强版）
   */
  static async confirmDeletion(
    unusedKeys: string[],
    previewFilePath: string,
    forceKeptKeys: string[] = []
  ): Promise<boolean> {
    const summary: DeletionSummary = {
      keysToDelete: unusedKeys,
      totalKeys: unusedKeys.length,
      affectedLanguages: [], // 在实际使用时填充
      previewFilePath,
    };

    // 显示强制保留信息
    if (forceKeptKeys.length > 0) {
      Logger.info(
        `🔒 已配置强制保留 ${forceKeptKeys.length} 个Key，将跳过删除:`,
        forceKeptKeys
      );
      forceKeptKeys.forEach((key) => Logger.info(`   - ${key}`));
      Logger.info("");
    }

    Logger.info(`\n⚠️  发现 ${summary.totalKeys} 个可删除的无用翻译Key\n`);

    // 最终确认
    const { confirmDeletion } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmDeletion",
        message: `⚠️  确认删除这 ${summary.totalKeys} 个无用的翻译Key吗？此操作不可撤销！`,
        default: false,
      },
    ]);

    if (confirmDeletion) {
      // 二次确认（对于大量删除）
      if (summary.totalKeys > 20) {
        const { finalConfirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "finalConfirm",
            message: `🚨 最终确认：您即将删除 ${summary.totalKeys} 个翻译Key，确定继续吗？`,
            default: false,
          },
        ]);
        return finalConfirm;
      }
    }

    return confirmDeletion;
  }

  /**
   * 确认模块级别的Key删除
   */
  static async confirmModuleLevelDeletion(moduleLevelUnusedKeys: {
    [modulePath: string]: string[];
  }): Promise<boolean> {
    const totalKeys = Object.values(moduleLevelUnusedKeys).reduce(
      (total, keys) => total + keys.length,
      0
    );
    const moduleCount = Object.keys(moduleLevelUnusedKeys).length;

    Logger.info(
      `\n🧹 发现 ${totalKeys} 个模块级无用Key，分布在 ${moduleCount} 个模块中\n`
    );

    // 显示详细信息
    Logger.info("📁 模块级无用Key详情:");
    Object.entries(moduleLevelUnusedKeys).forEach(
      ([modulePath, keys], index) => {
        Logger.info(`   ${index + 1}. ${modulePath} (${keys.length} 个key)`);
        if (keys.length <= 5) {
          keys.forEach((key) => Logger.info(`      - ${key}`));
        } else {
          keys.slice(0, 3).forEach((key) => Logger.info(`      - ${key}`));
          Logger.info(`      ... 还有 ${keys.length - 3} 个`);
        }
      }
    );
    Logger.info("");

    // 确认删除
    const { confirmDeletion } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmDeletion",
        message: `⚠️  确认从这些模块中删除无用的Key吗？此操作不可撤销！`,
        default: false,
      },
    ]);

    return confirmDeletion;
  }

  /**
   * 显示简要摘要
   */
  private static displayBriefSummary(unusedKeys: string[]): void {
    Logger.info("\n📊 删除摘要:");
    Logger.info(`   - 无用Key数量: ${unusedKeys.length}`);

    if (unusedKeys.length <= 5) {
      Logger.info("   - Key列表:");
      unusedKeys.forEach((key, index) => {
        Logger.info(`     ${index + 1}. ${key}`);
      });
    } else {
      Logger.info("   - 前5个Key:");
      unusedKeys.slice(0, 5).forEach((key, index) => {
        Logger.info(`     ${index + 1}. ${key}`);
      });
      Logger.info(`     ... 还有 ${unusedKeys.length - 5} 个`);
    }
    Logger.info("");
  }

  /**
   * 显示操作选项菜单
   */
  static async showActionMenu(
    unusedKeys: string[]
  ): Promise<"delete" | "preview" | "cancel"> {
    const choices = [
      {
        name: `🗑️  删除所有无用Key (${unusedKeys.length}个)`,
        value: "delete",
      },
      {
        name: "📄 生成详细预览文件",
        value: "preview",
      },
      {
        name: "❌ 取消操作",
        value: "cancel",
      },
    ];

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "请选择要执行的操作:",
        choices,
      },
    ]);

    return action;
  }

  /**
   * 确认是否上传到远端
   */
  static async confirmRemoteSync(): Promise<boolean> {
    Logger.info("\n" + "=".repeat(60));
    Logger.info("☁️  准备同步到远端 (Google Sheets)");
    Logger.info("=".repeat(60));

    const { confirmSync } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmSync",
        message: `🚀 确认将扫描后的翻译数据同步到远端 Google Sheets 吗？`,
        default: true,
      },
    ]);

    if (confirmSync) {
      Logger.info("✅ 用户确认，开始同步到远端...");
    } else {
      Logger.info("❌ 用户取消同步，跳过远端上传");
    }

    return confirmSync;
  }

  /**
   * 显示删除进度和结果
   */
  static displayDeletionResult(result: {
    deletedKeys: string[];
    affectedLanguages: string[];
    duration: number;
    success: boolean;
    error?: string;
  }): void {
    Logger.info("\n" + "=".repeat(60));

    if (result.success) {
      Logger.info("🎉 删除操作完成！");
      Logger.info(`\n📊 删除统计:`);
      Logger.info(`   ✅ 成功删除: ${result.deletedKeys.length} 个Key`);
      Logger.info(`   🌐 影响语言: ${result.affectedLanguages.join(", ")}`);
      Logger.info(`   ⏱️  执行时间: ${this.formatDuration(result.duration)}`);

      if (result.deletedKeys.length <= 10) {
        Logger.info(`\n📝 已删除的Key:`);
        result.deletedKeys.forEach((key, index) => {
          Logger.info(`   ${index + 1}. ${key}`);
        });
      } else {
        Logger.info(`\n📝 已删除的Key (前10个):`);
        result.deletedKeys.slice(0, 10).forEach((key, index) => {
          Logger.info(`   ${index + 1}. ${key}`);
        });
        Logger.info(`   ... 还有 ${result.deletedKeys.length - 10} 个`);
      }
    } else {
      Logger.error("❌ 删除操作失败！");
      Logger.error(`\n💥 错误信息: ${result.error}`);
      Logger.info(`\n🔄 建议:`);
      Logger.info("   1. 检查文件权限");
      Logger.info("   2. 确认磁盘空间充足");
      Logger.info("   3. 稍后重试操作");
    }

    Logger.info("=".repeat(60) + "\n");
  }

  /**
   * 显示扫描结果摘要
   */
  static displayScanSummary(summary: {
    totalFiles: number;
    totalKeys: number;
    newKeys: number;
    unusedKeys: number;
    duration: number;
  }): void {
    Logger.info("\n" + "=".repeat(50));
    Logger.info("📊 扫描结果摘要");
    Logger.info("=".repeat(50));
    Logger.info(`📁 处理文件数: ${summary.totalFiles}`);
    Logger.info(`🔑 总翻译Key数: ${summary.totalKeys}`);
    Logger.info(`✨ 新增Key数: ${summary.newKeys}`);
    Logger.info(`🗑️  无用Key数: ${summary.unusedKeys}`);
    Logger.info(`⏱️  执行时间: ${this.formatDuration(summary.duration)}`);
    Logger.info("=".repeat(50));

    if (summary.unusedKeys > 0) {
      Logger.warn(
        `\n⚠️  发现 ${summary.unusedKeys} 个无用的翻译Key，建议进行清理`
      );
    } else {
      Logger.info("\n✅ 所有翻译Key都在使用中，无需清理");
    }
  }

  /**
   * 等待用户操作
   */
  static async waitForUser(
    message: string = "按 Enter 继续..."
  ): Promise<void> {
    await inquirer.prompt([
      {
        type: "input",
        name: "continue",
        message,
      },
    ]);
  }

  /**
   * 显示文件路径并询问是否打开
   */
  static async offerToOpenFile(
    filePath: string,
    description: string
  ): Promise<boolean> {
    Logger.info(`\n📄 ${description}: ${filePath}`);

    const { shouldOpen } = await inquirer.prompt([
      {
        type: "confirm",
        name: "shouldOpen",
        message: "是否使用系统默认程序打开文件？",
        default: false,
      },
    ]);

    if (shouldOpen) {
      try {
        const { exec } = require("child_process");
        const command =
          process.platform === "darwin"
            ? "open"
            : process.platform === "win32"
            ? "start"
            : "xdg-open";
        exec(`${command} "${filePath}"`);
        Logger.info("✅ 文件已打开");
      } catch (error) {
        Logger.warn("⚠️  无法打开文件，请手动查看");
      }
    }

    return shouldOpen;
  }

  /**
   * 格式化持续时间
   */
  private static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(1);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * 清理屏幕（可选）
   */
  static clearScreen(): void {
    console.clear();
  }

  /**
   * 显示分隔线
   */
  static showSeparator(char: string = "-", length: number = 50): void {
    console.log(char.repeat(length));
  }
}
