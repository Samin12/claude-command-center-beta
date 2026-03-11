'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  FileType2,
  Folder,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  Music,
  Plus,
  Presentation,
  Search,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import type { WorkspaceNode } from '@/types/electron';
import { filterWorkspaceNodes } from './utils';

interface FileExplorerProps {
  rootPath: string | null;
  tree: WorkspaceNode[];
  loading: boolean;
  selectedFilePath: string | null;
  dirtyFilePath: string | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectFile: (path: string) => void;
  onCreateEntry: (parentPath: string, type: 'file' | 'directory', name: string) => void;
  onDeleteEntry: (targetPath: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
}

interface ExplorerContextMenuState {
  x: number;
  y: number;
  targetPath: string | null;
  parentPath: string | null;
  targetType: 'file' | 'directory' | 'root';
  targetName: string;
}

interface CreateEntryDialogState {
  parentPath: string;
  type: 'file' | 'directory';
}

interface DeleteEntryDialogState {
  targetPath: string;
  targetName: string;
  targetType: 'file' | 'directory';
}

function getFileIcon(extension?: string) {
  switch (extension) {
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.webp':
    case '.svg':
      return ImageIcon;
    case '.mp4':
    case '.mov':
    case '.webm':
      return Video;
    case '.mp3':
    case '.wav':
    case '.m4a':
      return Music;
    case '.ppt':
    case '.pptx':
    case '.key':
      return Presentation;
    case '.xls':
    case '.xlsx':
    case '.ods':
    case '.csv':
      return FileSpreadsheet;
    case '.json':
    case '.excalidraw':
    case '.excalidraw.json':
      return FileType2;
    default:
      return FileText;
  }
}

export default function FileExplorer({
  rootPath,
  tree,
  loading,
  selectedFilePath,
  dirtyFilePath,
  searchQuery,
  onSearchChange,
  onSelectFile,
  onCreateEntry,
  onDeleteEntry,
  searchInputRef,
}: FileExplorerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => (
    new Set(tree.filter((node) => node.type === 'directory').map((node) => node.path))
  ));
  const [contextMenu, setContextMenu] = useState<ExplorerContextMenuState | null>(null);
  const [createDialog, setCreateDialog] = useState<CreateEntryDialogState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteEntryDialogState | null>(null);
  const [entryName, setEntryName] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredTree = useMemo(() => filterWorkspaceNodes(tree, deferredSearchQuery), [deferredSearchQuery, tree]);

  useEffect(() => {
    if (!contextMenu) return;

    const closeMenu = () => setContextMenu(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  const togglePath = (nodePath: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(nodePath)) next.delete(nodePath);
      else next.add(nodePath);
      return next;
    });
  };

