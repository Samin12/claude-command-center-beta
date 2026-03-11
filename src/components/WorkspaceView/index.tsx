'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { WorkspaceFile, WorkspaceNode, WorkspaceRoot } from '@/types/electron';
import { isElectron, useElectronWorkspace } from '@/hooks/useElectron';
import ProjectSwitcher from './ProjectSwitcher';
import FileExplorer from './FileExplorer';
import EditorPane from './EditorPane';
import TerminalDock from './TerminalDock';
import { getProjectName, pickInitialWorkspaceFilePath } from './utils';
import { useWorkspaceTerminalManager } from './useWorkspaceTerminalManager';

function confirmDiscardChanges(): boolean {
  return window.confirm('You have unsaved changes. Discard them?');
}

interface PersistedWorkspaceState {
  openRootPaths: string[];
  selectedRootPath: string | null;
  activeFilePathsByRoot: Record<string, string>;
}

const OPEN_WORKSPACE_TABS_KEY = 'workspace-open-tabs';
const WORKSPACE_STATE_KEY = 'workspace-layout-state';

function hasWorkspaceFilePath(nodes: WorkspaceNode[], filePath: string): boolean {
  return nodes.some((node) => {
    if (node.type === 'file') return node.path === filePath;
    return hasWorkspaceFilePath(node.children || [], filePath);
  });
}

