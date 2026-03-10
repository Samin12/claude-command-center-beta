import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

import { decodeProjectPath } from '../../electron/utils/decode-project-path';

const existsSyncMock = vi.mocked(fs.existsSync);

beforeEach(() => {
  existsSyncMock.mockReset();
});

/**
 * Helper: given a real filesystem path, register all its prefixes as existing.
 * e.g. '/Users/charlie/Documents' registers /, /Users, /Users/charlie, /Users/charlie/Documents
 */
function registerPath(fullPath: string) {
  const parts = fullPath.split('/').filter(Boolean);
  let current = '/';
  const paths = new Set<string>(['/']);
  for (const part of parts) {
    current = current === '/' ? `/${part}` : `${current}/${part}`;
    paths.add(current);
  }
  existsSyncMock.mockImplementation((p: fs.PathLike) => {
    return paths.has(String(p));
  });
  return paths;
}

/**
 * Helper: register multiple paths that coexist on the same filesystem.
 */
function registerPaths(fullPaths: string[]) {
  const allPaths = new Set<string>(['/']);
  for (const fullPath of fullPaths) {
    const parts = fullPath.split('/').filter(Boolean);
    let current = '/';
    for (const part of parts) {
      current = current === '/' ? `/${part}` : `${current}/${part}`;
      allPaths.add(current);
    }
  }
  existsSyncMock.mockImplementation((p: fs.PathLike) => {
    return allPaths.has(String(p));
  });
  return allPaths;
}

describe('decodeProjectPath', () => {
  describe('simple paths (no ambiguity)', () => {
    it('decodes a basic path with no dashes or dots in names', () => {
      registerPath('/Users/charlie/Documents/myproject');
      expect(decodeProjectPath('-Users-charlie-Documents-myproject'))
        .toBe('/Users/charlie/Documents/myproject');
    });
  });

  describe('paths with dashes in directory names', () => {
    it('decodes a path where a directory name contains a dash', () => {
      registerPath('/Users/charlie/Documents/octav-frontend-lite');
      expect(decodeProjectPath('-Users-charlie-Documents-octav-frontend-lite'))
        .toBe('/Users/charlie/Documents/octav-frontend-lite');
    });

    it('decodes a path with a single-dash directory name', () => {
      registerPath('/Users/charlie/Documents/my-project');
      expect(decodeProjectPath('-Users-charlie-Documents-my-project'))
        .toBe('/Users/charlie/Documents/my-project');
    });
  });

  describe('paths with dots in directory names (the bug)', () => {
    it('decodes docs.octav.fi correctly', () => {
      registerPath('/Users/charlie/Documents/docs.octav.fi');
      expect(decodeProjectPath('-Users-charlie-Documents-docs-octav-fi'))
        .toBe('/Users/charlie/Documents/docs.octav.fi');
    });

    it('decodes nav.octav.fi correctly', () => {
      registerPath('/Users/charlie/Documents/nav.octav.fi');
      expect(decodeProjectPath('-Users-charlie-Documents-nav-octav-fi'))
        .toBe('/Users/charlie/Documents/nav.octav.fi');
    });

    it('decodes perps.octav.fi correctly', () => {
      registerPath('/Users/charlie/Documents/perps.octav.fi');
      expect(decodeProjectPath('-Users-charlie-Documents-perps-octav-fi'))
        .toBe('/Users/charlie/Documents/perps.octav.fi');
    });
  });

  describe('paths with mixed separators', () => {
    it('decodes a directory with both dot and dash', () => {
      registerPath('/Users/charlie/Documents/my-app.v2');
      expect(decodeProjectPath('-Users-charlie-Documents-my-app-v2'))
        .toBe('/Users/charlie/Documents/my-app.v2');
    });
  });

  describe('fallback behavior', () => {
    it('falls back gracefully when directory does not exist on disk', () => {
      // Only root and /Users exist
      existsSyncMock.mockImplementation((p: fs.PathLike) => {
        const s = String(p);
        return s === '/' || s === '/Users';
      });
      const result = decodeProjectPath('-Users-nonexistent-path');
      // Should still produce a valid-looking path even if not on disk
      expect(result).toContain('/Users');
      expect(result).toContain('nonexistent');
      expect(result).toContain('path');
    });
  });

  describe('disambiguation when both forms exist', () => {
    it('prefers the longer (dash-joined) match when both exist', () => {
      // Both /Users/charlie/Documents/octav-server and
      // /Users/charlie/Documents/octav/server exist
      registerPaths([
        '/Users/charlie/Documents/octav-server',
        '/Users/charlie/Documents/octav/server',
      ]);
      // The greedy longest-first approach should match octav-server
      expect(decodeProjectPath('-Users-charlie-Documents-octav-server'))
        .toBe('/Users/charlie/Documents/octav-server');
    });
  });

  describe('real-world encoded directory names', () => {
    it('handles morpho.octav.fi', () => {
      registerPath('/Users/charlie/Documents/morpho.octav.fi');
      expect(decodeProjectPath('-Users-charlie-Documents-morpho-octav-fi'))
        .toBe('/Users/charlie/Documents/morpho.octav.fi');
    });

    it('handles resolv.octav.fi', () => {
      registerPath('/Users/charlie/Documents/resolv.octav.fi');
      expect(decodeProjectPath('-Users-charlie-Documents-resolv-octav-fi'))
        .toBe('/Users/charlie/Documents/resolv.octav.fi');
    });

    it('handles octav-admin-frontend-v2 (dashes only)', () => {
      registerPath('/Users/charlie/Documents/octav-admin-frontend-v2');
      expect(decodeProjectPath('-Users-charlie-Documents-octav-admin-frontend-v2'))
        .toBe('/Users/charlie/Documents/octav-admin-frontend-v2');
    });
  });
});
