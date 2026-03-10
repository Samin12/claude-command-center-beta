import * as path from 'path';
import * as fs from 'fs';

/**
 * Decode a Claude Code project directory name back to a filesystem path.
 *
 * Claude Code encodes project paths by replacing both `/` and `.` with `-`.
 * For example: `/Users/charlie/Documents/docs.octav.fi`
 *   → `-Users-charlie-Documents-docs-octav-fi`
 *
 * To decode, we greedily match tokens against the filesystem, trying the
 * longest possible segment first. For each candidate segment we try all
 * combinations of `-` and `.` as separators so that both `frontend-lite`
 * and `docs.octav.fi` are correctly reconstructed.
 */
export function decodeProjectPath(dirName: string): string {
  const tokens = dirName.replace(/^-/, '').split('-');
  let resolved = '/';
  let i = 0;

  while (i < tokens.length) {
    let matched = false;

    for (let len = tokens.length - i; len >= 1; len--) {
      const subTokens = tokens.slice(i, i + len);

      if (len === 1) {
        // Single token — no separator ambiguity
        const candidate = path.join(resolved, subTokens[0]);
        try {
          if (fs.existsSync(candidate)) {
            resolved = candidate;
            i += 1;
            matched = true;
            break;
          }
        } catch { /* ignore */ }
      } else {
        // Try all separator combinations (-, .) for this group of tokens
        const names = separatorCombinations(subTokens);
        for (const name of names) {
          const candidate = path.join(resolved, name);
          try {
            if (fs.existsSync(candidate)) {
              resolved = candidate;
              i += len;
              matched = true;
              break;
            }
          } catch { /* ignore */ }
        }
        if (matched) break;
      }
    }

    if (!matched) {
      // Nothing found on disk — append the single token as-is
      resolved = path.join(resolved, tokens[i]);
      i++;
    }
  }

  return resolved;
}

/**
 * Generate all possible names by joining tokens with `-` or `.` at each position.
 * For N tokens there are 2^(N-1) combinations. Capped at 7 tokens (64 combos).
 */
function separatorCombinations(tokens: string[]): string[] {
  if (tokens.length <= 1) return [tokens[0] || ''];

  const separators = ['-', '.'];
  const positions = tokens.length - 1;

  // Safety cap — for very long token sequences just try all-dash and all-dot
  if (positions > 6) {
    return [tokens.join('-'), tokens.join('.')];
  }

  const total = 1 << positions; // 2^positions
  const results: string[] = [];

  for (let mask = 0; mask < total; mask++) {
    let result = tokens[0];
    for (let j = 0; j < positions; j++) {
      const sepIdx = (mask >> j) & 1;
      result += separators[sepIdx] + tokens[j + 1];
    }
    results.push(result);
  }

  return results;
}
