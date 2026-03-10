'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ObsidianFile, ObsidianFolder } from '@/types/electron';

type FileMeta = Omit<ObsidianFile, 'content'> & { preview?: string };

interface VaultData {
  vaultPath: string;
  name: string;
  files: FileMeta[];
  tree: ObsidianFolder;
}

export function useObsidian() {
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [activeVaultPath, setActiveVaultPath] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<ObsidianFile | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI?.obsidian?.scan();
      if (result) {
        setVaults(result.vaults);
        // Auto-select the first vault if none selected
        if (result.vaults.length > 0 && !activeVaultPath) {
          setActiveVaultPath(result.vaults[0].vaultPath);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan vaults');
    } finally {
      setLoading(false);
    }
  }, [activeVaultPath]);

  useEffect(() => {
    scan();
  }, [scan]);

  const selectVault = useCallback((vaultPath: string) => {
    setActiveVaultPath(vaultPath);
    setSelectedFile(null);
    setSelectedFolder('');
    setExpandedFolders(new Set());
    setSearchQuery('');
  }, []);

  const activeVault = vaults.find(v => v.vaultPath === activeVaultPath) || null;

  const openFile = useCallback(async (filePath: string) => {
    if (!activeVaultPath) return;
    setFileLoading(true);
    try {
      const result = await window.electronAPI?.obsidian?.readFile(filePath, activeVaultPath);
      if (result?.file) {
        setSelectedFile(result.file);
      } else if (result?.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setFileLoading(false);
    }
  }, [activeVaultPath]);

  const saveFile = useCallback(async (filePath: string, content: string) => {
    if (!activeVaultPath) return { error: 'No active vault' };
    try {
      const result = await window.electronAPI?.obsidian?.writeFile(filePath, content, activeVaultPath);
      if (result?.success) {
        // Update local state with new content
        setSelectedFile(prev => prev && prev.path === filePath ? { ...prev, content } : prev);
      }
      return result || { error: 'API not available' };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to save file' };
    }
  }, [activeVaultPath]);

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const selectFolder = useCallback((folderPath: string) => {
    setSelectedFolder(folderPath);
  }, []);

  // Filter files by selected folder and search query (scoped to active vault)
  const allFiles = activeVault?.files || [];
  const filteredFiles = allFiles.filter(f => {
    const inFolder = selectedFolder === '' || f.relativePath.startsWith(selectedFolder + '/') || f.relativePath === selectedFolder;
    const matchesSearch = searchQuery === '' || f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.relativePath.toLowerCase().includes(searchQuery.toLowerCase());
    return inFolder && matchesSearch;
  });

  return {
    vaults,
    activeVault,
    activeVaultPath,
    files: filteredFiles,
    allFiles,
    tree: activeVault?.tree || null,
    selectedFile,
    selectedFolder,
    expandedFolders,
    searchQuery,
    loading,
    fileLoading,
    error,
    scan,
    selectVault,
    openFile,
    saveFile,
    toggleFolder,
    selectFolder,
    setSearchQuery,
    setSelectedFile,
  };
}
