import type { AgentCharacter } from '@/types/electron';

// Character emoji/icons mapping
export const CHARACTER_FACES: Record<AgentCharacter, string> = {
  robot: '🤖',
  ninja: '🥷',
  wizard: '🧙',
  astronaut: '👨‍🚀',
  knight: '⚔️',
  pirate: '🏴‍☠️',
  alien: '👽',
  viking: '🪓',
  frog: '🐸',
};

// Terminal theme configuration
export const TERMINAL_THEME = {
  background: '#1a1a2e',
  foreground: '#e4e4e7',
  cursor: '#3D9B94',
  cursorAccent: '#1a1a2e',
  selectionBackground: '#3D9B9433',
  black: '#18181b',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#3D9B94',
  white: '#e4e4e7',
  brightBlack: '#52525b',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa',
} as const;

// Light terminal theme
export const TERMINAL_THEME_LIGHT = {
  background: '#FFFFFF',
  foreground: '#1a1a2e',
  cursor: '#3D9B94',
  cursorAccent: '#FFFFFF',
  selectionBackground: '#3D9B9433',
  black: '#1a1a2e',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#ca8a04',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0d7377',
  white: '#e4e4e7',
  brightBlack: '#71717a',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#eab308',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#3D9B94',
  brightWhite: '#fafafa',
} as const;

// Helper to get terminal theme by name
export function getTerminalTheme(theme: 'dark' | 'light' = 'dark') {
  return theme === 'light' ? TERMINAL_THEME_LIGHT : TERMINAL_THEME;
}

// Quick terminal theme (slightly different background)
export const QUICK_TERMINAL_THEME = {
  ...TERMINAL_THEME,
  background: '#0f0f1a',
  cursor: '#a855f7',
  cursorAccent: '#0f0f1a',
  selectionBackground: '#a855f733',
} as const;

// Terminal configuration
export const TERMINAL_CONFIG = {
  fontSize: 13,
  fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
  cursorBlink: true,
  cursorStyle: 'bar' as const,
  scrollback: 10000,
  convertEol: true,
};

export const QUICK_TERMINAL_CONFIG = {
  ...TERMINAL_CONFIG,
  fontSize: 12,
  scrollback: 5000,
};

// Language mappings for syntax highlighting
export const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  json: 'json',
  md: 'markdown',
  css: 'css',
  scss: 'scss',
  html: 'markup',
  xml: 'markup',
  yaml: 'yaml',
  yml: 'yaml',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  prisma: 'graphql',
};

// Get language from file extension
export const getLanguageFromPath = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return LANGUAGE_MAP[ext] || 'typescript';
};

// File tree types
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  isExpanded?: boolean;
}

// Git data types
export interface GitData {
  branch: string;
  status: Array<{ status: string; file: string }>;
  diff: string;
  commits: Array<{ hash: string; message: string; author: string; date: string }>;
}

// Initial git data state
export const INITIAL_GIT_DATA: GitData = {
  branch: '',
  status: [],
  diff: '',
  commits: [],
};
