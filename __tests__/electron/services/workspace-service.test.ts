import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AppSettings } from '../../../electron/types';

const mockState = vi.hoisted(() => ({
  tempHome: process.cwd(),
}));

let tempHome = process.cwd();
let workspaceDir = '';
let outsideDir = '';

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return {
    ...actual,
    homedir: vi.fn(() => mockState.tempHome),
  };
});

vi.mock('../../../electron/utils/decode-project-path', () => ({
  decodeProjectPath: vi.fn((entry: string) => {
    if (entry === 'encoded-workspace') {
      return workspaceDir;
    }
    return entry;
  }),
}));

import {
  createWorkspaceRoot,
  getClaudeWorkspaceRoots,
  getWorkspaceRoots,
  readWorkspaceFile,
  resolveApprovedWorkspacePath,
  writeWorkspaceFile,
} from '../../../electron/services/workspace-service';

beforeEach(() => {
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-service-'));
  workspaceDir = path.join(tempHome, 'workspace');
  outsideDir = path.join(tempHome, 'outside');
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.mkdirSync(outsideDir, { recursive: true });
  mockState.tempHome = tempHome;
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tempHome, { recursive: true, force: true });
});

describe('workspace-service', () => {
  it('creates a workspace root for a valid directory', () => {
    expect(createWorkspaceRoot(workspaceDir)).toEqual({
      path: fs.realpathSync(workspaceDir),
      name: 'workspace',
      source: 'custom',
    });
  });

  it('loads Claude roots from ~/.claude/projects', () => {
    const claudeProjectsDir = path.join(tempHome, '.claude', 'projects');
    fs.mkdirSync(path.join(claudeProjectsDir, 'encoded-workspace'), { recursive: true });

    expect(getClaudeWorkspaceRoots()).toEqual([
      {
        path: fs.realpathSync(workspaceDir),
        name: 'workspace',
        source: 'claude',
      },
    ]);
  });

  it('deduplicates discovered and custom roots', () => {
    const claudeProjectsDir = path.join(tempHome, '.claude', 'projects');
    fs.mkdirSync(path.join(claudeProjectsDir, 'encoded-workspace'), { recursive: true });

    const roots = getWorkspaceRoots({ workspaceRoots: [workspaceDir] } as AppSettings);
    expect(roots).toHaveLength(1);
    expect(roots[0].source).toBe('claude');
  });

  it('rejects symlink escapes outside the approved root', () => {
    const allowedFile = path.join(workspaceDir, 'inside.txt');
    const outsideFile = path.join(outsideDir, 'secret.txt');
    const symlinkPath = path.join(workspaceDir, 'linked-secret.txt');

    fs.writeFileSync(allowedFile, 'inside', 'utf-8');
    fs.writeFileSync(outsideFile, 'outside', 'utf-8');
    fs.symlinkSync(outsideFile, symlinkPath);

    const settings = { workspaceRoots: [workspaceDir] } as AppSettings;
    expect(resolveApprovedWorkspacePath(allowedFile, settings)?.resolvedPath).toBe(fs.realpathSync(allowedFile));
    expect(resolveApprovedWorkspacePath(symlinkPath, settings)).toBeNull();
  });

  it('reads and writes editable files inside an approved root', () => {
    const filePath = path.join(workspaceDir, 'note.md');
    fs.writeFileSync(filePath, '# Hello', 'utf-8');
    const settings = { workspaceRoots: [workspaceDir] } as AppSettings;

    const file = readWorkspaceFile(filePath, settings);
    expect(file.kind).toBe('markdown');
    expect(file.content).toContain('Hello');

    writeWorkspaceFile(filePath, '# Updated', settings);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('# Updated');
  });
});
