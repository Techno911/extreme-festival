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

// ── Dynamic sections: scan filesystem for real status ──
function scanSections() {
  const outputDir = path.join(__dirname, 'output');
  const tacticDir = path.join(outputDir, 'tactic');
  const outreachDir = path.join(outputDir, 'outreach');
  const researchDir = path.join(outputDir, 'research');

  // Map section id → artifacts (files that prove work was done)
  // Human-readable names for artifacts
  const nameMap = {
    'а-стратегия.md': 'Стратегия продвижения',
    'б-анализ-рынка.md': 'Анализ рынка и конкурентов',
    'конкурентная-стратегия.md': 'Конкурентная стратегия',
    'в-рекламный-бюджет.md': 'Рекламный бюджет (1.5 млн)',
    'г-план-продаж-билетов.md': 'План продаж билетов',
    'д-сайт-тендерный-пакет.md': 'Тендерный пакет: сайт',
    'е-трейлер-тендерный-пакет.md': 'Тендерный пакет: трейлер',
    'ж-амбассадоры.md': 'Стратегия амбассадоров',
    'з-инфопартнёры.md': 'Стратегия инфопартнёров',
    'и-блогеры.md': 'Стратегия блогеров и посевов',
    'к-контент-стратегия.md': 'Контент-стратегия и рубрикатор',
    'л-мерч.md': 'Ассортимент и продажи мерча',
    'м-подрядчики.md': 'Стандарт тендера ЧиП (9 элементов)',
    'н-календарный-план.md': 'Календарный план 14 недель',
    'marketing-brief.md': 'Маркетинговый бриф (ЧиП 2.5)',
    'moodboard.md': 'Мудборд: Visual Style + UX + Анти',
    'outreach-letter.md': 'Письмо подрядчикам (copy-paste)',
    'block4-audience.md': 'Блок 4: ЦА по AJTBD',
    'rockfm-pitch-final.md': 'Питч Rock FM (готов к отправке)',
    'partner-rockfm-test.md': 'Питч Rock FM (черновик)',
    'brief_kruzhok.md': 'Инструкция для кругляшка',
    'krug-brief.md': 'Бриф для записи кругляшка',
    'merch-matrix-test.md': 'Матрица мерча (метал + скейт)',
    'competitive-analysis-frameworks-2026.md': 'Фреймворки конкурентного анализа',
    'competitor-monitor-2026-04-03.md': 'Мониторинг конкурентов (3 апреля)',
    'tg-metal-channels-test.md': '10 ТГ-каналов о метале',
  };

  const artifactMap = {
    strategy: { files: ['а-стратегия.md'], dir: tacticDir },
    market: { files: ['б-анализ-рынка.md', 'конкурентная-стратегия.md'], dir: tacticDir, research: ['competitive-analysis-frameworks-2026.md', 'competitor-monitor-2026-04-03.md'] },
    budget: { files: ['в-рекламный-бюджет.md'], dir: tacticDir },
    sales: { files: ['г-план-продаж-билетов.md'], dir: tacticDir },
    site: { files: ['д-сайт-тендерный-пакет.md'], dir: tacticDir, outreach: ['tender-site/marketing-brief.md', 'tender-site/moodboard.md', 'tender-site/outreach-letter.md', 'tender-site/block4-audience.md'] },
    trailer: { files: ['е-трейлер-тендерный-пакет.md'], dir: tacticDir },
    ambassadors: { files: ['ж-амбассадоры.md'], dir: tacticDir, outreach: ['ambassadors/'] },
    partners: { files: ['з-инфопартнёры.md'], dir: tacticDir, outreach: ['partners/rockfm-pitch-final.md'] },
    bloggers: { files: ['и-блогеры.md'], dir: tacticDir, research: ['tg-metal-channels-test.md'] },
    content: { files: ['к-контент-стратегия.md'], dir: tacticDir },
    merch: { files: ['л-мерч.md'], dir: tacticDir, research: ['merch-matrix-test.md'] },
    contractors: { files: ['м-подрядчики.md'], dir: tacticDir },
    calendar: { files: ['н-календарный-план.md'], dir: tacticDir },
  };

  const result = {};
  for (const [sectionId, mapping] of Object.entries(artifactMap)) {
    const artifacts = [];
    // Check tactic files
    for (const f of mapping.files) {
      const fp = path.join(mapping.dir, f);
      if (fs.existsSync(fp)) {
        const stat = fs.statSync(fp);
        const humanName = nameMap[f] || f;
        artifacts.push({ path: `output/tactic/${f}`, name: humanName, size: stat.size, modified: stat.mtime.toISOString() });
      }
    }
    // Check outreach files
    if (mapping.outreach) {
      for (const f of mapping.outreach) {
        const fp = path.join(outreachDir, f);
        if (f.endsWith('/')) {
          // Directory — count files inside
          if (fs.existsSync(fp)) {
            const files = fs.readdirSync(fp).filter(x => x.endsWith('.md'));
            files.forEach(x => {
              const hName = nameMap[x] || x.replace(/^\d+_/, '').replace('.md', '').replace(/_/g, ' ');
            artifacts.push({ path: `output/outreach/${f}${x}`, name: hName, size: 0, modified: '' });
            });
          }
        } else if (fs.existsSync(fp)) {
          const fn = f.split('/').pop();
          const hName = nameMap[fn] || fn;
          artifacts.push({ path: `output/outreach/${f}`, name: hName, size: fs.statSync(fp).size, modified: fs.statSync(fp).mtime.toISOString() });
        }
      }
    }
    // Check research files
    if (mapping.research) {
      for (const f of mapping.research) {
        const fp = path.join(researchDir, f);
        if (fs.existsSync(fp)) {
          const rName = nameMap[f] || f;
          artifacts.push({ path: `output/research/${f}`, name: rName, size: fs.statSync(fp).size, modified: fs.statSync(fp).mtime.toISOString() });
        }
      }
    }
    result[sectionId] = { artifacts, count: artifacts.length };
  }
  return result;
}

