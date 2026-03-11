'use client';

import type { WorkspaceFile, WorkspaceNode } from '@/types/electron';

export function toLocalFileUrl(filePath: string): string {
  return `local-file://${encodeURI(filePath)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function getProjectName(projectPath: string): string {
  return projectPath.split(/[\\/]/).filter(Boolean).pop() || projectPath;
}

function flattenWorkspaceFiles(nodes: WorkspaceNode[]): WorkspaceNode[] {
  return nodes.flatMap((node) => {
    if (node.type === 'file') return [node];
    return flattenWorkspaceFiles(node.children || []);
  });
}

export function filterWorkspaceNodes(nodes: WorkspaceNode[], query: string): WorkspaceNode[] {
  if (!query.trim()) return nodes;
  const normalized = query.trim().toLowerCase();

  return nodes.flatMap((node) => {
    if (node.type === 'directory') {
      const children = filterWorkspaceNodes(node.children || [], normalized);
      if (node.name.toLowerCase().includes(normalized) || children.length > 0) {
        return [{ ...node, children }];
      }
      return [];
    }

    return node.name.toLowerCase().includes(normalized) ? [node] : [];
  });
}

export function canFormatAsJson(file: WorkspaceFile | null): boolean {
  if (!file) return false;
  return ['.json', '.excalidraw', '.excalidraw.json'].includes(file.extension);
}

const PREFERRED_FILENAMES = [
  'copy.md',
  'readme.md',
  'claude.md',
  'agents.md',
  'package.json',
  'index.html',
  'landing.html',
  'readme.txt',
];

const PREFERRED_EXTENSIONS = [
  '.md',
  '.txt',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.html',
  '.json',
  '.css',
  '.yml',
  '.yaml',
];

export function pickInitialWorkspaceFilePath(nodes: WorkspaceNode[]): string | null {
  const files = flattenWorkspaceFiles(nodes);
  if (!files.length) return null;

  const preferredByName = files.find((node) => PREFERRED_FILENAMES.includes(node.name.toLowerCase()));
  if (preferredByName) return preferredByName.path;

  const preferredByExtension = files.find((node) => node.extension && PREFERRED_EXTENSIONS.includes(node.extension));
  if (preferredByExtension) return preferredByExtension.path;

  return files[0].path;
}
