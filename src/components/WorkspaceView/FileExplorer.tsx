'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  FileType2,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Music,
  Presentation,
  Search,
  Video,
} from 'lucide-react';
import type { WorkspaceNode } from '@/types/electron';
import { filterWorkspaceNodes } from './utils';

interface FileExplorerProps {
  tree: WorkspaceNode[];
  loading: boolean;
  selectedFilePath: string | null;
  dirtyFilePath: string | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelectFile: (path: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
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
  tree,
  loading,
  selectedFilePath,
  dirtyFilePath,
  searchQuery,
  onSearchChange,
  onSelectFile,
  searchInputRef,
}: FileExplorerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => (
    new Set(tree.filter((node) => node.type === 'directory').map((node) => node.path))
  ));
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredTree = useMemo(() => filterWorkspaceNodes(tree, deferredSearchQuery), [deferredSearchQuery, tree]);

  const togglePath = (nodePath: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(nodePath)) next.delete(nodePath);
      else next.add(nodePath);
      return next;
    });
  };

  const renderNode = (node: WorkspaceNode, depth = 0): React.ReactNode => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = node.path === selectedFilePath;
    const isDirty = node.path === dirtyFilePath;

    if (node.type === 'directory') {
      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => togglePath(node.path)}
            className={`flex w-full items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 text-left text-sm transition ${
              isSelected ? 'border-emerald-400/15 bg-emerald-400/8 text-white' : 'text-white/58 hover:bg-white/[0.045] hover:text-white/90'
            }`}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {isExpanded ? <FolderOpen className="h-4 w-4 text-emerald-300/90" /> : <Folder className="h-4 w-4 text-emerald-300/90" />}
            <span className="truncate">{node.name}</span>
          </button>
          {isExpanded && (node.children || []).map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    const Icon = getFileIcon(node.extension);
    return (
      <button
        key={node.path}
        type="button"
        onClick={() => onSelectFile(node.path)}
        className={`flex w-full items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-sm transition ${
          isSelected
            ? 'border-emerald-400/20 bg-emerald-400/10 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.05)]'
            : 'border-transparent text-white/58 hover:border-white/8 hover:bg-white/[0.045] hover:text-white/90'
        }`}
        style={{ paddingLeft: `${depth * 14 + 30}px` }}
      >
        <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-emerald-200' : 'text-white/40'}`} />
        <span className="truncate">{node.name}</span>
        {isDirty && <span className="ml-auto h-2 w-2 rounded-full bg-amber-500" />}
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-white/10 bg-[#0d1218]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="border-b border-white/8 px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/38">Files</h2>
          <span className="text-xs text-white/35">{tree.length} root items</span>
        </div>
        <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
          <Search className="h-4 w-4 text-white/35" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Filter filenames…"
            className="w-full bg-transparent outline-none placeholder:text-white/28"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-white/38">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/45">
            No files match this project or filter.
          </div>
        ) : (
          filteredTree.map((node) => renderNode(node))
        )}
      </div>
    </div>
  );
}
