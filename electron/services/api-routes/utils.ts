import * as path from 'path';
import * as os from 'os';
import { agents } from '../../core/agent-manager';
import { AgentStatus } from '../../types';

/**
 * Check if a file path is safe to send via Telegram.
 * Blocks sensitive directories that could exfiltrate secrets.
 */
export function isSafeTelegramPath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const home = os.homedir();

  if (!resolved.startsWith(home + path.sep) && resolved !== home) {
    return false;
  }

  const blockedDirs = [
    path.join(home, '.ssh'),
    path.join(home, '.gnupg'),
    path.join(home, '.aws'),
    path.join(home, '.claude'),
    path.join(home, '.env'),
  ];

  for (const blocked of blockedDirs) {
    if (resolved === blocked || resolved.startsWith(blocked + path.sep)) {
      return false;
    }
  }

  return true;
}

/**
 * Find an agent by ID first, then fall back to session ID lookup.
 * Deduplicates a pattern used across hooks and kanban routes.
 */
export function findAgentByIdOrSession(agentId?: string, sessionId?: string): AgentStatus | undefined {
  if (agentId) {
    const agent = agents.get(agentId);
    if (agent) return agent;
  }
  if (sessionId) {
    for (const [, a] of agents) {
      if (a.currentSessionId === sessionId) {
        return a;
      }
    }
  }
  return undefined;
}
