'use strict';

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const templates = require('./templates');
const sheets = require('./sheets');
const paperclip = require('./paperclip');
const dashboard = require('./dashboard-bridge');

// ─── Config ──────────────────────────────────────────────────────────────────

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const USE_POLLING = process.env.USE_POLLING !== 'false';
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || '3001', 10);
const ARTEM_CHAT_ID = process.env.TELEGRAM_ARTEM_CHAT_ID;
const ZHENYA_CHAT_ID = process.env.TELEGRAM_ZHENYA_CHAT_ID;
const PAPERCLIP_BASE_URL = process.env.PAPERCLIP_BASE_URL || 'http://localhost:3100';

if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не задан в .env');
  process.exit(1);
}

// ─── Bot Init ─────────────────────────────────────────────────────────────────

let bot;

if (USE_POLLING) {
  // Локальная разработка: polling (без HTTPS)
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log('✅ Bot started in POLLING mode (local dev)');
} else {
  // Production: webhook через nginx/HTTPS
  bot = new TelegramBot(TOKEN, { webHook: { port: WEBHOOK_PORT } });
  bot.setWebHook(`${WEBHOOK_URL}`);
  console.log(`✅ Bot started in WEBHOOK mode on port ${WEBHOOK_PORT}`);
}

// ─── Whisper (локальный, через faster-whisper) ───────────────────────────────

const { execFile } = require('child_process');
const WHISPER_SCRIPT = path.join(__dirname, 'whisper_transcribe.py');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Отправить сообщение Артёму
 */
async function notifyArtem(text) {
  if (!ARTEM_CHAT_ID) return;
  try {
    await bot.sendMessage(ARTEM_CHAT_ID, text, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Ошибка отправки Артёму:', err.message);
  }
}

/**
 * Отправить сообщение Жене
 */
async function notifyZhenya(text) {
  if (!ZHENYA_CHAT_ID) return;
  try {
    await bot.sendMessage(ZHENYA_CHAT_ID, text, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Ошибка отправки Жене:', err.message);
  }
}

/**
 * Расшифровать голосовое через локальный faster-whisper
 */
async function transcribeVoice(fileId) {
  const file = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
  const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
  const tempPath = path.join('/tmp', `voice_${Date.now()}.ogg`);
  fs.writeFileSync(tempPath, response.data);

  return new Promise((resolve, reject) => {
    execFile('python3', [WHISPER_SCRIPT, tempPath], { timeout: 120000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(tempPath); } catch (_) {}
      if (err) {
        console.error('Whisper error:', stderr || err.message);
        resolve('[Ошибка расшифровки голосового]');
      } else {
        resolve(stdout.trim() || '[Тишина или неразборчиво]');
      }
    });
  });
}

/**
 * Записать идею в файл для обработки агентом
 */
function saveIdeaForValidation(text, fromName) {
  const dir = path.join(__dirname, '../output/tracking');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fileName = `idea_${Date.now()}.md`;
  const filePath = path.join(dir, fileName);
  const content = `# Идея для валидации\n\n**От:** ${fromName}\n**Дата:** ${new Date().toISOString()}\n\n## Текст\n\n${text}\n`;
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

// ─── Helpers: Weekly tasks from calendar ─────────────────────────────────────

function getCurrentWeekTasks() {
  const calendarPath = path.join(__dirname, '../output/tactic/к-календарный-план.md');
  if (!fs.existsSync(calendarPath)) return [];
  const content = fs.readFileSync(calendarPath, 'utf8');
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const weekNum = Math.ceil(dayOfYear / 7);
  // Простое извлечение задач по ключевым словам текущего месяца
  const months = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл'];
  const currentMonth = months[now.getMonth()] || '';
  const lines = content.split('\n').filter(l => l.includes('|') && l.toLowerCase().includes(currentMonth));
  return lines.slice(0, 5).map(l => l.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim());
}

function getDraftPostsForApproval() {
  const draftsDir = path.join(__dirname, '../output/drafts');
  if (!fs.existsSync(draftsDir)) return [];
  const files = fs.readdirSync(draftsDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, 5);
  return files.map(f => {
    const content = fs.readFileSync(path.join(draftsDir, f), 'utf8');
    const preview = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('>')).slice(0, 3).join(' ').substring(0, 200);
    return { file: f, preview };
  });
}

function getDaysUntilFest() {
  const festDate = new Date('2026-07-11');
  const now = new Date();
  return Math.ceil((festDate - now) / 86400000);
}

// ─── Tactic section handler ───────────────────────────────────────────────────

const TACTIC_DIR = path.join(__dirname, '../output/tactic');

/**
 * Читает раздел тактики и отправляет выжимку (≤ 3500 символов)
 */
async function handleTacticSection(chatId, fileName, label) {
  const filePath = path.join(TACTIC_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    await bot.sendMessage(chatId, `⚠️ Раздел «${label}» ещё не написан.\n\nЗапусти: <code>/generate-tactic</code>`, { parse_mode: 'HTML' });
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Заголовок из H1
  const h1 = lines.find(l => l.startsWith('# '));
  const title = h1 ? h1.replace(/^#+\s*/, '').trim() : label;

  // Ключевые блоки: H2-заголовки + первые абзацы
  const summary = [];
  let inBlock = false;
  let blockLines = [];
  let blockCount = 0;

  for (const line of lines) {
    if (line.startsWith('## ') && blockCount < 6) {
      if (inBlock && blockLines.length > 0) {
        summary.push('<b>' + blockLines[0] + '</b>');
        const bodyLines = blockLines.slice(1).filter(l => l.trim() && !l.startsWith('---'));
        const bodyText = bodyLines.slice(0, 5).join('\n').replace(/\*\*/g, '').substring(0, 400);
        if (bodyText) summary.push(bodyText);
        summary.push('');
        blockCount++;
      }
      inBlock = true;
      blockLines = [line.replace(/^##\s*/, '')];
    } else if (inBlock) {
      blockLines.push(line);
    }
  }

  // Последний блок
  if (inBlock && blockLines.length > 0 && blockCount < 6) {
    summary.push('<b>' + blockLines[0] + '</b>');
    const bodyLines = blockLines.slice(1).filter(l => l.trim() && !l.startsWith('---'));
    const bodyText = bodyLines.slice(0, 5).join('\n').replace(/\*\*/g, '').substring(0, 400);
    if (bodyText) summary.push(bodyText);
  }

  let text = `📄 <b>${title}</b>\n\n`;
  text += summary.join('\n').substring(0, 3000);
  text += `\n\n📎 Полный файл: <code>output/tactic/${fileName}</code>`;

  // Разбиваем на части если > 4000 символов
  if (text.length > 4000) {
    const chunks = [];
    let chunk = '';
    for (const line of text.split('\n')) {
      if ((chunk + line + '\n').length > 3800) {
        chunks.push(chunk);
        chunk = '';
      }
      chunk += line + '\n';
    }
    if (chunk) chunks.push(chunk);

    for (const c of chunks) {
      await bot.sendMessage(chatId, c, { parse_mode: 'HTML', disable_web_page_preview: true });
    }
  } else {
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true });
  }
}

// ─── Agent task handler ───────────────────────────────────────────────────────

/**
 * Отправляет длинное сообщение, разбивая на чанки
 */
async function sendLongMessage(chatId, text, opts = {}) {
  const MAX = 3800;
  if (text.length <= MAX) {
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true, ...opts });
    return;
  }
  const chunks = [];
  let chunk = '';
  for (const line of text.split('\n')) {
    if ((chunk + line + '\n').length > MAX) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += line + '\n';
  }
  if (chunk) chunks.push(chunk);
  for (const c of chunks) {
    await bot.sendMessage(chatId, c, { parse_mode: 'HTML', disable_web_page_preview: true });
  }
}

const AGENT_EMOJI = { researcher: '🔍', writer: '✍️', critic: '⚖️', 'content-ops': '📱', ceo: '🎯', 'head-strategy': '🧭', 'head-content': '📝', 'head-growth': '📈' };
const AGENT_NAME = { researcher: 'Researcher', writer: 'Writer', critic: 'Critic', 'content-ops': 'ContentOps', ceo: 'CMO', 'head-strategy': 'Head of Strategy', 'head-content': 'Head of Content', 'head-growth': 'Head of Growth' };

/**
 * Phase 1A: Тупая труба — бот создаёт Issue для CMO и будит его.
 * Без polling, без batch, без прогресс-бара.
 */
async function sendToCMO(chatId, text) {
  const issue = await paperclip.createIssue(
    `[TG] ${text.substring(0, 80)}`,
    `Запрос из Telegram:\n\n${text}`,
    'ceo'
  );

  const isLocal = issue.source === 'file';
  if (isLocal) {
    await bot.sendMessage(chatId, [
      '🧠 <b>CMO принял задачу (Paperclip offline)</b>',
      `📁 <code>output/tracking/${issue.fileName}</code>`,
      'Запусти Paperclip чтобы агент обработал.',
    ].join('\n'), { parse_mode: 'HTML' });
    return;
  }

  await bot.sendMessage(chatId, [
    '🧠 <b>CMO принял задачу</b>',
    `📋 <code>${issue.identifier || ''}</code>`,
    '⏳ Анализирую и распределяю...',
    `🖥 Paperclip: <code>localhost:3100</code>`,
  ].join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });

  const agentId = paperclip.AGENT_IDS && paperclip.AGENT_IDS.ceo;
  if (agentId) {
    await paperclip.invokeHeartbeat(agentId);
  }
}

