#!/usr/bin/env node
/**
 * Dashboard Server — serves built React app + state API
 *
 * Endpoints:
 *   GET  /api/state    — read dashboard state
 *   POST /api/state    — update dashboard state (from bot/agents)
 *   GET  /*            — serve React SPA
 *
 * Usage: node dashboard-server.js [port]
 * Default port: 3200
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2] || '3200', 10);
const STATE_FILE = path.join(__dirname, 'dashboard-state.json');
const DIST_DIR = path.join(__dirname, 'dashboard', 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastUpdated: new Date().toISOString(), lastUpdatedBy: 'system', kpis: {}, checkpoints: {}, changelog: [] };
  }
}

function writeState(data) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    });
    res.end(content);
  } catch {
    // SPA fallback — serve index.html for any non-asset route
    try {
      const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
      res.end(html);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}

const server = http.createServer((req, res) => {
  // CORS headers for dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API: read state
  if (url.pathname === '/api/state' && req.method === 'GET') {
    const state = readState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(state));
  }

  // API: write state
  if (url.pathname === '/api/state' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        writeState(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // API: append to changelog (convenience endpoint for bot)
  if (url.pathname === '/api/changelog' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const entry = JSON.parse(body);
        const state = readState();
        state.changelog.push({
          timestamp: entry.timestamp || new Date().toISOString(),
          agent: entry.agent || 'unknown',
          action: entry.action || 'update',
          summary: entry.summary || '',
        });
        state.lastUpdated = new Date().toISOString();
        state.lastUpdatedBy = entry.agent || 'bot';
        if (entry.kpis) {
          Object.assign(state.kpis, entry.kpis);
        }
        if (entry.checkpoints) {
          Object.assign(state.checkpoints, entry.checkpoints);
        }
        writeState(state);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, changelogSize: state.changelog.length }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Static files
  let filePath = path.join(DIST_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`📡 API:       http://localhost:${PORT}/api/state`);
  console.log(`📝 Changelog: POST http://localhost:${PORT}/api/changelog`);
});
