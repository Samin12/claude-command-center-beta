import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { scanVault, readVaultFile } from '../services/obsidian-service';
import type { AppSettings } from '../types';

interface ObsidianHandlerDeps {
  getAppSettings: () => AppSettings;
  setAppSettings: (settings: AppSettings) => void;
  saveAppSettings: (settings: AppSettings) => void;
}

/**
 * Register IPC handlers for Obsidian vault browsing (multi-vault).
 */
export function registerObsidianHandlers(deps: ObsidianHandlerDeps): void {
  const { getAppSettings, setAppSettings, saveAppSettings } = deps;

  // Scan all registered vaults — returns per-vault file list + folder tree
  ipcMain.handle('obsidian:scan', async () => {
    const settings = getAppSettings();
    const vaultPaths = settings.obsidianVaultPaths || [];

    const vaults: Array<{
      vaultPath: string;
      name: string;
      files: ReturnType<typeof scanVault>['files'];
      tree: ReturnType<typeof scanVault>['tree'];
    }> = [];

    for (const vp of vaultPaths) {
      if (!fs.existsSync(vp)) continue;
      const { files, tree } = scanVault(vp);
      vaults.push({
        vaultPath: vp,
        name: path.basename(vp),
        files,
        tree,
      });
    }

    return { vaults };
  });

  // Read a single file — validate vaultPath is in registered list
  ipcMain.handle('obsidian:readFile', async (_event, filePath: string, vaultPath: string) => {
    const settings = getAppSettings();
    const vaultPaths = settings.obsidianVaultPaths || [];

    if (!vaultPaths.includes(vaultPath)) {
      return { error: 'Vault path not registered' };
    }

    return readVaultFile(filePath, vaultPath);
  });

  // Get vault configuration status
  ipcMain.handle('obsidian:getVaultInfo', async () => {
    const settings = getAppSettings();
    const vaultPaths = settings.obsidianVaultPaths || [];
    return {
      configured: vaultPaths.length > 0,
      vaultPaths,
    };
  });

  // Detect if a project folder is an Obsidian vault
  ipcMain.handle('obsidian:detectVault', async (_event, projectPath: string) => {
    try {
      const obsidianDir = path.join(projectPath, '.obsidian');
      if (fs.existsSync(obsidianDir) && fs.statSync(obsidianDir).isDirectory()) {
        return { detected: true, vaultPath: projectPath };
      }
      return { detected: false, vaultPath: null };
    } catch {
      return { detected: false, vaultPath: null };
    }
  });

  // Add a vault path to registered list
  ipcMain.handle('obsidian:addVault', async (_event, vaultPath: string) => {
    try {
      const settings = getAppSettings();
      const vaultPaths = settings.obsidianVaultPaths || [];

      if (vaultPaths.includes(vaultPath)) {
        return { success: true }; // Already registered
      }

      const updated = { ...settings, obsidianVaultPaths: [...vaultPaths, vaultPath] };
      setAppSettings(updated);
      saveAppSettings(updated);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Write content to a file — validate file is within a registered vault
  ipcMain.handle('obsidian:writeFile', async (_event, filePath: string, content: string, vaultPath: string) => {
    const settings = getAppSettings();
    const registeredPaths = settings.obsidianVaultPaths || [];

    if (!registeredPaths.includes(vaultPath)) {
      return { error: 'Vault path not registered' };
    }

    const fullPath = path.resolve(filePath);
    if (!fullPath.startsWith(path.resolve(vaultPath))) {
      return { error: 'File path is outside vault' };
    }

    try {
      fs.writeFileSync(fullPath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to write file' };
    }
  });

  // Remove a vault path from registered list
  ipcMain.handle('obsidian:removeVault', async (_event, vaultPath: string) => {
    try {
      const settings = getAppSettings();
      const vaultPaths = settings.obsidianVaultPaths || [];

      const updated = { ...settings, obsidianVaultPaths: vaultPaths.filter(p => p !== vaultPath) };
      setAppSettings(updated);
      saveAppSettings(updated);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
