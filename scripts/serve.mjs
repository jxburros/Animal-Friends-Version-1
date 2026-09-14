#!/usr/bin/env node
// Development server for the browser game. Replaces `python3 -m http.server`, which sends
// Last-Modified but no Cache-Control: browsers then "heuristically" cache every JS module, the
// stylesheet and the spec files, and a freshly downloaded ZIP quietly plays the previous version
// because none of the URLs changed. This server marks everything `no-store`, so the browser asks
// for every file on every load, and prints which folder and version it is serving so a leftover
// server or a stale unzipped copy is obvious at a glance.
//
//   npm run serve                 # http://localhost:8080/
//   npm run serve -- --port 9000  # or PORT=9000 npm run serve
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function readPort() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--port');
  const raw = i >= 0 ? args[i + 1] : process.env.PORT;
  const port = raw === undefined ? 8080 : Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`Bad port "${raw}". Use --port <number> or PORT=<number>.`);
    process.exit(1);
  }
  return port;
}

// Never let the browser keep a copy: every load asks the server, so the files on disk always win.
const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...NO_CACHE, 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

async function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method not allowed\n', { Allow: 'GET, HEAD' });
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    send(res, 400, 'Bad request\n');
    return;
  }
  // Resolve inside the project root only; `..` segments can never escape it.
  let file = path.normalize(path.join(ROOT, pathname));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    send(res, 403, 'Forbidden\n');
    return;
  }
  let info;
  try {
    info = await stat(file);
    if (info.isDirectory()) {
      if (!pathname.endsWith('/')) {
        send(res, 301, '', { Location: `${pathname}/` });
        return;
      }
      file = path.join(file, 'index.html');
      info = await stat(file);
    }
  } catch (e) {
    send(res, 404, `Not found: ${pathname}\n`);
    return;
  }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { ...NO_CACHE, 'Content-Type': type, 'Content-Length': info.size });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

async function main() {
  const port = readPort();
  let version = '?';
  try { version = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8')).version || '?'; } catch (e) { /* keep '?' */ }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error(e);
      if (!res.headersSent) send(res, 500, 'Server error\n');
      else res.destroy();
    });
  });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`);
      console.error('Another server is probably still running, likely an older copy of the game in another terminal.');
      console.error('Stop it with Ctrl+C there, or start this one on a free port:  npm run serve -- --port 8081');
    } else {
      console.error(e);
    }
    process.exit(1);
  });
  server.listen(port, () => {
    const url = `http://localhost:${server.address().port}/`;
    console.log(`Animal Friends TCG v${version}`);
    console.log(`Serving ${ROOT}`);
    console.log(`Open ${url}  (caching is off: every reload fetches the files on disk)`);
    console.log('Press Ctrl+C to stop.');
  });
}

main();
