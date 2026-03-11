'use client';

import { useMemo, useState } from 'react';
import { Copy, Eye, ExternalLink, Folder, Pencil, Save, Sparkles } from 'lucide-react';
import type { WorkspaceFile } from '@/types/electron';
import { canFormatAsJson, formatBytes } from './utils';
import { CodeTextViewer, MarkdownFileViewer, MediaViewer, MetadataViewer } from './viewers';

interface EditorPaneProps {
  file: WorkspaceFile | null;
  draftContent: string;
  isDirty: boolean;
  isSaving: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onOpenPath: (path: string) => void;
  onRevealPath: (path: string) => void;
}

export default function EditorPane({
  file,
  draftContent,
  isDirty,
  isSaving,
  onDraftChange,
  onSave,
  onOpenPath,
  onRevealPath,
}: EditorPaneProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  const canFormat = useMemo(() => canFormatAsJson(file), [file]);
  const resolvedMode = file?.writable ? mode : 'preview';

  const handleCopyPath = async () => {
    if (!file) return;
    await navigator.clipboard.writeText(file.path);
  };

  const handleFormatJson = () => {
    if (!file) return;
    try {
      onDraftChange(JSON.stringify(JSON.parse(draftContent), null, 2));
    } catch {
      // Keep invalid JSON as-is.
    }
  };

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center rounded-[24px] border border-border-primary bg-card p-10 shadow-sm">
        <div className="max-w-lg text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/12 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Dorothy Workspace</h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Pick a project at the top, choose a file from the explorer, and Dorothy will open it here with the right viewer or editor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-border-primary bg-card shadow-sm">
      <div className="border-b border-border-primary px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-foreground">{file.name}</h2>
              {isDirty && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Unsaved</span>}
            </div>
            <p className="truncate text-xs text-text-muted">{file.path}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {file.writable && (
              <div className="flex items-center rounded-2xl border border-border-primary bg-bg-secondary p-1">
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  aria-pressed={resolvedMode === 'edit'}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition active:scale-[0.98] ${
                    resolvedMode === 'edit'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-text-secondary hover:bg-card hover:text-foreground active:bg-primary/10'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('preview')}
                  aria-pressed={resolvedMode === 'preview'}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition active:scale-[0.98] ${
                    resolvedMode === 'preview'
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-text-secondary hover:bg-card hover:text-foreground active:bg-primary/10'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </span>
                </button>
              </div>
            )}

            {canFormat && (
              <button
                type="button"
                onClick={handleFormatJson}
                className="rounded-2xl border border-border-primary bg-bg-secondary px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-primary/20 hover:bg-secondary hover:text-foreground active:scale-[0.98] active:bg-primary/10"
              >
                Format JSON
              </button>
            )}

            {file.writable && (
              <button
                type="button"
                onClick={onSave}
                disabled={!isDirty || isSaving}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            )}

            <button type="button" onClick={handleCopyPath} className="rounded-2xl border border-border-primary bg-bg-secondary p-2 text-text-secondary transition hover:border-primary/20 hover:bg-secondary hover:text-foreground active:scale-[0.98] active:bg-primary/10" title="Copy path">
              <Copy className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => onRevealPath(file.path)} className="rounded-2xl border border-border-primary bg-bg-secondary p-2 text-text-secondary transition hover:border-primary/20 hover:bg-secondary hover:text-foreground active:scale-[0.98] active:bg-primary/10" title="Reveal in Finder">
              <Folder className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => onOpenPath(file.path)} className="rounded-2xl border border-border-primary bg-bg-secondary p-2 text-text-secondary transition hover:border-primary/20 hover:bg-secondary hover:text-foreground active:scale-[0.98] active:bg-primary/10" title="Open externally">
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
          <span className="rounded-full border border-border-primary bg-bg-secondary px-2 py-1">{file.kind}</span>
          <span>{file.extension || 'no extension'}</span>
          <span>{formatBytes(file.size)}</span>
          <span>{new Date(file.lastModified).toLocaleString()}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {file.kind === 'markdown' && file.content !== undefined ? (
          <MarkdownFileViewer content={draftContent} mode={resolvedMode} onChange={onDraftChange} onModeChange={setMode} />
        ) : (file.kind === 'text' || file.kind === 'markdown') && file.content !== undefined ? (
          <CodeTextViewer filePath={file.path} content={draftContent} mode={resolvedMode} onChange={onDraftChange} />
        ) : file.kind === 'image' || file.kind === 'video' || file.kind === 'audio' || file.kind === 'pdf' ? (
          <MediaViewer file={file} />
        ) : (
          <MetadataViewer
            file={file}
            message={file.content === undefined && (file.kind === 'text' || file.kind === 'markdown')
              ? 'This text file is too large for inline editing, so Dorothy is showing metadata instead.'
              : undefined}
          />
        )}
      </div>
    </div>
  );
}
