export type SelectionMode = "all" | "manual" | "skip";

export interface InteractionPolicy {
  selectionMode?: SelectionMode;
  autoConfirmDelete?: boolean;
  autoFinalConfirm?: boolean;
}

export interface IUserInteraction {
  selectKeysForDeletion(formattedUnusedKeys: string[]): Promise<string[]>;
  confirmDeletion(
    filteredFormattedKeys: string[],
    previewPath?: string,
    forceKeptKeys?: string[],
    options?: { testMode?: boolean }
  ): Promise<boolean>;
  confirmRemoteSync?(): Promise<boolean>;
}