export default function WorkspaceView() {
  const {
    roots,
    isLoading: rootsLoading,
    addRoot,
    removeRoot,
    getTree,
    readFile,
    writeFile,
    createEntry,
    deleteEntry,
    openPath,
    revealPath,
    openInVsCode,
    refresh: refreshRoots,
  } = useElectronWorkspace();
  const terminalManager = useWorkspaceTerminalManager();
  const [selectedRootPath, setSelectedRootPath] = useState<string | null>(null);
  const [tree, setTree] = useState<WorkspaceNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [fileSearch, setFileSearch] = useState('');
  const [terminalExpanded, setTerminalExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRootPaths, setOpenRootPaths] = useState<string[]>([]);
  const [activeFilePathsByRoot, setActiveFilePathsByRoot] = useState<Record<string, string>>({});
  const [workspaceStateLoaded, setWorkspaceStateLoaded] = useState(false);
  const [hasPersistedWorkspaceState, setHasPersistedWorkspaceState] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const isDirty = activeFile?.writable ? draftContent !== savedContent : false;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(WORKSPACE_STATE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<PersistedWorkspaceState>;
        const nextOpenRootPaths = Array.isArray(parsed.openRootPaths)
          ? parsed.openRootPaths.filter((value): value is string => typeof value === 'string')
          : [];
        const nextSelectedRootPath = typeof parsed.selectedRootPath === 'string' ? parsed.selectedRootPath : null;
        const nextActiveFilePathsByRoot = parsed.activeFilePathsByRoot && typeof parsed.activeFilePathsByRoot === 'object'
          ? Object.fromEntries(
            Object.entries(parsed.activeFilePathsByRoot).filter(
              (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'
            )
          )
          : {};

        setOpenRootPaths(nextOpenRootPaths);
        setSelectedRootPath(nextSelectedRootPath);
        setActiveFilePathsByRoot(nextActiveFilePathsByRoot);
        setHasPersistedWorkspaceState(true);
        return;
      }

      const legacyStored = window.localStorage.getItem(OPEN_WORKSPACE_TABS_KEY);
      if (!legacyStored) return;
      const parsedLegacy = JSON.parse(legacyStored);
      if (Array.isArray(parsedLegacy)) {
        const nextOpenRootPaths = parsedLegacy.filter((value): value is string => typeof value === 'string');
        setOpenRootPaths(nextOpenRootPaths);
        setSelectedRootPath(nextOpenRootPaths[0] || null);
        setHasPersistedWorkspaceState(true);
      }
    } catch (storageError) {
      console.error('Failed to load workspace state:', storageError);
    } finally {
      setWorkspaceStateLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !workspaceStateLoaded) return;
    const nextState: PersistedWorkspaceState = {
      openRootPaths,
      selectedRootPath,
      activeFilePathsByRoot,
    };
    window.localStorage.setItem(WORKSPACE_STATE_KEY, JSON.stringify(nextState));
    window.localStorage.removeItem(OPEN_WORKSPACE_TABS_KEY);
  }, [activeFilePathsByRoot, openRootPaths, selectedRootPath, workspaceStateLoaded]);

  useEffect(() => {
    if (!workspaceStateLoaded) return;
    if (rootsLoading) return;

    if (!roots.length) {
      setSelectedRootPath(null);
      setOpenRootPaths([]);
      return;
    }

    const validPaths = new Set(roots.map((root) => root.path));
    const filteredOpenRootPaths = openRootPaths.filter((rootPath) => validPaths.has(rootPath));
    const fallbackPath = filteredOpenRootPaths[0] || (!hasPersistedWorkspaceState ? roots[0].path : null);
    const nextSelectedPath = selectedRootPath && filteredOpenRootPaths.includes(selectedRootPath)
      ? selectedRootPath
      : fallbackPath;

    const nextOpenRootPaths = filteredOpenRootPaths.length > 0
      ? filteredOpenRootPaths
      : (fallbackPath ? [fallbackPath] : []);

    if (nextOpenRootPaths.length !== openRootPaths.length || nextOpenRootPaths.some((rootPath, index) => rootPath !== openRootPaths[index])) {
      setOpenRootPaths(nextOpenRootPaths);
    }

    if (selectedRootPath !== nextSelectedPath) {
      setSelectedRootPath(nextSelectedPath);
    }
  }, [hasPersistedWorkspaceState, openRootPaths, roots, rootsLoading, selectedRootPath, workspaceStateLoaded]);

  const loadTree = useCallback(async (rootPath: string) => {
    setTreeLoading(true);
    setError(null);
    try {
      const result = await getTree(rootPath);
      if (result.error) {
        setError(result.error);
        setTree([]);
        return;
      }
      setTree(result.tree);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load workspace tree');
      setTree([]);
    } finally {
      setTreeLoading(false);
    }
  }, [getTree]);

  useEffect(() => {
    if (!selectedRootPath) return;
    void loadTree(selectedRootPath);
  }, [selectedRootPath, loadTree]);

  const openFile = useCallback(async (filePath: string) => {
    if (activeFilePath === filePath) return;
    if (isDirty && !confirmDiscardChanges()) return;

    setFileLoading(true);
    setError(null);
    try {
      const result = await readFile(filePath);
      if (result.error || !result.file) {
        setError(result.error || 'Failed to load file');
        return;
      }
      setActiveFile(result.file);
      setActiveFilePath(filePath);
      setDraftContent(result.file.content || '');
      setSavedContent(result.file.content || '');
      if (selectedRootPath) {
        setActiveFilePathsByRoot((current) => (
          current[selectedRootPath] === filePath ? current : { ...current, [selectedRootPath]: filePath }
        ));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load file');
    } finally {
      setFileLoading(false);
    }
  }, [activeFilePath, isDirty, readFile, selectedRootPath]);

  useEffect(() => {
    if (!selectedRootPath || treeLoading || fileLoading || activeFilePath) return;
    const restoredFilePath = activeFilePathsByRoot[selectedRootPath];
    const initialFilePath = restoredFilePath && hasWorkspaceFilePath(tree, restoredFilePath)
      ? restoredFilePath
      : pickInitialWorkspaceFilePath(tree);
    if (!initialFilePath) return;
    void openFile(initialFilePath);
  }, [activeFilePath, activeFilePathsByRoot, fileLoading, openFile, selectedRootPath, tree, treeLoading]);

  const saveActiveFile = useCallback(async () => {
    if (!activeFile?.writable || !activeFilePath || !isDirty) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await writeFile(activeFilePath, draftContent);
      if (result.error || result.success === false) {
        setError(result.error || 'Failed to save file');
        return;
      }
      const refreshed = await readFile(activeFilePath);
      if (refreshed.file) {
        setActiveFile(refreshed.file);
        setDraftContent(refreshed.file.content || draftContent);
        setSavedContent(refreshed.file.content || draftContent);
      } else {
        setSavedContent(draftContent);
      }
      if (selectedRootPath) {
        void loadTree(selectedRootPath);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save file');
    } finally {
      setIsSaving(false);
    }
  }, [activeFile, activeFilePath, draftContent, isDirty, loadTree, readFile, selectedRootPath, writeFile]);

  const handleSelectRoot = useCallback((rootPath: string) => {
    if (rootPath === selectedRootPath) return;
    if (isDirty && !confirmDiscardChanges()) return;
    setHasPersistedWorkspaceState(true);
    setOpenRootPaths((current) => (current.includes(rootPath) ? current : [...current, rootPath]));
    setSelectedRootPath(rootPath);
    setActiveFile(null);
    setActiveFilePath(null);
    setDraftContent('');
    setSavedContent('');
    setError(null);
  }, [isDirty, selectedRootPath]);

  const handleAddFolder = useCallback(async () => {
    try {
      const folderPath = await window.electronAPI?.dialog.openFolder();
      if (!folderPath) return;
      const result = await addRoot(folderPath);
      if (result.error || result.success === false) {
        setError(result.error || 'Failed to add folder');
        return;
      }
      if (result.root?.path) {
        setHasPersistedWorkspaceState(true);
        setOpenRootPaths((current) => (current.includes(result.root!.path) ? current : [...current, result.root!.path]));
        setSelectedRootPath(result.root.path);
      } else {
        await refreshRoots();
      }
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Failed to add folder');
    }
  }, [addRoot, refreshRoots]);

  const handleRemoveRoot = useCallback(async (rootPath: string) => {
    if (selectedRootPath === rootPath && isDirty && !confirmDiscardChanges()) return;
    const result = await removeRoot(rootPath);
    if (result.error || result.success === false) {
      setError(result.error || 'Failed to remove folder');
      return;
    }
    setHasPersistedWorkspaceState(true);
    setOpenRootPaths((current) => current.filter((path) => path !== rootPath));
    if (selectedRootPath === rootPath) {
      setActiveFile(null);
      setActiveFilePath(null);
      setDraftContent('');
      setSavedContent('');
    }
    setActiveFilePathsByRoot((current) => {
      const next = { ...current };
      delete next[rootPath];
      return next;
    });
  }, [isDirty, removeRoot, selectedRootPath]);

  const handleCloseRootTab = useCallback((rootPath: string) => {
    if (selectedRootPath === rootPath && isDirty && !confirmDiscardChanges()) return;

    setHasPersistedWorkspaceState(true);
    setOpenRootPaths((current) => {
      const next = current.filter((path) => path !== rootPath);
      if (selectedRootPath === rootPath) {
        const fallbackPath = next[0] || null;
        setSelectedRootPath(fallbackPath);
        setActiveFile(null);
        setActiveFilePath(null);
        setDraftContent('');
        setSavedContent('');
      }
      return next;
    });
  }, [isDirty, selectedRootPath]);

  const handleCreateEntry = useCallback(async (parentPath: string, type: 'file' | 'directory', name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      const result = await createEntry({ parentPath, type, name: trimmedName });
      if (result.error || result.success === false) {
        setError(result.error || 'Failed to create workspace entry');
        return;
      }

      if (selectedRootPath) {
        await loadTree(selectedRootPath);
      }

      if (type === 'file' && result.path) {
        await openFile(result.path);
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create workspace entry');
    }
  }, [createEntry, loadTree, openFile, selectedRootPath]);

  const handleDeleteEntry = useCallback(async (targetPath: string) => {
    const isActiveTarget = !!activeFilePath && (
      activeFilePath === targetPath ||
      activeFilePath.startsWith(`${targetPath}/`) ||
      activeFilePath.startsWith(`${targetPath}\\`)
    );
    if (isActiveTarget && isDirty && !confirmDiscardChanges()) return;

    try {
      const result = await deleteEntry(targetPath);
      if (result.error || result.success === false) {
        setError(result.error || 'Failed to delete workspace entry');
        return;
      }

      if (isActiveTarget) {
        setActiveFile(null);
        setActiveFilePath(null);
        setDraftContent('');
        setSavedContent('');
        if (selectedRootPath) {
          setActiveFilePathsByRoot((current) => {
            if (!current[selectedRootPath]) return current;
            const next = { ...current };
            delete next[selectedRootPath];
            return next;
          });
        }
      }

      if (selectedRootPath) {
        await loadTree(selectedRootPath);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete workspace entry');
    }
  }, [activeFilePath, deleteEntry, isDirty, loadTree, selectedRootPath]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!isDirty) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (!confirmDiscardChanges()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [isDirty]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveActiveFile();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape' && fileSearch) {
        setFileSearch('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileSearch, saveActiveFile]);

  const activeTerminalRoots = useMemo(
    () => new Set(Array.from(terminalManager.sessions.values()).filter((session) => !!session.ptyId).map((session) => session.projectPath)),
    [terminalManager.sessions]
  );

  const dirtyRootPaths = useMemo(
    () => new Set(selectedRootPath && isDirty ? [selectedRootPath] : []),
    [isDirty, selectedRootPath]
  );

  const openRoots = useMemo(() => {
    const rootMap = new Map(roots.map((root) => [root.path, root]));
    return openRootPaths
      .map((rootPath) => rootMap.get(rootPath))
      .filter((root): root is WorkspaceRoot => Boolean(root));
  }, [openRootPaths, roots]);

  const currentSession = terminalManager.getSession(selectedRootPath);
  const projectName = selectedRootPath ? getProjectName(selectedRootPath) : 'No project selected';

  if (!isElectron()) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-bg-primary p-8">
        <div className="max-w-md rounded-[28px] border border-border-primary bg-card p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-text-muted" />
          <h1 className="text-xl font-semibold">Workspace is only available in the desktop app.</h1>
          <p className="mt-2 text-sm text-text-secondary">Dorothy needs Electron access for local projects, rich previews, and the Claude Code terminal dock.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-[radial-gradient(circle_at_top_left,var(--warning-muted),transparent_28%),radial-gradient(circle_at_top_right,var(--success-muted),transparent_24%),linear-gradient(180deg,var(--bg-secondary),var(--bg-primary))] px-4 py-3 text-foreground lg:px-6 lg:py-5">
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <ProjectSwitcher
          roots={roots}
          openRoots={openRoots}
          selectedRootPath={selectedRootPath}
          dirtyRootPaths={dirtyRootPaths}
          activeTerminalRoots={activeTerminalRoots}
          onSelect={handleSelectRoot}
          onOpenRoot={handleSelectRoot}
          onCloseRootTab={handleCloseRootTab}
          onAddFolder={handleAddFolder}
          onRemoveRoot={handleRemoveRoot}
          onOpenInVsCode={() => {
            if (!selectedRootPath) return;
            void openInVsCode(selectedRootPath);
          }}
        />

        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-h-0">
            {fileLoading ? (
              <div className="flex h-full items-center justify-center rounded-[24px] border border-border-primary bg-card">
                <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
              </div>
            ) : (
              <EditorPane
                key={activeFile?.path || 'empty'}
                file={activeFile}
                draftContent={draftContent}
                isDirty={isDirty}
                isSaving={isSaving}
                onDraftChange={setDraftContent}
                onSave={saveActiveFile}
                onOpenPath={(path) => {
                  void openPath(path);
                }}
                onRevealPath={(path) => {
                  void revealPath(path);
                }}
              />
            )}
          </div>

          <div className="min-h-0">
            <FileExplorer
              key={`${selectedRootPath || 'empty'}:${tree.length}`}
              rootPath={selectedRootPath}
              tree={tree}
              loading={treeLoading || rootsLoading}
              selectedFilePath={activeFilePath}
              dirtyFilePath={isDirty ? activeFilePath : null}
              searchQuery={fileSearch}
              onSearchChange={setFileSearch}
              onSelectFile={(filePath) => {
                void openFile(filePath);
              }}
              onCreateEntry={(parentPath, type, name) => {
                void handleCreateEntry(parentPath, type, name);
              }}
              onDeleteEntry={(targetPath) => {
                void handleDeleteEntry(targetPath);
              }}
              searchInputRef={searchInputRef}
            />
          </div>
        </div>

        <div className={`transition-[height] duration-200 ${terminalExpanded ? 'h-[40vh]' : 'h-[26vh] lg:h-[24vh]'}`}>
          <TerminalDock
            projectPath={selectedRootPath}
            projectName={projectName}
            session={currentSession}
            expanded={terminalExpanded}
            onToggleExpanded={() => setTerminalExpanded((current) => !current)}
            onStart={(cols, rows) => {
              if (!selectedRootPath) return;
              void terminalManager.startClaude(selectedRootPath, cols, rows);
            }}
            onStop={() => {
              if (!selectedRootPath) return;
              void terminalManager.stopTerminal(selectedRootPath);
            }}
            onClear={() => {
              if (!selectedRootPath) return;
              terminalManager.clearOutput(selectedRootPath);
            }}
            onResize={(cols, rows) => {
              if (!selectedRootPath) return;
              void terminalManager.resizeTerminal(selectedRootPath, cols, rows);
            }}
            onSendInput={(data) => {
              if (!selectedRootPath) return;
              void terminalManager.sendInput(selectedRootPath, data);
            }}
            onOpenExternal={() => {
              if (!selectedRootPath) return;
              void terminalManager.openInTerminalApp(selectedRootPath);
            }}
          />
        </div>
      </div>
    </div>
  );
}
