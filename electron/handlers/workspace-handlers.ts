import { ipcMain, shell } from 'electron';
import * as path from 'path';
import type { AppSettings } from '../types';
import {
  buildWorkspaceTree,
  createWorkspaceRoot,
  getWorkspaceFileMeta,
  getWorkspaceRoots,
  readWorkspaceFile,
  resolveApprovedWorkspacePath,
  writeWorkspaceFile,
} from '../services/workspace-service';

interface WorkspaceHandlerDeps {
  getAppSettings: () => AppSettings;
  setAppSettings: (settings: AppSettings) => void;
  saveAppSettings: (settings: AppSettings) => void;
}

export function registerWorkspaceHandlers(deps: WorkspaceHandlerDeps): void {
  const { getAppSettings, setAppSettings, saveAppSettings } = deps;

  ipcMain.handle('workspace:listRoots', async () => {
    return { roots: getWorkspaceRoots(getAppSettings()) };
  });

  ipcMain.handle('workspace:addRoot', async (_event, rootPath: string) => {
    try {
      const root = createWorkspaceRoot(rootPath);
      if (!root) {
        return { success: false, error: 'Selected folder is invalid' };
      }

      const currentSettings = getAppSettings();
      if (getWorkspaceRoots(currentSettings).some((existingRoot) => existingRoot.path === root.path)) {
        return { success: true, root };
      }
      const currentRoots = currentSettings.workspaceRoots || [];
      if (!currentRoots.includes(root.path)) {
        const nextSettings = { ...currentSettings, workspaceRoots: [...currentRoots, root.path] };
        setAppSettings(nextSettings);
        saveAppSettings(nextSettings);
      }

      return { success: true, root };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add folder' };
    }
  });

  ipcMain.handle('workspace:removeRoot', async (_event, rootPath: string) => {
    try {
      const currentSettings = getAppSettings();
      const nextRoots = (currentSettings.workspaceRoots || []).filter((entry) => entry !== rootPath);
      const nextSettings = { ...currentSettings, workspaceRoots: nextRoots };
      setAppSettings(nextSettings);
      saveAppSettings(nextSettings);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to remove folder' };
    }
  });

  ipcMain.handle('workspace:getTree', async (_event, rootPath: string) => {
    try {
      return { tree: buildWorkspaceTree(rootPath, getAppSettings()) };
    } catch (error) {
      return { tree: [], error: error instanceof Error ? error.message : 'Failed to load workspace tree' };
    }
  });

  ipcMain.handle('workspace:readFile', async (_event, filePath: string) => {
    try {
      return { file: readWorkspaceFile(filePath, getAppSettings()) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to read file' };
    }
  });

  ipcMain.handle('workspace:writeFile', async (_event, params: { filePath: string; content: string }) => {
    try {
      writeWorkspaceFile(params.filePath, params.content, getAppSettings());
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to save file' };
    }
  });

  ipcMain.handle('workspace:getFileMeta', async (_event, filePath: string) => {
    try {
      return { file: getWorkspaceFileMeta(filePath, getAppSettings()) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to load file metadata' };
    }
  });

  ipcMain.handle('workspace:openPath', async (_event, targetPath: string) => {
    try {
      const approved = resolveApprovedWorkspacePath(targetPath, getAppSettings());
      if (!approved) return { success: false, error: 'Access denied' };
      const error = await shell.openPath(approved.resolvedPath);
      return error ? { success: false, error } : { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to open path' };
    }
  });

  ipcMain.handle('workspace:revealPath', async (_event, targetPath: string) => {
    try {
      const approved = resolveApprovedWorkspacePath(targetPath, getAppSettings());
      if (!approved) return { success: false, error: 'Access denied' };
      shell.showItemInFolder(approved.resolvedPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reveal path' };
    }
  });

  ipcMain.handle('workspace:openInVsCode', async (_event, targetPath: string) => {
    try {
      const approved = resolveApprovedWorkspacePath(targetPath, getAppSettings());
      if (!approved) return { success: false, error: 'Access denied' };

      const normalizedPath = approved.resolvedPath.endsWith(path.sep)
        ? approved.resolvedPath
        : `${approved.resolvedPath}${path.sep}`;
      const projectUri = `vscode://file${encodeURI(normalizedPath)}`;
      await shell.openExternal(projectUri);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to open project in VS Code' };
    }
  });
}
