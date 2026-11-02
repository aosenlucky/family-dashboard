import { createVaultStorage } from "../../src/features/diary/storage.js";
export const { readVault, writeVault } = createVaultStorage("family-private-diary-preview-v1");
