import type { IUserInteraction } from "./IUserInteraction";
import { UserInteraction } from "./UserInteraction";

export class InquirerInteractionAdapter implements IUserInteraction {
  async selectKeysForDeletion(
    formattedUnusedKeys: string[]
  ): Promise<string[]> {
    return UserInteraction.selectKeysForDeletion(formattedUnusedKeys);
  }

  async confirmDeletion(
    filteredFormattedKeys: string[],
    previewPath?: string,
    forceKeptKeys?: string[],
    options?: { testMode?: boolean }
  ): Promise<boolean> {
    return UserInteraction.confirmDeletion(
      filteredFormattedKeys,
      previewPath ?? "",
      forceKeptKeys ?? []
    );
  }

  async confirmRemoteSync(): Promise<boolean> {
    return UserInteraction.confirmRemoteSync();
  }
}
