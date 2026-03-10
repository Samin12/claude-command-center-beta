'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, CheckCircle, XCircle, Cloud, RefreshCw, Download, KeyRound, LogIn, ShieldCheck, Mail, HardDrive, Table2, CalendarDays, FileText, Presentation, ListChecks, MessageSquare, Users, ClipboardList, Lightbulb } from 'lucide-react';
import { Toggle } from './Toggle';
import TerminalDialog from '@/components/TerminalDialog';
import type { AppSettings } from './types';

interface GoogleWorkspaceSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

type ServiceAccess = 'none' | 'read' | 'write';

interface AuthStatus {
  authenticated: boolean;
  user: string | null;
  tokenValid: boolean;
  scopes: string[];
  authMethod: string;
  services: Record<string, ServiceAccess>;
}

const SERVICE_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  gmail: { label: 'Gmail', color: '#EA4335', icon: Mail },
  drive: { label: 'Drive', color: '#1FA463', icon: HardDrive },
  sheets: { label: 'Sheets', color: '#34A853', icon: Table2 },
  calendar: { label: 'Calendar', color: '#4285F4', icon: CalendarDays },
  docs: { label: 'Docs', color: '#4285F4', icon: FileText },
  slides: { label: 'Slides', color: '#FBBC04', icon: Presentation },
  tasks: { label: 'Tasks', color: '#4285F4', icon: ListChecks },
  chat: { label: 'Chat', color: '#00AC47', icon: MessageSquare },
  people: { label: 'People', color: '#4285F4', icon: Users },
  forms: { label: 'Forms', color: '#7B1FA2', icon: ClipboardList },
  keep: { label: 'Keep', color: '#FBBC04', icon: Lightbulb },
};

