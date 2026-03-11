'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Code2, FolderOpen, FolderPlus, Folder, Search, X } from 'lucide-react';
import type { WorkspaceRoot } from '@/types/electron';

interface ProjectSwitcherProps {
  roots: WorkspaceRoot[];
  openRoots: WorkspaceRoot[];
  selectedRootPath: string | null;
  dirtyRootPaths: Set<string>;
  activeTerminalRoots: Set<string>;
  onSelect: (rootPath: string) => void;
  onOpenRoot: (rootPath: string) => void;
  onCloseRootTab: (rootPath: string) => void;
  onAddFolder: () => void;
  onRemoveRoot: (rootPath: string) => void;
  onOpenInVsCode: () => void;
}

export default function ProjectSwitcher({
  roots,
  openRoots,
  selectedRootPath,
  dirtyRootPaths,
  activeTerminalRoots,
  onSelect,
  onOpenRoot,
  onCloseRootTab,
  onAddFolder,
  onRemoveRoot,
  onOpenInVsCode,
}: ProjectSwitcherProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredRoots = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return roots;
    return roots.filter((root) => root.name.toLowerCase().includes(normalized) || root.path.toLowerCase().includes(normalized));
  }, [roots, search]);

  return (
    <div className="relative flex flex-col gap-3 rounded-[24px] border border-border-primary bg-card/90 px-4 py-3 shadow-sm backdrop-blur lg:flex-row lg:items-center">
      <button
        type="button"
        onClick={() => setPickerOpen((current) => !current)}
        aria-pressed={pickerOpen}
        className={`flex shrink-0 items-center gap-3 rounded-2xl border px-3 py-2 text-left transition active:scale-[0.98] ${
          pickerOpen
            ? 'border-primary/30 bg-primary/10'
            : 'border-border-primary bg-bg-secondary hover:border-primary/25 hover:bg-secondary active:bg-primary/10'
        }`}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Folder className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-text-muted">Workspace</p>
          <p className="text-sm font-medium text-foreground">{roots.length} projects</p>
        </div>
        <ChevronDown className={`ml-1 h-4 w-4 text-text-muted transition ${pickerOpen ? 'rotate-180' : ''}`} />
      </button>

      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
        {openRoots.map((root) => {
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
              <button
                type="button"
                onClick={() => onSelect(root.path)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl text-left active:scale-[0.99]"
              >
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
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onCloseRootTab(root.path);
                }}
                className="rounded-full p-1 text-text-muted opacity-0 transition hover:bg-secondary hover:text-foreground active:scale-[0.95] active:bg-primary/10 group-hover:opacity-100"
                title="Close tab"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenInVsCode}
          disabled={!selectedRootPath}
          className="inline-flex items-center gap-2 rounded-2xl border border-border-primary bg-bg-secondary px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:bg-secondary active:scale-[0.98] active:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Code2 className="h-4 w-4" />
          Open in VS Code
        </button>
        <button
          type="button"
          onClick={onAddFolder}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.98]"
        >
          <FolderPlus className="h-4 w-4" />
          Add Folder
        </button>
      </div>

      {pickerOpen && (
        <div className="absolute left-4 right-4 top-[calc(100%+0.5rem)] z-20 rounded-[24px] border border-border-primary bg-card p-4 shadow-xl lg:left-4 lg:right-auto lg:w-[440px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Open Project Tabs</p>
              <p className="text-xs text-text-secondary">Choose which projects stay visible at the top.</p>
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="rounded-full p-2 text-text-muted transition hover:bg-secondary hover:text-foreground"
              title="Close picker"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="mb-3 flex items-center gap-2 rounded-2xl border border-border-primary bg-input px-3 py-2 text-sm text-foreground">
            <Search className="h-4 w-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a project..."
              className="w-full bg-transparent outline-none placeholder:text-text-muted"
            />
          </label>

          <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
            {filteredRoots.map((root) => {
              const isOpen = openRoots.some((openRoot) => openRoot.path === root.path);
              const isActive = root.path === selectedRootPath;

              return (
                <div
                  key={root.path}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${
                    isActive ? 'border-primary/30 bg-primary/8' : 'border-border-primary bg-bg-secondary/60'
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <FolderOpen className="h-4 w-4" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenRoot(root.path);
                      setPickerOpen(false);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-medium text-foreground">{root.name}</div>
                    <div className="truncate text-xs text-text-secondary">{root.path}</div>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                      {root.source}
                    </span>
                    {root.source === 'custom' && (
                      <button
                    type="button"
                    onClick={() => onRemoveRoot(root.path)}
                    className="rounded-full p-1 text-text-muted transition hover:bg-secondary hover:text-foreground active:scale-[0.95] active:bg-primary/10"
                    title="Remove custom folder"
                  >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onOpenRoot(root.path);
                        setPickerOpen(false);
                      }}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
                        isOpen ? 'bg-bg-tertiary text-text-secondary' : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      {isOpen ? 'Open' : 'Show'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
