'use strict';

/**
 * test-phase1-final.js — финальный тест Phase 1
 * Инжектирует задачу напрямую через handleAgentTask-логику,
 * имитируя входящее сообщение из TG.
 */

const path = require('path');
const notifierDir = path.join(__dirname, '..', 'notifier');

// Load env
require(path.join(notifierDir, 'node_modules', 'dotenv')).config({
  path: path.join(notifierDir, '.env'),
});

const paperclip = require(path.join(notifierDir, 'paperclip.js'));
const TelegramBot = require(path.join(notifierDir, 'node_modules', 'node-telegram-bot-api'));

const CHAT_ID = 41977400;
const TASK_TEXT = 'Подготовь раздел б — анализ рынка и конкурентной среды: исследование ключевых конкурентов включая Скрежет металла, оценка ёмкости целевой аудитории, анализ ценообразования и позиционирования';

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

async function run() {
  console.log('[TEST] Старт финального теста Phase 1');
  console.log(`[TEST] chatId=${CHAT_ID}`);
  console.log(`[TEST] task="${TASK_TEXT.substring(0, 80)}..."`);

  // 1. Создаём issue для CMO
  const taskTitle = `[ceo] ${TASK_TEXT.substring(0, 80)}`;
  console.log('\n[TEST] Создаём issue для CMO...');
  const issue = await paperclip.createIssue(taskTitle, TASK_TEXT, 'ceo');
  console.log(`[TEST] Issue создан: ${issue.identifier || issue.id} source=${issue.source}`);

  // 2. Отправляем статус в TG
  let statusMsg;
  try {
    statusMsg = await bot.sendMessage(
      CHAT_ID,
      `⏳ Задача принята: _${TASK_TEXT.substring(0, 100)}..._\n\nИдентификатор: \`${issue.identifier || issue.id}\`\nАгент: CMO`,
      { parse_mode: 'Markdown' }
    );
    console.log(`[TEST] Status msg sent: msg_id=${statusMsg.message_id}`);
  } catch (err) {
    console.warn('[TEST] TG status msg failed:', err.message);
  }

  // 3. Инвокируем heartbeat CMO
  const cmoId = process.env.PAPERCLIP_AGENT_CEO;
  console.log(`\n[TEST] Invoking CMO heartbeat (${cmoId})...`);
  const hbOk = await paperclip.invokeHeartbeat(cmoId);
  console.log(`[TEST] Heartbeat: ${hbOk ? 'ok' : 'failed'}`);

  // 4. Polling — ждём завершения
  console.log(`\n[TEST] Polling ${issue.id} (max 10min, interval 15s)...`);
  let lastStatus = '';
  const result = await paperclip.waitForCompletion(issue.id, {
    intervalMs: 15000,
    timeoutMs: 600000,
    onProgress: (status) => {
      if (status !== lastStatus) {
        console.log(`[TEST] status → ${status}`);
        lastStatus = status;
      }
    },
  });

  if (!result) {
    console.error('[TEST] TIMEOUT — результат не получен за 10 минут');
    await bot.sendMessage(CHAT_ID, '⚠️ Таймаут — CMO не завершил задачу за 10 минут.').catch(() => {});
    process.exit(1);
  }

  console.log(`\n[TEST] Завершено: status=${result.status}`);

  // 5. Получаем результат из комментариев
  const comment = await paperclip.getLatestComment(issue.id);
  const resultText = comment?.body || result.description || '(нет текста результата)';
  console.log(`[TEST] Результат: ${resultText.length} символов`);
  console.log('\n─── PREVIEW (первые 500 символов) ───');
  console.log(resultText.substring(0, 500));
  console.log('─────────────────────────────────────\n');

  // 6. Отправляем результат в TG
  const MAX_LEN = 4000;
  if (resultText.length <= MAX_LEN) {
    await bot.sendMessage(CHAT_ID, `✅ *Результат CMO:*\n\n${resultText}`, {
      parse_mode: 'Markdown',
    }).catch(async () => {
      // fallback без markdown
      await bot.sendMessage(CHAT_ID, `✅ Результат CMO:\n\n${resultText}`).catch(console.error);
    });
  } else {
    // Разбиваем на части
    const parts = [];
    for (let i = 0; i < resultText.length; i += MAX_LEN) {
      parts.push(resultText.substring(i, i + MAX_LEN));
    }
    console.log(`[TEST] Отправляем ${parts.length} частей`);
    for (let i = 0; i < parts.length; i++) {
      const header = i === 0 ? '✅ *Результат CMO:*\n\n' : `*(часть ${i + 1}/${parts.length})*\n\n`;
      await bot.sendMessage(CHAT_ID, header + parts[i], { parse_mode: 'Markdown' })
        .catch(async () => {
          await bot.sendMessage(CHAT_ID, `Часть ${i + 1}:\n${parts[i]}`).catch(console.error);
        });
      if (i < parts.length - 1) await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('[TEST] Готово — результат доставлен в TG');

  // 7. Проверяем файлы в output/
  const fs = require('fs');
  const outputDir = path.join(__dirname, '..', 'output');
  if (fs.existsSync(outputDir)) {
    const check = (dir) => {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).map(f => {
        const fp = path.join(dir, f);
        const stat = fs.statSync(fp);
        return { file: path.relative(outputDir, fp), size: stat.size, mtime: stat.mtime.toISOString() };
      }).filter(f => !f.file.startsWith('tracking'));
    };
    const allFiles = [
      ...check(path.join(outputDir, 'research')),
      ...check(path.join(outputDir, 'tactic')),
      ...check(path.join(outputDir)),
    ];
    if (allFiles.length > 0) {
      console.log('\n[TEST] Файлы в output/:');
      allFiles.sort((a, b) => b.mtime.localeCompare(a.mtime)).forEach(f => {
        console.log(`  ${f.file} (${f.size} bytes, ${f.mtime})`);
      });
    } else {
      console.log('\n[TEST] output/ — файлов нет (агенты пишут в комментарии к issues)');
    }
  }

  process.exit(0);
}

run().catch(err => {
  console.error('[TEST] FATAL:', err);
  process.exit(1);
});
