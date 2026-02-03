/**
 * UI - UserPrompt
 * 用户提示模块 - 处理用户交互
 */

import { createInterface } from 'readline';

/**
 * 测试模式标志（用于自动确认）
 */
let TEST_MODE_AUTO_CONFIRM = false;

/**
 * 设置测试模式
 *
 * @param enabled 是否启用测试模式（启用后自动返回 true）
 */
export function setTestMode(enabled: boolean): void {
  TEST_MODE_AUTO_CONFIRM = enabled;
}

/**
 * 用户提示器
 *
 * 职责：处理用户交互，如确认删除操作
 */
export class UserPrompt {
  private rl: ReturnType<typeof createInterface> | null = null;
  /** 自动确认值：true=自动删除, false=自动保留, null=交互式询问 */
  private autoConfirm: boolean | null = null;

  constructor() {
    // 检查全局测试模式标志
    this.autoConfirm = TEST_MODE_AUTO_CONFIRM ? true : null;
  }

  /**
   * 设置自动确认（用于测试或 CLI 选项）
   *
   * @param value 自动确认值：true=自动删除, false=自动保留, null=交互式询问
   */
  setAutoConfirm(value: boolean | null): void {
    this.autoConfirm = value;
  }

  /**
   * 显示无用 keys 并询问用户是否删除
   *
   * @param unusedKeys 无用的 keys（格式化后的 [folderName][key]）
   * @returns 用户是否确认删除
   */
  async confirmDeleteUnusedKeys(unusedKeys: string[]): Promise<boolean> {
    if (unusedKeys.length === 0) {
      return false;
    }

    // 显示无用 keys
    this.showUnusedKeys(unusedKeys);

    // 自动确认模式
    if (this.autoConfirm !== null) {
      if (this.autoConfirm) {
        console.log('   [自动确认删除]');
        return true;
      } else {
        console.log('   [自动保留，跳过删除]');
        return false;
      }
    }

    // 询问用户
    return this.askYesNo('\n是否删除这些无用的 keys? (y/N): ');
  }

  /**
   * 显示无用 keys 列表
   *
   * @param unusedKeys 无用的 keys
   */
  showUnusedKeys(unusedKeys: string[]): void {
    const message = this.formatUnusedKeysMessage(unusedKeys);
    console.log(message);
  }

  /**
   * 格式化无用 keys 消息
   *
   * @param unusedKeys 无用的 keys（格式化后的 [folderName][key]）
   * @returns 格式化后的消息
   */
  formatUnusedKeysMessage(unusedKeys: string[]): string {
    if (unusedKeys.length === 0) {
      return '\n✅ 所有翻译 keys 都在使用中，无需清理';
    }

    let message = `\n🗑️ 检测到 ${unusedKeys.length} 个无用的翻译 keys:\n`;

    for (const unusedKey of unusedKeys) {
      // 解析格式: [folderName][key]
      const match = unusedKey.match(/^\[(.+)\]\[([^\]]+)\]$/);
      if (match) {
        const [, folderName, key] = match;
        message += `   📁 ${folderName}\n      🔑 ${key}\n`;
      } else {
        message += `   ${unusedKey}\n`;
      }
    }

    return message;
  }

  /**
   * 询问用户是/否问题
   *
   * @param question 问题文本
   * @returns 用户是否回答 yes
   */
  async askYesNo(question: string): Promise<boolean> {
    if (!this.rl) {
      this.rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }

    return new Promise<boolean>((resolve) => {
      this.rl!.question(question, (answer) => {
        const normalized = answer.trim().toLowerCase();
        resolve(normalized === 'y' || normalized === 'yes');
      });
    });
  }

  /**
   * 关闭 readline 接口
   */
  close(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}
