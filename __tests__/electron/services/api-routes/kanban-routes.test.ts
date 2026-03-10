import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../electron/core/agent-manager', () => ({
  agents: new Map(),
  saveAgents: vi.fn(),
}));

vi.mock('../../../../electron/utils/kanban-generate', () => ({
  generateTaskFromPrompt: vi.fn(async (prompt: string) => ({
    title: `Generated: ${prompt}`,
    description: 'Auto-generated',
  })),
}));

const mockLoadTasks = vi.fn(() => []);
const mockSaveTasks = vi.fn();

vi.mock('../../../../electron/handlers/kanban-handlers', () => ({
  loadTasks: (...args: unknown[]) => mockLoadTasks(...args),
  saveTasks: (...args: unknown[]) => mockSaveTasks(...args),
}));

import { registerKanbanRoutes } from '../../../../electron/services/api-routes/kanban-routes';
import { agents } from '../../../../electron/core/agent-manager';
import { RouteApp, RouteContext, RouteRequest } from '../../../../electron/services/api-routes/types';
import { AppSettings } from '../../../../electron/types';

function makeRouteApp(): RouteApp {
  const app: RouteApp = {
    routes: [],
    add(method, pattern, handler) { this.routes.push({ method, pattern, handler }); },
    get(pattern, handler) { this.add('GET', pattern, handler); },
    post(pattern, handler) { this.add('POST', pattern, handler); },
    put(pattern, handler) { this.add('PUT', pattern, handler); },
    delete(pattern, handler) { this.add('DELETE', pattern, handler); },
  };
  return app;
}

let ctx: RouteContext;

beforeEach(() => {
  agents.clear();
  mockLoadTasks.mockClear();
  mockSaveTasks.mockClear();

  ctx = {
    mainWindow: { isDestroyed: () => false, webContents: { send: vi.fn() } } as any,
    appSettings: {} as AppSettings,
    getTelegramBot: () => null,
    getSlackApp: () => null,
    slackResponseChannel: null,
    slackResponseThreadTs: null,
    handleStatusChangeNotificationCallback: vi.fn(),
    sendNotificationCallback: vi.fn(),
    initAgentPtyCallback: vi.fn(),
    agentStatusEmitter: {} as any,
  };
});

describe('kanban-routes', () => {
  function getHandler(app: RouteApp, pattern: string) {
    return app.routes.find(r => r.pattern === pattern)!.handler;
  }

  describe('POST /api/kanban/generate', () => {
    it('generates task from prompt', async () => {
      const app = makeRouteApp();
      registerKanbanRoutes(app, ctx);
      const handler = getHandler(app, '/api/kanban/generate');

      const sendJson = vi.fn();
      await handler({ body: { prompt: 'Fix bug', availableProjects: [] }, params: {} } as RouteRequest, sendJson, ctx);

      expect(sendJson).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        task: expect.objectContaining({ title: 'Generated: Fix bug' }),
      }));
    });

    it('returns 400 when prompt missing', async () => {
      const app = makeRouteApp();
      registerKanbanRoutes(app, ctx);
      const handler = getHandler(app, '/api/kanban/generate');

      const sendJson = vi.fn();
      await handler({ body: {}, params: {} } as RouteRequest, sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'prompt is required' }, 400);
    });
  });

  describe('POST /api/kanban/complete', () => {
    it('completes task by task_id', async () => {
      mockLoadTasks.mockReturnValue([
        { id: 'task-1', title: 'Test', column: 'ongoing', assignedAgentId: 'a1' },
      ]);

      const app = makeRouteApp();
      registerKanbanRoutes(app, ctx);
      const handler = getHandler(app, '/api/kanban/complete');

      const sendJson = vi.fn();
      await handler({ body: { task_id: 'task-1', summary: 'done' }, params: {} } as RouteRequest, sendJson, ctx);

      expect(mockSaveTasks).toHaveBeenCalled();
      const result = sendJson.mock.calls[0][0];
      expect(result.success).toBe(true);
      expect(result.task.column).toBe('done');
      expect(result.task.progress).toBe(100);
    });

    it('returns success when no task found', async () => {
      mockLoadTasks.mockReturnValue([]);
      const app = makeRouteApp();
      registerKanbanRoutes(app, ctx);
      const handler = getHandler(app, '/api/kanban/complete');

      const sendJson = vi.fn();
      await handler({ body: { agent_id: 'nope' }, params: {} } as RouteRequest, sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'No kanban task found for this agent',
      }));
    });

    it('finds task by agent session_id', async () => {
      agents.set('a1', { id: 'a1', currentSessionId: 'sess-1' } as any);
      mockLoadTasks.mockReturnValue([
        { id: 'task-1', title: 'Test', column: 'ongoing', assignedAgentId: 'a1' },
      ]);

      const app = makeRouteApp();
      registerKanbanRoutes(app, ctx);
      const handler = getHandler(app, '/api/kanban/complete');

      const sendJson = vi.fn();
      await handler({ body: { session_id: 'sess-1' }, params: {} } as RouteRequest, sendJson, ctx);

      const result = sendJson.mock.calls[0][0];
      expect(result.success).toBe(true);
      expect(result.task.column).toBe('done');
    });
  });
});