/**
 * Создаёт Issue в Paperclip, будит агента, polling результата → доставка в TG
 */
async function handleAgentTask(chatId, agentType, taskText) {
  const emoji = AGENT_EMOJI[agentType] || '🤖';
  const name = AGENT_NAME[agentType] || agentType;
  console.log(`[handleAgentTask] chatId=${chatId} agent=${agentType} task="${taskText.substring(0,60)}"`);

  // 1. Создаём Issue
  const issue = await paperclip.createIssue(
    `[${agentType}] ${taskText.substring(0, 80)}`,
    taskText,
    agentType
  );
  console.log(`[handleAgentTask] issue created: ${issue.identifier || issue.id} source=${issue.source}`);

  const isLocal = issue.source === 'file';

  if (isLocal) {
    // Fallback: Paperclip не запущен
    await bot.sendMessage(chatId, [
      `${emoji} <b>Задача сохранена (Paperclip offline)</b>`,
      '',
      `Агент: <b>${name}</b>`,
      `📁 <code>output/tracking/${issue.fileName}</code>`,
      '',
      'Запусти Paperclip: <code>npx paperclipai run --data-dir .paperclip</code>',
    ].join('\n'), { parse_mode: 'HTML' });
    return;
  }

  // 2. Отправляем статус
  const issueIdentifier = issue.identifier || '';
  let statusMsg = null;
  try {
    statusMsg = await bot.sendMessage(chatId, [
      `${emoji} <b>${name} работает...</b>`,
      `📋 <code>${issueIdentifier}</code>`,
      `⏳ Ожидаю результат (до 5 мин)`,
    ].join('\n'), { parse_mode: 'HTML', disable_web_page_preview: true });
    console.log(`[handleAgentTask] status msg sent, msg_id=${statusMsg?.message_id}`);
  } catch (sendErr) {
    console.error(`[handleAgentTask] sendMessage error: ${sendErr.message}`);
  }

  // 3. Будим агента
  const agentId = paperclip.AGENT_IDS[agentType];
  if (agentId) {
    await paperclip.invokeHeartbeat(agentId);
    console.log(`[handleAgentTask] heartbeat invoked for ${agentType}`);
  }

  // 4. Polling (каждые 10 сек, макс 5 мин)
  console.log(`[handleAgentTask] polling ${issue.id}...`);
  let lastStatus = '';
  const result = await paperclip.waitForCompletion(issue.id, {
    intervalMs: 10000,
    timeoutMs: 600000, // 10 мин для CMO (может создавать подзадачи)
    onProgress: async (status) => {
      if (status !== lastStatus) {
        lastStatus = status;
        console.log(`[handleAgentTask] ${issueIdentifier} status → ${status}`);
        const statusEmoji = { in_progress: '🔄', done: '✅', cancelled: '❌' };
        if (statusMsg) {
          try {
            await bot.editMessageText([
              `${emoji} <b>${name} ${status === 'in_progress' ? 'работает' : status}...</b>`,
              `📋 <code>${issueIdentifier}</code>`,
              `${statusEmoji[status] || '⏳'} Статус: ${status}`,
            ].join('\n'), {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
            });
          } catch {}
        }
      }
    },
  });
  console.log(`[handleAgentTask] waitForCompletion done: result=${result ? result.status : 'null(timeout)'}`);

  // 5. Доставка результата
  if (result && result.status === 'done') {
    const comment = await paperclip.getLatestComment(issue.id);
    const resultText = comment ? comment.body : '(агент завершил без комментария)';
    console.log(`[handleAgentTask] delivering result, len=${resultText.length}`);

    // Убираем статус-сообщение (результат будет в новом сообщении)
    if (statusMsg) {
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch {}
    }

    // Краткий результат
    const cleanText = resultText.replace(/<[^>]*>/g, '').trim();
    const shortResult = cleanText.length > 800 ? cleanText.substring(0, 800) + '...' : cleanText;

    // Обновляем дашборд
    dashboard.updateDashboard({
      agent: name,
      action: 'task_complete',
      summary: `${taskText.substring(0, 60)} → ${cleanText.substring(0, 120)}`,
    });

    const dashUrl = dashboard.getDashboardUrl();

    // Единое сообщение: краткий результат + дашборд + кнопки
    await bot.sendMessage(chatId, [
      `${emoji} <b>${name} — готово</b> ✅`,
      `📋 <code>${issueIdentifier}</code>`,
      '',
      shortResult,
      '',
      `📊 <a href="${dashUrl}">Открыть дашборд</a> — изменения уже там`,
    ].join('\n'), {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[
          { text: '👍 Ок', callback_data: `agent_ok:${issue.id.substring(0, 36)}` },
          { text: '✏️ Доработай', callback_data: `agent_rev:${issue.id.substring(0, 36)}` },
          { text: '❌ Отмена', callback_data: `agent_del:${issue.id.substring(0, 36)}` },
        ]],
      },
    });

    console.log(`[handleAgentTask] delivered: ${issueIdentifier}, dashboard updated`);
  } else if (result && result.status === 'cancelled') {
    await bot.editMessageText([
      `${emoji} <b>${name} — отменено</b> ❌`,
      `📋 ${issue.identifier}`,
    ].join('\n'), {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'HTML',
    });
  } else {
    // Timeout
    await bot.editMessageText([
      `${emoji} <b>${name} — в работе (долгая задача)</b>`,
      '',
      `📋 <code>${issueIdentifier}</code>`,
      `⏳ Агент работает дольше 5 мин.`,
      `🖥 Paperclip: <code>localhost:3100</code> → Issues → ${issueIdentifier}`,
      '',
      'Результат придёт когда агент закончит.',
    ].join('\n'), {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    // Запускаем фоновый polling (ещё 10 мин)
    pollInBackground(chatId, issue.id, agentType, 600000);
  }
}

/**
 * Фоновый polling для долгих задач (после основного timeout)
 */
function pollInBackground(chatId, issueId, agentType, timeoutMs) {
  const emoji = AGENT_EMOJI[agentType] || '🤖';
  const name = AGENT_NAME[agentType] || agentType;

  const check = async () => {
    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs) {
      console.log(`[pollInBackground] ${issueId} — timeout after ${timeoutMs}ms`);
      return;
    }

    try {
      const issue = await paperclip.getIssue(issueId);
      if (!issue) return;

      if (issue.status === 'done') {
        const comment = await paperclip.getLatestComment(issueId);
        const resultText = comment ? comment.body : '(агент завершил без комментария)';

        // Краткий результат (убрать HTML, обрезать)
        const cleanText = resultText.replace(/<[^>]*>/g, '').trim();
        const shortResult = cleanText.length > 500 ? cleanText.substring(0, 500) + '...' : cleanText;

        // Обновляем дашборд
        dashboard.updateDashboard({
          agent: name,
          action: 'task_complete',
          summary: `${issue.title.substring(0, 60)} → ${shortResult.substring(0, 120)}`,
        });

        const dashUrl = dashboard.getDashboardUrl();

        // Отправляем краткий отчёт + ссылка на дашборд
        await bot.sendMessage(chatId, [
          `${emoji} <b>${name} — готово</b> ✅`,
          `📋 <code>${issue.identifier}</code>`,
          '',
          shortResult.substring(0, 800),
          '',
          `📊 <a href="${dashUrl}">Открыть дашборд</a>`,
        ].join('\n'), {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[
              { text: '👍 Ок', callback_data: `agent_ok:${issueId.substring(0, 36)}` },
              { text: '✏️ Доработай', callback_data: `agent_rev:${issueId.substring(0, 36)}` },
            ]],
          },
        });

        console.log(`[pollInBackground] ${issue.identifier} delivered + dashboard updated`);
        return;
      }

      if (issue.status === 'cancelled') return;
    } catch (err) {
      console.error(`[pollInBackground] error: ${err.message}`);
    }

    setTimeout(check, 10000); // check every 10s
  };

  const startTime = Date.now();
  setTimeout(check, 10000);
}

