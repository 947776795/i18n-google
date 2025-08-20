import inquirer from "inquirer";
import { Logger } from "../utils/StringUtils";

export interface DeletionSummary {
  keysToDelete: string[];
  totalKeys: number;
  affectedLanguages: string[];
  previewFilePath?: string;
}

/**
 * 用户交互工具类 - 简化版本，仅保留核心功能
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
        return await UserInteraction.manualSelectKeys(formattedUnusedKeys);

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

    // 显示操作提示
    Logger.info("\n📝 手动选择操作说明:");
    Logger.info("   • 使用 ↑↓ 箭头键移动光标");
    Logger.info("   • 使用 空格键 选择/取消选择项目");
    Logger.info("   • 选择完成后按 回车键 确认");
    Logger.info("   • 按 Ctrl+C 取消操作\n");

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
   * 显示删除确认对话框
   */
  static async confirmDeletion(
    unusedKeys: string[],
    _previewFilePath: string,
    forceKeptKeys: string[] = []
  ): Promise<boolean> {
    // 显示强制保留信息
    if (forceKeptKeys.length > 0) {
      Logger.info(
        `🔒 已配置强制保留 ${forceKeptKeys.length} 个Key，将跳过删除:`
      );
      forceKeptKeys.forEach((key) => Logger.info(`   - ${key}`));
      Logger.info("");
    }

    Logger.info(`\n⚠️  发现 ${unusedKeys.length} 个可删除的无用翻译Key\n`);

    // 最终确认
    const { confirmDeletion } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmDeletion",
        message: `⚠️  确认删除这 ${unusedKeys.length} 个无用的翻译Key吗？此操作不可撤销！`,
        default: false,
      },
    ]);

    if (confirmDeletion) {
      // 二次确认（对于大量删除）
      if (unusedKeys.length > 20) {
        const { finalConfirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "finalConfirm",
            message: `🚨 最终确认：您即将删除 ${unusedKeys.length} 个翻译Key，确定继续吗？`,
            default: false,
          },
        ]);
        return finalConfirm;
      }
    }

    return confirmDeletion;
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
}