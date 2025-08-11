import type { IUserInteraction, InteractionPolicy } from "./IUserInteraction";

export class AutoInteraction implements IUserInteraction {
  constructor(private policy: InteractionPolicy = {}) {}

  async selectKeysForDeletion(
    formattedUnusedKeys: string[]
  ): Promise<string[]> {
    const mode = this.policy.selectionMode ?? "skip";
    if (mode === "all") return formattedUnusedKeys;
    if (mode === "manual") return formattedUnusedKeys; // 由上层再过滤
    return [];
  }

  async confirmDeletion(): Promise<boolean> {
    const confirm = this.policy.autoConfirmDelete ?? true;
    const finalConfirm = this.policy.autoFinalConfirm ?? true;
    return confirm && finalConfirm;
  }

  async confirmRemoteSync(): Promise<boolean> {
    return true;
  }
}
