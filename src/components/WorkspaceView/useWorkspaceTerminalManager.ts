'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AgentStatus } from '@/types/electron';
import { isElectron } from '@/hooks/useElectron';
import { getProjectName } from './utils';

export interface WorkspaceTerminalSession {
  projectPath: string;
  agentId: string | null;
  ptyId: string | null;
  output: string;
  status: 'idle' | 'starting' | 'running' | 'stopped' | 'error' | 'waiting' | 'completed';
  exitCode?: number;
  agentName?: string;
}

const MAX_OUTPUT_CHARS = 200000;
const sessions = new Map<string, WorkspaceTerminalSession>();
const agentProjectPaths = new Map<string, string>();
const subscribers = new Set<() => void>();
let listenersBound = false;
let hydrationPromise: Promise<void> | null = null;

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
    agentId: null,
    ptyId: null,
    output: '',
    status: 'idle',
  };
  sessions.set(projectPath, next);
  return next;
}

function getWorkspaceProjectPath(agent: AgentStatus): string {
  return agent.workspaceRootPath || agent.projectPath;
}

function isWorkspaceAgent(agent: AgentStatus): boolean {
  return agent.source === 'workspace' && !!getWorkspaceProjectPath(agent);
}

function getAgentPriority(agent: AgentStatus): number {
  switch (agent.status) {
    case 'running':
    case 'waiting':
      return 3;
    case 'idle':
      return 2;
    case 'completed':
    case 'error':
      return 1;
    default:
      return 0;
  }
}

function pickPreferredWorkspaceAgent(current: AgentStatus | null, candidate: AgentStatus): AgentStatus {
  if (!current) return candidate;

  const currentPriority = getAgentPriority(current);
  const candidatePriority = getAgentPriority(candidate);
  if (candidatePriority !== currentPriority) {
    return candidatePriority > currentPriority ? candidate : current;
  }

  const currentUpdatedAt = new Date(current.lastActivity || 0).getTime();
  const candidateUpdatedAt = new Date(candidate.lastActivity || 0).getTime();
  return candidateUpdatedAt >= currentUpdatedAt ? candidate : current;
}

function syncSessionFromAgent(agent: AgentStatus, options?: { preferAgentOutput?: boolean }) {
  if (!isWorkspaceAgent(agent)) return null;

  const projectPath = getWorkspaceProjectPath(agent);
  const session = ensureSession(projectPath);
  const nextOutput = trimOutput(agent.output.join(''));
  const shouldReplaceOutput =
    options?.preferAgentOutput ||
    session.agentId !== agent.id ||
    !session.output ||
    nextOutput.length >= session.output.length;

  session.agentId = agent.id;
  session.ptyId = agent.ptyId || null;
  session.status = agent.status;
  session.agentName = agent.name;
  session.exitCode = undefined;

  if (shouldReplaceOutput) {
    session.output = nextOutput;
  }

  agentProjectPaths.set(agent.id, projectPath);
  return session;
}

async function hydrateWorkspaceSessions(): Promise<void> {
  if (!isElectron() || !window.electronAPI?.agent?.list) return;
  if (hydrationPromise) {
    await hydrationPromise;
    return;
  }

  hydrationPromise = (async () => {
    const agents = await window.electronAPI!.agent.list();
    const preferredByProject = new Map<string, AgentStatus>();

    for (const agent of agents) {
      if (!isWorkspaceAgent(agent)) continue;
      const projectPath = getWorkspaceProjectPath(agent);
      const preferred = pickPreferredWorkspaceAgent(preferredByProject.get(projectPath) || null, agent);
      preferredByProject.set(projectPath, preferred);
    }

    for (const agent of preferredByProject.values()) {
      syncSessionFromAgent(agent, { preferAgentOutput: true });
    }

    const activeWorkspaceAgentIds = new Set(Array.from(preferredByProject.values()).map((agent) => agent.id));
    for (const session of sessions.values()) {
      if (!session.agentId) continue;
      if (!activeWorkspaceAgentIds.has(session.agentId)) {
        const staleAgentId = session.agentId;
        if (!session.ptyId && session.status !== 'starting') {
          session.agentId = null;
          session.agentName = undefined;
          session.status = session.output ? 'completed' : 'idle';
          session.exitCode = undefined;
        }
        agentProjectPaths.delete(staleAgentId);
      }
    }

    emitChange();
  })();

  try {
    await hydrationPromise;
  } finally {
    hydrationPromise = null;
  }
}

async function findWorkspaceAgent(projectPath: string): Promise<AgentStatus | null> {
  if (!isElectron() || !window.electronAPI?.agent?.list) return null;

  const agentList = await window.electronAPI.agent.list();
  let preferred: AgentStatus | null = null;

  for (const agent of agentList) {
    if (!isWorkspaceAgent(agent)) continue;
    if (getWorkspaceProjectPath(agent) !== projectPath) continue;
    preferred = pickPreferredWorkspaceAgent(preferred, agent);
  }

  return preferred;
}

