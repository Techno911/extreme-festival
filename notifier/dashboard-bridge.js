/**
 * Dashboard Bridge — connects bot/agents to the dashboard state
 *
 * Writes to dashboard-state.json and optionally hits the dashboard-server API.
 * Works even if dashboard-server is not running (file-based).
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const STATE_FILE = path.join(__dirname, '..', 'dashboard-state.json');
const DASHBOARD_PORT = 3200;
const DASHBOARD_URL = `http://localhost:${DASHBOARD_PORT}`;

// ─── Read / Write state file ─────────────────────────────────────────────────

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: 'system',
      kpis: {},
      checkpoints: {},
      changelog: [],
    };
  }
}

function writeState(state) {
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Add a changelog entry and optionally update KPIs/checkpoints
 * @param {object} opts
 * @param {string} opts.agent - Agent name (CMO, Researcher, Writer, etc.)
 * @param {string} opts.action - What happened (task_complete, checkpoint_done, kpi_update)
 * @param {string} opts.summary - Human-readable summary for TG and dashboard
 * @param {object} [opts.kpis] - KPI updates to merge
 * @param {object} [opts.checkpoints] - Checkpoint updates to merge
 */
function updateDashboard(opts) {
  const state = readState();

  state.changelog.push({
    timestamp: new Date().toISOString(),
    agent: opts.agent || 'bot',
    action: opts.action || 'update',
    summary: opts.summary || '',
  });

  if (opts.kpis) {
    state.kpis = { ...state.kpis, ...opts.kpis };
  }

  if (opts.checkpoints) {
    state.checkpoints = { ...state.checkpoints, ...opts.checkpoints };
  }

  state.lastUpdatedBy = opts.agent || 'bot';
  writeState(state);

  // Also try to hit the API (non-blocking)
  tryApiPost('/api/changelog', {
    agent: opts.agent,
    action: opts.action,
    summary: opts.summary,
    kpis: opts.kpis,
    checkpoints: opts.checkpoints,
  });

  return state;
}

/**
 * Update a KPI value
 */
function updateKpi(key, value, agent = 'bot') {
  const state = readState();
  state.kpis[key] = value;
  state.lastUpdatedBy = agent;
  writeState(state);
  return state;
}

/**
 * Mark a checkpoint as done/undone
 * @param {string} sectionId - e.g. 'site', 'ambassadors'
 * @param {number} index - checkpoint index
 * @param {boolean} done
 * @param {string} agent
 */
function setCheckpoint(sectionId, index, done, agent = 'bot') {
  const state = readState();
  state.checkpoints[`${sectionId}:${index}`] = done;
  state.lastUpdatedBy = agent;
  writeState(state);
  return state;
}

/**
 * Get dashboard URL
 */
function getDashboardUrl() {
  return DASHBOARD_URL;
}

/**
 * Generate a TG-formatted summary of recent changes
 */
function getRecentChangesSummary(count = 5) {
  const state = readState();
  const recent = state.changelog.slice(-count).reverse();
  if (recent.length === 0) return 'Нет обновлений.';

  return recent.map((e) => {
    const time = new Date(e.timestamp).toLocaleString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${time} [${e.agent}] ${e.summary}`;
  }).join('\n');
}

// ─── Internal ────────────────────────────────────────────────────────────────

function tryApiPost(path, data) {
  try {
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: DASHBOARD_PORT,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 2000,
    });
    req.on('error', () => {}); // ignore
    req.write(body);
    req.end();
  } catch {
    // API not available, that's fine — file-based state is our source of truth
  }
}

module.exports = {
  updateDashboard,
  updateKpi,
  setCheckpoint,
  getDashboardUrl,
  getRecentChangesSummary,
  readState,
};
