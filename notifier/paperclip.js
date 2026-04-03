'use strict';

/**
 * paperclip.js — интеграция с Paperclip AI (localhost:3100)
 *
 * Если Paperclip запущен (npx paperclipai) → создаёт Issues, отслеживает статус.
 * Если НЕ запущен → graceful fallback: сохраняет задачи как файлы в output/tracking/.
 *
 * Установка: npx paperclipai (или pnpm dlx paperclipai)
 * UI: http://localhost:3100
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.PAPERCLIP_BASE_URL || 'http://127.0.0.1:3100';
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID || null;
const TRACKING_DIR = path.join(__dirname, '../output/tracking');

// Agent ID map: type → Paperclip agent UUID
const AGENT_IDS = {
  researcher: process.env.PAPERCLIP_AGENT_RESEARCHER || null,
  writer: process.env.PAPERCLIP_AGENT_WRITER || null,
  critic: process.env.PAPERCLIP_AGENT_CRITIC || null,
  'content-ops': process.env.PAPERCLIP_AGENT_CONTENT_OPS || null,
  ceo: process.env.PAPERCLIP_AGENT_CEO || null,
  'head-strategy': process.env.PAPERCLIP_AGENT_HEAD_STRATEGY || null,
  'head-content': process.env.PAPERCLIP_AGENT_HEAD_CONTENT || null,
  'head-growth': process.env.PAPERCLIP_AGENT_HEAD_GROWTH || null,
};

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = { hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method: 'GET', timeout: 3000 };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function httpPost(urlStr, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname, port: url.port || 80, path: url.pathname,
      method: 'POST', timeout: 5000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

function httpPatch(urlStr, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname, port: url.port || 80, path: url.pathname,
      method: 'PATCH', timeout: 5000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

// ─── Fallback: file-based task storage ───────────────────────────────────────

function ensureTrackingDir() {
  if (!fs.existsSync(TRACKING_DIR)) fs.mkdirSync(TRACKING_DIR, { recursive: true });
}

function saveTaskToFile(title, body, agentType) {
  ensureTrackingDir();
  const timestamp = Date.now();
  const fileName = `task_${agentType || 'agent'}_${timestamp}.md`;
  const filePath = path.join(TRACKING_DIR, fileName);
  const content = [
    `# ${title}`,
    '',
    `**Агент:** ${agentType || 'general'}`,
    `**Дата:** ${new Date().toISOString()}`,
    `**Статус:** pending`,
    '',
    '## Описание',
    '',
    body || '',
  ].join('\n');
  fs.writeFileSync(filePath, content, 'utf8');
  return { id: `local:${timestamp}`, fileName, filePath };
}

function getLocalTasks(status) {
  ensureTrackingDir();
  const files = fs.readdirSync(TRACKING_DIR).filter(f => f.startsWith('task_') && f.endsWith('.md'));
  return files.map(f => {
    const content = fs.readFileSync(path.join(TRACKING_DIR, f), 'utf8');
    const statusMatch = content.match(/\*\*Статус:\*\*\s*(.+)/);
    const taskStatus = statusMatch ? statusMatch[1].trim() : 'pending';
    if (status && taskStatus !== status) return null;
    const titleMatch = content.match(/^# (.+)/m);
    return { id: `local:${f}`, title: titleMatch ? titleMatch[1] : f, status: taskStatus, fileName: f };
  }).filter(Boolean);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Проверить доступность Paperclip
 * @returns {boolean}
 */