// ─── Handler Functions (вынесены для NLP-маппинга) ──────────────────────────

async function handleHelp(chatId) {
  await bot.sendMessage(chatId, `🤘 <b>ExtremeFest Bot</b>
⏳ До феста: <b>${getDaysUntilFest()} дней</b>

<b>📊 Дашборд</b>
/статус — полный дашборд проекта
/cjm — CJM по S-ID (что покрыто, что нет)
/бюджет — бюджет маркетинга
/задачи — задачи этой недели

<b>📋 Контент</b>
/контент — план на эту неделю
/черновики — посты на одобрение
/баланс — баланс воронки

<b>🎯 Трекинг</b>
/амбассадоры — статус питч-листа
/партнёры — инфопартнёры
/блогеры — статус посевов
/продажи — план продаж билетов

<b>🏗️ Тендеры</b>
/тендер — сводка всех тендеров
/тендер сайт|видео|дизайн|smm|трафик

<b>📄 Тактика</b>
«план продаж», «анализ рынка», «амбассадоры»
«рекламный бюджет», «мерч», «календарный план»

<b>🤖 Агенты</b>
«исследуй [тему]» → Researcher
«напиши [текст]» → Writer
«проверь [идею]» → Critic

<b>🛠 Прочее</b>
/дайджест — дайджест сейчас
/таблица — ссылки на Google Sheets

chat_id: <code>${chatId}</code>`, { parse_mode: 'HTML' });
}

async function handleCJM(chatId) {
  if (!sheets.isConfigured()) {
    await bot.sendMessage(chatId, '⚠️ Google Sheet не настроен.', { parse_mode: 'HTML' });
    return;
  }
  try {
    const coverage = await sheets.getSIDCoverage();
    if (!coverage) {
      await bot.sendMessage(chatId, '⚠️ Не удалось получить CJM-данные.', { parse_mode: 'HTML' });
      return;
    }
    const stageEmoji = { 'Привлечение': '🟢', 'Прогрев': '🟡', 'Продажа': '🔴', 'Лояльность': '⚪' };
    const lines = ['📊 <b>CJM по сегментам (S-ID)</b>', ''];
    for (const [stage, data] of Object.entries(coverage)) {
      lines.push(`${stageEmoji[stage] || '•'} <b>${stage}</b> (цель ${data.target}%): ${data.covered}/${data.total} S-ID покрыты, ${data.totalPosts} постов`);
      for (const sid of data.sids) {
        const mark = sid.covered ? '✅' : '⚠️';
        const reach = sid.avgReach > 0 ? `, охват ${sid.avgReach}` : '';
        lines.push(`  ${mark} ${sid.sid} ${sid.name}: ${sid.count} постов${reach}`);
      }
      lines.push('');
    }
    // Рекомендация
    const missing = [];
    for (const [stage, data] of Object.entries(coverage)) {
      const uncovered = data.sids.filter(s => !s.covered);
      if (uncovered.length > 0) {
        missing.push(`${stage}: ${uncovered.map(s => s.sid + ' ' + s.name).join(', ')}`);
      }
    }
    if (missing.length > 0) {
      lines.push('💡 <b>Не покрыты:</b>');
      for (const m of missing) lines.push(`• ${m}`);
    }
    await bot.sendMessage(chatId, lines.join('\n').substring(0, 4000), { parse_mode: 'HTML' });
  } catch (err) {
    await bot.sendMessage(chatId, `⚠️ Ошибка CJM: ${err.message}`, { parse_mode: 'HTML' });
  }
}

