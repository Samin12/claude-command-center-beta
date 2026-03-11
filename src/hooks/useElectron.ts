'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type {
  AgentStatus,
  AgentEvent,
  AgentCharacter,
  AgentProvider,
  WorkspaceCreateEntryParams,
  WorkspaceCreateEntryResult,
  WorkspaceRoot,
  WorkspaceNode,
  WorkspaceFile,
  WorkspaceFileMeta,
  WorkspaceActionResult,
} from '@/types/electron';

// Check if we're running in Electron
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
};

// Hook for agent management via Electron IPC
export function useElectronAgents() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all agents
  const fetchAgents = useCallback(async () => {
    if (!isElectron()) {
      setIsLoading(false);
      return;
    }

    try {
      const list = await window.electronAPI!.agent.list();
      // Only update state if data has actually changed to prevent unnecessary re-renders
      setAgents(prev => {
        // Quick length check first
        if (prev.length !== list.length) return list;
        // Compare each agent's key fields
        const hasChanged = list.some((agent, i) => {
          const prevAgent = prev[i];
          return (
            prevAgent.id !== agent.id ||
            prevAgent.status !== agent.status ||
            prevAgent.currentTask !== agent.currentTask ||
            prevAgent.lastActivity !== agent.lastActivity
          );
        });
        return hasChanged ? list : prev;
      });
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new agent
  const createAgent = useCallback(async (config: {
    projectPath: string;
    skills: string[];
    worktree?: { enabled: boolean; branchName: string };
    character?: AgentCharacter;
    name?: string;
    secondaryProjectPath?: string;
    skipPermissions?: boolean;
    provider?: AgentProvider;
    localModel?: string;
    obsidianVaultPaths?: string[];
  }) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    const agent = await window.electronAPI!.agent.create(config);
    setAgents(prev => [...prev, agent]);
    return agent;
  }, []);

  // Update an agent
  const updateAgent = useCallback(async (params: {
    id: string;
    skills?: string[];
    secondaryProjectPath?: string | null;
    skipPermissions?: boolean;
    name?: string;
    character?: AgentCharacter;
  }) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    const result = await window.electronAPI!.agent.update(params);
    if (result.success && result.agent) {
      setAgents(prev => prev.map(a => a.id === params.id ? result.agent! : a));
    }
    return result;
  }, []);

  // Start an agent
  const startAgent = useCallback(async (
    id: string,
    prompt: string,
    options?: { model?: string; resume?: boolean; provider?: AgentProvider; localModel?: string }
  ) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    await window.electronAPI!.agent.start({ id, prompt, options });
    await fetchAgents();
  }, [fetchAgents]);

  // Stop an agent
  const stopAgent = useCallback(async (id: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    await window.electronAPI!.agent.stop(id);
    await fetchAgents();
  }, [fetchAgents]);

  // Remove an agent
  const removeAgent = useCallback(async (id: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    await window.electronAPI!.agent.remove(id);
    setAgents(prev => prev.filter(a => a.id !== id));
  }, []);

  // Send input to an agent
  const sendInput = useCallback(async (id: string, input: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    await window.electronAPI!.agent.sendInput({ id, input });
  }, []);

  // Subscribe to agent events
  useEffect(() => {
    if (!isElectron()) return;

    const unsubOutput = window.electronAPI!.agent.onOutput((event: AgentEvent) => {
      setAgents(prev => prev.map(a =>
        a.id === event.agentId
          ? { ...a, output: [...a.output, event.data], lastActivity: event.timestamp }
          : a
      ));
    });

    const unsubError = window.electronAPI!.agent.onError((event: AgentEvent) => {
      setAgents(prev => prev.map(a =>
        a.id === event.agentId
          ? { ...a, output: [...a.output, `[error] ${event.data}`], lastActivity: event.timestamp }
          : a
      ));
    });

    const unsubComplete = window.electronAPI!.agent.onComplete(() => {
      fetchAgents();
    });

    const unsubStatus = window.electronAPI!.agent.onStatus?.((event: { agentId: string; status: string; timestamp: string }) => {
      setAgents(prev => prev.map(a =>
        a.id === event.agentId
          ? { ...a, status: event.status as AgentStatus['status'], lastActivity: event.timestamp }
          : a
      ));
    });

    return () => {
      unsubOutput();
      unsubError();
      unsubComplete();
      unsubStatus?.();
    };
  }, [fetchAgents]);

  // Initial fetch
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return {
    agents,
    isLoading,
    isElectron: isElectron(),
    createAgent,
    updateAgent,
    startAgent,
    stopAgent,
    removeAgent,
    sendInput,
    refresh: fetchAgents,
  };
}

