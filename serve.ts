// Local static HTTP server for Ember & Basil (Node 22 standard library only).
// Serves game/ at http://127.0.0.1:8080 (or --port <N>) for play-testing and screenshot capture.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_ROOT = resolve(fileURLToPath(new URL('./game', import.meta.url)));

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function parsePort(argv: string[]): number {
  const idx = argv.indexOf('--port');
  if (idx === -1) return 8080;
  const parsed = Number(argv[idx + 1]);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 8080;
}

const port = parsePort(process.argv.slice(2));

createServer((req, res) => {
  const parsed = new URL(req.url ?? '/', 'http://127.0.0.1');
  let reqPath: string;
  try {
    reqPath = decodeURIComponent(parsed.pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (reqPath.endsWith('/')) reqPath += 'index.html';
  const filePath = resolve(join(GAME_ROOT, normalize(reqPath)));
  if (filePath !== GAME_ROOT && !filePath.startsWith(GAME_ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const contentType = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, {
      'content-type': contentType,
      'content-length': stats.size,
      'cache-control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Ember & Basil ready at http://127.0.0.1:${port}`);
});