async function handleBudget(chatId) {
  const budgetPath = path.join(__dirname, '../output/tracking/budget.md');
  if (!fs.existsSync(budgetPath)) {
    await bot.sendMessage(chatId, '⚠️ Файл budget.md не найден.', { parse_mode: 'HTML' });
    return;
  }
  const content = fs.readFileSync(budgetPath, 'utf8');
  const totalMatch = content.match(/^Общий бюджет:\s*(\d+)/m);
  const spentMatch = content.match(/^Потрачено:\s*(\d+)/m);
  const soldMatch = content.match(/^Продано билетов:\s*(\d+)/m);
  const totalBudget = totalMatch ? parseInt(totalMatch[1]) : 0;
  const spent = spentMatch ? parseInt(spentMatch[1]) : 0;
  const remaining = totalBudget - spent;
  const sold = soldMatch ? parseInt(soldMatch[1]) : 0;
  const costPerTicket = sold > 0 && spent > 0 ? Math.round(spent / sold) : '—';

  // Парсинг таблицы
  const tableRows = content.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Статья'));
  const items = tableRows.map(row => {
    const cols = row.split('|').map(c => c.trim()).filter(Boolean);
    return cols.length >= 4 ? `• ${cols[0]}: ${parseInt(cols[2]).toLocaleString('ru')}₽ / ${parseInt(cols[1]).toLocaleString('ru')}₽` : null;
  }).filter(Boolean);

  const percent = totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0;
  const text = [
    `💰 <b>Бюджет маркетинга</b>`,
    '',
    `📊 Общий: <b>${(totalBudget / 1000).toFixed(0)}K₽</b>`,
    `📉 Потрачено: <b>${(spent / 1000).toFixed(0)}K₽</b> (${percent}%)`,
    `📈 Остаток: <b>${(remaining / 1000).toFixed(0)}K₽</b>`,
    `🎫 Стоимость 1 билета: <b>${costPerTicket}₽</b>`,
    '',
    `<b>По статьям:</b>`,
    ...items,
    '',
    `📎 <code>output/tracking/budget.md</code>`,
  ].join('\n');

  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

async function handleStatus(chatId) {
  const daysLeft = getDaysUntilFest();
  const TRACKING_DIR = path.join(__dirname, '../output/tracking');
  const TACTIC_DIR_PATH = path.join(__dirname, '../output/tactic');

  // ── Продажи ──
  let ticketsSold = '?';
  const salesPath = path.join(TRACKING_DIR, 'sales.md');
  if (fs.existsSync(salesPath)) {
    const sm = fs.readFileSync(salesPath, 'utf8').match(/^Продано:\s*(\d+)/m);
    if (sm) ticketsSold = sm[1];
  }

  // ── Тактика ──
  const tacticFiles = ['а', 'б', 'в', 'г', 'д', 'е', 'ж', 'з', 'и', 'к', 'л', 'м', 'н'];
  let tacticDone = 0;
  if (fs.existsSync(TACTIC_DIR_PATH)) {
    const files = fs.readdirSync(TACTIC_DIR_PATH);
    tacticDone = tacticFiles.filter(l => files.some(f => f.startsWith(l))).length;
  }

  // ── Амбассадоры ──
  let ambassLine = '🔴 нет данных';
  const amPath = path.join(TRACKING_DIR, 'ambassadors.md');
  if (fs.existsSync(amPath)) {
    const ac = fs.readFileSync(amPath, 'utf8');
    const rows = ac.split('\n').filter(l => l.startsWith('|') && l.includes('|') && !l.includes('---') && !l.includes('Имя') && !l.includes('Ник'));
    const total = rows.length;
    const agreed = rows.filter(l => l.includes('🟢') || l.includes('✅') || l.includes('🎯') || l.includes('📋')).length;
    ambassLine = `${total} в базе, ${agreed} согласились`;
  }

  // ── Партнёры ──
  let partnersLine = '🔴 нет данных';
  const ppPath = path.join(TRACKING_DIR, 'partners.md');
  if (fs.existsSync(ppPath)) {
    const pc = fs.readFileSync(ppPath, 'utf8');
    const rows = pc.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Станция') && !l.includes('Медиа') && !l.includes('Платформа') && !l.includes('Партнёр') && !l.includes('#'));
    const total = rows.length;
    const agreed = rows.filter(l => l.includes('🟢') || l.includes('✅') || l.includes('📋')).length;
    const confirmed = rows.filter(l => l.includes('Ernie Ball') || l.includes('✅')).length;
    partnersLine = `${total} в воронке, ${confirmed} подтверждены`;
  }

  // ── Тендеры ──
  let tendersLine = 'не запущены';
  const tpPath = path.join(TRACKING_DIR, 'tenders.md');
  if (fs.existsSync(tpPath)) {
    const tc = fs.readFileSync(tpPath, 'utf8');
    const launched = (tc.match(/✅|🟢/g) || []).length;
    const pending = (tc.match(/⏳/g) || []).length;
    tendersLine = launched > 0 ? `${launched} запущено, ${pending} ожидают` : `${pending} ожидают запуска`;
  }

  // ── Черновики ──
  const draftsDir = path.join(__dirname, '../output/drafts');
  const draftsCount = fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir).filter(f => f.endsWith('.md') && !f.startsWith('ШАБЛОН')).length : 0;

  // ── Дедлайны ──
  const now = new Date();
  const deadlines = [];
  if (now < new Date('2026-04-20')) deadlines.push('20 апр — запустить тендер на сайт');
  if (now < new Date('2026-04-25')) deadlines.push('25 апр — запустить тендер на трейлер');
  if (now < new Date('2026-05-04')) deadlines.push('4 мая — выбрать подрядчика сайта');
  if (now < new Date('2026-05-11')) deadlines.push('11 мая — выбрать подрядчика трейлера');
  if (now < new Date('2026-05-01')) deadlines.push('1 мая — раскрыть иностранного хедлайнера');
  const urgentDeadlines = deadlines.slice(0, 3);

  // ── Неделя ──
  const festStart = new Date(2026, 3, 7); // April 7
  const weekNum = Math.max(0, Math.floor((now - festStart) / (7 * 86400000)) + 1);
  const weekLabel = weekNum <= 0 ? '0 (старт 7 апреля)' : String(weekNum);

  // ── Цели месяца ──
  const monthTargets = { 3: 50, 4: 150, 5: 350, 6: 650, 7: 1000 };
  const currentMonth = now.getMonth() + 1;
  const monthTarget = monthTargets[currentMonth] || '?';
  const ticketsNum = parseInt(ticketsSold) || 0;
  const behindPlan = ticketsNum < (monthTarget * 0.7) ? '⚠️ позади плана' : '✅ в графике';

  // ── Блогеры ──
  let bloggersLine = '🔴 нет данных';
  const blPath = path.join(TRACKING_DIR, 'bloggers.md');
  if (fs.existsSync(blPath)) {
    const bc = fs.readFileSync(blPath, 'utf8');
    const rows = bc.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('Имя') && !l.includes('Статусы') && !l.includes('#'));
    const total = rows.length;
    const done = rows.filter(l => l.includes('✅')).length;
    bloggersLine = `${done}/${total} опубликовали`;
  }

  const text = [
    `🤘 <b>Эстрим Фест — Дашборд</b>`,
    `⏳ До феста: <b>${daysLeft} дней</b> | Неделя: ${weekLabel}`,
    '',
    `🎫 <b>БИЛЕТЫ:</b> ${ticketsSold}/1000 (${Math.round(ticketsNum / 10)}%) ${behindPlan}`,
    `   Цель ${['', '', '', 'марта', 'апреля', 'мая', 'июня', 'июля'][currentMonth] || 'месяца'}: ${monthTarget}`,
    '',
    `📋 <b>ТЕНДЕРЫ:</b> ${tendersLine}`,
    `🎸 <b>АМБАССАДОРЫ:</b> ${ambassLine}`,
    `📻 <b>ПАРТНЁРЫ:</b> ${partnersLine}`,
    `📣 <b>БЛОГЕРЫ:</b> ${bloggersLine}`,
    '',
    `📄 Тактика: ${tacticDone}/${tacticFiles.length} | Черновики: ${draftsCount}`,
    '',
    urgentDeadlines.length > 0
      ? `🔥 <b>Горит:</b>\n${urgentDeadlines.map(d => `• ${d}`).join('\n')}`
      : '✅ Критичных дедлайнов на этой неделе нет',
    '',
    'Детали: /cjm /бюджет /амбассадоры /тендер',
  ].join('\n');

  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

