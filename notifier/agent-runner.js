'use strict';

/**
 * agent-runner.js — Обёртка для запуска Claude Code из Paperclip heartbeat
 *
 * Paperclip вызывает этот скрипт при heartbeat/invoke.
 * ENV от Paperclip: PAPERCLIP_AGENT_ID, PAPERCLIP_API_URL, PAPERCLIP_COMPANY_ID
 *
 * Flow:
 *   1. GET inbox → список issues для этого агента
 *   2. Если пусто → exit 0
 *   3. POST checkout → атомарный захват
 *   4. Определить роль агента → прочитать system prompt
 *   5. Spawn claude CLI с промптом
 *   6. PATCH issue → done + POST comment с результатом
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const API_URL = process.env.PAPERCLIP_API_URL || 'http://localhost:3100';
const AGENT_ID = process.env.PAPERCLIP_AGENT_ID;
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;
const PROJECT_DIR = path.join(__dirname, '..');
const AGENTS_DIR = path.join(PROJECT_DIR, '.claude', 'agents');
const CLAUDE_BIN = '/usr/local/bin/claude';

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function request(method, urlStr, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Agent role detection ─────────────────────────────────────────────────────

const ROLE_MAP = {};

function loadRoles() {
  // Build AGENT_ID → role mapping from .env
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const env = fs.readFileSync(envPath, 'utf8');
  const pairs = [
    ['PAPERCLIP_AGENT_RESEARCHER', 'researcher'],
    ['PAPERCLIP_AGENT_WRITER', 'writer'],
    ['PAPERCLIP_AGENT_CRITIC', 'critic'],
    ['PAPERCLIP_AGENT_CONTENT_OPS', 'content-ops'],
    ['PAPERCLIP_AGENT_CEO', 'cmo'],
    ['PAPERCLIP_AGENT_NOTIFIER', 'notifier'],
    ['PAPERCLIP_AGENT_HEAD_STRATEGY', 'head-strategy'],
    ['PAPERCLIP_AGENT_HEAD_CONTENT', 'head-content'],
    ['PAPERCLIP_AGENT_HEAD_GROWTH', 'head-growth'],
    ['PAPERCLIP_AGENT_GROWTH_SCOUT', 'growth-scout'],
    ['PAPERCLIP_AGENT_OUTREACH_WRITER', 'outreach-writer'],
    ['PAPERCLIP_AGENT_MERCH_PLANNER', 'merch-planner'],
    ['PAPERCLIP_AGENT_AUDIENCE_ANALYST', 'audience-analyst'],
  ];
  for (const [envKey, role] of pairs) {
    const match = env.match(new RegExp(`${envKey}=(.+)`));
    if (match) ROLE_MAP[match[1].trim()] = role;
  }
}

function getAgentRole() {
  return ROLE_MAP[AGENT_ID] || 'writer';
}

function getSystemPrompt(role) {
  // Map role to agent file
  const fileName = role + '.md';
  const filePath = path.join(AGENTS_DIR, fileName);
  if (!fs.existsSync(filePath)) return `Ты — AI-агент (${role}). Выполняй задачу точно.`;

  const content = fs.readFileSync(filePath, 'utf8');
  // Extract body after frontmatter
  const fmEnd = content.indexOf('---', content.indexOf('---') + 3);
  if (fmEnd === -1) return content;
  return content.substring(fmEnd + 3).trim();
}

// ─── Inbox & Checkout ─────────────────────────────────────────────────────────

async function getInbox() {
  // Get issues assigned to this agent that are ready to process.
  // Includes stale in_progress (no active run) to recover from crashed runners.
  try {
    const res = await request('GET', `${API_URL}/api/companies/${COMPANY_ID}/issues?assigneeAgentId=${AGENT_ID}`);
    if (res.status === 200) {
      const issues = Array.isArray(res.data) ? res.data : (res.data.issues || []);
      return issues.filter(i => {
        if (['backlog', 'todo'].includes(i.status)) return true;
        // Stale in_progress: checked out but no active execution (crashed runner)
        if (i.status === 'in_progress' && !i.activeRun && !i.executionRunId) return true;
        return false;
      });
    }
  } catch (err) {
    console.error('[agent-runner] Inbox error:', err.message);
  }
  return [];
}

async function checkoutIssue(issueId) {
  try {
    const res = await request('POST', `${API_URL}/api/issues/${issueId}/checkout`, {
      agentId: AGENT_ID,
      expectedStatuses: ['backlog', 'todo', 'in_progress'],
    });
    return res.status < 300 ? res.data : null;
  } catch (err) {
    console.error('[agent-runner] Checkout error:', err.message);
    return null;
  }
}

async function completeIssue(issueId, resultText) {
  // 1. Post comment with result
  try {
    await request('POST', `${API_URL}/api/issues/${issueId}/comments`, {
      body: resultText.substring(0, 50000), // Paperclip limit
    });
  } catch (err) {
    console.error('[agent-runner] Comment error:', err.message);
  }

  // 2. Update status to done
  try {
    await request('PATCH', `${API_URL}/api/issues/${issueId}`, { status: 'done' });
  } catch (err) {
    console.error('[agent-runner] Status update error:', err.message);
  }
}

async function failIssue(issueId, errorText) {
  try {
    await request('POST', `${API_URL}/api/issues/${issueId}/comments`, {
      body: `❌ Ошибка агента:\n${errorText}`,
    });
    await request('PATCH', `${API_URL}/api/issues/${issueId}`, { status: 'backlog' });
  } catch (err) {
    console.error('[agent-runner] Fail update error:', err.message);
  }
}

// ─── Claude Code execution ────────────────────────────────────────────────────

function runClaude(prompt, maxTurns, additionalArgs) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', prompt,
      '--max-turns', String(maxTurns || 15),
      '--output-format', 'text',
      '--model', 'sonnet',
      ...(additionalArgs || []),
    ];

    console.log(`[agent-runner] Spawning claude with ${args.length} args, prompt ${prompt.length} chars`);

    const proc = spawn(CLAUDE_BIN, args, {
      cwd: PROJECT_DIR,
      env: {
        ...process.env,
        PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin',
        HOME: process.env.HOME || '/Users/techno',
      },
      timeout: 600000, // 10 min max
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => { stdout += chunk; });
    proc.stderr.on('data', chunk => { stderr += chunk; });

    proc.on('close', (code) => {
      if (code === 0 || stdout.length > 0) {
        resolve(stdout || '(агент завершил без вывода)');
      } else {
        reject(new Error(`Claude exited with code ${code}: ${stderr.substring(0, 500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

// ─── Sheets sync ─────────────────────────────────────────────────────────────

/**
 * Runs migrate-drafts-to-sheet.js to sync any new output/drafts/ files to Google Sheets.
 * Runs as a child process — non-blocking, best-effort.
 */
