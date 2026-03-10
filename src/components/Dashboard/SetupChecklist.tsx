'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  ExternalLink,
  FolderKanban,
  Github,
  Settings2,
  TerminalSquare,
} from 'lucide-react';

const CLAUDE_CODE_SETUP_URL = 'https://docs.anthropic.com/en/docs/claude-code/getting-started';

interface SetupChecklistProps {
  projectCount: number;
  historyCount: number;
  hasStats: boolean;
}

interface SetupState {
  loading: boolean;
  claudePath: string;
  ghPath: string;
  claudeVersion: string;
}

function StatusIcon({ done, optional = false }: { done: boolean; optional?: boolean }) {
  if (done) {
    return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />;
  }

  if (optional) {
    return <Circle className="w-4 h-4 text-muted-foreground shrink-0" />;
  }

  return <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />;
}

export default function SetupChecklist({ projectCount, historyCount, hasStats }: SetupChecklistProps) {
  const [setup, setSetup] = useState<SetupState>({
    loading: true,
    claudePath: '',
    ghPath: '',
    claudeVersion: 'Unknown',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSetupState() {
      if (typeof window === 'undefined' || !window.electronAPI) {
        if (!cancelled) {
          setSetup(prev => ({ ...prev, loading: false }));
        }
        return;
      }

      try {
        const [paths, info] = await Promise.all([
          window.electronAPI.cliPaths?.detect?.(),
          window.electronAPI.settings?.getInfo?.(),
        ]);

        if (cancelled) return;

        setSetup({
          loading: false,
          claudePath: paths?.claude || '',
          ghPath: paths?.gh || '',
          claudeVersion: info?.claudeVersion || 'Unknown',
        });
      } catch {
        if (!cancelled) {
          setSetup(prev => ({ ...prev, loading: false }));
        }
      }
    }

    void loadSetupState();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasClaudeCli = Boolean(setup.claudePath) || (setup.claudeVersion !== '' && setup.claudeVersion !== 'Unknown');
  const hasClaudeData = projectCount > 0 || historyCount > 0 || hasStats;
  const hasGitHubCli = Boolean(setup.ghPath);

  if (hasClaudeCli && hasClaudeData) {
    return null;
  }

  const title = !hasClaudeCli ? 'Finish setup in one step' : 'Claude Code is installed';
  const description = !hasClaudeCli
    ? 'Install Claude Code once, then reopen this app. If it is already installed but not detected, use Settings > CLI Paths and click Detect Paths.'
    : 'Run Claude Code in any project folder one time and Command Center will automatically start showing your projects, sessions, history, and usage.';

  const openClaudeCodeSetup = () => {
    if (typeof window === 'undefined') return;

    if (window.electronAPI?.updates?.openExternal) {
      void window.electronAPI.updates.openExternal(CLAUDE_CODE_SETUP_URL);
      return;
    }

    window.open(CLAUDE_CODE_SETUP_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="border border-amber-500/30 bg-amber-500/8 p-5 lg:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-amber-300 mb-2">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">First Run Setup</span>
          </div>
          <h2 className="text-lg lg:text-xl font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground mt-2">{description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!hasClaudeCli && (
            <button
              type="button"
              onClick={openClaudeCodeSetup}
              className="px-4 py-2 bg-foreground text-background hover:bg-foreground/90 transition-colors text-sm flex items-center gap-2"
            >
              Install Claude Code
              <ExternalLink className="w-4 h-4" />
            </button>
          )}

          <Link
            href={!hasClaudeCli ? '/settings?section=cli' : '/projects'}
            className="px-4 py-2 border border-border text-sm text-foreground hover:border-foreground transition-colors flex items-center gap-2"
          >
            {!hasClaudeCli ? (
              <>
                <Settings2 className="w-4 h-4" />
                Check CLI Paths
              </>
            ) : (
              <>
                <FolderKanban className="w-4 h-4" />
                Open Projects
              </>
            )}
          </Link>
        </div>
      </div>

      <div className="grid gap-3 mt-5 md:grid-cols-3">
        <div className="border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <StatusIcon done={hasClaudeCli} />
            <p className="text-sm font-medium text-foreground">Claude Code installed</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {setup.loading
              ? 'Checking your machine...'
              : hasClaudeCli
                ? `Detected ${setup.claudeVersion || 'Claude Code'}`
                : 'Required. Command Center reads your local Claude Code data and controls local Claude agents.'}
          </p>
        </div>

        <div className="border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <StatusIcon done={hasClaudeData} />
            <p className="text-sm font-medium text-foreground">Claude used in at least one project</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {hasClaudeData
              ? `${projectCount} project${projectCount === 1 ? '' : 's'} found locally.`
              : 'Required once. Open any code folder in Terminal, run `claude`, and this app will populate automatically.'}
          </p>
        </div>

        <div className="border border-border bg-card/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <StatusIcon done={hasGitHubCli} optional />
            <p className="text-sm font-medium text-foreground">GitHub CLI</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {hasGitHubCli
              ? 'Optional tooling found. GitHub automations can use it immediately.'
              : 'Optional. Only needed for GitHub-powered automations and PR workflows.'}
          </p>
        </div>
      </div>

      {!hasClaudeCli && (
        <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <TerminalSquare className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            If Claude Code is already installed on this computer, most users should only need to download this app and open it.
          </p>
        </div>
      )}

      {!hasGitHubCli && (
        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Github className="w-4 h-4 shrink-0 mt-0.5" />
          <p>Leave GitHub CLI for later unless the user wants automations that open or update GitHub issues and PRs.</p>
        </div>
      )}
    </section>
  );
}
