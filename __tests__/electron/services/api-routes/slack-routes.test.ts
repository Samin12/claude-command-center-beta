import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerSlackRoutes } from '../../../../electron/services/api-routes/slack-routes';
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

const mockPostMessage = vi.fn();
let ctx: RouteContext;

beforeEach(() => {
  mockPostMessage.mockReset();
  ctx = {
    mainWindow: null,
    appSettings: { slackChannelId: 'C123' } as unknown as AppSettings,
    getTelegramBot: () => null,
    getSlackApp: () => ({
      client: { chat: { postMessage: mockPostMessage } },
    }) as any,
    slackResponseChannel: null,
    slackResponseThreadTs: null,
    handleStatusChangeNotificationCallback: vi.fn(),
    sendNotificationCallback: vi.fn(),
    initAgentPtyCallback: vi.fn(),
    agentStatusEmitter: {} as any,
  };
});

describe('slack-routes', () => {
  it('sends message to Slack', async () => {
    mockPostMessage.mockResolvedValue(undefined);
    const app = makeRouteApp();
    registerSlackRoutes(app, ctx);

    const sendJson = vi.fn();
    await app.routes[0].handler({ body: { message: 'Hello' }, params: {} } as RouteRequest, sendJson, ctx);

    expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'C123',
      text: ':crown: Hello',
    }));
    expect(sendJson).toHaveBeenCalledWith({ success: true });
  });

  it('uses thread_ts when available', async () => {
    ctx.slackResponseThreadTs = 'ts-123';
    mockPostMessage.mockResolvedValue(undefined);
    const app = makeRouteApp();
    registerSlackRoutes(app, ctx);

    const sendJson = vi.fn();
    await app.routes[0].handler({ body: { message: 'Reply' }, params: {} } as RouteRequest, sendJson, ctx);

    expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
      thread_ts: 'ts-123',
    }));
  });

  it('returns 400 when message missing', async () => {
    const app = makeRouteApp();
    registerSlackRoutes(app, ctx);

    const sendJson = vi.fn();
    await app.routes[0].handler({ body: {}, params: {} } as RouteRequest, sendJson, ctx);
    expect(sendJson).toHaveBeenCalledWith({ error: 'message is required' }, 400);
  });

  it('returns 400 when slack not configured', async () => {
    ctx.getSlackApp = () => null;
    const app = makeRouteApp();
    registerSlackRoutes(app, ctx);

    const sendJson = vi.fn();
    await app.routes[0].handler({ body: { message: 'hi' }, params: {} } as RouteRequest, sendJson, ctx);
    expect(sendJson).toHaveBeenCalledWith({ error: 'Slack not configured or no channel ID' }, 400);
  });
});
