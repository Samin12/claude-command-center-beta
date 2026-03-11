import { promises as fs, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import path from 'path';
import os from 'os';

const CLAUDE_DIR = path.join(os.homedir(), '.claude');

/**
 * Decode a Claude Code project directory name back to a filesystem path.
 * Claude encodes paths by replacing both `/` and `.` with `-`.
 * Greedy filesystem matching tries `-` and `.` separator combinations.
 */
function decodeProjectPath(dirName: string): string {
  const tokens = dirName.replace(/^-/, '').split('-');
  let resolved = '/';
  let i = 0;

  while (i < tokens.length) {
    let matched = false;
    for (let len = tokens.length - i; len >= 1; len--) {
      const subTokens = tokens.slice(i, i + len);
      const names = len === 1 ? [subTokens[0]] : sepCombinations(subTokens);
      for (const name of names) {
        const candidate = path.join(resolved, name);
        try {
          if (existsSync(candidate)) {
            resolved = candidate;
            i += len;
            matched = true;
            break;
          }
        } catch { /* ignore */ }
      }
      if (matched) break;
    }
    if (!matched) {
      resolved = path.join(resolved, tokens[i]);
      i++;
    }
  }
  return resolved;
}

function sepCombinations(tokens: string[]): string[] {
  const seps = ['-', '.'];
  const positions = tokens.length - 1;
  if (positions > 6) return [tokens.join('-'), tokens.join('.')];
  const total = 1 << positions;
  const results: string[] = [];
  for (let mask = 0; mask < total; mask++) {
    let r = tokens[0];
    for (let j = 0; j < positions; j++) {
      r += seps[(mask >> j) & 1] + tokens[j + 1];
    }
    results.push(r);
  }
  return results;
}

export interface ClaudeSettings {
  enabledPlugins: Record<string, boolean>;
  env: Record<string, string>;
  hooks: Record<string, unknown>;
  includeCoAuthoredBy: boolean;
  permissions: {
    allow: string[];
    deny: string[];
  };
}

export interface ClaudeStats {
  version: number;
  lastComputedDate: string;
  dailyActivity: Array<{
    date: string;
    messageCount: number;
    sessionCount: number;
    toolCallCount: number;
  }>;
  dailyModelTokens: Array<{
    date: string;
    tokensByModel: Record<string, number>;
  }>;
  modelUsage: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    webSearchRequests: number;
    costUSD: number;
    contextWindow: number;
    maxOutputTokens: number;
  }>;
  totalSessions: number;
  totalMessages: number;
  longestSession: {
    sessionId: string;
    duration: number;
    messageCount: number;
    timestamp: string;
  };
  firstSessionDate: string;
  hourCounts: Record<string, number>;
}

export interface ClaudeProject {
  id: string;
  name: string;
  path: string;
  sessions: ClaudeSession[];
  lastActivity: Date;
}

export interface ClaudeSession {
  id: string;
  projectPath: string;
  messages: ClaudeMessage[];
  startTime: Date;
  lastActivity: Date;
  model?: string;
  version?: string;
}

export interface ClaudeMessage {
  uuid: string;
  parentUuid: string | null;
  type: 'user' | 'assistant';
  timestamp: string;
  content: string | MessageContent[];
  model?: string;
  toolCalls?: ToolCall[];
}

interface MessageContent {
  type: string;
  text?: string;
  thinking?: string;
  tool_use_id?: string;
  content?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudePlugin {
  name: string;
  marketplace: string;
  fullName: string;
  enabled: boolean;
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
}

export interface ClaudeSkill {
  name: string;
  source: 'project' | 'user' | 'plugin';
  path: string;
  description?: string;
  projectName?: string;
  version?: string;
  repositoryUrl?: string;
  gitBranch?: string;
  gitCommit?: string;
}

export interface HistoryEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId?: string;
  pastedContents?: Record<string, unknown>;
}

