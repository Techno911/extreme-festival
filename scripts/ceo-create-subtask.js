'use strict';

/**
 * ceo-create-subtask.js
 * CLI-утилита для создания подзадач из CMO-агента.
 *
 * Использование:
 *   node scripts/ceo-create-subtask.js --agent researcher --title "Заголовок" --description "Описание"
 *
 * Вывод в stdout (JSON):
 *   {"id":"...","identifier":"CMP-X","agent":"researcher","status":"created"}
 *
 * Используется CMO при обработке задач из Telegram.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const notifierDir = path.join(__dirname, '..', 'notifier');
require(path.join(notifierDir, 'node_modules', 'dotenv')).config({ path: path.join(notifierDir, '.env') });

const BASE_URL = process.env.PAPERCLIP_BASE_URL || 'http://localhost:3100';
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;

// agent type → env variable → UUID
const AGENT_ID_MAP = {
  researcher:       process.env.PAPERCLIP_AGENT_RESEARCHER,
  writer:           process.env.PAPERCLIP_AGENT_WRITER,
  critic:           process.env.PAPERCLIP_AGENT_CRITIC,
  'content-ops':    process.env.PAPERCLIP_AGENT_CONTENT_OPS,
  cmo:              process.env.PAPERCLIP_AGENT_CEO,
  'head-strategy':  process.env.PAPERCLIP_AGENT_HEAD_STRATEGY,
  'head-content':   process.env.PAPERCLIP_AGENT_HEAD_CONTENT,
  'head-growth':    process.env.PAPERCLIP_AGENT_HEAD_GROWTH,
};

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpPost(urlStr, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
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

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--agent') args.agent = argv[i + 1];
    if (argv[i] === '--title') args.title = argv[i + 1];
    if (argv[i] === '--description') args.description = argv[i + 1];
  }
  return args;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.agent || !args.title) {
    process.stderr.write('Usage: node ceo-create-subtask.js --agent <type> --title "заголовок" [--description "описание"]\n');
    process.stderr.write('Agent types: researcher, writer, critic, content-ops\n');
    process.exit(1);
  }

  if (!COMPANY_ID) {
    process.stderr.write('PAPERCLIP_COMPANY_ID не задан в .env\n');
    process.exit(1);
  }

  const agentId = AGENT_ID_MAP[args.agent];
  if (!agentId) {
    process.stderr.write(`Неизвестный тип агента: ${args.agent}. Допустимые: ${Object.keys(AGENT_ID_MAP).join(', ')}\n`);
    process.exit(1);
  }

  // 1. Создать Issue
  const issueBody = {
    title: args.title,
    description: args.description || '',
    assigneeAgentId: agentId,
    status: 'backlog',
    priority: 'medium',
  };

  const issueRes = await httpPost(`${BASE_URL}/api/companies/${COMPANY_ID}/issues`, issueBody);

  if (issueRes.status >= 300) {
    process.stderr.write(`Ошибка создания issue: HTTP ${issueRes.status} — ${JSON.stringify(issueRes.data)}\n`);
    process.exit(1);
  }

  const issue = issueRes.data;

  // 2. Разбудить агента
  const heartbeatRes = await httpPost(`${BASE_URL}/api/agents/${agentId}/heartbeat/invoke`, {});

  if (heartbeatRes.status >= 300) {
    process.stderr.write(`Предупреждение: heartbeat вернул HTTP ${heartbeatRes.status}\n`);
  }

  // 3. Вывести результат в stdout
  const output = {
    id: issue.id,
    identifier: issue.identifier || '',
    agent: args.agent,
    status: 'created',
  };

  process.stdout.write(JSON.stringify(output) + '\n');
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