export const GoogleWorkspaceSection = ({ appSettings, onSaveAppSettings }: GoogleWorkspaceSectionProps) => {
  const [gwsPath, setGwsPath] = useState<string>('');
  const [gcloudPath, setGcloudPath] = useState<string>('');
  const [detecting, setDetecting] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [mcpConfigured, setMcpConfigured] = useState(false);
  const [settingUpMcp, setSettingUpMcp] = useState(false);
  const [showInstallTerminal, setShowInstallTerminal] = useState(false);
  const [installCommand, setInstallCommand] = useState('');
  const [installTitle, setInstallTitle] = useState('');
  const [installType, setInstallType] = useState<'cli' | 'gcloud' | 'skills' | 'auth-setup' | 'auth-login'>('cli');
  const [gwsSkills, setGwsSkills] = useState<string[]>([]);

  // Stable ref so fetchSkills doesn't depend on onSaveAppSettings identity
  const onSaveRef = useRef(onSaveAppSettings);
  onSaveRef.current = onSaveAppSettings;

  const fetchSkills = useCallback(async () => {
    if (!window.electronAPI?.gws?.listSkills) return;
    try {
      const skills = await window.electronAPI.gws.listSkills();
      setGwsSkills(skills);
      if (skills.length > 0) {
        onSaveRef.current({ gwsSkillsInstalled: true });
      }
    } catch {
      setGwsSkills([]);
    }
  }, []);

  const detectAll = useCallback(async () => {
    setDetecting(true);
    try {
      // Use centralized CLI paths detection
      const paths = await window.electronAPI?.cliPaths?.detect();
      if (paths) {
        setGwsPath(paths.gws || '');
        setGcloudPath(paths.gcloud || '');
      }
    } catch {
      setGwsPath('');
      setGcloudPath('');
    } finally {
      setDetecting(false);
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    if (!window.electronAPI?.gws?.authStatus) return;
    setCheckingAuth(true);
    try {
      const status = await window.electronAPI.gws.authStatus();
      setAuthStatus(status);
    } catch {
      setAuthStatus(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  const fetchMcpStatus = useCallback(async () => {
    if (!window.electronAPI?.gws?.getMcpStatus) return;
    try {
      const result = await window.electronAPI.gws.getMcpStatus();
      setMcpConfigured(result.configured);
    } catch {
      setMcpConfigured(false);
    }
  }, []);

  useEffect(() => {
    detectAll();
    fetchMcpStatus();
    fetchSkills();
  }, [detectAll, fetchMcpStatus, fetchSkills]);

  useEffect(() => {
    if (gwsPath) {
      checkAuthStatus();
    }
  }, [gwsPath, checkAuthStatus]);

  // Build a command with gcloud's bin dir on PATH so gws can find it
  const gwsCommandWithPath = (args: string) => {
    const parts: string[] = [];
    // Prepend gcloud's directory to PATH if detected at a non-standard location
    if (gcloudPath) {
      const gcloudDir = gcloudPath.replace(/\/gcloud$/, '');
      parts.push(`export PATH="${gcloudDir}:$PATH"`);
    }
    // Use full gws path if detected
    const gws = gwsPath || 'gws';
    parts.push(`"${gws}" ${args}`);
    return parts.join(' && ');
  };

  const handleAuthSetup = () => {
    setInstallType('auth-setup');
    setInstallTitle('Google Workspace Auth Setup');
    setInstallCommand(gwsCommandWithPath('auth setup'));
    setShowInstallTerminal(true);
  };

  const handleAuthLogin = () => {
    setInstallType('auth-login');
    setInstallTitle('Google Workspace Auth Login');
    setInstallCommand(gwsCommandWithPath('auth login'));
    setShowInstallTerminal(true);
  };

  const handleInstallGcloud = () => {
    setInstallType('gcloud');
    setInstallTitle('Installing Google Cloud SDK');
    setInstallCommand('brew install google-cloud-sdk');
    setShowInstallTerminal(true);
  };

  const handleInstallCli = () => {
    setInstallType('cli');
    setInstallTitle('Installing gws CLI');
    setInstallCommand('npm install -g @googleworkspace/cli');
    setShowInstallTerminal(true);
  };

  const handleInstallSkills = () => {
    setInstallType('skills');
    setInstallTitle('Installing Agent Skills');
    setInstallCommand('npx skills add https://github.com/googleworkspace/cli');
    setShowInstallTerminal(true);
  };

  const handleInstallComplete = async () => {
    await detectAll();
    if (installType === 'skills') {
      await fetchSkills();
    }
    if (installType === 'auth-setup' || installType === 'auth-login') {
      await checkAuthStatus();
    }
  };

  const handleToggleEnabled = async () => {
    const newEnabled = !appSettings.gwsEnabled;
    onSaveAppSettings({ gwsEnabled: newEnabled });

    if (newEnabled) {
      setSettingUpMcp(true);
      try {
        if (window.electronAPI?.gws?.setup) {
          await window.electronAPI.gws.setup();
        }
        setMcpConfigured(true);
      } catch {
        // Ignore
      } finally {
        setSettingUpMcp(false);
      }
    } else {
      try {
        if (window.electronAPI?.gws?.remove) {
          await window.electronAPI.gws.remove();
        }
        setMcpConfigured(false);
      } catch {
        // Ignore
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Google Workspace</h2>
        <p className="text-sm text-muted-foreground">Access Gmail, Drive, Sheets, Docs, Calendar & more via the gws CLI.</p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Enable Google Workspace MCP</p>
              <p className="text-sm text-muted-foreground">
                Runs <code className="bg-secondary px-1 text-xs">gws mcp -s drive,gmail,calendar,sheets,docs</code> over stdio
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {settingUpMcp && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Toggle
              enabled={appSettings.gwsEnabled}
              onChange={handleToggleEnabled}
            />
          </div>
        </div>

        {/* CLI Detection Status */}
        <div className="pt-4 space-y-3">
          {/* gcloud status */}
          <div className="flex items-center gap-2 text-sm">
            {detecting ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : gcloudPath ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">gcloud:</span>
                <span className="font-mono text-xs">{gcloudPath}</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">gcloud: Not installed (required for auth setup)</span>
                <button
                  onClick={handleInstallGcloud}
                  className="ml-2 px-3 py-1 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3" />
                  Install gcloud
                </button>
              </>
            )}
          </div>

          {/* gws status */}
          <div className="flex items-center gap-2 text-sm">
            {detecting ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : gwsPath ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">gws:</span>
                <span className="font-mono text-xs">{gwsPath}</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-zinc-500" />
                <span className="text-muted-foreground">gws: Not installed</span>
                <button
                  onClick={handleInstallCli}
                  className="ml-2 px-3 py-1 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3 h-3" />
                  Install gws
                </button>
              </>
            )}
          </div>

          {/* MCP Registration Status */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${mcpConfigured ? 'bg-green-500' : 'bg-zinc-500'}`} />
            <span className="text-muted-foreground">
              MCP: {mcpConfigured ? 'Registered with agents (Drive, Gmail, Calendar, Sheets, Docs)' : 'Not registered — enable the toggle above'}
            </span>
          </div>
        </div>
      </div>

      {/* Authentication Status — only shown when gws is detected */}
      {gwsPath && (
        <div className="border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Authentication</h3>
            <button
              onClick={checkAuthStatus}
              disabled={checkingAuth}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {checkingAuth ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>

          {authStatus ? (
            <div className="space-y-4">
              {/* User info */}
              <div className="flex items-center gap-2 text-sm">
                {authStatus.authenticated ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    <span>Signed in as <span className="font-medium">{authStatus.user || 'unknown'}</span></span>
                    <button
                      onClick={() => {
                        setInstallType('auth-login');
                        setInstallTitle('Update Google Workspace Access');
                        setInstallCommand(gwsCommandWithPath('auth login'));
                        setShowInstallTerminal(true);
                      }}
                      className="ml-2 px-3 py-1 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-xs flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      Update Access
                    </button>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-zinc-500 shrink-0" />
                    <span className="text-muted-foreground">Not authenticated</span>
                    <button
                      onClick={handleAuthSetup}
                      className="ml-2 px-3 py-1 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-xs flex items-center gap-1.5"
                    >
                      <KeyRound className="w-3 h-3" />
                      Auth Setup
                    </button>
                    <button
                      onClick={handleAuthLogin}
                      className="ml-2 px-3 py-1 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-xs flex items-center gap-1.5"
                    >
                      <LogIn className="w-3 h-3" />
                      Auth Login
                    </button>
                  </>
                )}
              </div>

              {authStatus.authenticated && (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${authStatus.tokenValid ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-muted-foreground">
                      Token: {authStatus.tokenValid ? 'Valid' : 'Expired'}
                    </span>
                    {!authStatus.tokenValid && (
                      <button
                        onClick={handleAuthLogin}
                        className="ml-2 px-3 py-1 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-xs flex items-center gap-1.5"
                      >
                        <LogIn className="w-3 h-3" />
                        Refresh Login
                      </button>
                    )}
                  </div>

                  {/* Connected Services */}
                  <div>
                    <p className="text-sm font-medium mb-2">Connected Services</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(SERVICE_CONFIG).map(([key, config]) => {
                        const access = authStatus.services[key] ?? 'none';
                        const connected = access !== 'none';
                        const Icon = config.icon;
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-sm transition-colors ${
                              connected
                                ? 'bg-secondary/60'
                                : 'opacity-40'
                            }`}
                          >
                            <Icon
                              className="w-3.5 h-3.5 shrink-0"
                              style={connected ? { color: config.color } : undefined}
                            />
                            <span className={connected ? 'text-foreground' : 'text-muted-foreground'}>
                              {config.label}
                            </span>
                            {connected && (
                              <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                access === 'write'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'bg-emerald-500/15 text-emerald-400'
                              }`}>
                                {access === 'write' ? 'R/W' : 'READ'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {checkingAuth ? 'Checking authentication...' : 'Not authenticated yet. Run auth setup first, then login.'}
              </p>
              {!checkingAuth && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAuthSetup}
                    className="px-3 py-1.5 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-xs flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3 h-3" />
                    Auth Setup
                  </button>
                  <button
                    onClick={handleAuthLogin}
                    className="px-3 py-1.5 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-xs flex items-center gap-1.5"
                  >
                    <LogIn className="w-3 h-3" />
                    Auth Login
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Agent Skills */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Agent Skills</h3>
          {gwsSkills.length === 0 && (
            <button
              onClick={handleInstallSkills}
              className="px-3 py-1 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-xs flex items-center gap-1.5"
            >
              <Download className="w-3 h-3" />
              Install Skills
            </button>
          )}
        </div>

        {gwsSkills.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              <span>{gwsSkills.length} skill{gwsSkills.length !== 1 ? 's' : ''} installed</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {gwsSkills.map((skill) => {
                // Map skill name (e.g. "gws-gmail") to service config
                const serviceKey = skill.replace(/^gws-/, '').split('-')[0];
                const config = SERVICE_CONFIG[serviceKey];
                const Icon = config?.icon;
                return (
                  <div
                    key={skill}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded text-sm bg-secondary/60"
                  >
                    {Icon ? (
                      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: config.color }} />
                    ) : (
                      <Cloud className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="text-foreground truncate">{skill.replace(/^gws-/, '')}</span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleInstallSkills}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Install more skills
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-zinc-500" />
            <span className="text-muted-foreground">No skills installed</span>
          </div>
        )}
      </div>

      {/* Setup Guide */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Setup Guide</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Install <code className="bg-secondary px-1">gcloud</code> CLI (required for initial auth setup)</li>
          <li>Install <code className="bg-secondary px-1">gws</code> CLI via the button above or <code className="bg-secondary px-1">npm install -g @googleworkspace/cli</code></li>
          <li>Click <strong>Auth Setup</strong> above (creates a Google Cloud project + OAuth client)</li>
          <li>Click <strong>Auth Login</strong> to authenticate with your Google account</li>
          <li>Click the refresh icon above to verify your connection and see connected services</li>
          <li>Click &quot;Install Skills&quot; to add 100+ agent skills for Google Workspace</li>
          <li>Enable the toggle to register the MCP server — agents will be able to call Google APIs directly</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-4">
          The MCP server (<code className="bg-secondary px-0.5">gws mcp</code>) exposes Google Workspace APIs as tools over stdio. Default services: Drive, Gmail, Calendar, Sheets, Docs. Each service adds 10-80 tools.
        </p>
      </div>

      {/* Install Dialog — reuses TerminalDialog in command mode */}
      <TerminalDialog
        open={showInstallTerminal}
        repo=""
        title={installTitle}
        command={installCommand}
        onClose={(success) => {
          setShowInstallTerminal(false);
          if (success) handleInstallComplete();
        }}
      />
    </div>
  );
};
