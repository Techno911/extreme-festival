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

function parseLiveKPIs() {
  const outputDir = path.join(__dirname, 'output');
  const kpis = {};
  try {
    // tickets — from tracking/sales.md
    const sales = fs.readFileSync(path.join(outputDir, 'tracking', 'sales.md'), 'utf8');
    const m = sales.match(/[Пп]родано[:\s]*(\d+)/);
    kpis.tickets = m ? parseInt(m[1]) : 16;
  } catch { kpis.tickets = 16; }
  try {
    // ambassadors — count 🟢 in tracking/ambassadors.md
    const amb = fs.readFileSync(path.join(outputDir, 'tracking', 'ambassadors.md'), 'utf8');
    kpis.ambassadors = (amb.match(/🟢/g) || []).length;
  } catch { kpis.ambassadors = 0; }
  try {
    // partners — count 🟢 in tracking/partners.md
    const part = fs.readFileSync(path.join(outputDir, 'tracking', 'partners.md'), 'utf8');
    kpis.partners = (part.match(/🟢/g) || []).length;
  } catch { kpis.partners = 1; }
  try {
    // contentDrafts — count files in output/drafts/
    kpis.contentDrafts = fs.readdirSync(path.join(outputDir, 'drafts')).filter(f => f.endsWith('.md')).length;
  } catch { kpis.contentDrafts = 0; }
  try {
    // sectionsReady — count files in output/tactic/
    kpis.sectionsReady = fs.readdirSync(path.join(outputDir, 'tactic')).filter(f => f.endsWith('.md')).length;
  } catch { kpis.sectionsReady = 0; }
  try {
    // tendersLaunched — parse tracking/tenders.md for non-empty statuses
    const tend = fs.readFileSync(path.join(outputDir, 'tracking', 'tenders.md'), 'utf8');
    kpis.tendersLaunched = (tend.match(/✅|🟢|Запущен/g) || []).length;
  } catch { kpis.tendersLaunched = 0; }
  kpis.budgetSpent = 0;
  kpis.bloggersReach = 0;
  return kpis;
}

function readState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    // Overlay live KPIs from tracking files
    state.kpis = { ...state.kpis, ...parseLiveKPIs() };
    state.lastUpdated = new Date().toISOString();
    return state;
  } catch {
    return { lastUpdated: new Date().toISOString(), lastUpdatedBy: 'system', kpis: parseLiveKPIs(), checkpoints: {}, changelog: [] };
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