// Read Claude Code settings
export async function getSettings(): Promise<ClaudeSettings | null> {
  try {
    const content = await fs.readFile(path.join(CLAUDE_DIR, 'settings.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Read Claude Code stats
export async function getStats(): Promise<ClaudeStats | null> {
  try {
    const content = await fs.readFile(path.join(CLAUDE_DIR, 'stats-cache.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Get all projects with their sessions
export async function getProjects(): Promise<ClaudeProject[]> {
  try {
    const projectsDir = path.join(CLAUDE_DIR, 'projects');
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });

    const projects: ClaudeProject[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== '.' && entry.name !== '..') {
        // Decode encoded path (Claude replaces both / and . with -)
        const projectPath = decodeProjectPath(entry.name);
        const projectDir = path.join(projectsDir, entry.name);

        // Get session files
        const sessionFiles = await fs.readdir(projectDir);
        const sessions: ClaudeSession[] = [];
        let lastActivity = new Date(0);

        for (const sessionFile of sessionFiles) {
          if (sessionFile.endsWith('.jsonl')) {
            const sessionId = sessionFile.replace('.jsonl', '');
            const sessionPath = path.join(projectDir, sessionFile);
            const stat = await fs.stat(sessionPath);

            if (stat.mtime > lastActivity) {
              lastActivity = stat.mtime;
            }

            sessions.push({
              id: sessionId,
              projectPath,
              messages: [],
              startTime: stat.birthtime,
              lastActivity: stat.mtime,
            });
          }
        }

        // Extract project name from path
        const projectName = projectPath.split('/').pop() || entry.name;

        projects.push({
          id: entry.name,
          name: projectName,
          path: projectPath,
          sessions,
          lastActivity,
        });
      }
    }

    // Sort by last activity
    projects.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    return projects;
  } catch {
    return [];
  }
}

// Get session messages
export async function getSessionMessages(projectId: string, sessionId: string): Promise<ClaudeMessage[]> {
  try {
    const sessionPath = path.join(CLAUDE_DIR, 'projects', projectId, `${sessionId}.jsonl`);
    const content = await fs.readFile(sessionPath, 'utf-8');
    const lines = content.trim().split('\n');

    const messages: ClaudeMessage[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        if (entry.type === 'user' || entry.type === 'assistant') {
          const msg: ClaudeMessage = {
            uuid: entry.uuid,
            parentUuid: entry.parentUuid,
            type: entry.type,
            timestamp: entry.timestamp,
            content: '',
            model: entry.message?.model,
          };

          // Extract content
          if (entry.message?.content) {
            if (typeof entry.message.content === 'string') {
              msg.content = entry.message.content;
            } else if (Array.isArray(entry.message.content)) {
              msg.content = entry.message.content;

              // Extract tool calls
              const toolUses = entry.message.content.filter(
                (c: MessageContent) => c.type === 'tool_use'
              );
              if (toolUses.length > 0) {
                msg.toolCalls = toolUses.map((t: MessageContent) => ({
                  id: t.tool_use_id || '',
                  name: t.name || '',
                  input: t.input || {},
                }));
              }
            }
          }

          messages.push(msg);
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    return messages;
  } catch {
    return [];
  }
}

// Get installed plugins/skills
export async function getPlugins(): Promise<ClaudePlugin[]> {
  try {
    const content = await fs.readFile(
      path.join(CLAUDE_DIR, 'plugins', 'installed_plugins.json'),
      'utf-8'
    );
    const data = JSON.parse(content);
    const settings = await getSettings();

    const plugins: ClaudePlugin[] = [];

    for (const [fullName, installations] of Object.entries(data.plugins || {})) {
      const [name, marketplace] = fullName.split('@');
      const install = (installations as Array<{
        installPath: string;
        version: string;
        installedAt: string;
        lastUpdated: string;
      }>)[0];

      if (install) {
        plugins.push({
          name,
          marketplace,
          fullName,
          enabled: settings?.enabledPlugins?.[fullName] ?? false,
          installPath: install.installPath,
          version: install.version,
          installedAt: install.installedAt,
          lastUpdated: install.lastUpdated,
        });
      }
    }

    return plugins;
  } catch {
    return [];
  }
}

// Helper to read skill metadata from local skill folders
async function readSkillMetadata(skillPath: string): Promise<{
  name: string;
  description?: string;
  version?: string;
  repositoryUrl?: string;
  gitBranch?: string;
  gitCommit?: string;
} | null> {
  try {
    const realPath = await fs.realpath(skillPath);
    const baseName = path.basename(realPath);

    const metadata: {
      name: string;
      description?: string;
      version?: string;
      repositoryUrl?: string;
      gitBranch?: string;
      gitCommit?: string;
    } = {
      name: baseName,
    };

    const marketplaceMetadataPath = path.join(realPath, '.claude-plugin', 'marketplace.json');
    if (existsSync(marketplaceMetadataPath)) {
      try {
        const marketplace = JSON.parse(await fs.readFile(marketplaceMetadataPath, 'utf-8'));
        metadata.name = marketplace.name || metadata.name;
        metadata.description = marketplace.metadata?.description || marketplace.plugins?.[0]?.description || metadata.description;
        metadata.version = marketplace.metadata?.version || metadata.version;
        metadata.repositoryUrl = normalizeGitHubUrl(marketplace.metadata?.repository) || metadata.repositoryUrl;
      } catch {
        // Ignore invalid marketplace metadata
      }
    }

    for (const metadataPath of [
      path.join(realPath, '.claude-plugin', 'plugin.json'),
      path.join(realPath, 'plugin.json'),
    ]) {
      if (!existsSync(metadataPath)) continue;
      try {
        const pluginMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        metadata.name = pluginMetadata.name || metadata.name;
        metadata.description = pluginMetadata.description || metadata.description;
        metadata.version = pluginMetadata.version || metadata.version;
        metadata.repositoryUrl = normalizeGitHubUrl(pluginMetadata.repository || pluginMetadata.homepage) || metadata.repositoryUrl;
      } catch {
        // Ignore invalid plugin metadata
      }
    }

    const skillMarkdownPath = path.join(realPath, 'SKILL.md');
    if (existsSync(skillMarkdownPath)) {
      try {
        const content = await fs.readFile(skillMarkdownPath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const commentVersion = content.match(/<!--\s*Version:\s*([^\s]+)\s*-->/i)?.[1];

        metadata.name = frontmatter.topLevel.name || metadata.name;
        metadata.description = frontmatter.topLevel.description || metadata.description;
        metadata.version = frontmatter.metadata.version || frontmatter.topLevel.version || commentVersion || metadata.version;
        metadata.repositoryUrl =
          normalizeGitHubUrl(
            frontmatter.metadata.repository ||
            frontmatter.metadata.homepage ||
            frontmatter.topLevel.repository ||
            frontmatter.topLevel.homepage
          ) || metadata.repositoryUrl;
      } catch {
        // Ignore unreadable skill markdown
      }
    }

    const gitMetadata = readGitMetadata(realPath);
    metadata.repositoryUrl = metadata.repositoryUrl || gitMetadata.repositoryUrl;
    metadata.gitBranch = gitMetadata.gitBranch;
    metadata.gitCommit = gitMetadata.gitCommit;

    return metadata;
  } catch {
    return null;
  }
}

function parseFrontmatter(content: string): {
  topLevel: Record<string, string>;
  metadata: Record<string, string>;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { topLevel: {}, metadata: {} };
  }

  const topLevel: Record<string, string> = {};
  const metadata: Record<string, string> = {};
  let section: 'topLevel' | 'metadata' = 'topLevel';

  for (const rawLine of match[1].split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const isIndented = /^[ \t]/.test(rawLine);
    if (!isIndented) section = 'topLevel';
    if (!isIndented && trimmed === 'metadata:') {
      section = 'metadata';
      continue;
    }

    const line = rawLine.replace(/^\s+/, '');
    const valueMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.+?)\s*$/);
    if (!valueMatch) continue;

    const [, key, value] = valueMatch;
    if (value === '|' || value === '>') continue;

    const normalizedValue = stripQuotes(value);
    if (section === 'metadata') {
      metadata[key] = normalizedValue;
    } else {
      topLevel[key] = normalizedValue;
    }
  }

  return { topLevel, metadata };
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith('\'') && value.endsWith('\''))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function normalizeGitHubUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;

  const trimmed = rawUrl.trim();
  const sshMatch = trimmed.match(/^git@github\.com:(.+?)(?:\.git)?\/?$/i);
  if (sshMatch) {
    return `https://github.com/${sshMatch[1].replace(/\.git$/i, '')}`;
  }

  const sshProtocolMatch = trimmed.match(/^ssh:\/\/git@github\.com\/(.+?)(?:\.git)?\/?$/i);
  if (sshProtocolMatch) {
    return `https://github.com/${sshProtocolMatch[1].replace(/\.git$/i, '')}`;
  }

  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/(.+?)(?:\.git)?\/?$/i);
  if (httpsMatch) {
    return `https://github.com/${httpsMatch[1].replace(/\.git$/i, '')}`;
  }

  return undefined;
}

function readGitMetadata(skillPath: string): Pick<ClaudeSkill, 'repositoryUrl' | 'gitBranch' | 'gitCommit'> {
  try {
    const repositoryUrl = normalizeGitHubUrl(
      execFileSync('git', ['-C', skillPath, 'config', '--get', 'remote.origin.url'], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    );

    const gitBranch = execFileSync('git', ['-C', skillPath, 'branch', '--show-current'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || undefined;

    const gitCommit = execFileSync('git', ['-C', skillPath, 'rev-parse', '--short', 'HEAD'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || undefined;

    return { repositoryUrl, gitBranch, gitCommit };
  } catch {
    return {};
  }
}

// Get installed skills from ~/.claude/skills, ~/.agents/skills, project .claude/skills, and plugins
export async function getSkills(): Promise<ClaudeSkill[]> {
  const skills: ClaudeSkill[] = [];

  // Read project skills from known Claude projects FIRST
  // (to match Claude Code's ordering: project, user, plugin)
  try {
    const projects = await getProjects();

    for (const project of projects) {
      const projectSkillsDir = path.join(project.path, '.claude', 'skills');

      try {
        const skillEntries = await fs.readdir(projectSkillsDir, { withFileTypes: true });

        for (const entry of skillEntries) {
          if (entry.isDirectory() || entry.isSymbolicLink()) {
            const skillPath = path.join(projectSkillsDir, entry.name);
            const metadata = await readSkillMetadata(skillPath);

            skills.push({
              name: metadata?.name || entry.name,
              source: 'project',
              path: skillPath,
              description: metadata?.description,
              projectName: project.name,
              version: metadata?.version,
              repositoryUrl: metadata?.repositoryUrl,
              gitBranch: metadata?.gitBranch,
              gitCommit: metadata?.gitCommit,
            });
          }
        }
      } catch {
        // Project doesn't have a .claude/skills directory
      }
    }
  } catch {
    // No known project skills
  }

  // Read user skills from ~/.claude/skills
  try {
    const userSkillsDir = path.join(CLAUDE_DIR, 'skills');
    const entries = await fs.readdir(userSkillsDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skills can be directories or symlinks
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const skillPath = path.join(userSkillsDir, entry.name);
        const metadata = await readSkillMetadata(skillPath);

        skills.push({
          name: metadata?.name || entry.name,
          source: 'user',
          path: skillPath,
          description: metadata?.description,
          version: metadata?.version,
          repositoryUrl: metadata?.repositoryUrl,
          gitBranch: metadata?.gitBranch,
          gitCommit: metadata?.gitCommit,
        });
      }
    }
  } catch {
    // No user skills directory
  }

  // Read user skills from ~/.agents/skills (alternative location)
  try {
    const agentsSkillsDir = path.join(os.homedir(), '.agents', 'skills');
    const entries = await fs.readdir(agentsSkillsDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skills can be directories or symlinks
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const skillPath = path.join(agentsSkillsDir, entry.name);
        const metadata = await readSkillMetadata(skillPath);

        // Check if skill with same name already exists (avoid duplicates)
        const existingSkill = skills.find(s => s.name === (metadata?.name || entry.name));
        if (!existingSkill) {
          skills.push({
            name: metadata?.name || entry.name,
            source: 'user',
            path: skillPath,
            description: metadata?.description,
            version: metadata?.version,
            repositoryUrl: metadata?.repositoryUrl,
            gitBranch: metadata?.gitBranch,
            gitCommit: metadata?.gitCommit,
          });
        }
      }
    }
  } catch {
    // No ~/.agents/skills directory
  }

  // Check for plugin skills from installed_plugins.json
  try {
    const plugins = await getPlugins();
    for (const plugin of plugins) {
      skills.push({
        name: plugin.name,
        source: 'plugin',
        path: plugin.installPath,
        description: `Plugin from ${plugin.marketplace}`,
      });
    }
  } catch {
    // No plugins
  }

  return skills;
}

// Get recent history
export async function getHistory(limit = 100): Promise<HistoryEntry[]> {
  try {
    const content = await fs.readFile(path.join(CLAUDE_DIR, 'history.jsonl'), 'utf-8');
    const lines = content.trim().split('\n');

    const entries: HistoryEntry[] = [];

    // Get last N entries
    const startIndex = Math.max(0, lines.length - limit);

    for (let i = startIndex; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]);
        entries.push({
          display: entry.display,
          timestamp: entry.timestamp,
          project: entry.project,
          sessionId: entry.sessionId,
          pastedContents: entry.pastedContents,
        });
      } catch {
        // Skip invalid lines
      }
    }

    return entries;
  } catch {
    return [];
  }
}

// Get active sessions
export async function getActiveSessions(): Promise<string[]> {
  try {
    const sessionEnvDir = path.join(CLAUDE_DIR, 'session-env');
    const entries = await fs.readdir(sessionEnvDir, { withFileTypes: true });

    return entries
      .filter(e => e.isDirectory() && e.name !== '.' && e.name !== '..')
      .map(e => e.name);
  } catch {
    return [];
  }
}

// Get all data in one call
export async function getAllClaudeData() {
  const [settings, stats, projects, plugins, skills, history, activeSessions] = await Promise.all([
    getSettings(),
    getStats(),
    getProjects(),
    getPlugins(),
    getSkills(),
    getHistory(50),
    getActiveSessions(),
  ]);

  return {
    settings,
    stats,
    projects,
    plugins,
    skills,
    history,
    activeSessions,
  };
}
