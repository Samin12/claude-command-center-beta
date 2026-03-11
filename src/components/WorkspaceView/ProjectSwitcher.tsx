'use client';

import { Code2, FolderPlus, Folder, X } from 'lucide-react';
import type { WorkspaceRoot } from '@/types/electron';

interface ProjectSwitcherProps {
  roots: WorkspaceRoot[];
  selectedRootPath: string | null;
  dirtyRootPaths: Set<string>;
  activeTerminalRoots: Set<string>;
  onSelect: (rootPath: string) => void;
  onAddFolder: () => void;
  onRemoveRoot: (rootPath: string) => void;
  onOpenInVsCode: () => void;
}

export default function ProjectSwitcher({
  roots,
  selectedRootPath,
  dirtyRootPaths,
  activeTerminalRoots,
  onSelect,
  onAddFolder,
  onRemoveRoot,
  onOpenInVsCode,
}: ProjectSwitcherProps) {
  return (
    <div className="flex flex-col gap-3 rounded-[24px] border border-border-primary bg-card/90 px-4 py-3 shadow-sm backdrop-blur lg:flex-row lg:items-center">
      <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border-primary bg-bg-secondary px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Folder className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">Workspace</p>
          <p className="text-sm font-medium text-foreground">{roots.length} projects</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
        {roots.map((root) => {
          const isActive = root.path === selectedRootPath;
          const isDirty = dirtyRootPaths.has(root.path);
          const hasTerminal = activeTerminalRoots.has(root.path);

          return (
            <div
              key={root.path}
              className={`group flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left transition ${
                isActive
                  ? 'border-primary/35 bg-primary/10 text-foreground shadow-sm'
                  : 'border-border-primary bg-bg-secondary/70 text-text-secondary hover:border-primary/25 hover:bg-secondary hover:text-foreground'
              }`}
            >
              <button type="button" onClick={() => onSelect(root.path)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <Folder className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-text-muted'}`} />
                <span className="max-w-[180px] truncate text-sm font-medium">{root.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                  isActive ? 'bg-primary/10 text-text-secondary' : 'bg-bg-tertiary text-text-muted'
                }`}>
                  {root.source}
                </span>
                {isDirty && <span className="h-2 w-2 rounded-full bg-primary" />}
                {hasTerminal && <span className="h-2 w-2 rounded-full bg-accent-cyan" />}
              </button>
              {root.source === 'custom' && (
                <button
                  type="button"
                  onClick={() => onRemoveRoot(root.path)}
                  className="rounded-full p-1 text-text-muted opacity-0 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                  title="Remove custom folder"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenInVsCode}
          disabled={!selectedRootPath}
          className="inline-flex items-center gap-2 rounded-2xl border border-border-primary bg-bg-secondary px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Code2 className="h-4 w-4" />
          Open in VS Code
        </button>
        <button
          type="button"
          onClick={onAddFolder}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          <FolderPlus className="h-4 w-4" />
          Add Folder
        </button>
      </div>
    </div>
  );
}
