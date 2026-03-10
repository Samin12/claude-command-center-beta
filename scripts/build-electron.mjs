import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const mcpPackages = [
  'mcp-orchestrator',
  'mcp-telegram',
  'mcp-kanban',
  'mcp-vault',
  'mcp-socialdata',
  'mcp-x',
  'mcp-world',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function moveIfExists(sourcePath, backupPath) {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  if (fs.existsSync(backupPath)) {
    throw new Error(`Backup path already exists: ${backupPath}`);
  }

  fs.renameSync(sourcePath, backupPath);
  return true;
}

function reconcileBackupState(sourcePath, backupPath) {
  if (fs.existsSync(backupPath) && !fs.existsSync(sourcePath)) {
    fs.renameSync(backupPath, sourcePath);
  }
}

function restoreIfExists(backupPath, sourcePath) {
  if (!fs.existsSync(backupPath)) {
    return;
  }

  if (fs.existsSync(sourcePath)) {
    fs.rmSync(sourcePath, { recursive: true, force: true });
  }

  fs.renameSync(backupPath, sourcePath);
}

const apiDir = path.join(rootDir, 'src', 'app', 'api');
const apiBackupDir = path.join(rootDir, 'src', 'app', '_api_backup');
const iconFile = path.join(rootDir, 'src', 'app', 'icon.tsx');
const iconBackupFile = path.join(rootDir, 'src', 'app', '_icon_backup.tsx');
const electronBuilderArgs = process.argv.slice(2);

if (electronBuilderArgs.length === 0) {
  console.error('No electron-builder arguments were provided.');
  process.exit(1);
}

let apiMoved = false;
let iconMoved = false;

try {
  reconcileBackupState(apiDir, apiBackupDir);
  reconcileBackupState(iconFile, iconBackupFile);

  apiMoved = moveIfExists(apiDir, apiBackupDir);
  iconMoved = moveIfExists(iconFile, iconBackupFile);

  run(npxCmd, ['next', 'build'], {
    env: { ELECTRON_BUILD: '1' },
  });
  run(npxCmd, ['tsc', '-p', 'electron/tsconfig.json']);

  for (const pkg of mcpPackages) {
    const packageDir = path.join(rootDir, pkg);
    run(npmCmd, ['install'], { cwd: packageDir });
    run(npmCmd, ['run', 'build'], { cwd: packageDir });
  }

  run(npxCmd, ['electron-builder', ...electronBuilderArgs]);
} finally {
  if (apiMoved || fs.existsSync(apiBackupDir)) {
    restoreIfExists(apiBackupDir, apiDir);
  }

  if (iconMoved || fs.existsSync(iconBackupFile)) {
    restoreIfExists(iconBackupFile, iconFile);
  }
}