async function handleAmbassadors(chatId) {
  const TRACKING_DIR = path.join(__dirname, '../output/tracking');
  const filePath = path.join(TRACKING_DIR, 'ambassadors.md');

  if (!fs.existsSync(filePath)) {
    await bot.sendMessage(chatId, '⚠️ Файл ambassadors.md не найден.', { parse_mode: 'HTML' });
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Считаем статистику
  const dataRows = lines.filter(l => l.startsWith('|') && l.includes('|') && !l.includes('---') && !l.includes('Имя') && !l.includes('Ник') && !l.includes('Статусы') && !l.includes('#'));
  const total = dataRows.length;
  const pitched = dataRows.filter(l => l.includes('🟡') || l.includes('🟠') || l.includes('🟢') || l.includes('✅') || l.includes('📋') || l.includes('🎯')).length;
  const agreed = dataRows.filter(l => l.includes('🟢') || l.includes('✅') || l.includes('📋') || l.includes('🎯')).length;
  const done = dataRows.filter(l => l.includes('✅') || l.includes('📋') || l.includes('🎯')).length;

  // Топ-5 приоритетных (ищем высокий ICE и статус 🔴)
  const notPitched = dataRows
    .filter(l => l.includes('🔴'))
    .slice(0, 5)
    .map(l => {
      const cols = l.split('|').map(c => c.trim()).filter(Boolean);
      return cols[1] ? `• ${cols[1]}` : null;
    })
    .filter(Boolean);

  const text = [
    `🎸 <b>Амбассадоры — трекинг</b>`,
    '',
    `📊 Всего в базе: <b>${total}</b>`,
    `🟡 Питчили: <b>${pitched}</b>`,
    `🟢 Согласились: <b>${agreed}</b>`,
    `✅ Материал готов: <b>${done}</b>`,
    `🎯 Цель: 15+ кругляшков к июню`,
    '',
    notPitched.length > 0
      ? `<b>Следующие в питче:</b>\n${notPitched.join('\n')}`
      : '✅ Все в питче',
    '',
    `📎 <code>output/tracking/ambassadors.md</code>`,
  ].join('\n');

  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

async function handlePartners(chatId) {
  const TRACKING_DIR = path.join(__dirname, '../output/tracking');
  const filePath = path.join(TRACKING_DIR, 'partners.md');

  if (!fs.existsSync(filePath)) {
    await bot.sendMessage(chatId, '⚠️ Файл partners.md не найден.', { parse_mode: 'HTML' });
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const dataRows = lines.filter(l =>
    l.startsWith('|') && l.includes('|') && !l.includes('---') &&
    !l.includes('Станция') && !l.includes('Медиа') && !l.includes('Платформа') &&
    !l.includes('Партнёр') && !l.includes('# ') && l.trim() !== '|---|---|---|---|---|---|---|---|'
  );

  const total = dataRows.length;
  const contacted = dataRows.filter(l => l.includes('🟡') || l.includes('🟠') || l.includes('🟢') || l.includes('✅')).length;
  const confirmed = dataRows.filter(l => l.includes('🟢') || l.includes('✅') || l.includes('📋')).length;
  const notContacted = dataRows.filter(l => l.includes('🔴')).length;

  const text = [
    `📻 <b>Инфопартнёры — трекинг</b>`,
    '',
    `📊 Всего в воронке: <b>${total}</b>`,
    `🟡 Написали: <b>${contacted}</b>`,
    `🟢 Подтверждены: <b>${confirmed}</b>`,
    `🔴 Не написали: <b>${notContacted}</b>`,
    `🎯 Цель: 10+ партнёров`,
    '',
    `<b>Уровни:</b>`,
    `📡 Радиостанции: Rock FM, НАШЕ, Максимум`,
    `📰 Медиа: InRock, Rockcor, Metal Library`,
    `📅 Афиши: KudaGo, Afisha, TimeOut`,
    `🛹 Скейт: Red Deck, Rampstroy, Street Zone`,
    '',
    `Лимит билетов: 50 суммарно`,
    `📎 <code>output/tracking/partners.md</code>`,
  ].join('\n');

  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

async function handleBloggers(chatId) {
  const TRACKING_DIR = path.join(__dirname, '../output/tracking');
  const filePath = path.join(TRACKING_DIR, 'bloggers.md');

  if (!fs.existsSync(filePath)) {
    await bot.sendMessage(chatId, '⚠️ Файл bloggers.md не найден.', { parse_mode: 'HTML' });
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const dataRows = lines.filter(l =>
    l.startsWith('|') && l.includes('|') && !l.includes('---') && !l.includes('Имя') &&
    !l.includes('Статусы') && !l.includes('# ')
  );

  const total = dataRows.length;
  const done = dataRows.filter(l => l.includes('✅')).length;
  const active = dataRows.filter(l => l.includes('🟢') || l.includes('🟠')).length;
  const notYet = dataRows.filter(l => l.includes('🔴')).length;

  const text = [
    `📣 <b>Блогеры и посевы — трекинг</b>`,
    '',
    `📊 Всего в базе: <b>${total}</b>`,
    `✅ Опубликовали: <b>${done}</b>`,
    `🟢 В работе: <b>${active}</b>`,
    `🔴 Не написали: <b>${notYet}</b>`,
    `🎯 Цель: 500k+ охват`,
    '',
    `<b>Волны:</b>`,
    `📅 Волна 1 (май): 5 блогеров — охват 100k+`,
    `📅 Волна 2 (июнь): 10+ каналов — охват 300k+`,
    `📅 Волна 3 (июль): все каналы + региональные`,
    '',
    `Лимит билетов: 30 блогерам (в рамках 80 общих)`,
    `📎 <code>output/tracking/bloggers.md</code>`,
  ].join('\n');

  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

async function handleDigest(chatId) {
  const TRACKING_DIR = path.join(__dirname, '../output/tracking');
  const daysLeft = getDaysUntilFest();
  const now = new Date();
  const date = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  // Продажи
  let ticketsSold = 'неизвестно';
  const salesPath = path.join(TRACKING_DIR, 'sales.md');
  if (fs.existsSync(salesPath)) {
    const sm = fs.readFileSync(salesPath, 'utf8').match(/^Продано:\s*(\d+)/m);
    if (sm) ticketsSold = sm[1];
  }

  // Задачи
  const tasks = getCurrentWeekTasks();
  const urgentDeadlines = [];
  const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const criticalDates = [
    { d: new Date('2026-04-20'), t: 'Запустить тендер на сайт (30 брифов)' },
    { d: new Date('2026-04-25'), t: 'Запустить тендер на трейлер (30 брифов)' },
    { d: new Date('2026-05-04'), t: 'Выбрать подрядчика сайта' },
    { d: new Date('2026-05-11'), t: 'Выбрать подрядчика трейлера' },
    { d: new Date('2026-05-01'), t: 'Раскрыть иностранного хедлайнера' },
    { d: new Date('2026-06-01'), t: 'Запустить посевы в ТГ-каналах' },
  ];
  for (const { d, t } of criticalDates) {
    if (d >= now && d <= inTwoWeeks) {
      const days = Math.ceil((d - now) / 86400000);
      urgentDeadlines.push(`${t} — через ${days} дн.`);
    }
  }

  const tasksToday = urgentDeadlines.length > 0 ? urgentDeadlines : (tasks.length > 0 ? tasks : ['Нет задач с дедлайном в ближайшие 2 недели']);
  const message = templates.dailyDigest({ date, tasksToday, urgentItems: urgentDeadlines, ticketsSold, daysLeft });

  await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
}

async function handleTasks(chatId) {
  const tasks = getCurrentWeekTasks();
  const daysLeft = getDaysUntilFest();

  if (tasks.length === 0) {
    await bot.sendMessage(chatId, `📋 <b>Задачи на неделю</b>\n\nКалендарный план не найден или задач на этот период нет.\n\n⏳ До феста: <b>${daysLeft} дней</b>`, { parse_mode: 'HTML' });
    return;
  }

  const taskList = tasks.map((t, i) => `${i + 1}. ${t}`).join('\n');
  await bot.sendMessage(chatId, `📋 <b>Задачи на эту неделю</b>\n\n${taskList}\n\n⏳ До феста: <b>${daysLeft} дней</b>`, { parse_mode: 'HTML' });
}

async function handleFilePosts(chatId) {
  const drafts = getDraftPostsForApproval();
  if (drafts.length === 0) {
    await bot.sendMessage(chatId, '📝 Черновиков для одобрения нет.', { parse_mode: 'HTML' });
    return;
  }
  for (const draft of drafts) {
    const preview = draft.preview || '(пусто)';
    await bot.sendMessage(chatId, `✍️ <b>${draft.file}</b>\n\n<i>${preview}...</i>`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Одобрить', callback_data: `approve:${draft.file}` },
          { text: '✏️ Доработать', callback_data: `revise:${draft.file}` },
          { text: '❌ Отклонить', callback_data: `reject:${draft.file}` }
        ]]
      }
    });
  }
}

async function handleContent(chatId) {
  if (!sheets.isConfigured()) {
    await bot.sendMessage(chatId, '⚠️ Google Sheet не настроен. Запусти: <code>node scripts/init-smm-sheet.js</code>', { parse_mode: 'HTML' });
    return;
  }

  const weekNum = sheets.getCurrentWeekNumber();
  const plan = await sheets.getWeekPlan(weekNum);
  const daysLeft = getDaysUntilFest();

  if (plan.length === 0) {
    await bot.sendMessage(chatId, `📋 <b>Неделя ${weekNum}</b>\n\nКонтент-план пуст. Агент content-ops ещё не заполнил.\n\n⏳ До феста: <b>${daysLeft} дней</b>`, { parse_mode: 'HTML' });
    return;
  }

  let text = `📋 <b>Контент-план — неделя ${weekNum}</b>\n\n`;
  for (const post of plan) {
    const statusEmoji = post.status === 'Одобрен' ? '✅' : post.status === 'Черновик' ? '✏️' : post.status === 'Опубликован' ? '📤' : '⏳';
    text += `${statusEmoji} <b>${post.day} ${post.date}</b> — ${post.rubric || '—'}\n`;
    text += `   ${post.sid || ''} | ${post.stage || ''} | ${post.format || ''}\n`;
    if (post.text) text += `   <i>${post.text.substring(0, 80)}...</i>\n`;
    text += '\n';
  }
  text += `⏳ До феста: <b>${daysLeft} дней</b>`;
  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

async function handleBalance(chatId) {
  if (!sheets.isConfigured()) {
    await bot.sendMessage(chatId, '⚠️ Google Sheet не настроен.', { parse_mode: 'HTML' });
    return;
  }

  const balance = await sheets.getFunnelBalance();
  if (!balance) {
    await bot.sendMessage(chatId, '❌ Не удалось загрузить баланс воронки.', { parse_mode: 'HTML' });
    return;
  }

  let text = '📊 <b>Баланс воронки</b>\n\n';
  const targets = { 'Привлечение': '40%', 'Прогрев': '25%', 'Продажа': '20%', 'Лояльность': '15%' };
  for (const row of balance) {
    const target = targets[row.stage] || '';
    text += `${row.stage}: <b>${row.count}</b> постов (${row.percent}) | цель: ${target}\n`;
  }
  text += '\n📎 Таблица: ' + sheets.getSheetUrl();
  await bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true });
}

async function handleDrafts(chatId) {
  if (!sheets.isConfigured()) {
    await bot.sendMessage(chatId, '⚠️ Google Sheet не настроен.', { parse_mode: 'HTML' });
    return;
  }

  const drafts = await sheets.getPostsByStatus('Черновик');
  if (drafts.length === 0) {
    await bot.sendMessage(chatId, '📝 Черновиков для одобрения нет.', { parse_mode: 'HTML' });
    return;
  }

  for (const draft of drafts.slice(0, 5)) {
    const preview = draft.text ? draft.text.substring(0, 200) : '(текст не заполнен)';
    await bot.sendMessage(chatId, `✍️ <b>${draft.rubric}</b> (${draft.date})\nS-ID: ${draft.sid} | ${draft.stage}\n\n<i>${preview}</i>`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Одобрить', callback_data: `sheet_approve:${draft.rowIndex}` },
          { text: '✏️ Доработать', callback_data: `sheet_revise:${draft.rowIndex}` },
          { text: '❌ Отклонить', callback_data: `sheet_reject:${draft.rowIndex}` }
        ]]
      }
    });
  }
}

