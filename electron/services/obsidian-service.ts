import * as fs from 'fs';
import * as path from 'path';

export interface ObsidianFile {
  name: string;
  path: string;
  relativePath: string;
  content: string;
  size: number;
  lastModified: string;
  frontmatter?: Record<string, unknown>;
}

export interface ObsidianFolder {
  name: string;
  path: string;
  relativePath: string;
  children: (ObsidianFolder | { type: 'file'; name: string; relativePath: string })[];
}

/**
 * Validate that a file path is within the vault directory.
 * Uses path.resolve + startsWith to prevent traversal bypasses.
 */
export function isWithinVault(filePath: string, vaultPath: string): boolean {
  const resolved = path.resolve(filePath);
  const resolvedVault = path.resolve(vaultPath);
  return resolved.startsWith(resolvedVault + path.sep) || resolved === resolvedVault;
}

/**
 * Parse YAML frontmatter from markdown content.
 * Extracts key-value pairs from `---` delimited blocks.
 */
export function parseFrontmatter(content: string): Record<string, unknown> | undefined {
  if (!content.startsWith('---')) return undefined;

  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) return undefined;

  const yaml = content.slice(4, endIndex).trim();
  const result: Record<string, unknown> = {};

  for (const line of yaml.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let value: unknown = line.slice(colonIndex + 1).trim();

    // Simple type coercion
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10);
    // Handle YAML arrays like [tag1, tag2]
    else if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    }

    if (key) result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Recursively scan an Obsidian vault.
 * Skips `.obsidian/` directory and non-`.md` files.
 */
export function scanVault(vaultPath: string): { files: (Omit<ObsidianFile, 'content'> & { preview?: string })[]; tree: ObsidianFolder } {
  if (!fs.existsSync(vaultPath)) {
    return { files: [], tree: { name: path.basename(vaultPath), path: vaultPath, relativePath: '', children: [] } };
  }

  const files: (Omit<ObsidianFile, 'content'> & { preview?: string })[] = [];

  function walkDir(dirPath: string, relativeTo: string): ObsidianFolder {
    const dirName = path.basename(dirPath);
    const relPath = path.relative(relativeTo, dirPath);
    const folder: ObsidianFolder = {
      name: dirName,
      path: dirPath,
      relativePath: relPath || '',
      children: [],
    };

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return folder;
    }

    // Sort: folders first, then files, both alphabetical
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip .obsidian config dir and hidden dirs
        if (entry.name.startsWith('.')) continue;
        folder.children.push(walkDir(fullPath, relativeTo));
      } else if (entry.name.endsWith('.md')) {
        const entryRelPath = path.relative(relativeTo, fullPath);
        try {
          const stat = fs.statSync(fullPath);
          // Read first 200 chars for preview snippet
          let preview = '';
          try {
            const fd = fs.openSync(fullPath, 'r');
            const buf = Buffer.alloc(256);
            const bytesRead = fs.readSync(fd, buf, 0, 256, 0);
            fs.closeSync(fd);
            let raw = buf.toString('utf-8', 0, bytesRead);
            // Strip frontmatter
            if (raw.startsWith('---')) {
              const endIdx = raw.indexOf('\n---', 3);
              if (endIdx !== -1) raw = raw.slice(endIdx + 4).trimStart();
            }
            preview = raw.replace(/[#*_`~\[\]]/g, '').trim().slice(0, 120);
          } catch { /* ignore */ }
          files.push({
            name: entry.name,
            path: fullPath,
            relativePath: entryRelPath,
            size: stat.size,
            lastModified: stat.mtime.toISOString(),
            preview,
          });
          folder.children.push({ type: 'file', name: entry.name, relativePath: entryRelPath });
        } catch {
          // Skip unreadable files
        }
      }
    }

    return folder;
  }

  const tree = walkDir(vaultPath, vaultPath);
  return { files, tree };
}

/**
 * Read a single file from the vault with path validation.
 */
export function readVaultFile(filePath: string, vaultPath: string): { file?: ObsidianFile; error?: string } {
  if (!vaultPath) {
    return { error: 'No Obsidian vault configured' };
  }

  if (!isWithinVault(filePath, vaultPath)) {
    return { error: 'Access denied: path outside vault directory' };
  }

  try {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(vaultPath, filePath);

    return {
      file: {
        name: path.basename(filePath),
        path: filePath,
        relativePath,
        content,
        size: stat.size,
        lastModified: stat.mtime.toISOString(),
        frontmatter: parseFrontmatter(content),
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to read file' };
  }
}