  const openContextMenu = (
    event: React.MouseEvent,
    targetType: 'file' | 'directory' | 'root',
    targetPath: string | null,
    parentPath: string | null,
    targetName: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      targetPath,
      parentPath,
      targetType,
      targetName,
    });
  };

  const requestCreateEntry = (parentPath: string, type: 'file' | 'directory') => {
    setContextMenu(null);
    setEntryName(type === 'file' ? 'untitled.md' : 'new-folder');
    setCreateDialog({ parentPath, type });
  };

  const requestDeleteEntry = (targetPath: string, targetName: string, targetType: 'file' | 'directory') => {
    setContextMenu(null);
    setDeleteDialog({ targetPath, targetName, targetType });
  };

  const handleConfirmCreate = () => {
    if (!createDialog) return;
    const trimmedName = entryName.trim();
    if (!trimmedName) return;
    onCreateEntry(createDialog.parentPath, createDialog.type, trimmedName);
    setCreateDialog(null);
    setEntryName('');
  };

  const handleConfirmDelete = () => {
    if (!deleteDialog) return;
    onDeleteEntry(deleteDialog.targetPath);
    setDeleteDialog(null);
  };

  const renderNode = (node: WorkspaceNode, depth = 0, parentPath: string | null = rootPath): React.ReactNode => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = node.path === selectedFilePath;
    const isDirty = node.path === dirtyFilePath;

    if (node.type === 'directory') {
      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => togglePath(node.path)}
            onContextMenu={(event) => openContextMenu(event, 'directory', node.path, node.path, node.name)}
            className={`flex w-full items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 text-left text-sm transition active:scale-[0.995] ${
              isSelected ? 'border-primary/20 bg-primary/10 text-foreground shadow-sm' : 'text-text-secondary hover:bg-secondary hover:text-foreground active:bg-primary/8'
            }`}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {isExpanded ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-primary" />}
            <span className="truncate">{node.name}</span>
          </button>
          {isExpanded && (node.children || []).map((child) => renderNode(child, depth + 1, node.path))}
        </div>
      );
    }

    const Icon = getFileIcon(node.extension);
    return (
      <button
        key={node.path}
        type="button"
        onClick={() => onSelectFile(node.path)}
        onContextMenu={(event) => openContextMenu(event, 'file', node.path, parentPath, node.name)}
        className={`flex w-full items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-sm transition active:scale-[0.995] ${
          isSelected
            ? 'border-primary/20 bg-primary/10 text-foreground shadow-sm'
            : 'border-transparent text-text-secondary hover:border-primary/10 hover:bg-secondary hover:text-foreground active:bg-primary/8'
        }`}
        style={{ paddingLeft: `${depth * 14 + 30}px` }}
      >
        <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : 'text-text-muted'}`} />
        <span className="truncate">{node.name}</span>
        {isDirty && <span className="ml-auto h-2 w-2 rounded-full bg-primary" />}
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-border-primary bg-card shadow-sm">
      <div className="border-b border-border-primary px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-text-muted">Files</h2>
          <span className="text-xs text-text-muted">{tree.length} root items</span>
        </div>
        <label className="flex items-center gap-2 rounded-2xl border border-border-primary bg-input px-3 py-2 text-sm text-foreground">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Filter filenames…"
            className="w-full bg-transparent outline-none placeholder:text-text-muted"
          />
        </label>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-auto p-3"
        onContextMenu={(event) => {
          if (!rootPath) return;
          openContextMenu(event, 'root', rootPath, rootPath, 'Workspace root');
        }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-primary bg-bg-secondary p-6 text-center text-sm text-text-secondary">
            No files match this project or filter.
          </div>
        ) : (
          filteredTree.map((node) => renderNode(node))
        )}

        {contextMenu?.parentPath && (
          <div
            className="fixed z-30 min-w-[220px] rounded-2xl border border-border-primary bg-card p-2 shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => requestCreateEntry(contextMenu.parentPath!, 'file')}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-secondary active:bg-primary/10"
            >
              <Plus className="h-4 w-4 text-primary" />
              New file
            </button>
            <button
              type="button"
              onClick={() => requestCreateEntry(contextMenu.parentPath!, 'directory')}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-secondary active:bg-primary/10"
            >
              <FolderPlus className="h-4 w-4 text-primary" />
              New folder
            </button>

            {contextMenu.targetPath && contextMenu.targetType !== 'root' && (
              <>
                <div className="my-2 h-px bg-border-primary" />
                <button
                  type="button"
                  onClick={() => requestDeleteEntry(
                    contextMenu.targetPath!,
                    contextMenu.targetName,
                    contextMenu.targetType === 'file' ? 'file' : 'directory'
                  )}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive transition hover:bg-destructive/8 active:bg-destructive/12"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete {contextMenu.targetType}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {createDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-border-primary bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {createDialog.type === 'file' ? 'Create New File' : 'Create New Folder'}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {createDialog.type === 'file'
                    ? 'Add a file to the selected location in this project.'
                    : 'Add a folder to the selected location in this project.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateDialog(null);
                  setEntryName('');
                }}
                className="rounded-full p-2 text-text-muted transition hover:bg-secondary hover:text-foreground active:scale-[0.96]"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleConfirmCreate();
              }}
              className="space-y-4"
            >
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">Name</span>
                <input
                  autoFocus
                  type="text"
                  value={entryName}
                  onChange={(event) => setEntryName(event.target.value)}
                  placeholder={createDialog.type === 'file' ? 'untitled.md' : 'new-folder'}
                  className="w-full rounded-2xl border border-border-primary bg-input px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </label>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateDialog(null);
                    setEntryName('');
                  }}
                  className="rounded-2xl border border-border-primary bg-bg-secondary px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!entryName.trim()}
                  className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createDialog.type === 'file' ? 'Create File' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-border-primary bg-card p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Delete {deleteDialog.targetType}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  This will permanently remove <span className="font-medium text-foreground">{deleteDialog.targetName}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteDialog(null)}
                className="rounded-full p-2 text-text-muted transition hover:bg-secondary hover:text-foreground active:scale-[0.96]"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteDialog(null)}
                className="rounded-2xl border border-border-primary bg-bg-secondary px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-2xl bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:opacity-90 active:scale-[0.98]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