async function handleSheetLink(chatId) {
  const url = sheets.getSheetUrl();
  const tenderUrl = sheets.getTenderSheetUrl ? sheets.getTenderSheetUrl() : null;
  let text = `📎 <b>Таблицы: Эстрим Фест</b>\n\n📊 SMM-система: ${url}`;
  if (tenderUrl) text += `\n🎯 Тендеры: ${tenderUrl}`;
  await bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true });
}

async function handleWeek(chatId, weekNum) {
  if (!sheets.isConfigured()) {
    await bot.sendMessage(chatId, '⚠️ Google Sheet не настроен.', { parse_mode: 'HTML' });
    return;
  }

  const plan = await sheets.getWeekPlan(weekNum);
  if (plan.length === 0) {
    await bot.sendMessage(chatId, `Неделя ${weekNum}: пусто.`, { parse_mode: 'HTML' });
    return;
  }

  let text = `📋 <b>Неделя ${weekNum}</b>\n\n`;
  for (const post of plan) {
    text += `• <b>${post.day}</b> — ${post.rubric} (${post.sid}): ${post.status}\n`;
  }
  await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

// handleSales удалён — продажи теперь через handleTacticSection → г-план-продаж-билетов.md

async function handleTender(chatId, tenderType) {
  if (!sheets.isConfigured()) {
    await bot.sendMessage(chatId, '⚠️ Google Sheet не настроен.', { parse_mode: 'HTML' });
    return;
  }

  if (tenderType) {
    // Конкретный тендер
    const typeMap = {
      'сайт': 'Разработка', 'разработка': 'Разработка', 'site': 'Разработка',
      'видео': 'Видео', 'трейлер': 'Видео', 'video': 'Видео',
      'дизайн': 'Дизайн', 'design': 'Дизайн',
      'smm': 'SMM', 'смм': 'SMM',
      'трафик': 'Трафик', 'реклама': 'Трафик', 'traffic': 'Трафик',
    };
    const sheetName = typeMap[tenderType.toLowerCase()] || tenderType;

    try {
      const summary = await sheets.getTenderSummary(sheetName);
      if (!summary) {
        await bot.sendMessage(chatId, `❌ Тендер «${sheetName}» не найден.`, { parse_mode: 'HTML' });
        return;
      }

      const emojiMap = { 'Разработка': '🎯', 'Видео': '🎬', 'Дизайн': '🎨', 'SMM': '📱', 'Трафик': '📈' };
      let text = `${emojiMap[sheetName] || '📋'} <b>Тендер: ${sheetName}</b>\n\n`;
      text += `Собрано: <b>${summary.total}/30</b> | Прошли: <b>${summary.passed}</b> | Отказано: <b>${summary.rejected}</b>\n\n`;

      if (summary.top3.length > 0) {
        text += '<b>ТОП-3:</b>\n';
        for (const c of summary.top3) {
          text += `${c.rank}. ${c.name} — <b>${c.score}</b> (${c.budgetStatus || '—'})\n`;
        }
      } else {
        text += 'ТОП-3 пока нет — оценки не проставлены.\n';
      }

      text += `\n📎 Таблица: ${sheets.getTenderSheetUrl()}`;
      await bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true });
    } catch (err) {
      await bot.sendMessage(chatId, `❌ Ошибка: ${err.message}`, { parse_mode: 'HTML' });
    }
  } else {
    // Сводка по всем тендерам
    try {
      const all = await sheets.getAllTendersSummary();
      const emojiMap = { 'Трафик': '📈', 'Дизайн': '🎨', 'Разработка': '🎯', 'SMM': '📱', 'Видео': '🎬' };

      let text = '📊 <b>Тендеры: Эстрим Фест</b>\n\n';
      for (const s of all) {
        const e = emojiMap[s.type] || '📋';
        if (s.total === 0) {
          text += `${e} ${s.type}: не начат\n`;
        } else {
          const topName = s.top3.length > 0 ? `, ТОП: ${s.top3[0].name} (${s.top3[0].score})` : '';
          text += `${e} ${s.type}: <b>${s.total}/30</b>, прошли ${s.passed}${topName}\n`;
        }
      }
      text += `\n📎 Таблица: ${sheets.getTenderSheetUrl()}`;
      await bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true });
    } catch (err) {
      await bot.sendMessage(chatId, `❌ Ошибка: ${err.message}`, { parse_mode: 'HTML' });
    }
  }
}

// ─── Commands (делегируют в handler-функции) ──────────────────────────────────

bot.onText(/\/(start|помощь)/, (msg) => handleHelp(msg.chat.id));
bot.onText(/\/(check-status|статус)/, (msg) => handleStatus(msg.chat.id));
bot.onText(/\/задачи/, (msg) => handleTasks(msg.chat.id));
bot.onText(/\/посты/, (msg) => handleFilePosts(msg.chat.id));
bot.onText(/\/контент/, (msg) => handleContent(msg.chat.id));
bot.onText(/\/баланс/, (msg) => handleBalance(msg.chat.id));
bot.onText(/\/черновики/, (msg) => handleDrafts(msg.chat.id));
bot.onText(/\/таблица/, (msg) => handleSheetLink(msg.chat.id));
bot.onText(/\/неделя (\d+)/, (msg, match) => handleWeek(msg.chat.id, parseInt(match[1], 10)));
bot.onText(/\/продажи/, (msg) => handleTacticSection(msg.chat.id, 'г-план-продаж-билетов.md', 'План продаж билетов'));
bot.onText(/\/тендер(.*)/, (msg, match) => handleTender(msg.chat.id, (match[1] || '').trim() || null));
bot.onText(/\/(амбассадоры|ambassadors)/, (msg) => handleAmbassadors(msg.chat.id));
bot.onText(/\/(партнёры|partners)/, (msg) => handlePartners(msg.chat.id));
bot.onText(/\/(блогеры|bloggers)/, (msg) => handleBloggers(msg.chat.id));
bot.onText(/\/(дайджест|digest)/, (msg) => handleDigest(msg.chat.id));
bot.onText(/\/(cjm|воронка)/, (msg) => handleCJM(msg.chat.id));
bot.onText(/\/бюджет/, (msg) => handleBudget(msg.chat.id));

