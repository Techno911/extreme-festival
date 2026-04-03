'use strict';

/**
 * weekly-report.js — Еженедельный отчёт продаж (пятница, 18:00 МСК)
 *
 * Запуск: node weekly-report.js
 * Cron:   0 15 * * 5 node /opt/extremefest/notifier/weekly-report.js  (UTC = 18:00 МСК)
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const templates = require('./templates');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ZHENYA_CHAT_ID = process.env.TELEGRAM_ZHENYA_CHAT_ID;

if (!TOKEN || !ZHENYA_CHAT_ID) {
  console.error('TELEGRAM_BOT_TOKEN или TELEGRAM_ZHENYA_CHAT_ID не заданы');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN);
const TRACKING_DIR = path.join(__dirname, '../output/tracking');

function getDaysLeft() {
  const festDate = new Date('2026-07-11T00:00:00+03:00');
  return Math.max(0, Math.ceil((festDate - new Date()) / 86400000));
}

function getCurrentWeekNumber() {
  const festStart = new Date(2026, 3, 6); // April 6
  const now = new Date();
  const diff = Math.floor((now - festStart) / (7 * 86400000));
  return Math.max(1, Math.min(14, diff + 1));
}

function getTicketsSold() {
  const salesPath = path.join(TRACKING_DIR, 'sales.md');
  if (!fs.existsSync(salesPath)) return { total: 0, history: [] };

  const content = fs.readFileSync(salesPath, 'utf8');
  const totalMatch = content.match(/^Продано:\s*(\d+)/m);
  const total = totalMatch ? parseInt(totalMatch[1]) : 0;

  // История — последние 2 записи
  const rows = content.match(/\|\s*\d{4}-\d{2}-\d{2}\s*\|[^|]+\|[^|]+\|/g) || [];
  return { total, rows };
}

function getSalesThisWeek(total, rows) {
  if (!rows || rows.length < 2) return 0;
  // Разница между последними двумя записями
  const nums = rows.map(r => {
    const m = r.match(/\|\s*(\d+)\s*\|/g);
    return m ? parseInt(m[0].replace(/[| ]/g, '')) : 0;
  });
  return nums.length >= 2 ? Math.max(0, nums[0] - nums[1]) : 0;
}

function getTopChannel() {
  // Упрощённо: смотрим bloggers.md на 🟢/✅
  const blogPath = path.join(TRACKING_DIR, 'bloggers.md');
  if (!fs.existsSync(blogPath)) return null;
  const content = fs.readFileSync(blogPath, 'utf8');
  const doneRows = content.split('\n').filter(l => l.includes('✅') && l.startsWith('|'));
  if (doneRows.length === 0) return null;
  const cols = doneRows[0].split('|').map(c => c.trim()).filter(Boolean);
  return cols[1] || null;
}

async function sendWeeklyReport() {
  const weekNum = getCurrentWeekNumber();
  const daysLeft = getDaysLeft();
  const { total, rows } = getTicketsSold();
  const soldThisWeek = getSalesThisWeek(total, rows);
  const target = 1000;
  const percentDone = Math.round((total / target) * 100);

  // Прогноз (линейная экстраполяция)
  const weeksLeft = Math.ceil(daysLeft / 7);
  const weeklyRate = soldThisWeek || Math.round(total / Math.max(1, weekNum));
  const forecast = Math.min(target, total + weeklyRate * weeksLeft);

  const topChannel = getTopChannel();

  const message = templates.weeklySalesReport({
    weekNumber: weekNum,
    soldThisWeek,
    totalSold: total,
    target,
    percentDone,
    forecast,
    topChannel,
  });

  try {
    await bot.sendMessage(ZHENYA_CHAT_ID, message, { parse_mode: 'HTML' });
    console.log(`✅ Еженедельный отчёт отправлен (неделя ${weekNum})`);
  } catch (err) {
    console.error('Ошибка отправки отчёта:', err.message);
    process.exit(1);
  }

  setTimeout(() => process.exit(0), 2000);
}

sendWeeklyReport();
