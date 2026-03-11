'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  Package,
  CheckCircle,
  XCircle,
  Terminal as TerminalIcon,
  Plus,
  X,
  Copy,
  Check,
  Download,
  MonitorDown,
  ExternalLink,
} from 'lucide-react';
import { useClaude } from '@/hooks/useClaude';
import { useElectronSkills } from '@/hooks/useElectron';
import { SKILLS_DATABASE, fetchSkillsFromMarketplace, type Skill } from '@/lib/skills-database';
import TerminalDialog from '@/components/TerminalDialog';
import ProviderBadge from '@/components/ProviderBadge';

const COL_STYLES = {
  rank: { width: '4%' },
  skill: { width: '30%' },
  repo: { width: '25%' },
  installs: { width: '10%' },
  status: { width: '31%' },
} as const;

const normalizeSkillKey = (value: string) => value.trim().toLowerCase();

const getMarketplaceGitHubUrl = (repo: string) => `https://github.com/${repo}`;

const getGitHubTreeUrl = (repositoryUrl?: string, gitCommit?: string) => {
  if (!repositoryUrl || !gitCommit) return undefined;
  return `${repositoryUrl.replace(/\/$/, '')}/tree/${gitCommit}`;
};

export default function SkillsPage() {
  const { data, loading, error, refresh: refreshClaude } = useClaude();
  const { installedSkills, installedSkillsByProvider, isSkillInstalledOn, isElectron: hasElectron, refresh: refreshSkills } = useElectronSkills();
  const [search, setSearch] = useState('');
  const [copiedSkill, setCopiedSkill] = useState<string | null>(null);
  const [installingSkill, setInstallingSkill] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Custom skill installation
  const [showCustomInstall, setShowCustomInstall] = useState(false);
  const [customRepo, setCustomRepo] = useState('');
  const [customSkillName, setCustomSkillName] = useState('');

  // Terminal modal for installation
  const [showInstallTerminal, setShowInstallTerminal] = useState(false);
  const [currentInstallRepo, setCurrentInstallRepo] = useState('');
  const [currentInstallTitle, setCurrentInstallTitle] = useState('');

  // Live skills data from skills.sh
  const [liveSkills, setLiveSkills] = useState<Skill[] | null>(null);
  const [loadingSkills, setLoadingSkills] = useState(true);

  useEffect(() => {
    fetchSkillsFromMarketplace()
      .then(skills => { if (skills) setLiveSkills(skills); })
      .finally(() => setLoadingSkills(false));
  }, []);

  const skillsDatabase = liveSkills || SKILLS_DATABASE;

  const installedPlugins = useMemo(() => data?.plugins || [], [data?.plugins]);
  const installedSkillsFromClaude = useMemo(() => data?.skills || [], [data?.skills]);

  // Get list of installed skill names (from all sources)
  const installedSkillNames = useMemo(() => {
    const fromPlugins = installedPlugins.map(p => p.name.toLowerCase());
    const fromClaudeSkills = installedSkillsFromClaude.map(s => s.name.toLowerCase());
    const fromElectron = installedSkills.map(s => s.toLowerCase());
    return [...new Set([...fromPlugins, ...fromClaudeSkills, ...fromElectron])];
  }, [installedPlugins, installedSkillsFromClaude, installedSkills]);

  const installedSkillNameSet = useMemo(
    () => new Set(installedSkillNames.map(normalizeSkillKey)),
    [installedSkillNames]
  );

  const claudeInstalledNames = useMemo(() => {
    const fromProvider = installedSkillsByProvider.claude || [];
    const userSkills = installedSkillsFromClaude
      .filter(skill => skill.source === 'user')
      .map(skill => skill.name);
    return Array.from(new Set([...fromProvider, ...userSkills]));
  }, [installedSkillsByProvider, installedSkillsFromClaude]);

  const claudeInstalledNameSet = useMemo(
    () => new Set(claudeInstalledNames.map(normalizeSkillKey)),
    [claudeInstalledNames]
  );

  const marketplaceByName = useMemo(
    () => new Map(skillsDatabase.map(skill => [normalizeSkillKey(skill.name), skill])),
    [skillsDatabase]
  );

  const trackedLocalSkills = useMemo(() => {
    return installedSkillsFromClaude
      .filter((skill) => skill.source === 'user' || skill.source === 'project')
      .map((skill) => {
        const marketplaceSkill = marketplaceByName.get(normalizeSkillKey(skill.name));
        const repositoryUrl = skill.repositoryUrl || (marketplaceSkill ? getMarketplaceGitHubUrl(marketplaceSkill.repo) : undefined);
        const gitState = skill.gitCommit
          ? 'git-synced'
          : repositoryUrl
            ? 'git-linked'
            : 'local-only';

        return {
          ...skill,
          key: `${skill.source}:${skill.path}`,
          repositoryUrl,
          githubTreeUrl: getGitHubTreeUrl(repositoryUrl, skill.gitCommit),
          providers: ['claude', 'codex', 'gemini'].filter((provider) => isSkillInstalledOn(skill.name, provider)),
          gitState,
        };
      })
      .sort((a, b) => {
        const sourcePriority = (value: 'user' | 'project' | 'plugin') => {
          if (value === 'user') return 0;
          if (value === 'project') return 1;
          return 2;
        };
        const sourceDiff = sourcePriority(a.source) - sourcePriority(b.source);
        if (sourceDiff !== 0) return sourceDiff;
        if ((a.projectName || '') !== (b.projectName || '')) {
          return (a.projectName || '').localeCompare(b.projectName || '');
        }
        return a.name.localeCompare(b.name);
      });
  }, [installedSkillsFromClaude, isSkillInstalledOn, marketplaceByName]);

  // Check if a skill is installed
  const isSkillInstalled = (skillName: string) => {
    return installedSkillNameSet.has(normalizeSkillKey(skillName));
  };

  // Filter skills
  const filteredSkills = useMemo(() => {
    let skills = skillsDatabase;

    if (search) {
      const q = search.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.repo.toLowerCase().includes(q)
      );
    }

    return [...skills].sort((a, b) => {
      const aClaudeInstalled = claudeInstalledNameSet.has(normalizeSkillKey(a.name));
      const bClaudeInstalled = claudeInstalledNameSet.has(normalizeSkillKey(b.name));
      if (aClaudeInstalled !== bClaudeInstalled) {
        return aClaudeInstalled ? -1 : 1;
      }

      const aInstalled = installedSkillNameSet.has(normalizeSkillKey(a.name));
      const bInstalled = installedSkillNameSet.has(normalizeSkillKey(b.name));
      if (aInstalled !== bInstalled) {
        return aInstalled ? -1 : 1;
      }

      return a.rank - b.rank;
    });
  }, [search, skillsDatabase, claudeInstalledNameSet, installedSkillNameSet]);

  // Install skill directly (Electron only)
  const handleDirectInstall = async (repo: string, skillName: string) => {
    if (!hasElectron) {
      copyInstallCommand(repo, skillName);
      return;
    }

    const fullRepo = `${repo}/${skillName}`;
    setInstallingSkill(skillName);
    setCurrentInstallRepo(fullRepo);
    setCurrentInstallTitle(skillName);
    setShowInstallTerminal(true);
  };

  const copyInstallCommand = async (repo: string, skillName: string) => {
    const command = `npx skills add https://github.com/${repo} --skill ${skillName}`;
    try {
      await navigator.clipboard.writeText(command);
      setCopiedSkill(skillName);
      setShowToast({
        message: `Command copied! Open your terminal and paste to install "${skillName}"`,
        type: 'success',
      });
      setTimeout(() => {
        setCopiedSkill(null);
        setShowToast(null);
      }, 3000);
    } catch {
      setShowToast({
        message: 'Failed to copy to clipboard',
        type: 'info',
      });
    }
  };

  const handleCustomInstall = async () => {
    if (!customRepo) return;

    const fullRepo = customSkillName ? `${customRepo}/${customSkillName}` : customRepo;

    if (hasElectron) {
      setInstallingSkill('custom');
      setCurrentInstallRepo(fullRepo);
      setCurrentInstallTitle(customSkillName || customRepo);
      setShowCustomInstall(false);
      setCustomRepo('');
      setCustomSkillName('');
      setShowInstallTerminal(true);
    } else {
      // Fallback to copy
      const command = customSkillName
        ? `npx skills add https://github.com/${customRepo} --skill ${customSkillName}`
        : `npx skills add https://github.com/${customRepo}`;
      try {
        await navigator.clipboard.writeText(command);
        setShowToast({
          message: 'Command copied! Open your terminal and paste to install.',
          type: 'success',
        });
        setCustomRepo('');
        setCustomSkillName('');
        setShowCustomInstall(false);
        setTimeout(() => setShowToast(null), 3000);
      } catch {
        setShowToast({
          message: 'Failed to copy to clipboard',
          type: 'info',
        });
      }
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-muted-foreground">Loading skills...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-red-400">
          <p className="mb-2">Failed to load skills</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-7rem)] lg:min-h-[calc(100vh-3rem)] pt-4 lg:pt-6">
      {/* Header */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Skills Marketplace</h1>
            <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
              {hasElectron
                ? 'Install skills directly to enhance your AI Agents'
                : 'Browse and copy install commands for skills'
              }
            </p>
          </div>
          <button
            onClick={() => setShowCustomInstall(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Custom Install</span>
            <span className="sm:hidden">Custom</span>
          </button>
        </div>

        {/* Badges row - below on mobile */}
        <div className="flex flex-wrap items-center gap-2">
          {!hasElectron && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-500/10 text-yellow-400 text-xs">
              <MonitorDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Desktop app for direct install</span>
              <span className="sm:hidden">Desktop only</span>
            </div>
          )}
          <div className="text-xs lg:text-sm text-muted-foreground">
            <span className="font-medium">{skillsDatabase.length}</span> skills
            {liveSkills && <span className="text-muted-foreground/60"> (live from skills.sh)</span>}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 border flex items-center justify-between ${showToast.type === 'success'
              ? 'bg-primary/10 border-primary/30 text-primary'
              : showToast.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-white/10 border-white/30 text-white'
              }`}
          >
            <div className="flex items-center gap-3">
              {showToast.type === 'error' ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              <p className="text-sm">{showToast.message}</p>
            </div>
            <button onClick={() => setShowToast(null)} className="p-1 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Install Modal */}
      <AnimatePresence>
        {showCustomInstall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCustomInstall(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card border border-border rounded-none p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TerminalIcon className="w-5 h-5 text-muted-foreground" />
                  Install Custom Skill
                </h3>
                <button onClick={() => setShowCustomInstall(false)} className="p-1 hover:bg-secondary rounded-none">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Repository (owner/repo)</label>
                  <input
                    type="text"
                    value={customRepo}
                    onChange={(e) => setCustomRepo(e.target.value)}
                    placeholder="e.g., anthropics/skills"
                    className="w-full px-4 py-2.5 rounded-none font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Skill Name (optional)</label>
                  <input
                    type="text"
                    value={customSkillName}
                    onChange={(e) => setCustomSkillName(e.target.value)}
                    placeholder="e.g., frontend-design"
                    className="w-full px-4 py-2.5 rounded-none font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to install all skills from the repository
                  </p>
                </div>

                <div className="p-3 rounded-none bg-secondary/50 border border-border font-mono text-xs text-muted-foreground">
                  npx skills add https://github.com/{customRepo}{customSkillName ? ` --skill ${customSkillName}` : ''}
                </div>

                <button
                  onClick={handleCustomInstall}
                  disabled={!customRepo || installingSkill === 'custom'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-foreground text-background font-medium rounded-none hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  {installingSkill === 'custom' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Installing...
                    </>
                  ) : hasElectron ? (
                    <>
                      <Download className="w-4 h-4" />
                      Install Skill
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Install Command
                    </>
                  )}
                </button>

                {!hasElectron && (
                  <p className="text-xs text-muted-foreground text-center">
                    After copying, open your terminal and paste the command to install
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 pr-1">
        {trackedLocalSkills.length > 0 && (
          <div className="border border-border bg-card p-4 lg:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Skill Inventory</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Every local skill folder shows its path, scope, project ownership, and Git tracking status.
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{trackedLocalSkills.length}</span> tracked locally
              </div>
            </div>

            <div className="grid gap-3 mt-4 md:grid-cols-2 xl:grid-cols-3">
              {trackedLocalSkills.map((skill) => (
                <div
                  key={skill.key}
                  className="border border-border bg-secondary/40 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                        <h3 className="text-sm font-medium truncate">{skill.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {skill.description || 'Installed locally and ready to use.'}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium ${
                      skill.gitState === 'git-synced'
                        ? 'bg-primary/10 text-primary'
                        : skill.gitState === 'git-linked'
                          ? 'bg-yellow-500/10 text-yellow-300'
                          : 'bg-white/10 text-muted-foreground'
                    }`}>
                      {skill.gitState === 'git-synced'
                        ? 'Git synced'
                        : skill.gitState === 'git-linked'
                          ? 'Git linked'
                          : 'Local only'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-1 border text-[10px] font-medium uppercase tracking-wide ${
                      skill.source === 'project'
                        ? 'bg-green-500/10 border-green-500/20 text-green-300'
                        : 'bg-background/60 border-border text-muted-foreground'
                    }`}>
                      {skill.source === 'project' ? 'Project' : 'User'}
                    </span>
                    {skill.projectName && (
                      <span className="px-2 py-1 bg-green-500/10 border border-green-500/20 text-[10px] font-medium text-green-300">
                        {skill.projectName}
                      </span>
                    )}
                    {skill.version && (
                      <span className="px-2 py-1 bg-background/60 border border-border text-[10px] font-medium uppercase tracking-wide">
                        v{skill.version}
                      </span>
                    )}
                    {skill.gitBranch && (
                      <span className="px-2 py-1 bg-background/60 border border-border text-[10px] font-medium">
                        {skill.gitBranch}
                      </span>
                    )}
                    {skill.gitCommit && (
                      <a
                        href={skill.githubTreeUrl || skill.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-background/60 border border-border text-[10px] font-medium hover:border-foreground/40 hover:text-foreground transition-colors"
                      >
                        {skill.gitCommit}
                      </a>
                    )}
                    {!skill.repositoryUrl && (
                      <span className="px-2 py-1 bg-background/60 border border-border text-[10px] font-medium text-muted-foreground">
                        Local
                      </span>
                    )}
                  </div>

                  <div className="border border-border/60 bg-background/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Path</p>
                    <p className="font-mono text-[11px] text-foreground/90 break-all">{skill.path}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {skill.providers.map((provider) => (
                        <ProviderBadge key={`${skill.key}-${provider}`} provider={provider} />
                      ))}
                    </div>
                    {skill.repositoryUrl && (
                      <a
                        href={skill.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-foreground hover:text-foreground/80 transition-colors"
                      >
                        GitHub
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search skills..."
              className="w-full pl-10 pr-4 py-2.5 rounded-none text-sm"
            />
          </div>
        </div>

        {/* Skills Table */}
        <div className="border border-border bg-card overflow-hidden mt-4 mb-4">
          {loadingSkills && !liveSkills ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Loading skills from skills.sh...</span>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th style={COL_STYLES.rank} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">#</th>
                    <th style={COL_STYLES.skill} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Skill</th>
                    <th style={COL_STYLES.repo} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Repository</th>
                    <th style={COL_STYLES.installs} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Installs</th>
                    <th style={COL_STYLES.status} className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSkills.map((skill) => {
                    const installed = isSkillInstalled(skill.name);
                    const justCopied = copiedSkill === skill.name;
                    const isInstalling = installingSkill === skill.name;

                    return (
                      <tr
                        key={`${skill.repo}-${skill.name}`}
                        className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
                      >
                        <td style={COL_STYLES.rank} className="px-4 py-3 text-xs text-muted-foreground">
                          {skill.rank}
                        </td>
                        <td style={COL_STYLES.skill} className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${installed ? 'bg-primary/10' : 'bg-secondary'
                              }`}>
                              {installed ? (
                                <CheckCircle className="w-4 h-4 text-primary" />
                              ) : (
                                <Package className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <span className="font-medium text-sm truncate">{skill.name}</span>
                          </div>
                        </td>
                        <td style={COL_STYLES.repo} className="px-4 py-3 hidden md:table-cell">
                          <a
                            href={getMarketplaceGitHubUrl(skill.repo)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground font-mono truncate max-w-full hover:text-foreground transition-colors"
                          >
                            <span className="truncate">{skill.repo}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </td>
                        <td style={COL_STYLES.installs} className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">{skill.installs}</span>
                        </td>
                        <td style={COL_STYLES.status} className="px-4 py-3 text-right">
                          {installed ? (
                            <div className="inline-flex items-center gap-1">
                              {isSkillInstalledOn(skill.name, 'claude') && (
                                <ProviderBadge provider="claude" />
                              )}
                              {isSkillInstalledOn(skill.name, 'codex') && (
                                <ProviderBadge provider="codex" />
                              )}
                              {isSkillInstalledOn(skill.name, 'gemini') && (
                                <ProviderBadge provider="gemini" />
                              )}
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-medium ml-1" style={{ borderRadius: 4 }}>
                                <Check className="w-2.5 h-2.5" />
                                Installed
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDirectInstall(skill.repo, skill.name)}
                              disabled={isInstalling}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${isInstalling
                                ? 'bg-secondary text-muted-foreground'
                                : justCopied
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-foreground text-background hover:bg-foreground/90'
                                }`}
                              style={{ borderRadius: 5 }}
                            >
                              {isInstalling ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Installing...
                                </>
                              ) : justCopied ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  Copied!
                                </>
                              ) : hasElectron ? (
                                <>
                                  <Download className="w-3 h-3" />
                                  Install
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  Copy
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredSkills.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <Package className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No skills found matching your search.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Installation Terminal Modal */}
      <TerminalDialog
        open={showInstallTerminal}
        repo={currentInstallRepo}
        title={currentInstallTitle}
        availableProviders={['claude', 'codex', 'gemini']}
        onClose={(success) => {
          setShowInstallTerminal(false);
          setInstallingSkill(null);
          // Always re-sync skills on close (install may have succeeded before terminal was closed)
          refreshSkills();
          refreshClaude();
          if (success) {
            setShowToast({
              message: `Successfully installed "${currentInstallRepo}"!`,
              type: 'success',
            });
            setTimeout(() => setShowToast(null), 4000);
          }
        }}
      />
    </div>
  );
}