// ─── Inline-кнопки (callback_query) ─────────────────────────────────────────

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  if (data === 'noop') { await bot.answerCallbackQuery(query.id); return; }

  const [action, target] = data.split(':');
  const trackingDir = path.join(__dirname, '../output/tracking');
  if (!fs.existsSync(trackingDir)) fs.mkdirSync(trackingDir, { recursive: true });
  const approvedPath = path.join(trackingDir, 'approved-posts.md');
  const timestamp = new Date().toISOString().split('T')[0];

  // ── Voice message → backlog / validate ──
  if (action === 'backlog') {
    const voiceText = (global._voiceTexts || {})[chatId];
    if (voiceText && sheets.isConfigured()) {
      const row = await sheets.addIdeaToBacklog(voiceText);
      await bot.answerCallbackQuery(query.id, { text: '📋 Добавлено!' });
      await bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: '📋 В БЭКЛОГЕ', callback_data: 'noop' }]] }, { chat_id: chatId, message_id: query.message.message_id });
      await bot.sendMessage(chatId, `Добавлено в бэклог контента (строка ${row}).`, { parse_mode: 'HTML' });
    }
    return;
  }
  if (action === 'validate_voice') {
    const voiceText = (global._voiceTexts || {})[chatId];
    if (voiceText) {
      await bot.answerCallbackQuery(query.id, { text: '💡 Отправлено на валидацию' });
      await bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: '💡 НА ВАЛИДАЦИИ', callback_data: 'noop' }]] }, { chat_id: chatId, message_id: query.message.message_id });
    }
    return;
  }

  // ── Google Sheet inline buttons ──
  if (action.startsWith('sheet_')) {
    const rowIndex = parseInt(target, 10);
    const sheetAction = action.replace('sheet_', '');
    const statusMap = { approve: 'Одобрен', revise: 'Доработать', reject: 'Отклонён' };
    const emojiMap = { approve: '✅', revise: '✏️', reject: '❌' };
    const newStatus = statusMap[sheetAction];

    const success = await sheets.updatePostStatus(rowIndex, newStatus);
    if (success) {
      await bot.answerCallbackQuery(query.id, { text: `${emojiMap[sheetAction]} ${newStatus}` });
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: `${emojiMap[sheetAction]} ${newStatus.toUpperCase()}`, callback_data: 'noop' }]] },
        { chat_id: chatId, message_id: query.message.message_id }
      );
      if (sheetAction === 'revise') {
        await bot.sendMessage(chatId, `Что исправить? Напиши текстом — передам агенту.`, { parse_mode: 'HTML' });
      }
    } else {
      await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка записи в таблицу' });
    }
    return;
  }

  // ── Agent feedback buttons ──
  if (action === 'agent_ok') {
    await paperclip.updateIssueStatus(target, 'done');
    await bot.answerCallbackQuery(query.id, { text: '✅ Принято!' });
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [[{ text: '✅ ПРИНЯТО', callback_data: 'noop' }]] },
      { chat_id: chatId, message_id: query.message.message_id }
    );
    return;
  }
  if (action === 'agent_rev') {
    await bot.answerCallbackQuery(query.id, { text: '✏️ Что доработать?' });
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [[{ text: '✏️ НА ДОРАБОТКУ', callback_data: 'noop' }]] },
      { chat_id: chatId, message_id: query.message.message_id }
    );
    // Store revision context
    if (!global._pendingRevisions) global._pendingRevisions = {};
    global._pendingRevisions[chatId] = { issueId: target, timestamp: Date.now() };
    await bot.sendMessage(chatId, 'Напиши что доработать — передам агенту.', { parse_mode: 'HTML' });
    return;
  }
  if (action === 'agent_del') {
    await paperclip.updateIssueStatus(target, 'cancelled');
    await bot.answerCallbackQuery(query.id, { text: '❌ Отменено' });
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [[{ text: '❌ ОТМЕНЕНО', callback_data: 'noop' }]] },
      { chat_id: chatId, message_id: query.message.message_id }
    );
    return;
  }

  // ── File-based inline buttons (legacy) ──
  if (action === 'approve') {
    fs.appendFileSync(approvedPath, `\n| ${timestamp} | ${target} | ✅ Одобрен |`);
    await bot.answerCallbackQuery(query.id, { text: '✅ Одобрено!' });
    await bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: '✅ ОДОБРЕН', callback_data: 'noop' }]] }, { chat_id: chatId, message_id: query.message.message_id });
  } else if (action === 'revise') {
    fs.appendFileSync(approvedPath, `\n| ${timestamp} | ${target} | ✏️ На доработку |`);
    await bot.answerCallbackQuery(query.id, { text: '✏️ Принято. Напиши что исправить.' });
    await bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: '✏️ НА ДОРАБОТКУ', callback_data: 'noop' }]] }, { chat_id: chatId, message_id: query.message.message_id });
    await bot.sendMessage(chatId, `Что исправить в <code>${target}</code>? Напиши текстом.`, { parse_mode: 'HTML' });
  } else if (action === 'reject') {
    fs.appendFileSync(approvedPath, `\n| ${timestamp} | ${target} | ❌ Отклонён |`);
    await bot.answerCallbackQuery(query.id, { text: '❌ Отклонён.' });
    await bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: '❌ ОТКЛОНЁН', callback_data: 'noop' }]] }, { chat_id: chatId, message_id: query.message.message_id });
  }
});

bot.onText(/\/validate-idea (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const idea = match[1];
  const fromName = msg.from.first_name || 'Пользователь';

  await bot.sendMessage(chatId, `💭 Идея получена: <i>${idea}</i>\n\nСохраняю для валидации Critic...`, { parse_mode: 'HTML' });

  const filePath = saveIdeaForValidation(idea, fromName);
  await bot.sendMessage(chatId, `📁 Сохранено: <code>${path.basename(filePath)}</code>\n\nCritic обработает при следующем запуске.`, { parse_mode: 'HTML' });
});

bot.onText(/\/research (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const topic = match[1];

  await bot.sendMessage(chatId, `🔍 Тема для ресёрча: <i>${topic}</i>\n\nСохранено. Researcher обработает при следующем запуске.`, { parse_mode: 'HTML' });

  // Сохраняем запрос
  const dir = path.join(__dirname, '../output/research');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fileName = `research_request_${Date.now()}.md`;
  fs.writeFileSync(
    path.join(dir, fileName),
    `# Research Request\n\n**Тема:** ${topic}\n**Дата:** ${new Date().toISOString()}\n**От:** ${msg.from.first_name}\n`,
    'utf8'
  );
});

// ─── Голосовые сообщения ──────────────────────────────────────────────────────

bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  const fromName = msg.from.first_name || 'Пользователь';

  try {
    await bot.sendMessage(chatId, '🎙 Расшифровываю голосовое...');

    const text = await transcribeVoice(msg.voice.file_id);

    await bot.sendMessage(chatId, `📝 Расшифровка:\n\n${text}`, { parse_mode: 'HTML' });
    handleAgentTask(chatId, 'ceo', text);
  } catch (err) {
    console.error('Ошибка обработки голосового:', err.message);
    await bot.sendMessage(chatId, 'Не удалось обработать голосовое. Попробуй текстом.').catch(() => {});
  }
});

// ─── NLP-маппинг: свободный текст → команды ────────────────────────────────

// ── ACTION vs QUERY detection ──
// ACTION verbs → задача для AI-агента (создать, исследовать, написать)
// QUERY verbs → чтение существующего файла/данных (покажи, расскажи)
const ACTION_VERBS = ['напиши', 'сгенерируй', 'создай', 'подготовь', 'сделай',
  'проведи', 'исследуй', 'найди', 'собери', 'проверь', 'оцени', 'валидируй',
  'обнови', 'доработай', 'разработай', 'составь', 'придумай', 'переделай',
  'переработай', 'дополни', 'улучши'];
const QUERY_VERBS = ['покажи', 'расскажи', 'что по', 'дай', 'какой', 'какая',
  'сколько', 'где', 'открой', 'прочитай'];

function isActionRequest(text) {
  const low = text.toLowerCase();
  return ACTION_VERBS.some(v => low.includes(v));
}

function detectAgentType(text) {
  const low = text.toLowerCase();
  if (low.includes('исследу') || low.includes('найди') || low.includes('собери') || low.includes('монитор') || low.includes('бенчмарк')) return 'researcher';
  if (low.includes('провер') || low.includes('оцени') || low.includes('валидируй') || low.includes('критик')) return 'critic';
  if (low.includes('пост') || low.includes('черновик') || low.includes('контент') || low.includes('адаптируй')) return 'content-ops';
  return 'writer';
}

