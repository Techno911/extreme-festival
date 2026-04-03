'use strict';

/**
 * setup-paperclip-agents.js
 * Настраивает adapterConfig для всех Paperclip агентов через API.
 * Без этого агенты — пустые оболочки (Error: Process adapter missing command).
 *
 * Запуск: /usr/local/bin/node scripts/setup-paperclip-agents.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const notifierDir = path.join(__dirname, '..', 'notifier');
require(path.join(notifierDir, 'node_modules', 'dotenv')).config({ path: path.join(notifierDir, '.env') });

const BASE_URL = process.env.PAPERCLIP_BASE_URL || 'http://localhost:3100';
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;
const PROJECT_DIR = path.join(__dirname, '..');
const AGENTS_DIR = path.join(PROJECT_DIR, '.claude', 'agents');
const RUNNER_PATH = path.join(notifierDir, 'agent-runner.js');

const AGENTS = [
  {
    envKey: 'PAPERCLIP_AGENT_RESEARCHER',
    name: 'Researcher',
    role: 'researcher',
    timeoutSec: 600,
  },
  {
    envKey: 'PAPERCLIP_AGENT_WRITER',
    name: 'Writer',
    role: 'writer',
    timeoutSec: 900,
  },
  {
    envKey: 'PAPERCLIP_AGENT_CRITIC',
    name: 'Critic',
    role: 'critic',
    timeoutSec: 300,
  },
  {
    envKey: 'PAPERCLIP_AGENT_CONTENT_OPS',
    name: 'ContentOps',
    role: 'content-ops',
    timeoutSec: 600,
  },
  {
    envKey: 'PAPERCLIP_AGENT_CEO',
    name: 'CEO',
    role: 'cmo',
    timeoutSec: 180,
  },
  {
    envKey: 'PAPERCLIP_AGENT_HEAD_STRATEGY',
    name: 'Head of Strategy',
    role: 'head-strategy',
    timeoutSec: 600,
  },
  {
    envKey: 'PAPERCLIP_AGENT_HEAD_CONTENT',
    name: 'Head of Content',
    role: 'head-content',
    timeoutSec: 600,
  },
  {
    envKey: 'PAPERCLIP_AGENT_HEAD_GROWTH',
    name: 'Head of Growth',
    role: 'head-growth',
    timeoutSec: 600,
  },
  // v5: 4 новых специалиста
  {
    envKey: 'PAPERCLIP_AGENT_GROWTH_SCOUT',
    name: 'Growth Scout',
    role: 'growth-scout',
    timeoutSec: 600,
  },
  {
    envKey: 'PAPERCLIP_AGENT_OUTREACH_WRITER',
    name: 'Outreach Writer',
    role: 'outreach-writer',
    timeoutSec: 600,
  },
  {
    envKey: 'PAPERCLIP_AGENT_MERCH_PLANNER',
    name: 'Merch Planner',
    role: 'merch-planner',
    timeoutSec: 600,
  },
  {
    envKey: 'PAPERCLIP_AGENT_AUDIENCE_ANALYST',
    name: 'Audience Analyst',
    role: 'audience-analyst',
    timeoutSec: 600,
  },
];

function httpPatch(urlStr, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'PATCH',
      timeout: 10000,
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

function getSystemPrompt(role) {
  const fileName = role + '.md';
  const filePath = path.join(AGENTS_DIR, fileName);
  if (!fs.existsSync(filePath)) return '';

  const content = fs.readFileSync(filePath, 'utf8');
  const firstDash = content.indexOf('---');
  if (firstDash === -1) return content;
  const secondDash = content.indexOf('---', firstDash + 3);
  if (secondDash === -1) return content;
  return content.substring(secondDash + 3).trim();
}

async function main() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  Настройка Paperclip агентов');
  console.log('═══════════════════════════════════════════\n');

  if (!COMPANY_ID) {
    console.error('❌ PAPERCLIP_COMPANY_ID не задан в .env');
    process.exit(1);
  }

  let successCount = 0;

  for (const agent of AGENTS) {
    const agentId = process.env[agent.envKey];
    if (!agentId) {
      console.log(`⏭️  ${agent.name}: ${agent.envKey} не задан → пропускаю`);
      continue;
    }

    const systemPrompt = getSystemPrompt(agent.role);

    const patchBody = {
      adapterConfig: {
        command: '/usr/local/bin/node',
        args: [RUNNER_PATH],
        cwd: PROJECT_DIR,
        env: {
          PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin',
          HOME: process.env.HOME || '/Users/techno',
        },
        timeoutSec: agent.timeoutSec,
        graceSec: 30,
      },
      systemPrompt: systemPrompt.substring(0, 5000),
    };

    try {
      const res = await httpPatch(`${BASE_URL}/api/agents/${agentId}`, patchBody);
      if (res.status < 300) {
        const d = res.data;
        console.log(`✅ ${agent.name} (${agentId.substring(0, 8)}):`);
        console.log(`   command: ${d.adapterConfig?.command || '?'}`);
        console.log(`   timeout: ${agent.timeoutSec}s`);
        console.log(`   prompt: ${systemPrompt.length} chars`);
        console.log('');
        successCount++;
      } else {
        console.error(`❌ ${agent.name}: HTTP ${res.status} — ${JSON.stringify(res.data)}`);
      }
    } catch (err) {
      console.error(`❌ ${agent.name}: ${err.message}`);
    }
  }

  console.log('═══════════════════════════════════════════');
  console.log(`✅ Настроено: ${successCount}/${AGENTS.length} агентов`);
  console.log('');
  console.log('Проверка:');
  console.log(`  curl -s ${BASE_URL}/api/companies/${COMPANY_ID}/agents | node -e "..."`);
  console.log('═══════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
