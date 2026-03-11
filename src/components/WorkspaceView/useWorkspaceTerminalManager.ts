'use client';

import { useCallback, useEffect, useState } from 'react';
import { isElectron } from '@/hooks/useElectron';

export interface WorkspaceTerminalSession {
  projectPath: string;
  ptyId: string | null;
  output: string;
  status: 'idle' | 'starting' | 'running' | 'stopped' | 'error';
  exitCode?: number;
}

const MAX_OUTPUT_CHARS = 200000;
const sessions = new Map<string, WorkspaceTerminalSession>();
const subscribers = new Set<() => void>();
let listenersBound = false;

function emitChange() {
  subscribers.forEach((listener) => listener());
}

function trimOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_CHARS) return output;
  return output.slice(output.length - MAX_OUTPUT_CHARS);
}

function ensureSession(projectPath: string): WorkspaceTerminalSession {
  const existing = sessions.get(projectPath);
  if (existing) return existing;

  const next: WorkspaceTerminalSession = {
    projectPath,
    ptyId: null,
    output: '',
    status: 'idle',
  };
  sessions.set(projectPath, next);
  return next;
}

function bindTerminalListeners() {
  if (listenersBound || !isElectron()) return;

  window.electronAPI?.shell?.onPtyOutput?.(({ ptyId, data }) => {
    for (const session of sessions.values()) {
      if (session.ptyId === ptyId) {
        session.output = trimOutput(session.output + data);
        session.status = 'running';
        emitChange();
        break;
      }
    }
  });

  window.electronAPI?.shell?.onPtyExit?.(({ ptyId, exitCode }) => {
    for (const session of sessions.values()) {
      if (session.ptyId === ptyId) {
        session.ptyId = null;
        session.status = exitCode === 0 ? 'stopped' : 'error';
        session.exitCode = exitCode;
        emitChange();
        break;
      }
    }
  });

  listenersBound = true;
}

export function useWorkspaceTerminalManager() {
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!isElectron()) return;
    bindTerminalListeners();

    const handleUpdate = () => setVersion((current) => current + 1);
    subscribers.add(handleUpdate);

    return () => {
      subscribers.delete(handleUpdate);
    };
  }, []);

  const startClaude = useCallback(async (projectPath: string, cols?: number, rows?: number) => {
    if (!isElectron() || !window.electronAPI?.shell?.startPty || !window.electronAPI?.shell?.writePty) return;

    const session = ensureSession(projectPath);
    if (session.ptyId) {
      return;
    }

    session.status = 'starting';
    session.exitCode = undefined;
    if (!session.output) {
      session.output = `\x1b[90mLaunching Claude Code in ${projectPath}\x1b[0m\r\n`;
    }
    emitChange();

    const ptyId = await window.electronAPI.shell.startPty({ cwd: projectPath, cols, rows });
    session.ptyId = ptyId;
    emitChange();

    await window.electronAPI.shell.writePty({ ptyId, data: 'claude\n' });
  }, []);

  const stopTerminal = useCallback(async (projectPath: string) => {
    if (!isElectron() || !window.electronAPI?.shell?.killPty) return;
    const session = ensureSession(projectPath);
    if (!session.ptyId) return;
    const currentId = session.ptyId;
    session.ptyId = null;
    session.status = 'stopped';
    emitChange();
    await window.electronAPI.shell.killPty({ ptyId: currentId });
  }, []);

  const sendInput = useCallback(async (projectPath: string, data: string) => {
    if (!isElectron() || !window.electronAPI?.shell?.writePty) return;
    const session = sessions.get(projectPath);
    if (!session?.ptyId) return;
    await window.electronAPI.shell.writePty({ ptyId: session.ptyId, data });
  }, []);

  const resizeTerminal = useCallback(async (projectPath: string, cols: number, rows: number) => {
    if (!isElectron() || !window.electronAPI?.shell?.resizePty) return;
    const session = sessions.get(projectPath);
    if (!session?.ptyId) return;
    await window.electronAPI.shell.resizePty({ ptyId: session.ptyId, cols, rows });
  }, []);

  const clearOutput = useCallback((projectPath: string) => {
    const session = ensureSession(projectPath);
    session.output = '';
    emitChange();
  }, []);

  const openInTerminalApp = useCallback(async (projectPath: string) => {
    if (!isElectron() || !window.electronAPI?.shell?.openTerminal) return;
    await window.electronAPI.shell.openTerminal({ cwd: projectPath });
  }, []);

  return {
    sessions: new Map(sessions),
    getSession: (projectPath: string | null) => (projectPath ? sessions.get(projectPath) || null : null),
    startClaude,
    stopTerminal,
    sendInput,
    resizeTerminal,
    clearOutput,
    openInTerminalApp,
  };
}