// ── TOPIC_MAP: тема → { queryHandler, agentType, file, label } ──
// queryHandler — для чтения существующих данных
// agentType — для создания новых (через Paperclip агента)
const TOPIC_MAP = [
  // Тактика: от специфичных к общим (порядок КРИТИЧЕН)
  { keywords: ['план продаж', 'продажи билет', 'помесячн план', 'целевые показател', 'продаж билет', 'выручк'],
    queryHandler: (chatId) => handleTacticSection(chatId, 'г-план-продаж-билетов.md', 'План продаж билетов'),
    agentType: 'writer' },
  { keywords: ['рекламный бюджет', 'бюджет канал', 'сколько тратить', 'рекламны расход', 'бюджет продвижени'],
    queryHandler: (chatId) => handleTacticSection(chatId, 'в-рекламный-бюджет.md', 'Рекламный бюджет'),
    agentType: 'writer' },
  { keywords: ['анализ рынк', 'конкурент', 'скрежет'],
    queryHandler: (chatId) => handleTacticSection(chatId, 'б-анализ-рынка.md', 'Анализ рынка'),
    agentType: 'researcher' },
  { keywords: ['бриф сайт', 'тендер сайт', 'лендинг', 'tilda', 'тильда'],
    queryHandler: (chatId) => handleTacticSection(chatId, 'д-сайт-тендерный-пакет.md', 'Сайт — тендерный пакет'),
    agentType: 'writer' },
  { keywords: ['трейлер', 'видеоролик', 'ролик феста', 'бриф видео'],
    queryHandler: (chatId) => handleTacticSection(chatId, 'е-трейлер-тендерный-пакет.md', 'Трейлер — тендерный пакет'),
    agentType: 'writer' },
  { keywords: ['амбассадор', 'посол феста', 'леос', 'hell scream', 'кругляш'],
    queryHandler: (chatId) => handleTacticSection(chatId, 'ж-амбассадоры.md', 'Амбассадоры'),
    agentType: 'researcher' },
  { keywords: ['инфопартнёр', 'медиа партнёр', 'радиостанц', 'рок фм', 'наше радио'],
    queryHandler: (chatId) => handleTacticSection(chatId, 'з-инфопартнёры.md', 'Инфопартнёры'),
    agentType: 'researcher' },
  { keywords: ['блогер', 'инфлюенсер', 'посев'],
    queryHandler: (chatId) => handleTacticSection(chatId, 'и-блогеры.md', 'Блогеры'),
    agentType: 'researcher' },
  { keywords: ['мерч', 'футболк', 'сувенир', 'мерчандайз'],
    queryHandler: (chatId) => handleTacticSection(chatId, 'л-мерч.md', 'Мерч'),
    agentType: 'writer' },
  { keywords: ['календарный план', 'расписани', 'когда что'],
    queryHandler: (chatId) => handleTacticSection(chatId, 'н-календарный-план.md', 'Календарный план'),
    agentType: 'writer' },
  { keywords: ['система выбора подрядчик', 'подрядчик вообще'],
    queryHandler: (chatId) => handleTacticSection(chatId, 'м-подрядчики.md', 'Система подрядчиков'),
    agentType: 'writer' },
  { keywords: ['контент-страт', 'контентная стратег', 'рубрик'],
    queryHandler: handleContent,
    agentType: 'content-ops' },
  // Стратегия ПОСЛЕДНЯЯ среди тактических
  { keywords: ['сегмент', 'аудитори', 'jtbd', 'персон', 'позиционирован'],
    queryHandler: (chatId) => handleTacticSection(chatId, 'а-стратегия.md', 'Стратегия'),
    agentType: 'researcher' },
];

// ── Операционные команды (только QUERY, без агентской маршрутизации) ──
const OPS_MAP = [
  { keywords: ['дайджест', 'сводк', 'digest', 'утренний'], handler: handleDigest },
  { keywords: ['контент план', 'план на неделю', 'что постим', 'что выходит'], handler: handleContent },
  { keywords: ['черновик', 'драфт', 'согласован', 'на проверк', 'одобр'], handler: handleDrafts },
  { keywords: ['задач', 'что делать', 'бэклог'], handler: handleTasks },
  { keywords: ['баланс', 'воронк'], handler: handleBalance },
  { keywords: ['таблиц', 'sheet', 'гугл табл'], handler: handleSheetLink },
  { keywords: ['тендер', 'выбор подрядчик'], handler: (chatId, text) => {
    const typePatterns = [
      { keywords: ['сайт', 'разработк', 'site'], type: 'сайт' },
      { keywords: ['видео', 'трейлер', 'ролик'], type: 'видео' },
      { keywords: ['дизайн', 'лого', 'макет'], type: 'дизайн' },
      { keywords: ['smm', 'смм', 'соцсет'], type: 'smm' },
      { keywords: ['трафик', 'реклам', 'таргет'], type: 'трафик' },
    ];
    const low = text.toLowerCase();
    const match = typePatterns.find(p => p.keywords.some(k => low.includes(k)));
    return handleTender(chatId, match ? match.type : null);
  }},
  { keywords: ['статус', 'прогресс', 'готовност'], handler: handleStatus },
  { keywords: ['сколько продал', 'продано билет'], handler: (chatId) => handleTacticSection(chatId, 'г-план-продаж-билетов.md', 'План продаж билетов') },
  { keywords: ['cjm', 'воронка детально', 'покрытие s-id'], handler: handleCJM },
  { keywords: ['бюджет', 'расход', 'сколько потратил', 'остаток бюджет'], handler: handleBudget },
  { keywords: ['помо', 'что умеешь', 'как работ', 'команд'], handler: handleHelp },
];

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/') || msg.voice) return;

  const chatId = msg.chat.id;
  const text = msg.text.toLowerCase();

  // ── Check for pending revision (follow-up after "Доработай") ──
  if (global._pendingRevisions && global._pendingRevisions[chatId]) {
    const rev = global._pendingRevisions[chatId];
    // Only valid for 5 minutes
    if (Date.now() - rev.timestamp < 300000) {
      delete global._pendingRevisions[chatId];
      const originalIssue = await paperclip.getIssue(rev.issueId);
      const revisionText = `ДОРАБОТКА к задаче ${originalIssue ? originalIssue.identifier : rev.issueId}:\n\nОригинальная задача: ${originalIssue ? originalIssue.title : '?'}\n\nЧто доработать: ${msg.text}`;
      await sendToCMO(chatId, revisionText);
      return;
    }
    delete global._pendingRevisions[chatId];
  }

  // ── Action-first: если явный action-запрос — сразу в CMO, минуя OPS_MAP ──
  const isActionEarly = isActionRequest(msg.text);
  if (isActionEarly) {
    // Но разрешаем /тендер как query (если нет action-слов в начале)
    // Action = собери/сделай/напиши/обнови/запусти → CMO
    await handleAgentTask(chatId, 'ceo', msg.text);
    return;
  }

  // ── OPS_MAP: операционные запросы (read-only) → прямо в handler, без агентов ──
  for (const entry of OPS_MAP) {
    if (entry.keywords.some(k => text.includes(k))) {
      await entry.handler(chatId, msg.text);
      return;
    }
  }

  // ── TOPIC_MAP: тактические разделы ──
  const isAction = isActionRequest(msg.text);
  for (const entry of TOPIC_MAP) {
    if (entry.keywords.some(k => text.includes(k))) {
      if (!isAction && entry.queryHandler) {
        // Read-only: читаем файл напрямую, без Paperclip
        await entry.queryHandler(chatId);
      } else {
        // Action-запрос: в CMO
        await handleAgentTask(chatId, 'ceo', msg.text);
      }
      return;
    }
  }

  // ── Нет матча в TOPIC_MAP/OPS_MAP ──
  // Action-запрос → CMO; query без контекста → CMO тоже (он умнее нас)
  await handleAgentTask(chatId, 'ceo', msg.text);
});

// ─── Экспорт для внешних вызовов ─────────────────────────────────────────────

module.exports = { notifyArtem, notifyZhenya, bot };

console.log('🤘 ExtremeFest Notifier запущен');