function runSheetsSync() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(PROJECT_DIR, 'scripts', 'migrate-drafts-to-sheet.js');
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error('migrate-drafts-to-sheet.js not found'));
    }

    const notifierDir = path.join(PROJECT_DIR, 'notifier');
    const envPath = path.join(notifierDir, '.env');

    const proc = spawn('/usr/local/bin/node', [scriptPath], {
      cwd: PROJECT_DIR,
      env: {
        ...process.env,
        PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin',
        HOME: process.env.HOME || '/Users/techno',
        // Load .env from notifier dir for GOOGLE_SPREADSHEET_ID etc.
        DOTENV_CONFIG_PATH: envPath,
      },
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    proc.stdout.on('data', chunk => { stdout += chunk; });
    proc.stderr.on('data', chunk => { process.stderr.write(chunk); });

    proc.on('close', (code) => {
      console.log(`[agent-runner] Sheets sync finished (exit ${code}): ${stdout.substring(0, 200)}`);
      resolve();
    });
    proc.on('error', reject);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!AGENT_ID || !COMPANY_ID) {
    console.log('[agent-runner] Missing PAPERCLIP_AGENT_ID or PAPERCLIP_COMPANY_ID. Exit.');
    process.exit(0);
  }

  loadRoles();
  const role = getAgentRole();
  console.log(`[agent-runner] Agent: ${AGENT_ID.substring(0, 8)} | Role: ${role}`);

  // 1. Get inbox
  const inbox = await getInbox();
  if (inbox.length === 0) {
    console.log('[agent-runner] No tasks in inbox. Exit.');
    process.exit(0);
  }

  console.log(`[agent-runner] Found ${inbox.length} task(s). Processing first.`);
  const issue = inbox[0];

  // 2. Checkout
  const checked = await checkoutIssue(issue.id);
  if (!checked) {
    console.error('[agent-runner] Failed to checkout issue. Exit.');
    process.exit(1);
  }
  console.log(`[agent-runner] Checked out: ${issue.identifier} — ${issue.title}`);

  // 3. Build prompt
  const systemPrompt = getSystemPrompt(role);
  const maxTurnsMap = { researcher: 20, writer: 25, critic: 10, 'content-ops': 15, cmo: 30, 'head-strategy': 20, 'head-content': 15, 'head-growth': 15, 'growth-scout': 20, 'outreach-writer': 20, 'merch-planner': 15, 'audience-analyst': 15 };
  const maxTurns = maxTurnsMap[role] || 15;

  // Role-specific Sheet/file instructions
  const roleInstructions = {
    'cmo': [
      '',
      '─── ОРКЕСТРАЦИЯ ЗАДАЧ ───',
      'Ты CMO-оркестратор. Анализируй запрос и создавай подзадачи для нужных агентов.',
      '',
      'МАРШРУТИЗАЦИЯ (СТРОГО):',
      '  head-strategy  — стратегия, аудитория, AJTBD, конкуренты, рынок, сайт-тендер, трейлер, подрядчики, календарный план (разделы а, б, в, и, к)',
      '  head-growth    — амбассадоры, инфопартнёры, блогеры, outreach-письма (разделы г, д, е)',
      '  head-content   — посты, черновики, рубрикатор, контент-план, мерч (разделы ж, з)',
      '  writer         — разовые тексты без стратегии (если не принадлежит ни одному Head)',
      '  critic         — только валидация и проверка',
      '',
      'НЕ отправляй researcher/writer напрямую если задача стратегическая или по продвижению.',
      'Head-агенты сами декомпозируют для своих подчинённых.',
      '',
      'ОБЯЗАТЕЛЬНО: для каждой подзадачи вызови через Bash:',
      `  node ${path.join(PROJECT_DIR, 'scripts', 'ceo-create-subtask.js')} --agent head-strategy --title "..." --description "..."`,
      `  node ${path.join(PROJECT_DIR, 'scripts', 'ceo-create-subtask.js')} --agent head-growth --title "..." --description "..."`,
      `  node ${path.join(PROJECT_DIR, 'scripts', 'ceo-create-subtask.js')} --agent head-content --title "..." --description "..."`,
      '',
      'Хелпер возвращает JSON: {"id":"...","identifier":"CMP-X","agent":"head-strategy","status":"created"}',
      'Вызывай Bash для каждой подзадачи отдельно.',
      '',
      'Один исполнитель (Женя Аржевский) — не плоди задачи зря. Максимум 2-3 подзадачи на запрос.',
      '',
    ].join('\n'),
    'content-ops': [
      '',
      '─── GOOGLE SHEETS ИНТЕГРАЦИЯ ───',
      'После создания черновика поста ОБЯЗАТЕЛЬНО:',
      '1. Сохрани черновик как файл в output/drafts/ (формат: YYYY-MM-DD-название.md)',
      '2. Запусти синхронизацию: node scripts/migrate-drafts-to-sheet.js',
      '   Это запишет черновик в Google Sheets (Контентная, колонки A-Q, статус "Черновик").',
      '3. Подтверди в ответе: "Черновик сохранён в output/drafts/ИМЯ.md и записан в Google Sheets."',
      '',
    ].join('\n'),
    'writer': [
      '',
      '─── СОХРАНЕНИЕ РЕЗУЛЬТАТОВ ───',
      'Если создаёшь контент (текст поста, бриф, шаблон):',
      '1. Сохрани в output/tactic/ (тактика) или output/drafts/ (посты) или output/research/ (исследования).',
      '2. Если пост/черновик — запусти: node scripts/migrate-drafts-to-sheet.js',
      '',
    ].join('\n'),
    'researcher': [
      '',
      '─── СОХРАНЕНИЕ РЕЗУЛЬТАТОВ ───',
      'Результаты исследования сохрани в output/research/ как .md файл.',
      'Резюме выведи в stdout для отправки в Telegram.',
      '',
    ].join('\n'),
    'head-strategy': [
      '',
      '─── ОРКЕСТРАЦИЯ СТРАТЕГИЧЕСКОГО ОТДЕЛА ───',
      'Ты Head of Strategy. Декомпозируй задачу для подчинённых агентов.',
      'Подчинённые: researcher (рынок/конкуренты/подрядчики), writer (Strategy Writer — тактика/брифы), audience-analyst (AJTBD-сегменты по Замесину)',
      '',
      'ОБЯЗАТЕЛЬНО: для каждой подзадачи вызови через Bash:',
      `  node ${path.join(PROJECT_DIR, 'scripts', 'ceo-create-subtask.js')} --agent researcher --title "..." --description "..."`,
      `  node ${path.join(PROJECT_DIR, 'scripts', 'ceo-create-subtask.js')} --agent writer --title "..." --description "..."`,
      `  node ${path.join(PROJECT_DIR, 'scripts', 'ceo-create-subtask.js')} --agent audience-analyst --title "..." --description "..."`,
      '',
      'Зона ответственности: разделы а (Стратегия), б (Сайт), в (Трейлер), и (Подрядчики), к (Календарный план).',
      'Один исполнитель (Женя Аржевский) — не плоди задачи зря. Максимум 2-3 подзадачи.',
      'Результаты сохраняются в output/tactic/ и output/research/.',
      '',
    ].join('\n'),
    'head-content': [
      '',
      '─── ОРКЕСТРАЦИЯ КОНТЕНТ-ОТДЕЛА ───',
      'Ты Head of Content. Декомпозируй задачу для контент-агентов.',
      'Подчинённые: content-ops (черновики постов), merch-planner (мерч: матрица, производство, дизайн-брифы)',
      '',
      'ОБЯЗАТЕЛЬНО: для каждой подзадачи вызови через Bash:',
      `  node ${path.join(PROJECT_DIR, 'scripts', 'ceo-create-subtask.js')} --agent content-ops --title "..." --description "..."`,
      `  node ${path.join(PROJECT_DIR, 'scripts', 'ceo-create-subtask.js')} --agent merch-planner --title "..." --description "..."`,
      '',
      'Зона ответственности: раздел ж (контент-стратегия), з (мерч), все посты ВК/ТГ/Insta, рубрикатор, Google Sheets.',
      'Баланс воронки: 40% Привлечение / 25% Прогрев / 20% Продажа / 15% Лояльность.',
      'Один исполнитель (Женя) — максимум 2-3 подзадачи.',
      '',
    ].join('\n'),
    'growth-scout': [
      '',
      '─── РАЗВЕДКА КОНТАКТОВ ───',
      'Результаты в output/research/ как .md файл. Обновляй tracking/*.md.',
      'Формат: ВСЕГДА таблица (Имя | Платформа | Подписчики | Контакт | ICE | Статус).',
      '',
    ].join('\n'),
    'outreach-writer': [
      '',
      '─── OUTREACH ПИСЬМА ───',
      'Результаты в output/outreach/ (ambassadors/, partners/, bloggers/).',
      'Каждое письмо — отдельный файл (имя-дата.md).',
      'КРАСНАЯ ЛИНИЯ: Леос — отдельный бриф БЕЗ Master. Не упоминать Скрежет.',
      '',
    ].join('\n'),
    'merch-planner': [
      '',
      '─── МЕРЧ ───',
      'Результаты в output/tactic/з-мерч.md + брифы в output/outreach/.',
      'Бенчмарк цен: output/research/мерч-бенчмарк.md — читай перед работой.',
      'Давид рисует сам — НЕ предлагать AI-арт. Бриф = размеры + тематика + дедлайн.',
      '',
    ].join('\n'),
    'audience-analyst': [
      '',
      '─── AJTBD СЕГМЕНТЫ ───',
      'Методика Замесина: Job, Trigger, Context, Pain, Where.',
      'База: output/research/ajtbd-01 — ajtbd-06.',
      'SMM-карта: context/smm-karta-kommunikatsiy.md.',
      'Результаты в output/research/ или обновление context/.',
      '',
    ].join('\n'),
    'head-growth': [
      '',
      '─── ОРКЕСТРАЦИЯ ПРОДВИЖЕНИЯ ───',
      'Ты Head of Growth. Декомпозируй задачу для агентов продвижения.',
      'Подчинённые: outreach-writer (питч-письма, скрипты, брифы кругляшков), growth-scout (поиск контактов, каналов, блогеров)',
      '',
      'ОБЯЗАТЕЛЬНО: для каждой подзадачи вызови через Bash:',
      `  node ${path.join(PROJECT_DIR, 'scripts', 'ceo-create-subtask.js')} --agent outreach-writer --title "..." --description "..."`,
      `  node ${path.join(PROJECT_DIR, 'scripts', 'ceo-create-subtask.js')} --agent growth-scout --title "..." --description "..."`,
      '',
      'Зона ответственности: г (амбассадоры), д (инфопартнёры), е (блогеры).',
      'KPI: 8-10 кружков амбассадоров к июню, 10+ инфопартнёров, охват блогеров 500k+.',
      'Один исполнитель (Женя) — максимум 2-3 подзадачи.',
      '',
    ].join('\n'),
  };

  const contextPreamble = [
    `Рабочая директория: ${PROJECT_DIR}`,
    `Контекст проекта: context/ExtremeFest_Context.md`,
    `Ограничения: .claude/rules/constraints.md`,
    `Аудитория: .claude/rules/audience-rules.md`,
    '',
    'Существующие файлы тактики в output/tactic/ (используй как базу знаний, НЕ перезаписывай без необходимости).',
    'Результаты исследований в output/research/.',
    roleInstructions[role] || '',
  ].join('\n');

  const fullPrompt = [
    systemPrompt,
    '',
    '─── КОНТЕКСТ ПРОЕКТА ───',
    contextPreamble,
    '─── ЗАДАЧА ───',
    issue.description || issue.title,
    '',
    '─── ФОРМАТ ОТВЕТА ───',
    'Выведи результат в stdout. Это будет отправлено пользователю в Telegram.',
    'Будь конкретен. Не пиши «я могу сделать X» — ДЕЛАЙ X.',
    'Если создаёшь файлы — напиши краткое резюме что создано и где.',
  ].join('\n');

  // 4. Execute
  // Tool permissions per role
  let claudeExtraArgs = [];
  if (role === 'cmo') {
    claudeExtraArgs = ['--allowedTools', 'Bash'];
  } else if (role === 'head-strategy') {
    claudeExtraArgs = ['--allowedTools', 'Bash'];
  } else if (['writer', 'researcher', 'content-ops', 'critic'].includes(role)) {
    claudeExtraArgs = ['--allowedTools', 'Read,Write,Edit,Bash'];
  }

  try {
    console.log(`[agent-runner] Running claude (max ${maxTurns} turns)${claudeExtraArgs.length ? ' +Bash' : ''}...`);
    const result = await runClaude(fullPrompt, maxTurns, claudeExtraArgs);
    console.log(`[agent-runner] Claude completed. Output: ${result.length} chars`);

    // 4b. Post-processing: sync new drafts to Google Sheets
    if (role === 'content-ops' || role === 'writer') {
      try {
        await runSheetsSync();
      } catch (syncErr) {
        console.warn(`[agent-runner] Sheets sync skipped: ${syncErr.message}`);
      }
    }

    // 5. Complete
    await completeIssue(issue.id, result);
    console.log(`[agent-runner] Issue ${issue.identifier} → done`);

    // 6. Self-re-invoke: if more tasks in inbox → wake self
    try {
      const remaining = await getInbox();
      if (remaining.length > 0) {
        console.log(`[agent-runner] ${remaining.length} more task(s) in inbox. Self-invoking...`);
        await request('POST', `${API_URL}/api/agents/${AGENT_ID}/heartbeat/invoke`, {});
      }
    } catch (selfErr) {
      console.warn(`[agent-runner] Self-invoke check failed: ${selfErr.message}`);
    }
  } catch (err) {
    console.error(`[agent-runner] Execution error: ${err.message}`);
    await failIssue(issue.id, err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[agent-runner] Fatal:', err.message);
  process.exit(1);
});
