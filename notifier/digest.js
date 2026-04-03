'use strict';

/**
 * digest.js — Ежедневный дайджест для Жени (10:00 МСК)
 *
 * Запуск: node digest.js
 * Cron:   0 7 * * * node /opt/extremefest/notifier/digest.js   (UTC = 10:00 МСК)
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const templates = require('./templates');

// ─── Config ──────────────────────────────────────────────────────────────────

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ZHENYA_CHAT_ID = process.env.TELEGRAM_ZHENYA_CHAT_ID;

if (!TOKEN || !ZHENYA_CHAT_ID) {
  console.error('TELEGRAM_BOT_TOKEN или TELEGRAM_ZHENYA_CHAT_ID не заданы');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN);
const OUTPUT_DIR = path.join(__dirname, '../output');
const TRACKING_DIR = path.join(OUTPUT_DIR, 'tracking');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysLeft() {
  const festDate = new Date('2026-07-11T00:00:00+03:00');
  const now = new Date();
  const diff = festDate - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(d) {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Читает tenders.md и вытаскивает ближайшие дедлайны (в течение 14 дней)
 */
function getUpcomingDeadlines() {
  const tendersPath = path.join(TRACKING_DIR, 'tenders.md');
  if (!fs.existsSync(tendersPath)) return [];

  const content = fs.readFileSync(tendersPath, 'utf8');
  const deadlines = [];
  const now = new Date();
  const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Ищем строки с датами типа "**20 апреля**" или "**4 мая**"
  const dateRegex = /\*\*(\d+)\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\*\*\s*—\s*(.+)/g;
  const months = {
    'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
    'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
  };

  let match;
  while ((match = dateRegex.exec(content)) !== null) {
    const day = parseInt(match[1]);
    const month = months[match[2]];
    const description = match[3].trim();
    const deadline = new Date(2026, month, day);

    if (deadline >= now && deadline <= inTwoWeeks) {
      const daysTo = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      deadlines.push(`${description} — через ${daysTo} дн. (${match[1]} ${match[2]})`);
    }
  }

  return deadlines;
}

/**
 * Читает ambassadors.md и считает статистику
 */
function getAmbassadorStats() {
  const filePath = path.join(TRACKING_DIR, 'ambassadors.md');
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  const stats = { total: 0, written: 0, replied: 0, agreed: 0, done: 0 };

  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('🔴') || line.includes('🟡') || line.includes('🟠') ||
        line.includes('🟢') || line.includes('✅') || line.includes('📋') || line.includes('🎯')) {
      if (line.startsWith('|') && !line.includes('---') && !line.includes('Имя') && !line.includes('Статусы')) {
        stats.total++;
        if (line.includes('🟡')) stats.written++;
        if (line.includes('🟠')) stats.replied++;
        if (line.includes('🟢')) stats.agreed++;
        if (line.includes('✅') || line.includes('📋') || line.includes('🎯')) stats.done++;
      }
    }
  }

  return stats;
}

/**
 * Читает bloggers.md и считает UTM-клики (заглушка — интеграция с TicketsCloud позже)
 */
function getTicketsSold() {
  // TODO: подключить реальный API TicketsCloud
  // Пока читаем из файла если есть ручное обновление
  const salesPath = path.join(TRACKING_DIR, 'sales.md');
  if (fs.existsSync(salesPath)) {
    const content = fs.readFileSync(salesPath, 'utf8');
    const match = content.match(/Продано:\s*(\d+)/);
    if (match) return parseInt(match[1]);
  }
  return 'неизвестно'; // не подключён API
}

/**
 * Строит список задач на сегодня из календарного плана
 */
function getTodayTasks() {
  // Упрощённая версия — просто напоминаем про активные дедлайны
  const upcoming = getUpcomingDeadlines();
  if (upcoming.length > 0) return upcoming;

  // Стандартные задачи по фазам
  const daysLeft = getDaysLeft();
  if (daysLeft > 100) {
    return ['Запустить тендер на сайт (рассылка 30 брифов)', 'Собрать контакты амбассадоров'];
  } else if (daysLeft > 60) {
    return ['Контроль подрядчика сайта', 'Развоз флаеров по точкам'];
  } else if (daysLeft > 30) {
    return ['Посевы в ТГ-каналах', 'Публикация кружков амбассадоров'];
  } else {
    return ['Финальные посты', 'Обратный отсчёт', 'Логистика площадки'];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function sendDailyDigest() {
  const now = new Date();
  const date = formatDate(now);
  const daysLeft = getDaysLeft();
  const tasksToday = getTodayTasks();
  const urgentItems = getUpcomingDeadlines();
  const ticketsSold = getTicketsSold();

  const message = templates.dailyDigest({
    date,
    tasksToday,
    urgentItems,
    ticketsSold,
    daysLeft
  });

  try {
    await bot.sendMessage(ZHENYA_CHAT_ID, message, { parse_mode: 'Markdown' });
    console.log(`✅ Дайджест отправлен Жене (${date})`);

    // Если есть статистика амбассадоров — добавляем
    const ambassStats = getAmbassadorStats();
    if (ambassStats && ambassStats.total > 0) {
      const ambassMessage = templates.ambassadorStatus({
        date,
        ...ambassStats,
        followUpToday: []
      });
      await bot.sendMessage(ZHENYA_CHAT_ID, ambassMessage, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error('Ошибка отправки дайджеста:', err.message);
    process.exit(1);
  }

  // Завершаем процесс (это cron-скрипт, не демон)
  setTimeout(() => process.exit(0), 2000);
}

sendDailyDigest();