async function isRunning() {
  try {
    const res = await httpGet(`${BASE_URL}/api/health`);
    return res.status === 200 && res.data && res.data.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Создать Issue в Paperclip или сохранить как файл
 * @param {string} title
 * @param {string} body
 * @param {string} agentType - researcher/writer/critic/content-ops
 * @returns {{ id: string, source: 'paperclip'|'file', fileName?: string }}
 */
async function createIssue(title, body, agentType) {
  const running = await isRunning();

  if (running && COMPANY_ID) {
    try {
      const payload = {
        title,
        description: body,
        status: 'backlog',
        priority: 'medium',
      };
      // Assign to agent if ID is known
      const agentId = AGENT_IDS[agentType];
      if (agentId) payload.assigneeAgentId = agentId;

      const res = await httpPost(`${BASE_URL}/api/companies/${COMPANY_ID}/issues`, payload);
      if (res.status < 300 && res.data && res.data.id) {
        console.log(`[Paperclip] Issue создан: ${res.data.identifier} → ${title}`);
        return { id: res.data.id, identifier: res.data.identifier, source: 'paperclip' };
      }
    } catch (err) {
      console.warn('[Paperclip] API error:', err.message, '— fallback to file');
    }
  }

  // Fallback
  const saved = saveTaskToFile(title, body, agentType);
  console.log(`[Paperclip] Сохранено локально: ${saved.fileName}`);
  return { id: saved.id, source: 'file', fileName: saved.fileName };
}

/**
 * Получить Issue по ID
 */
async function getIssue(id) {
  if (String(id).startsWith('local:')) {
    const fileName = String(id).replace('local:', '');
    const filePath = path.join(TRACKING_DIR, fileName);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    const titleMatch = content.match(/^# (.+)/m);
    const statusMatch = content.match(/\*\*Статус:\*\*\s*(.+)/);
    return {
      id,
      title: titleMatch ? titleMatch[1] : fileName,
      status: statusMatch ? statusMatch[1].trim() : 'pending',
      source: 'file',
    };
  }
  try {
    // Correct endpoint: /api/issues/{id} (no company prefix for single issue)
    const res = await httpGet(`${BASE_URL}/api/issues/${id}`);
    return res.status === 200 ? res.data : null;
  } catch {
    return null;
  }
}

/**
 * Получить Issues по статусу
 */
async function getIssuesByStatus(status) {
  const running = await isRunning();
  if (running && COMPANY_ID) {
    try {
      const res = await httpGet(`${BASE_URL}/api/companies/${COMPANY_ID}/issues?status=${status}`);
      if (res.status === 200) return Array.isArray(res.data) ? res.data : (res.data.issues || []);
    } catch {}
  }
  return getLocalTasks(status);
}

/**
 * Обновить статус Issue
 */
async function updateIssueStatus(id, status) {
  if (String(id).startsWith('local:')) {
    const fileName = String(id).replace('local:', '');
    const filePath = path.join(TRACKING_DIR, fileName);
    if (!fs.existsSync(filePath)) return false;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/\*\*Статус:\*\*\s*.+/, `**Статус:** ${status}`);
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  try {
    const res = await httpPatch(`${BASE_URL}/api/companies/${COMPANY_ID}/issues/${id}`, { status });
    return res.status < 300;
  } catch {
    return false;
  }
}

/**
 * Получить URL для просмотра Issue
 */
function getIssueUrl(id) {
  if (String(id).startsWith('local:')) {
    return `output/tracking/${String(id).replace('local:', '')}`;
  }
  return `${BASE_URL}/companies/${COMPANY_ID}/issues/${id}`;
}

/**
 * Разбудить агента (trigger heartbeat → agent-runner.js)
 */
async function invokeHeartbeat(agentId) {
  if (!agentId) return false;
  try {
    const res = await httpPost(`${BASE_URL}/api/agents/${agentId}/heartbeat/invoke`, {});
    return res.status < 300;
  } catch (err) {
    console.warn('[Paperclip] Heartbeat error:', err.message);
    return false;
  }
}

/**
 * Ожидание завершения Issue (polling)
 * @param {string} issueId
 * @param {object} opts - { intervalMs, timeoutMs, onProgress }
 * @returns {object|null} Issue data when done, or null on timeout
 */
async function waitForCompletion(issueId, opts = {}) {
  const { intervalMs = 10000, timeoutMs = 300000, onProgress } = opts;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const issue = await getIssue(issueId);
    if (!issue) return null;

    if (onProgress) onProgress(issue.status);

    if (['done', 'cancelled'].includes(issue.status)) {
      return issue;
    }

    // If still in backlog after 30s, something might be wrong
    if (issue.status === 'backlog' && Date.now() - start > 30000) {
      // Don't give up yet, agent might be slow to start
    }

    await new Promise(r => setTimeout(r, intervalMs));
  }

  return null; // timeout
}

/**
 * Получить комментарии к Issue
 */
async function getComments(issueId) {
  if (String(issueId).startsWith('local:')) return [];
  try {
    const res = await httpGet(`${BASE_URL}/api/issues/${issueId}/comments`);
    if (res.status === 200) return Array.isArray(res.data) ? res.data : (res.data.comments || []);
  } catch {}
  return [];
}

/**
 * Получить последний комментарий (результат агента)
 */
async function getLatestComment(issueId) {
  const comments = await getComments(issueId);
  if (comments.length === 0) return null;
  // Sort by createdAt desc, return first
  comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return comments[0];
}

/**
 * Добавить комментарий к Issue
 */
async function addComment(issueId, body) {
  if (String(issueId).startsWith('local:')) return null;
  try {
    const res = await httpPost(`${BASE_URL}/api/issues/${issueId}/comments`, { body });
    return res.status < 300 ? res.data : null;
  } catch (err) {
    console.warn('[Paperclip] Comment error:', err.message);
    return null;
  }
}

module.exports = {
  isRunning,
  createIssue,
  getIssue,
  getIssuesByStatus,
  updateIssueStatus,
  getIssueUrl,
  invokeHeartbeat,
  waitForCompletion,
  getComments,
  getLatestComment,
  addComment,
  AGENT_IDS,
};
