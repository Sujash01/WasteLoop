/**
 * WasteLoop — lightweight Node.js backend
 *
 * Core modules only: http, fs, path, url (+ events inside lib/events.js).
 * It does two things:
 *   1. serves the static website (HTML / CSS / JS / SVG assets)
 *   2. exposes a small JSON API backed by files in data/
 *
 * Start with:  npm start      (or: node server.js)
 * Academic prototype — not an official government service.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { URL } = require('url');

const routes = require('./lib/routes');
const { seedIfEmpty } = require('./lib/seed');
const store = require('./lib/store');
const dates = require('./lib/dates');
const mongo = require('./lib/mongodb');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400'
};

/** Send a JSON response. */
function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...CORS_HEADERS
  });
  res.end(body);
}

/**
 * Read and parse a JSON request body (promisified, size limited).
 */
function readJsonBody(req, limitBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(Object.assign(new Error('Request body too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      raw += chunk;
    });

    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 }));
      }
    });

    req.on('error', reject);
  });
}

/** Serve a static file with basic path traversal protection. */
async function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(ROOT, decodeURIComponent(relative));

  if (!target.startsWith(path.resolve(ROOT))) {
    sendJson(res, 403, { ok: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });
    return;
  }

  let stats;
  try {
    stats = await fsp.stat(target);
  } catch (error) {
    stats = null;
  }

  if (!stats || stats.isDirectory()) {
    const notFound = path.resolve(ROOT, '404.html');
    if (fs.existsSync(notFound) && !stats) {
      const html = await fsp.readFile(notFound, 'utf8');
      res.writeHead(404, { 'Content-Type': MIME_TYPES['.html'] });
      res.end(html);
      return;
    }
    res.writeHead(404, { 'Content-Type': MIME_TYPES['.html'] });
    res.end('<h1>404 — Page not found</h1><p><a href="/">Return to WasteLoop home</a></p>');
    return;
  }

  const extension = path.extname(target).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    'Content-Length': stats.size,
    'Cache-Control': 'no-cache',
    ...CORS_HEADERS
  });
  fs.createReadStream(target).pipe(res);
}

/** Handle an /api request: match a route, run the handler, send JSON. */
async function handleApi(req, res, url) {
  const match = routes.match(req.method, url.pathname);
  if (!match) {
    sendJson(res, 404, {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'No API route for ' + req.method + ' ' + url.pathname + '.' }
    });
    return;
  }

  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? {} : await readJsonBody(req);
    const query = Object.fromEntries(url.searchParams.entries());
    const result = await match.handler({ params: match.params, query, body, req });
    sendJson(res, result && result.ok === false ? 400 : 200, result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error('[error]', error);
    sendJson(res, statusCode, {
      ok: false,
      error: {
        code: error.code || 'SERVER_ERROR',
        message: error.message || 'Unexpected server error.',
        field: error.field || null
      }
    });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || HOST + ':' + PORT}`);

  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url);
    return;
  }
  serveStatic(req, res, url.pathname).catch((error) => {
    console.error('[static]', error);
    sendJson(res, 500, { ok: false, error: { code: 'SERVER_ERROR', message: 'Static file error.' } });
  });
});

async function start() {
  await mongo.connect();
  const summary = await seedIfEmpty();
  console.log('');
  console.log('  WasteLoop — academic prototype portal');
  console.log('  -------------------------------------');
  console.log('  Server        : http://' + HOST + ':' + PORT);
  console.log('  Storage       : ' + (mongo.isMongoConnected() ? 'MongoDB' : 'Local JSON files (' + path.relative(ROOT, store.DATA_DIR) + ')'));
  console.log('  Booking policy: future dates only, earliest = ' +
    dates.toIsoDate(dates.earliestBookingDay(new Date())) + ' (tomorrow)');
  console.log(
    '  Data files    : ' +
      (summary.created.length ? 'created ' + summary.created.join(', ') : 'existing files reused')
  );
  console.log('  Guide entries : ' + summary.guideEntries);
  console.log('');

  server.listen(PORT, HOST, () => {
    console.log('  Open ' + homeUrl() + ' in your browser. Press Ctrl+C to stop.');
    console.log('');
  });
}

function homeUrl() {
  return 'http://' + HOST + ':' + PORT + '/';
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is already in use. Start with: PORT=3001 npm start');
  } else {
    console.error(error);
  }
  process.exit(1);
});

if (require.main === module) {
  start();
}

module.exports = { server, start };