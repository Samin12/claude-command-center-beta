import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFileSync } from 'child_process';
import { decodeProjectPath } from '../utils/decode-project-path';

// Type definitions for Claude data structures
export interface ClaudeSettings {
  [key: string]: unknown;
}

export interface ClaudeStats {
  [key: string]: unknown;
}

export interface ClaudeProject {
  id: string;
  path: string;
  name: string;
  sessions: Array<{ id: string; timestamp: number }>;
  lastAccessed: number;
}

export interface ClaudePlugin {
  [key: string]: unknown;
}

export interface SkillMetadata {
  name: string;
  description?: string;
  version?: string;
  repositoryUrl?: string;
  gitBranch?: string;
  gitCommit?: string;
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

export interface ClaudeHistoryEntry {
  display: string;
  timestamp: number;
  project?: string;
}

export interface ClaudeData {
  settings: ClaudeSettings | null;
  stats: ClaudeStats | null;
  projects: ClaudeProject[];
  plugins: ClaudePlugin[];
  skills: ClaudeSkill[];
  history: ClaudeHistoryEntry[];
  activeSessions: unknown[];
}

/**
 * Read Claude Code settings from ~/.claude/settings.json
 */
export async function getClaudeSettings(): Promise<ClaudeSettings | null> {
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (!fs.existsSync(settingsPath)) return null;
    return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Read Claude Code stats from stats-cache.json or statsig_user_metadata.json
 */
export async function getClaudeStats(): Promise<ClaudeStats | null> {
  try {
    // Primary stats are in stats-cache.json
    const statsCachePath = path.join(os.homedir(), '.claude', 'stats-cache.json');
    if (fs.existsSync(statsCachePath)) {
      const statsCache = JSON.parse(fs.readFileSync(statsCachePath, 'utf-8'));
      return statsCache;
    }

    // Fallback to statsig_user_metadata.json if it exists
    const statsPath = path.join(os.homedir(), '.claude', 'statsig_user_metadata.json');
    if (fs.existsSync(statsPath)) {
      return JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    }

    return null;
  } catch {
    return null;
  }
}


/**
 * Read Claude Code projects from ~/.claude/projects
 */
export async function getClaudeProjects(): Promise<ClaudeProject[]> {
  try {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(projectsDir)) return [];

    const projects: ClaudeProject[] = [];

    const dirs = fs.readdirSync(projectsDir);
    for (const dir of dirs) {
      const fullPath = path.join(projectsDir, dir);
      const stat = fs.statSync(fullPath);
      if (!stat.isDirectory()) continue;

      // Decode project path smartly
      const decodedPath = decodeProjectPath(dir);

      // Get sessions
      const sessions: Array<{ id: string; timestamp: number }> = [];
      const files = fs.readdirSync(fullPath);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const sessionId = file.replace('.jsonl', '');
          const fileStat = fs.statSync(path.join(fullPath, file));
          sessions.push({ id: sessionId, timestamp: fileStat.mtimeMs });
        }
      }

      projects.push({
        id: dir,
        path: decodedPath,
        name: path.basename(decodedPath),
        sessions: sessions.sort((a, b) => b.timestamp - a.timestamp),
        lastAccessed: stat.mtimeMs,
      });
    }

    return projects.sort((a, b) => b.lastAccessed - a.lastAccessed);
  } catch {
    return [];
  }
}

/**
 * Read Claude Code plugins from ~/.claude/plugins/installed_plugins.json
 */