function bindTerminalListeners() {
  if (listenersBound || !isElectron()) return;

  window.electronAPI?.agent?.onOutput?.((event) => {
    const projectPath = agentProjectPaths.get(event.agentId);
    if (!projectPath) return;

    const session = ensureSession(projectPath);
    session.agentId = event.agentId;
    session.output = trimOutput(session.output + event.data);
    if (session.status === 'starting' || session.status === 'idle' || session.status === 'completed' || session.status === 'stopped') {
      session.status = 'running';
    }
    emitChange();
  });

  window.electronAPI?.agent?.onComplete?.((event) => {
    const projectPath = agentProjectPaths.get(event.agentId);
    if (!projectPath) return;

    const session = ensureSession(projectPath);
    session.agentId = event.agentId;
    session.ptyId = null;
    session.exitCode = event.exitCode;
    session.status = event.exitCode === 0 ? 'completed' : 'error';
    emitChange();
  });

  window.electronAPI?.agent?.onStatus?.((event) => {
    const projectPath = agentProjectPaths.get(event.agentId);
    if (!projectPath) return;

    const session = ensureSession(projectPath);
    session.agentId = event.agentId;
    session.status = event.status as WorkspaceTerminalSession['status'];
    if (event.status === 'idle' || event.status === 'completed' || event.status === 'error') {
      session.ptyId = null;
    }
    emitChange();
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
    void hydrateWorkspaceSessions();

    return () => {
      subscribers.delete(handleUpdate);
    };
  }, []);

  const startClaude = useCallback(async (projectPath: string, cols?: number, rows?: number) => {
    if (!isElectron() || !window.electronAPI?.agent?.create || !window.electronAPI?.agent?.start) return;

    const session = ensureSession(projectPath);

    try {
      await hydrateWorkspaceSessions();

      let agent = session.agentId
        ? await window.electronAPI.agent.get(session.agentId)
        : await findWorkspaceAgent(projectPath);

      if (!agent) {
        agent = await findWorkspaceAgent(projectPath);
      }

      if (!agent) {
        agent = await window.electronAPI.agent.create({
          projectPath,
          skills: [],
          name: `Workspace · ${getProjectName(projectPath)}`,
          skipPermissions: true,
          provider: 'claude',
          source: 'workspace',
          workspaceRootPath: projectPath,
        });
      }

      syncSessionFromAgent(agent, { preferAgentOutput: true });

      if (agent.ptyId && (agent.status === 'running' || agent.status === 'waiting')) {
        if (typeof cols === 'number' && typeof rows === 'number') {
          await window.electronAPI.agent.resize({ id: agent.id, cols, rows }).catch(() => undefined);
        }
        emitChange();
        return;
      }

      session.status = 'starting';
      session.exitCode = undefined;
      if (!session.output) {
        session.output = `\x1b[90mLaunching Claude Code in ${projectPath}\x1b[0m\r\n`;
      }
      emitChange();

      await window.electronAPI.agent.start({
        id: agent.id,
        prompt: '',
        options: { provider: agent.provider || 'claude' },
      });

      if (typeof cols === 'number' && typeof rows === 'number') {
        await window.electronAPI.agent.resize({ id: agent.id, cols, rows }).catch(() => undefined);
      }

      const refreshedAgent = await window.electronAPI.agent.get(agent.id);
      if (refreshedAgent) {
        syncSessionFromAgent(refreshedAgent, { preferAgentOutput: true });
      }
      emitChange();
    } catch (error) {
      session.status = 'error';
      session.output = trimOutput(
        `${session.output}\r\n\x1b[31mFailed to start Claude Code: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m\r\n`
      );
      emitChange();
    }
  }, []);

  const stopTerminal = useCallback(async (projectPath: string) => {
    if (!isElectron() || !window.electronAPI?.agent?.stop) return;
    const session = ensureSession(projectPath);
    if (!session.agentId) return;
    await window.electronAPI.agent.stop(session.agentId);
    session.ptyId = null;
    session.status = 'idle';
    session.exitCode = undefined;
    emitChange();
  }, []);

  const sendInput = useCallback(async (projectPath: string, data: string) => {
    if (!isElectron() || !window.electronAPI?.agent?.sendInput) return;
    const session = sessions.get(projectPath);
    if (!session?.agentId) return;
    await window.electronAPI.agent.sendInput({ id: session.agentId, input: data });
  }, []);

  const resizeTerminal = useCallback(async (projectPath: string, cols: number, rows: number) => {
    if (!isElectron() || !window.electronAPI?.agent?.resize) return;
    const session = sessions.get(projectPath);
    if (!session?.agentId) return;
    await window.electronAPI.agent.resize({ id: session.agentId, cols, rows });
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
