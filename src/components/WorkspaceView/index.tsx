'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { WorkspaceFile, WorkspaceNode } from '@/types/electron';
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

export default function WorkspaceView() {
  const {
    roots,
    isLoading: rootsLoading,
    addRoot,
    removeRoot,
    getTree,
    readFile,
    writeFile,
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
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const isDirty = activeFile?.writable ? draftContent !== savedContent : false;

  useEffect(() => {
    if (!roots.length) {
      setSelectedRootPath(null);
      return;
    }
    if (!selectedRootPath || !roots.some((root) => root.path === selectedRootPath)) {
      setSelectedRootPath(roots[0].path);
    }
  }, [roots, selectedRootPath]);

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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load file');
    } finally {
      setFileLoading(false);
    }
  }, [activeFilePath, isDirty, readFile]);

  useEffect(() => {
    if (!selectedRootPath || treeLoading || fileLoading || activeFilePath) return;
    const initialFilePath = pickInitialWorkspaceFilePath(tree);
    if (!initialFilePath) return;
    void openFile(initialFilePath);
  }, [activeFilePath, fileLoading, openFile, selectedRootPath, tree, treeLoading]);

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
    if (selectedRootPath === rootPath) {
      setActiveFile(null);
      setActiveFilePath(null);
      setDraftContent('');
      setSavedContent('');
    }
  }, [isDirty, removeRoot, selectedRootPath]);

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
          selectedRootPath={selectedRootPath}
          dirtyRootPaths={dirtyRootPaths}
          activeTerminalRoots={activeTerminalRoots}
          onSelect={handleSelectRoot}
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
              tree={tree}
              loading={treeLoading || rootsLoading}
              selectedFilePath={activeFilePath}
              dirtyFilePath={isDirty ? activeFilePath : null}
              searchQuery={fileSearch}
              onSearchChange={setFileSearch}
              onSelectFile={(filePath) => {
                void openFile(filePath);
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
