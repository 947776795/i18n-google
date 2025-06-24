import inquirer from "inquirer";

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
      console.log(
        `🔒 已配置强制保留 ${forceKeptKeys.length} 个Key，将跳过删除:`
      );
      forceKeptKeys.forEach((key) => console.log(`   - ${key}`));
      console.log("");
    }

    console.log(`\n⚠️  发现 ${summary.totalKeys} 个可删除的无用翻译Key\n`);

    // 如果Key数量较少，直接显示
    if (summary.totalKeys <= 10) {
      console.log("📝 无用Key列表:");
      unusedKeys.forEach((key, index) => {
        console.log(`   ${index + 1}. ${key}`);
      });
      console.log("");
    } else {
      // 显示预览文件信息
      console.log(`\n📄 详细预览已生成: ${previewFilePath}`);
      console.log("   请查看文件内容，然后返回继续操作\n");

      // 等待用户查看文件
      await inquirer.prompt([
        {
          type: "input",
          name: "continue",
          message: "查看完预览文件后，按 Enter 继续...",
        },
      ]);
    }

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

    console.log(
      `\n🧹 发现 ${totalKeys} 个模块级无用Key，分布在 ${moduleCount} 个模块中\n`
    );

    // 显示详细信息
    console.log("📁 模块级无用Key详情:");
    Object.entries(moduleLevelUnusedKeys).forEach(
      ([modulePath, keys], index) => {
        console.log(`   ${index + 1}. ${modulePath} (${keys.length} 个key)`);
        if (keys.length <= 5) {
          keys.forEach((key) => console.log(`      - ${key}`));
        } else {
          keys.slice(0, 3).forEach((key) => console.log(`      - ${key}`));
          console.log(`      ... 还有 ${keys.length - 3} 个`);
        }
      }
    );
    console.log("");

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
    console.log("\n📊 删除摘要:");
    console.log(`   - 无用Key数量: ${unusedKeys.length}`);

    if (unusedKeys.length <= 5) {
      console.log("   - Key列表:");
      unusedKeys.forEach((key, index) => {
        console.log(`     ${index + 1}. ${key}`);
      });
    } else {
      console.log("   - 前5个Key:");
      unusedKeys.slice(0, 5).forEach((key, index) => {
        console.log(`     ${index + 1}. ${key}`);
      });
      console.log(`     ... 还有 ${unusedKeys.length - 5} 个`);
    }
    console.log("");
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
   * 显示删除进度和结果
   */
  static displayDeletionResult(result: {
    deletedKeys: string[];
    affectedLanguages: string[];
    duration: number;
    success: boolean;
    error?: string;
  }): void {
    console.log("\n" + "=".repeat(60));

    if (result.success) {
      console.log("🎉 删除操作完成！");
      console.log(`\n📊 删除统计:`);
      console.log(`   ✅ 成功删除: ${result.deletedKeys.length} 个Key`);
      console.log(`   🌐 影响语言: ${result.affectedLanguages.join(", ")}`);
      console.log(`   ⏱️  执行时间: ${this.formatDuration(result.duration)}`);

      if (result.deletedKeys.length <= 10) {
        console.log(`\n📝 已删除的Key:`);
        result.deletedKeys.forEach((key, index) => {
          console.log(`   ${index + 1}. ${key}`);
        });
      } else {
        console.log(`\n📝 已删除的Key (前10个):`);
        result.deletedKeys.slice(0, 10).forEach((key, index) => {
          console.log(`   ${index + 1}. ${key}`);
        });
        console.log(`   ... 还有 ${result.deletedKeys.length - 10} 个`);
      }
    } else {
      console.log("❌ 删除操作失败！");
      console.log(`\n💥 错误信息: ${result.error}`);
      console.log(`\n🔄 建议:`);
      console.log("   1. 检查文件权限");
      console.log("   2. 确认磁盘空间充足");
      console.log("   3. 稍后重试操作");
    }

    console.log("=".repeat(60) + "\n");
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
    console.log("\n" + "=".repeat(50));
    console.log("📊 扫描结果摘要");
    console.log("=".repeat(50));
    console.log(`📁 处理文件数: ${summary.totalFiles}`);
    console.log(`🔑 总翻译Key数: ${summary.totalKeys}`);
    console.log(`✨ 新增Key数: ${summary.newKeys}`);
    console.log(`🗑️  无用Key数: ${summary.unusedKeys}`);
    console.log(`⏱️  执行时间: ${this.formatDuration(summary.duration)}`);
    console.log("=".repeat(50));

    if (summary.unusedKeys > 0) {
      console.log(
        `\n⚠️  发现 ${summary.unusedKeys} 个无用的翻译Key，建议进行清理`
      );
    } else {
      console.log("\n✅ 所有翻译Key都在使用中，无需清理");
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
    console.log(`\n📄 ${description}: ${filePath}`);

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
        console.log("✅ 文件已打开");
      } catch (error) {
        console.warn("⚠️  无法打开文件，请手动查看");
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
