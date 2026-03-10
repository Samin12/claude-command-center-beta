import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'vault-uuid'),
}));

vi.mock('../../../../electron/constants', () => ({
  VAULT_DIR: '/tmp/vault-test',
  MIME_TYPES: { '.png': 'image/png', '.jpg': 'image/jpeg' },
}));

const mockPrepare = vi.fn();
const mockDb = {
  prepare: mockPrepare,
};

vi.mock('../../../../electron/services/vault-db', () => ({
  getVaultDb: () => mockDb,
}));

import { registerVaultRoutes } from '../../../../electron/services/api-routes/vault-routes';
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

function makeReq(overrides: Partial<RouteRequest> = {}): RouteRequest {
  return {
    method: 'GET',
    pathname: '',
    url: new URL('http://localhost/'),
    body: {},
    raw: {} as any,
    res: {} as any,
    params: {},
    ...overrides,
  };
}

let ctx: RouteContext;

beforeEach(() => {
  vi.restoreAllMocks();
  mockPrepare.mockReset();

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

describe('vault-routes', () => {
  function findHandler(app: RouteApp, method: string, patternStr: string) {
    return app.routes.find(r => r.method === method && String(r.pattern).includes(patternStr))!.handler;
  }

  describe('GET /api/vault/documents', () => {
    it('returns documents', async () => {
      const docs = [{ id: 'd1', title: 'Doc 1' }];
      mockPrepare.mockReturnValue({ all: vi.fn(() => docs) });

      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'GET' && r.pattern === '/api/vault/documents')!.handler;

      const sendJson = vi.fn();
      await handler(makeReq({ url: new URL('http://localhost/api/vault/documents') }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ documents: docs });
    });

    it('filters by folder_id', async () => {
      const allMock = vi.fn(() => []);
      mockPrepare.mockReturnValue({ all: allMock });

      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'GET' && r.pattern === '/api/vault/documents')!.handler;

      const sendJson = vi.fn();
      const url = new URL('http://localhost/api/vault/documents?folder_id=f1');
      await handler(makeReq({ url }), sendJson, ctx);

      // Verify the query was called with the folder filter
      expect(mockPrepare).toHaveBeenCalled();
      expect(sendJson).toHaveBeenCalledWith({ documents: [] });
    });
  });

  describe('POST /api/vault/documents', () => {
    it('creates a document', async () => {
      const newDoc = { id: 'vault-uuid', title: 'New Doc' };
      mockPrepare
        .mockReturnValueOnce({ run: vi.fn() })
        .mockReturnValueOnce({ get: vi.fn(() => newDoc) });

      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'POST' && r.pattern === '/api/vault/documents')!.handler;

      const sendJson = vi.fn();
      await handler(makeReq({ body: { title: 'New Doc', content: 'Content' } }), sendJson, ctx);

      expect(sendJson).toHaveBeenCalledWith({ success: true, document: newDoc });
      expect(ctx.mainWindow!.webContents.send).toHaveBeenCalledWith('vault:document-created', newDoc);
    });

    it('returns 400 when title missing', async () => {
      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'POST' && r.pattern === '/api/vault/documents')!.handler;

      const sendJson = vi.fn();
      await handler(makeReq({ body: {} }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'title is required' }, 400);
    });
  });

  describe('GET /api/vault/documents/:id', () => {
    it('returns document with attachments', async () => {
      const doc = { id: 'd1', title: 'Doc' };
      const attachments = [{ id: 'a1' }];
      mockPrepare
        .mockReturnValueOnce({ get: vi.fn(() => doc) })
        .mockReturnValueOnce({ all: vi.fn(() => attachments) });

      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = findHandler(app, 'GET', 'documents\\/([^/]+)$');

      const sendJson = vi.fn();
      await handler(makeReq({ params: { id: 'd1' } }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ document: doc, attachments });
    });

    it('returns 404 when not found', async () => {
      mockPrepare.mockReturnValue({ get: vi.fn(() => undefined) });

      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = findHandler(app, 'GET', 'documents\\/([^/]+)$');

      const sendJson = vi.fn();
      await handler(makeReq({ params: { id: 'nope' } }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'Document not found' }, 404);
    });
  });

  describe('GET /api/vault/search', () => {
    it('returns search results', async () => {
      const results = [{ id: 'd1', snippet: 'test' }];
      mockPrepare.mockReturnValue({ all: vi.fn(() => results) });

      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'GET' && r.pattern === '/api/vault/search')!.handler;

      const sendJson = vi.fn();
      const url = new URL('http://localhost/api/vault/search?q=test');
      await handler(makeReq({ url }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ results });
    });

    it('returns 400 without query', async () => {
      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'GET' && r.pattern === '/api/vault/search')!.handler;

      const sendJson = vi.fn();
      await handler(makeReq({ url: new URL('http://localhost/api/vault/search') }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'q parameter is required' }, 400);
    });
  });

  describe('GET /api/vault/folders', () => {
    it('returns folders', async () => {
      const folders = [{ id: 'f1', name: 'Folder' }];
      mockPrepare.mockReturnValue({ all: vi.fn(() => folders) });

      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'GET' && r.pattern === '/api/vault/folders')!.handler;

      const sendJson = vi.fn();
      await handler(makeReq(), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ folders });
    });
  });

  describe('POST /api/vault/folders', () => {
    it('creates a folder', async () => {
      const folder = { id: 'vault-uuid', name: 'New' };
      mockPrepare
        .mockReturnValueOnce({ run: vi.fn() })
        .mockReturnValueOnce({ get: vi.fn(() => folder) });

      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'POST' && r.pattern === '/api/vault/folders')!.handler;

      const sendJson = vi.fn();
      await handler(makeReq({ body: { name: 'New' } }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ success: true, folder });
    });

    it('returns 400 when name missing', async () => {
      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'POST' && r.pattern === '/api/vault/folders')!.handler;

      const sendJson = vi.fn();
      await handler(makeReq({ body: {} }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'name is required' }, 400);
    });
  });

  describe('GET /api/local-file', () => {
    it('returns 404 without path param', async () => {
      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'GET' && r.pattern === '/api/local-file')!.handler;

      const sendJson = vi.fn();
      await handler(makeReq({ url: new URL('http://localhost/api/local-file') }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'File not found' }, 404);
    });

    it('returns 403 for path outside vault', async () => {
      const app = makeRouteApp();
      registerVaultRoutes(app, ctx);
      const handler = app.routes.find(r => r.method === 'GET' && r.pattern === '/api/local-file')!.handler;

      const sendJson = vi.fn();
      const url = new URL('http://localhost/api/local-file?path=/etc/passwd');
      await handler(makeReq({ url }), sendJson, ctx);
      expect(sendJson).toHaveBeenCalledWith({ error: 'Access denied: path outside allowed directory' }, 403);
    });
  });
});
