import type { IUserInteraction, InteractionPolicy } from "./IUserInteraction";

/**
 * 自动交互策略 - 简化版本，移除复杂的策略配置
 */
export class AutoInteraction implements IUserInteraction {
  constructor(private policy: InteractionPolicy = {}) {}

  async selectKeysForDeletion(
    formattedUnusedKeys: string[]
  ): Promise<string[]> {
    // 默认策略：跳过删除
    const mode = this.policy.selectionMode ?? "skip";
    return mode === "all" ? formattedUnusedKeys : [];
  }

  async confirmDeletion(): Promise<boolean> {
    // 默认不自动确认删除
    return this.policy.autoConfirmDelete ?? false;
  }

  async confirmRemoteSync(): Promise<boolean> {
    return true;
  }
}
