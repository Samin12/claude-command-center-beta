'use client';

import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Play, Square, Trash2 } from 'lucide-react';
import { getTerminalTheme } from '@/components/AgentWorld/constants';
import { useXtermTerminal } from '@/hooks/useXtermTerminal';
import type { WorkspaceTerminalSession } from './useWorkspaceTerminalManager';

interface TerminalDockProps {
  projectPath: string | null;
  projectName: string;
  session: WorkspaceTerminalSession | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  onStart: (cols?: number, rows?: number) => void;
  onStop: () => void;
  onClear: () => void;
  onResize: (cols: number, rows: number) => void;
  onSendInput: (data: string) => void;
  onOpenExternal: () => void;
}

const EMPTY_MESSAGE = '\x1b[90mTerminal ready. Click "Start Claude Code" to begin.\x1b[0m\r\n';

export default function TerminalDock({
  projectPath,
  projectName,
  session,
  expanded,
  onToggleExpanded,
  onStart,
  onStop,
  onClear,
  onResize,
  onSendInput,
  onOpenExternal,
}: TerminalDockProps) {
  const renderedProjectRef = useRef<string | null>(null);
  const renderedOutputRef = useRef('');
  const showingPlaceholderRef = useRef(false);

  const { terminalRef, isReady, write, clear, focus, getSize } = useXtermTerminal(true, {
    theme: getTerminalTheme('dark'),
    fontSize: 12,
    onData: (data) => {
      if (!projectPath) return;
      onSendInput(data);
    },
    onResize: (cols, rows) => {
      if (!projectPath) return;
      onResize(cols, rows);
    },
  });

  useEffect(() => {
    if (!isReady) return;
    const nextOutput = session?.output || '';

    if (renderedProjectRef.current !== projectPath) {
      clear();
      if (nextOutput) {
        write(nextOutput);
        showingPlaceholderRef.current = false;
      } else {
        write(EMPTY_MESSAGE);
        showingPlaceholderRef.current = true;
      }
      renderedProjectRef.current = projectPath;
      renderedOutputRef.current = nextOutput;
      return;
    }

    if (showingPlaceholderRef.current && nextOutput) {
      clear();
      write(nextOutput);
      renderedOutputRef.current = nextOutput;
      showingPlaceholderRef.current = false;
      return;
    }

    if (nextOutput.length < renderedOutputRef.current.length || !nextOutput.startsWith(renderedOutputRef.current)) {
      clear();
      if (nextOutput) {
        write(nextOutput);
        showingPlaceholderRef.current = false;
      } else {
        write(EMPTY_MESSAGE);
        showingPlaceholderRef.current = true;
      }
      renderedOutputRef.current = nextOutput;
      return;
    }

    if (nextOutput.length > renderedOutputRef.current.length) {
      write(nextOutput.slice(renderedOutputRef.current.length));
      renderedOutputRef.current = nextOutput;
      showingPlaceholderRef.current = false;
    }

    if (!nextOutput && (!showingPlaceholderRef.current || renderedOutputRef.current !== '')) {
      clear();
      write(EMPTY_MESSAGE);
      renderedOutputRef.current = '';
      showingPlaceholderRef.current = true;
    }
  }, [clear, isReady, projectPath, session, session?.output, write]);

  const handleStart = () => {
    const size = getSize();
    onStart(size?.cols, size?.rows);
    focus();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0d1218]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/35">Claude Code Dock</h3>
          <div className="flex items-center gap-2">
            <p className="text-sm text-white">{projectPath ? projectName : 'No project selected'}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
              session?.ptyId ? 'bg-emerald-400/12 text-emerald-100' : 'bg-white/[0.05] text-white/40'
            }`}>
              {session?.ptyId ? 'live' : session?.status || 'idle'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={handleStart} disabled={!projectPath} className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-400/25 bg-emerald-400/14 px-3 py-2 text-xs font-medium text-emerald-50 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50">
            <Play className="h-3.5 w-3.5" />
            Start Claude Code
          </button>
          <button type="button" onClick={onStop} disabled={!session?.ptyId} className="rounded-2xl border border-white/10 bg-black/20 p-2 text-white/45 transition hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-50" title="Stop terminal">
            <Square className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClear} disabled={!projectPath} className="rounded-2xl border border-white/10 bg-black/20 p-2 text-white/45 transition hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-50" title="Clear visible output">
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={onOpenExternal} disabled={!projectPath} className="rounded-2xl border border-white/10 bg-black/20 p-2 text-white/45 transition hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-50" title="Open in Terminal">
            <ExternalLink className="h-4 w-4" />
          </button>
          <button type="button" onClick={onToggleExpanded} className="rounded-2xl border border-white/10 bg-black/20 p-2 text-white/45 transition hover:text-white/85" title={expanded ? 'Collapse dock' : 'Expand dock'}>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 bg-[#090d13] p-2">
        <div ref={terminalRef} className="h-full w-full rounded-2xl border border-white/5 bg-[#0a0f15]" />
      </div>
    </div>
  );
}