export async function getClaudePlugins(): Promise<ClaudePlugin[]> {
  try {
    const pluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
    if (!fs.existsSync(pluginsPath)) return [];
    const data = JSON.parse(fs.readFileSync(pluginsPath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Read skill metadata from a skill path
 */
export function readSkillMetadata(skillPath: string): SkillMetadata | null {
  try {
    const realPath = fs.realpathSync(skillPath);
    const baseName = path.basename(realPath);

    const metadata: SkillMetadata = {
      name: baseName,
    };

    const marketplaceMetadataPath = path.join(realPath, '.claude-plugin', 'marketplace.json');
    if (fs.existsSync(marketplaceMetadataPath)) {
      try {
        const marketplace = JSON.parse(fs.readFileSync(marketplaceMetadataPath, 'utf-8'));
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
      if (!fs.existsSync(metadataPath)) continue;
      try {
        const pluginMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        metadata.name = pluginMetadata.name || metadata.name;
        metadata.description = pluginMetadata.description || metadata.description;
        metadata.version = pluginMetadata.version || metadata.version;
        metadata.repositoryUrl = normalizeGitHubUrl(pluginMetadata.repository || pluginMetadata.homepage) || metadata.repositoryUrl;
      } catch {
        // Ignore invalid plugin metadata
      }
    }

    const skillMarkdownPath = path.join(realPath, 'SKILL.md');
    if (fs.existsSync(skillMarkdownPath)) {
      try {
        const content = fs.readFileSync(skillMarkdownPath, 'utf-8');
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
    return { name: path.basename(skillPath) };
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

function readGitMetadata(skillPath: string): Pick<SkillMetadata, 'repositoryUrl' | 'gitBranch' | 'gitCommit'> {
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

/**
 * Read Claude Code skills from ~/.claude/skills and ~/.agents/skills
 * Also reads plugin skills from installed_plugins.json
 */
export async function getClaudeSkills(): Promise<ClaudeSkill[]> {
  const skills: ClaudeSkill[] = [];

  // Project skills from known Claude projects
  try {
    const projects = await getClaudeProjects();

    for (const project of projects) {
      const projectSkillsDir = path.join(project.path, '.claude', 'skills');
      if (!fs.existsSync(projectSkillsDir)) continue;

      const entries = fs.readdirSync(projectSkillsDir);
      for (const entry of entries) {
        const entryPath = path.join(projectSkillsDir, entry);
        try {
          const realPath = fs.realpathSync(entryPath);
          const metadata = readSkillMetadata(realPath);
          if (metadata) {
            skills.push({
              name: metadata.name,
              source: 'project',
              path: realPath,
              description: metadata.description,
              projectName: project.name,
              version: metadata.version,
              repositoryUrl: metadata.repositoryUrl,
              gitBranch: metadata.gitBranch,
              gitCommit: metadata.gitCommit,
            });
          }
        } catch {
          // Skip broken symlinks
        }
      }
    }
  } catch {
    // Ignore project skill read errors
  }

  // User skills from ~/.claude/skills
  const userSkillsDir = path.join(os.homedir(), '.claude', 'skills');
  if (fs.existsSync(userSkillsDir)) {
    const entries = fs.readdirSync(userSkillsDir);
    for (const entry of entries) {
      const entryPath = path.join(userSkillsDir, entry);
      try {
        const realPath = fs.realpathSync(entryPath);
        const metadata = readSkillMetadata(realPath);
        if (metadata) {
          skills.push({
            name: metadata.name,
            source: 'user',
            path: realPath,
            description: metadata.description,
            version: metadata.version,
            repositoryUrl: metadata.repositoryUrl,
            gitBranch: metadata.gitBranch,
            gitCommit: metadata.gitCommit,
          });
        }
      } catch {
        // Skip broken symlinks
      }
    }
  }

  // User skills from ~/.agents/skills (alternative location)
  const agentsSkillsDir = path.join(os.homedir(), '.agents', 'skills');
  if (fs.existsSync(agentsSkillsDir)) {
    const entries = fs.readdirSync(agentsSkillsDir);
    for (const entry of entries) {
      const entryPath = path.join(agentsSkillsDir, entry);
      try {
        const realPath = fs.realpathSync(entryPath);
        const metadata = readSkillMetadata(realPath);
        if (metadata) {
          // Check if skill with same name already exists (avoid duplicates)
          const existingSkill = skills.find(s => s.name === metadata.name);
          if (!existingSkill) {
            skills.push({
              name: metadata.name,
              source: 'user',
              path: realPath,
              description: metadata.description,
              version: metadata.version,
              repositoryUrl: metadata.repositoryUrl,
              gitBranch: metadata.gitBranch,
              gitCommit: metadata.gitCommit,
            });
          }
        }
      } catch {
        // Skip broken symlinks
      }
    }
  }

  // Plugin skills from installed_plugins.json
  const pluginsPath = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');
  if (fs.existsSync(pluginsPath)) {
    try {
      const plugins = JSON.parse(fs.readFileSync(pluginsPath, 'utf-8'));
      if (Array.isArray(plugins)) {
        for (const plugin of plugins) {
          skills.push({
            name: plugin.name || 'Unknown Plugin',
            source: 'plugin',
            path: plugin.path || '',
            description: plugin.description,
          });
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return skills;
}

/**
 * Read Claude Code history from ~/.claude/.history
 */
export async function getClaudeHistory(limit = 50): Promise<ClaudeHistoryEntry[]> {
  try {
    const historyPath = path.join(os.homedir(), '.claude', '.history');
    if (!fs.existsSync(historyPath)) return [];

    const content = fs.readFileSync(historyPath, 'utf-8');
    const entries = content.trim().split('\n').filter(Boolean);

    return entries.slice(-limit).reverse().map((line) => {
      const [display, timestampStr, project] = line.split('\t');
      return {
        display: display || '',
        timestamp: parseInt(timestampStr || '0', 10),
        project: project || undefined,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Get all Claude data (settings, stats, projects, plugins, skills, history)
 */
export async function getAllClaudeData(historyLimit = 50): Promise<ClaudeData> {
  try {
    const [settings, stats, projects, plugins, skills, history] = await Promise.all([
      getClaudeSettings(),
      getClaudeStats(),
      getClaudeProjects(),
      getClaudePlugins(),
      getClaudeSkills(),
      getClaudeHistory(historyLimit),
    ]);

    return {
      settings,
      stats,
      projects,
      plugins,
      skills,
      history,
      activeSessions: [],
    };
  } catch (err) {
    console.error('Failed to get Claude data:', err);
    return {
      settings: null,
      stats: null,
      projects: [],
      plugins: [],
      skills: [],
      history: [],
      activeSessions: [],
    };
  }
}
