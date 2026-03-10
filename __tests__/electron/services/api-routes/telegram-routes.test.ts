import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

import { registerTelegramRoutes } from '../../../../electron/services/api-routes/telegram-routes';
import { RouteApp, RouteContext, RouteRequest, SendJson } from '../../../../electron/services/api-routes/types';
import { AppSettings } from '../../../../electron/types';

vi.mock('../../../../electron/core/agent-manager', () => ({
  agents: new Map(),
  saveAgents: vi.fn(),
}));

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

function makeReq(body: Record<string, unknown>): RouteRequest {
  return { body, params: {} } as RouteRequest;
}

let ctx: RouteContext;
const mockSendMessage = vi.fn();
const mockSendPhoto = vi.fn();
const mockSendVideo = vi.fn();
const mockSendDocument = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  mockSendMessage.mockReset();
  mockSendPhoto.mockReset();
  mockSendVideo.mockReset();
  mockSendDocument.mockReset();

  ctx = {
    mainWindow: null,
    appSettings: {
      telegramChatId: '12345',
      telegramAuthorizedChatIds: ['12345'],
    } as unknown as AppSettings,
    getTelegramBot: () => ({
      sendMessage: mockSendMessage,
      sendPhoto: mockSendPhoto,
      sendVideo: mockSendVideo,
      sendDocument: mockSendDocument,
    }) as any,
    getSlackApp: () => null,
    slackResponseChannel: null,
    slackResponseThreadTs: null,
    handleStatusChangeNotificationCallback: vi.fn(),
    sendNotificationCallback: vi.fn(),
    initAgentPtyCallback: vi.fn(),
    agentStatusEmitter: {} as any,
  };
});

describe('telegram-routes', () => {
  function getHandler(app: RouteApp, pattern: string) {
    return app.routes.find(r => r.pattern === pattern)!.handler;
  }

  describe('POST /api/telegram/send', () => {
    it('sends message via telegram', async () => {
      mockSendMessage.mockResolvedValue(undefined);
      const app = makeRouteApp();
      registerTelegramRoutes(app, ctx);
      const handler = getHandler(app, '/api/telegram/send');

      const sendJson = vi.fn();
      await handler(makeReq({ message: 'Hello' }), sendJson, ctx);
      expect(mockSendMessage).toHaveBeenCalled();
      expect(sendJson).toHaveBeenCalledWith({ success: true });
    });

    it('returns 400 when message missing', async () => {
      const app = makeRouteApp();
      registerTelegramRoutes(app, ctx);
      const handler = getHandler(app, '/api/telegram/send');

      const sendJson = vi.fn();
      await handler(makeReq({}), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'message is required' }, 400);
    });

    it('returns 400 when bot not configured', async () => {
      ctx.getTelegramBot = () => null;
      const app = makeRouteApp();
      registerTelegramRoutes(app, ctx);
      const handler = getHandler(app, '/api/telegram/send');

      const sendJson = vi.fn();
      await handler(makeReq({ message: 'hello' }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Telegram not configured') }),
        400
      );
    });
  });

  describe('POST /api/telegram/send-photo', () => {
    it('returns 400 when photo_path missing', async () => {
      const app = makeRouteApp();
      registerTelegramRoutes(app, ctx);
      const handler = getHandler(app, '/api/telegram/send-photo');

      const sendJson = vi.fn();
      await handler(makeReq({}), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'photo_path is required' }, 400);
    });

    it('returns 403 for unsafe path', async () => {
      const app = makeRouteApp();
      registerTelegramRoutes(app, ctx);
      const handler = getHandler(app, '/api/telegram/send-photo');

      const sendJson = vi.fn();
      await handler(makeReq({ photo_path: '/etc/passwd' }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'Access denied: path not allowed' }, 403);
    });
  });
});
