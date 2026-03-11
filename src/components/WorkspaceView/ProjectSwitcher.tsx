'use client';

import { FolderPlus, Folder, X } from 'lucide-react';
import type { WorkspaceRoot } from '@/types/electron';

interface ProjectSwitcherProps {
  roots: WorkspaceRoot[];
  selectedRootPath: string | null;
  dirtyRootPaths: Set<string>;
  activeTerminalRoots: Set<string>;
  onSelect: (rootPath: string) => void;
  onAddFolder: () => void;
  onRemoveRoot: (rootPath: string) => void;
}

export default function ProjectSwitcher({
  roots,
  selectedRootPath,
  dirtyRootPaths,
  activeTerminalRoots,
  onSelect,
  onAddFolder,
  onRemoveRoot,
}: ProjectSwitcherProps) {
  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-[22px] border border-white/10 bg-[#0b1016]/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur">
      <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <Folder className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/35">Workspace</p>
          <p className="text-sm font-medium text-white/85">{roots.length} projects</p>
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
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.08)]'
                  : 'border-white/8 bg-white/[0.03] text-white/60 hover:border-white/15 hover:bg-white/[0.05] hover:text-white/90'
              }`}
            >
              <button type="button" onClick={() => onSelect(root.path)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <Folder className={`h-4 w-4 shrink-0 ${isActive ? 'text-emerald-300' : 'text-white/45'}`} />
                <span className="max-w-[180px] truncate text-sm font-medium">{root.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                  isActive ? 'bg-white/10 text-white/55' : 'bg-white/[0.04] text-white/40'
                }`}>
                  {root.source}
                </span>
                {isDirty && <span className="h-2 w-2 rounded-full bg-amber-400" />}
                {hasTerminal && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
              </button>
              {root.source === 'custom' && (
                <button
                  type="button"
                  onClick={() => onRemoveRoot(root.path)}
                  className="rounded-full p-1 text-white/35 opacity-0 transition hover:bg-white/10 hover:text-white/70 group-hover:opacity-100"
                  title="Remove custom folder"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAddFolder}
        className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/12 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/18"
      >
        <FolderPlus className="h-4 w-4" />
        Add Folder
      </button>
    </div>
  );
}