// ── Read markdown file and return as simple HTML ──
function readFileAsHtml(filePath) {
  const absPath = path.join(__dirname, filePath);
  if (!absPath.startsWith(__dirname) || !fs.existsSync(absPath)) return null;
  const content = fs.readFileSync(absPath, 'utf8');
  // Simple markdown → HTML: headers, bold, lists
  return content
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n/g, '<br>');
}

// ── Auto-checkpoints: file existence → checkpoint done ──
function scanAutoCheckpoints() {
  const base = __dirname;
  // Map: "sectionId:checkpointIndex" → file path (if file exists → checkpoint is done)
  const autoMap = {
    // Site tender
    'site:0': 'output/outreach/tender-site/marketing-brief.md',  // ТЗ/бриф написан
    'site:1': 'output/tracking/tenders.md',  // will check content for "Запущен"
    // Trailer
    'trailer:0': 'output/tactic/е-трейлер-тендерный-пакет.md',  // Написать концепцию + бриф
    // Ambassadors
    'ambassadors:0': 'output/outreach/ambassadors/01_leos.md',  // Питч-письма написаны
    'ambassadors:1': 'output/outreach/ambassadors/brief_kruzhok.md',  // Бриф кругляшка
    // Partners
    'partners:0': 'output/outreach/partner-rockfm-test.md',  // Первый питч отправлен
    // Content
    'content:0': 'output/tactic/к-контент-стратегия.md',  // Контент-стратегия написана
    // Merch
    'merch:0': 'output/research/merch-matrix-test.md',  // Матрица мерча
    // Market
    'market:5': null,  // Еженедельный мониторинг — check tracking for date
  };

  const result = {};
  for (const [key, filePath] of Object.entries(autoMap)) {
    if (filePath) {
      const absPath = path.join(base, filePath);
      result[key] = fs.existsSync(absPath);
    }
  }
  return result;
}

// ── Today's actions: what Женя should do RIGHT NOW ──
function getTodayActions() {
  const outreach = path.join(__dirname, 'output', 'outreach');
  const actions = [];

  // Check ready-to-send artifacts
  const checks = [
    { file: 'partners/rockfm-pitch-final.md', label: 'Отправь питч Rock FM', detail: 'Скопируй текст → вставь в ТГ редактору' },
    { file: 'tender-site/outreach-letter.md', label: 'Отправь бриф подрядчикам сайта', detail: 'Письмо + бриф → 5 подрядчикам в день' },
    { file: 'tender-site/marketing-brief.md', hidden: true }, // dependency of above
  ];

  // Ambassador pitches
  const ambDir = path.join(outreach, 'ambassadors');
  if (fs.existsSync(ambDir)) {
    const pitches = fs.readdirSync(ambDir).filter(f => f.match(/^\d+_/) && f.endsWith('.md'));
    if (pitches.length > 0) {
      actions.push({
        label: `Отправь ${Math.min(3, pitches.length)} питча амбассадорам`,
        detail: `${pitches.length} писем готовы в outreach/ambassadors/`,
        files: pitches.slice(0, 3).map(f => `output/outreach/ambassadors/${f}`),
        priority: 1,
      });
    }
  }

  for (const c of checks) {
    if (c.hidden) continue;
    if (fs.existsSync(path.join(outreach, c.file))) {
      actions.push({
        label: c.label,
        detail: c.detail,
        files: [`output/outreach/${c.file}`],
        priority: 2,
      });
    }
  }

  // Drafts for this week
  const draftsDir = path.join(__dirname, 'output', 'drafts');
  if (fs.existsSync(draftsDir)) {
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 86400000);
    const upcoming = fs.readdirSync(draftsDir).filter(f => {
      const m = f.match(/^(\d{4}-\d{2}-\d{2})/);
      if (!m) return false;
      const d = new Date(m[1]);
      return d >= now && d <= week;
    });
    if (upcoming.length > 0) {
      actions.push({
        label: `${upcoming.length} постов на эту неделю`,
        detail: 'Проверь и опубликуй из output/drafts/',
        files: upcoming.slice(0, 2).map(f => `output/drafts/${f}`),
        priority: 3,
      });
    }
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 4);
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

  // API: read state (includes live KPIs + section artifacts + auto-checkpoints + today actions)
  if (url.pathname === '/api/state' && req.method === 'GET') {
    const state = readState();
    state.sections = scanSections();
    state.todayActions = getTodayActions();
    // Merge auto-checkpoints (file-based) with user checkpoints
    const auto = scanAutoCheckpoints();
    for (const [key, done] of Object.entries(auto)) {
      if (done && !(key in state.checkpoints)) {
        state.checkpoints[key] = true;
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(state));
  }

  // API: get section artifacts
  if (url.pathname === '/api/sections' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(scanSections()));
  }

  // API: read file content (for viewing artifacts)
  if (url.pathname === '/api/file' && req.method === 'GET') {
    const filePath = url.searchParams.get('path');
    if (!filePath || filePath.includes('..')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid path' }));
    }
    const html = readFileAsHtml(filePath);
    if (!html) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'File not found' }));
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filePath}</title><style>body{font-family:Inter,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;background:#111;color:#eee;line-height:1.6}h1,h2,h3{color:#F97316}li{margin:4px 0}code{background:#222;padding:2px 6px;border-radius:4px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:8px;text-align:left}</style></head><body>${html}</body></html>`);
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
