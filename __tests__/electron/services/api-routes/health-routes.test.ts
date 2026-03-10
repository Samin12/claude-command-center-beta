import { describe, it, expect, vi } from 'vitest';
import { registerHealthRoutes } from '../../../../electron/services/api-routes/health-routes';
import { RouteApp, RouteContext, RouteRequest, SendJson } from '../../../../electron/services/api-routes/types';

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

const mockCtx = {} as RouteContext;

describe('health-routes', () => {
  it('registers GET /api/health', () => {
    const app = makeRouteApp();
    registerHealthRoutes(app, mockCtx);
    expect(app.routes).toHaveLength(1);
    expect(app.routes[0].method).toBe('GET');
    expect(app.routes[0].pattern).toBe('/api/health');
  });

  it('returns { ok: true }', async () => {
    const app = makeRouteApp();
    registerHealthRoutes(app, mockCtx);

    const sendJson = vi.fn() as unknown as SendJson;
    const req = { params: {} } as RouteRequest;
    await app.routes[0].handler(req, sendJson, mockCtx);
    expect(sendJson).toHaveBeenCalledWith({ ok: true });
  });
});
