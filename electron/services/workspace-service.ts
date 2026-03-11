import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MIME_TYPES } from '../constants';
import { decodeProjectPath } from '../utils/decode-project-path';
import type { AppSettings, WorkspaceFile, WorkspaceFileKind, WorkspaceFileMeta, WorkspaceNode, WorkspaceRoot } from '../types';

const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '__pycache__']);
const EDITABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.txt',
  '.yml', '.yaml', '.sh', '.xml', '.csv', '.excalidraw', '.excalidraw.json',
]);
const MARKDOWN_EXTENSIONS = new Set(['.md']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a']);
const DOCUMENT_EXTENSIONS = new Set(['.ppt', '.pptx', '.key', '.doc', '.docx']);
const SPREADSHEET_EXTENSIONS = new Set(['.xls', '.xlsx', '.ods']);
const MAX_INLINE_TEXT_BYTES = 2 * 1024 * 1024;

function safeRealPath(targetPath: string): string | null {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return null;
  }
}

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  return targetPath === rootPath || targetPath.startsWith(`${rootPath}${path.sep}`);
}

function sortRoots(roots: WorkspaceRoot[]): WorkspaceRoot[] {
  return roots.sort((a, b) => {
    if (a.source !== b.source) return a.source === 'claude' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function sortNodes(nodes: WorkspaceNode[]): WorkspaceNode[] {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  }).map((node) => ({
    ...node,
    children: node.children ? sortNodes(node.children) : undefined,
  }));
}

function getExtension(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.excalidraw.json')) return '.excalidraw.json';
  return path.extname(lower);
}

function getMimeType(filePath: string): string {
  const extension = getExtension(filePath);
  if (extension === '.md') return 'text/markdown';
  if (extension === '.txt' || extension === '.csv' || extension === '.sh' || extension === '.xml' || extension === '.yml' || extension === '.yaml') {
    return 'text/plain';
  }
  return MIME_TYPES[extension] || 'application/octet-stream';
}

function getFileKind(filePath: string): WorkspaceFileKind {
  const extension = getExtension(filePath);
  if (MARKDOWN_EXTENSIONS.has(extension)) return 'markdown';
  if (EDITABLE_EXTENSIONS.has(extension)) return 'text';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (extension === '.pdf') return 'pdf';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';
  if (SPREADSHEET_EXTENSIONS.has(extension)) return 'spreadsheet';
  return 'binary';
}

function isWritable(filePath: string): boolean {
  return EDITABLE_EXTENSIONS.has(getExtension(filePath));
}

function scanDirectory(dirPath: string, rootPath: string, visited = new Set<string>()): WorkspaceNode[] {
  const resolvedDir = safeRealPath(dirPath);
  if (!resolvedDir || visited.has(resolvedDir)) return [];
  visited.add(resolvedDir);

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: WorkspaceNode[] = [];

  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;

    const entryPath = path.join(dirPath, entry.name);
    const resolvedPath = safeRealPath(entryPath);
    if (!resolvedPath || !isWithinRoot(resolvedPath, rootPath)) continue;

    try {
      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: resolvedPath,
          type: 'directory',
          children: scanDirectory(resolvedPath, rootPath, visited),
        });
      } else if (stat.isFile()) {
        nodes.push({
          name: entry.name,
          path: resolvedPath,
          type: 'file',
          extension: getExtension(resolvedPath),
          size: stat.size,
        });
      }
    } catch {
      continue;
    }
  }

  return sortNodes(nodes);
}

function buildWorkspaceMeta(filePath: string, stat: fs.Stats): WorkspaceFileMeta {
  return {
    path: filePath,
    name: path.basename(filePath),
    extension: getExtension(filePath),
    mimeType: getMimeType(filePath),
    kind: getFileKind(filePath),
    size: stat.size,
    lastModified: stat.mtime.toISOString(),
    writable: isWritable(filePath),
  };
}

export function createWorkspaceRoot(rootPath: string): WorkspaceRoot | null {
  const resolved = safeRealPath(rootPath);
  if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return null;
  }
  return {
    path: resolved,
    name: path.basename(resolved),
    source: 'custom',
  };
}

export function getClaudeWorkspaceRoots(): WorkspaceRoot[] {
  const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(claudeProjectsDir)) return [];

  const seen = new Set<string>();
  const roots: WorkspaceRoot[] = [];

  for (const entry of fs.readdirSync(claudeProjectsDir)) {
    const decoded = decodeProjectPath(entry);
    const resolved = safeRealPath(decoded);
    if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) continue;
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    roots.push({
      path: resolved,
      name: path.basename(resolved),
      source: 'claude',
    });
  }

  return roots;
}

export function getWorkspaceRoots(settings: AppSettings): WorkspaceRoot[] {
  const seen = new Map<string, WorkspaceRoot>();

  for (const root of getClaudeWorkspaceRoots()) {
    seen.set(root.path, root);
  }

  for (const rootPath of settings.workspaceRoots || []) {
    const root = createWorkspaceRoot(rootPath);
    if (!root) continue;
    if (!seen.has(root.path)) seen.set(root.path, root);
  }

  return sortRoots(Array.from(seen.values()));
}

export function isApprovedWorkspaceRoot(rootPath: string, settings: AppSettings): boolean {
  const resolved = safeRealPath(rootPath);
  if (!resolved) return false;
  return getWorkspaceRoots(settings).some((root) => root.path === resolved);
}

export function resolveApprovedWorkspacePath(targetPath: string, settings: AppSettings): { resolvedPath: string; root: WorkspaceRoot } | null {
  const resolvedPath = safeRealPath(targetPath);
  if (!resolvedPath) return null;

  for (const root of getWorkspaceRoots(settings)) {
    if (isWithinRoot(resolvedPath, root.path)) {
      return { resolvedPath, root };
    }
  }

  return null;
}

export function buildWorkspaceTree(rootPath: string, settings: AppSettings): WorkspaceNode[] {
  const resolved = safeRealPath(rootPath);
  if (!resolved || !isApprovedWorkspaceRoot(resolved, settings)) {
    throw new Error('Workspace root is not approved');
  }
  return scanDirectory(resolved, resolved);
}

export function getWorkspaceFileMeta(filePath: string, settings: AppSettings): WorkspaceFileMeta {
  const approved = resolveApprovedWorkspacePath(filePath, settings);
  if (!approved) throw new Error('Access denied');

  const stat = fs.statSync(approved.resolvedPath);
  if (!stat.isFile()) throw new Error('Path is not a file');

  return buildWorkspaceMeta(approved.resolvedPath, stat);
}

export function readWorkspaceFile(filePath: string, settings: AppSettings): WorkspaceFile {
  const approved = resolveApprovedWorkspacePath(filePath, settings);
  if (!approved) throw new Error('Access denied');

  const stat = fs.statSync(approved.resolvedPath);
  if (!stat.isFile()) throw new Error('Path is not a file');

  const meta = buildWorkspaceMeta(approved.resolvedPath, stat);
  if ((meta.kind === 'text' || meta.kind === 'markdown') && stat.size <= MAX_INLINE_TEXT_BYTES) {
    return {
      ...meta,
      content: fs.readFileSync(approved.resolvedPath, 'utf-8'),
    };
  }

  return meta;
}

export function writeWorkspaceFile(filePath: string, content: string, settings: AppSettings): void {
  const approved = resolveApprovedWorkspacePath(filePath, settings);
  if (!approved) throw new Error('Access denied');
  if (!isWritable(approved.resolvedPath)) throw new Error('File type is read-only');

  fs.writeFileSync(approved.resolvedPath, content, 'utf-8');
}
