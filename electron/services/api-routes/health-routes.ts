import { RouteApp, RouteContext } from './types';

export function registerHealthRoutes(app: RouteApp, _ctx: RouteContext): void {
  app.get('/api/health', (req, sendJson) => {
    sendJson({ ok: true });
  });
}