// Hook for skill management via Electron IPC
export function useElectronSkills() {
  const [installedSkillsByProvider, setInstalledSkillsByProvider] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Flat list derived from all providers (backward compat)
  const installedSkills = useMemo(() => {
    const all = new Set<string>();
    for (const skills of Object.values(installedSkillsByProvider)) {
      for (const s of skills) all.add(s);
    }
    return Array.from(all);
  }, [installedSkillsByProvider]);

  const isSkillInstalledOn = useCallback((name: string, provider: string): boolean => {
    const skills = installedSkillsByProvider[provider];
    if (!skills) return false;
    return skills.some(s => s.toLowerCase() === name.toLowerCase());
  }, [installedSkillsByProvider]);

  const fetchInstalledSkills = useCallback(async () => {
    if (!isElectron()) {
      setIsLoading(false);
      return;
    }

    try {
      const byProvider = await window.electronAPI!.skill.listInstalledAll();
      setInstalledSkillsByProvider(byProvider);
    } catch (error) {
      console.error('Failed to fetch installed skills:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const installSkill = useCallback(async (repo: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    const result = await window.electronAPI!.skill.install(repo);
    await fetchInstalledSkills();
    return result;
  }, [fetchInstalledSkills]);

  const linkToProvider = useCallback(async (skillName: string, providerId: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.skill.linkToProvider({ skillName, providerId });
  }, []);

  useEffect(() => {
    fetchInstalledSkills();
  }, [fetchInstalledSkills]);

  return {
    installedSkills,
    installedSkillsByProvider,
    isSkillInstalledOn,
    isLoading,
    isElectron: isElectron(),
    installSkill,
    linkToProvider,
    refresh: fetchInstalledSkills,
  };
}

// Hook for file system operations via Electron IPC
export function useElectronFS() {
  const [projects, setProjects] = useState<{ path: string; name: string; lastModified: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!isElectron()) {
      setIsLoading(false);
      return;
    }

    try {
      const list = await window.electronAPI!.fs.listProjects();
      setProjects(list);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openFolderDialog = useCallback(async () => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.dialog.openFolder();
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    isLoading,
    isElectron: isElectron(),
    openFolderDialog,
    refresh: fetchProjects,
  };
}

export function useElectronWorkspace() {
  const [roots, setRoots] = useState<WorkspaceRoot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRoots = useCallback(async () => {
    if (!isElectron()) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await window.electronAPI!.workspace!.listRoots();
      setRoots(result.roots);
    } catch (error) {
      console.error('Failed to fetch workspace roots:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addRoot = useCallback(async (rootPath: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    const result = await window.electronAPI!.workspace!.addRoot(rootPath);
    await fetchRoots();
    return result;
  }, [fetchRoots]);

  const removeRoot = useCallback(async (rootPath: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    const result = await window.electronAPI!.workspace!.removeRoot(rootPath);
    await fetchRoots();
    return result;
  }, [fetchRoots]);

  const getTree = useCallback(async (rootPath: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.workspace!.getTree(rootPath) as Promise<{ tree: WorkspaceNode[]; error?: string }>;
  }, []);

  const readFile = useCallback(async (filePath: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.workspace!.readFile(filePath) as Promise<{ file?: WorkspaceFile; error?: string }>;
  }, []);

  const writeFile = useCallback(async (filePath: string, content: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.workspace!.writeFile({ filePath, content });
  }, []);

  const createEntry = useCallback(async (params: WorkspaceCreateEntryParams) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.workspace!.createEntry(params) as Promise<WorkspaceCreateEntryResult>;
  }, []);

  const deleteEntry = useCallback(async (targetPath: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.workspace!.deleteEntry(targetPath) as Promise<WorkspaceActionResult>;
  }, []);

  const getFileMeta = useCallback(async (filePath: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.workspace!.getFileMeta(filePath) as Promise<{ file?: WorkspaceFileMeta; error?: string }>;
  }, []);

  const openPath = useCallback(async (targetPath: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.workspace!.openPath(targetPath);
  }, []);

  const revealPath = useCallback(async (targetPath: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.workspace!.revealPath(targetPath);
  }, []);

  const openInVsCode = useCallback(async (targetPath: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.workspace!.openInVsCode(targetPath) as Promise<WorkspaceActionResult>;
  }, []);

  useEffect(() => {
    fetchRoots();
  }, [fetchRoots]);

  return {
    roots,
    isLoading,
    isElectron: isElectron(),
    addRoot,
    removeRoot,
    getTree,
    readFile,
    writeFile,
    createEntry,
    deleteEntry,
    getFileMeta,
    openPath,
    revealPath,
    openInVsCode,
    refresh: fetchRoots,
  };
}

// Hook for shell operations via Electron IPC
export function useElectronShell() {
  const openTerminal = useCallback(async (cwd: string, command?: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.shell.openTerminal({ cwd, command });
  }, []);

  const exec = useCallback(async (command: string, cwd?: string) => {
    if (!isElectron()) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI!.shell.exec({ command, cwd });
  }, []);

  return {
    isElectron: isElectron(),
    openTerminal,
    exec,
  };
}
