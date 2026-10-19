// Lokaler Vorschau-Server: nur Loopback, Host-Header-Prüfung, nur GET/HEAD, kein Ausbrechen aus dem Ordner.
// Start: node dev-server.mjs   (Standard-Port 5176)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 5176);
const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const hidden = /(^|[\\/])(\.git|node_modules|tests)([\\/]|$)/;

const server = createServer(async (req, res) => {
  const send = (code, body, headers = {}) => { res.writeHead(code, { 'Cache-Control': 'no-store', ...headers }); res.end(body); };
  if (!hosts.has(req.headers.host)) return send(403, 'Forbidden');
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root + sep) || hidden.test(file.slice(root.length))) return send(404, 'Not found');
    if (!(await stat(file)).isFile()) return send(404, 'Not found');
    const body = await readFile(file);
    send(200, req.method === 'HEAD' ? null : body, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
  } catch {
    send(404, 'Not found');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
