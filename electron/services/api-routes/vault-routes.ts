import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { VAULT_DIR, MIME_TYPES } from '../../constants';
import { getVaultDb } from '../vault-db';
import { RouteApp, RouteContext } from './types';

export function registerVaultRoutes(app: RouteApp, ctx: RouteContext): void {
  // GET /api/vault/documents
  app.get('/api/vault/documents', (req, sendJson) => {
    try {
      const db = getVaultDb();
      const folderId = req.url.searchParams.get('folder_id');
      const tagsParam = req.url.searchParams.get('tags');

      let query = 'SELECT * FROM documents';
      const conditions: string[] = [];
      const queryParams: unknown[] = [];

      if (folderId) {
        conditions.push('folder_id = ?');
        queryParams.push(folderId);
      }
      if (tagsParam) {
        const tags = tagsParam.split(',');
        const tagConditions = tags.map(() => "tags LIKE ?");
        conditions.push(`(${tagConditions.join(' OR ')})`);
        tags.forEach(tag => queryParams.push(`%"${tag.trim()}"%`));
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY updated_at DESC';

      const documents = db.prepare(query).all(...queryParams);
      sendJson({ documents });
    } catch (err) {
      sendJson({ error: String(err) }, 500);
    }
  });

  // POST /api/vault/documents
  app.post('/api/vault/documents', (req, sendJson) => {
    try {
      const db = getVaultDb();
      const { title, content, folder_id, author, agent_id, tags } = req.body as {
        title: string; content: string; folder_id?: string;
        author?: string; agent_id?: string; tags?: string[];
      };

      if (!title) {
        sendJson({ error: 'title is required' }, 400);
        return;
      }

      const id = uuidv4();
      const now = new Date().toISOString();
      const tagsJson = JSON.stringify(tags || []);

      db.prepare(`
        INSERT INTO documents (id, title, content, folder_id, author, agent_id, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, title, content || '', folder_id || null, author || 'api', agent_id || null, tagsJson, now, now);

      const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);

      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('vault:document-created', document);
      }

      sendJson({ success: true, document });
    } catch (err) {
      sendJson({ error: String(err) }, 500);
    }
  });

  // GET /api/vault/documents/:id
  app.get(/^\/api\/vault\/documents\/([^/]+)$/, (req, sendJson) => {
    try {
      const db = getVaultDb();
      const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
      if (!document) {
        sendJson({ error: 'Document not found' }, 404);
        return;
      }
      const attachments = db.prepare('SELECT * FROM attachments WHERE document_id = ? ORDER BY created_at DESC').all(req.params.id);
      sendJson({ document, attachments });
    } catch (err) {
      sendJson({ error: String(err) }, 500);
    }
  });

  // PUT /api/vault/documents/:id
  app.put(/^\/api\/vault\/documents\/([^/]+)$/, (req, sendJson) => {
    try {
      const db = getVaultDb();
      const docId = req.params.id;
      const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
      if (!existing) {
        sendJson({ error: 'Document not found' }, 404);
        return;
      }

      const { title, content, tags, folder_id } = req.body as {
        title?: string; content?: string; tags?: string[]; folder_id?: string | null;
      };

      const now = new Date().toISOString();
      const updates: string[] = ['updated_at = ?'];
      const values: unknown[] = [now];

      if (title !== undefined) { updates.push('title = ?'); values.push(title); }
      if (content !== undefined) { updates.push('content = ?'); values.push(content); }
      if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
      if (folder_id !== undefined) { updates.push('folder_id = ?'); values.push(folder_id); }

      values.push(docId);
      db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);

      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('vault:document-updated', document);
      }

      sendJson({ success: true, document });
    } catch (err) {
      sendJson({ error: String(err) }, 500);
    }
  });

  // DELETE /api/vault/documents/:id
  app.delete(/^\/api\/vault\/documents\/([^/]+)$/, (req, sendJson) => {
    try {
      const db = getVaultDb();
      const docId = req.params.id;

      const attachments = db.prepare('SELECT filepath FROM attachments WHERE document_id = ?').all(docId) as { filepath: string }[];
      for (const att of attachments) {
        try { if (fs.existsSync(att.filepath)) fs.unlinkSync(att.filepath); } catch { /* ignore */ }
      }

      db.prepare('DELETE FROM documents WHERE id = ?').run(docId);

      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('vault:document-deleted', { id: docId });
      }

      sendJson({ success: true });
    } catch (err) {
      sendJson({ error: String(err) }, 500);
    }
  });

  // GET /api/vault/search
  app.get('/api/vault/search', (req, sendJson) => {
    try {
      const db = getVaultDb();
      const query = req.url.searchParams.get('q');
      const limit = parseInt(req.url.searchParams.get('limit') || '20', 10);

      if (!query) {
        sendJson({ error: 'q parameter is required' }, 400);
        return;
      }

      const results = db.prepare(`
        SELECT d.*, snippet(documents_fts, 1, '<mark>', '</mark>', '...', 40) as snippet
        FROM documents_fts fts
        JOIN documents d ON d.rowid = fts.rowid
        WHERE documents_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(query, limit);
      sendJson({ results });
    } catch (err) {
      sendJson({ error: String(err) }, 500);
    }
  });

  // GET /api/vault/folders
  app.get('/api/vault/folders', (req, sendJson) => {
    try {
      const db = getVaultDb();
      const folders = db.prepare('SELECT * FROM folders ORDER BY name').all();
      sendJson({ folders });
    } catch (err) {
      sendJson({ error: String(err) }, 500);
    }
  });

  // POST /api/vault/folders
  app.post('/api/vault/folders', (req, sendJson) => {
    try {
      const db = getVaultDb();
      const { name, parent_id } = req.body as { name: string; parent_id?: string };

      if (!name) {
        sendJson({ error: 'name is required' }, 400);
        return;
      }

      const id = uuidv4();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, parent_id || null, now, now);

      const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
      sendJson({ success: true, folder });
    } catch (err) {
      sendJson({ error: String(err) }, 500);
    }
  });

  // DELETE /api/vault/folders/:id
  app.delete(/^\/api\/vault\/folders\/([^/]+)$/, (req, sendJson) => {
    try {
      const db = getVaultDb();
      const folderId = req.params.id;

      db.prepare('UPDATE documents SET folder_id = NULL WHERE folder_id = ?').run(folderId);
      db.prepare('DELETE FROM folders WHERE id = ?').run(folderId);

      sendJson({ success: true });
    } catch (err) {
      sendJson({ error: String(err) }, 500);
    }
  });

  // POST /api/vault/documents/:id/attach
  app.post(/^\/api\/vault\/documents\/([^/]+)\/attach$/, (req, sendJson) => {
    try {
      const db = getVaultDb();
      const docId = req.params.id;
      const { file_path } = req.body as { file_path: string };

      const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(docId);
      if (!doc) {
        sendJson({ error: 'Document not found' }, 404);
        return;
      }

      if (!file_path || !fs.existsSync(file_path)) {
        sendJson({ error: 'File not found' }, 400);
        return;
      }

      const id = uuidv4();
      const filename = path.basename(file_path);
      const destPath = path.join(VAULT_DIR, 'attachments', `${id}-${filename}`);
      fs.copyFileSync(file_path, destPath);

      const stats = fs.statSync(destPath);
      const ext = path.extname(filename).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.pdf': 'application/pdf', '.txt': 'text/plain',
        '.md': 'text/markdown', '.json': 'application/json',
      };
      const mimetype = mimeMap[ext] || 'application/octet-stream';
      const now = new Date().toISOString();

      db.prepare('INSERT INTO attachments (id, document_id, filename, filepath, mimetype, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, docId, filename, destPath, mimetype, stats.size, now);

      const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
      sendJson({ success: true, attachment });
    } catch (err) {
      sendJson({ error: String(err) }, 500);
    }
  });

  // GET /api/local-file?path=... — serve local files (for vault image previews)
  app.get('/api/local-file', (req, sendJson) => {
    const filePath = req.url.searchParams.get('path');
    if (!filePath) {
      sendJson({ error: 'File not found' }, 404);
      return;
    }

    const resolved = path.resolve(filePath);
    const allowedDir = path.join(VAULT_DIR, 'attachments');
    if (!resolved.startsWith(allowedDir + path.sep) && resolved !== allowedDir) {
      sendJson({ error: 'Access denied: path outside allowed directory' }, 403);
      return;
    }
    if (!fs.existsSync(resolved)) {
      sendJson({ error: 'File not found' }, 404);
      return;
    }
    try {
      const ext = path.extname(resolved).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
      const stat = fs.statSync(resolved);
      req.res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=3600',
      });
      fs.createReadStream(resolved).pipe(req.res);
    } catch (err) {
      sendJson({ error: String(err) }, 500);
    }
  });
}
