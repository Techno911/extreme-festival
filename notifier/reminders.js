'use strict';

const tracking = require('./tracking');

// ─── Constants ──────────────────────────────────────────────────────────────

const FESTIVAL_DATE = new Date('2026-07-11T00:00:00+03:00');

// Week 1 starts April 7, 2026
const WEEK1_START = new Date('2026-04-07T00:00:00+03:00');

const MILESTONES = [
  { date: '2026-04-20', name: 'Тендер на сайт запущен' },
  { date: '2026-05-04', name: 'Подрядчик сайта выбран' },
  { date: '2026-05-01', name: 'Дизайн мерча у Давида/Оли' },
  { date: '2026-05-25', name: 'Съёмки трейлера завершены' },
  { date: '2026-06-01', name: 'Сайт запущен' },
  { date: '2026-05-25', name: 'Трейлер опубликован' },
  { date: '2026-06-15', name: '10+ кружков амбассадоров' },
  { date: '2026-07-01', name: '500+ билетов продано' },
];

// Weekly tasks by week number (Женя's operational tasks)
const WEEKLY_TASKS = {
  1: [
    { task: 'Собрать контакты амбассадоров (лайнап + скейтеры)', status: 'pending' },
    { task: 'Подготовить бриф на сайт (тендерный пакет)', status: 'pending' },
    { task: 'Написать 3 первых питча амбассадорам', status: 'pending' },
  ],
  2: [
    { task: 'Разослать тендер на сайт (30 подрядчиков)', status: 'pending' },
    { task: 'Написать радиостанциям (Rock FM, НАШЕ Радио)', status: 'pending' },
    { task: 'Подготовить бриф на трейлер', status: 'pending' },
  ],
  3: [
    { task: 'Разослать тендер на трейлер', status: 'pending' },
    { task: 'Follow-up амбассадорам (кто не ответил)', status: 'pending' },
    { task: 'Зарегистрировать фест на KudaGo и Afisha', status: 'pending' },
  ],
  4: [
    { task: 'Выбрать подрядчика сайта (дедлайн 4 мая)', status: 'pending' },
    { task: 'Передать дизайн мерча Давиду/Оле', status: 'pending' },
    { task: 'Первая волна питчей блогерам', status: 'pending' },
  ],
  5: [
    { task: 'Контроль разработки сайта', status: 'pending' },
    { task: 'Выбрать подрядчика трейлера (дедлайн 11 мая)', status: 'pending' },
    { task: 'Согласовать кружки от первых амбассадоров', status: 'pending' },
  ],
  6: [
    { task: 'Контроль съёмок трейлера', status: 'pending' },
    { task: 'Запустить посевы в ТГ-каналах (волна 1)', status: 'pending' },
    { task: 'Follow-up партнёрам (радио, медиа)', status: 'pending' },
  ],
  7: [
    { task: 'Публикация трейлера', status: 'pending' },
    { task: 'Запуск сайта', status: 'pending' },
    { task: 'Публикация первых кружков амбассадоров', status: 'pending' },
  ],
  8: [
    { task: 'Посевы в ТГ (волна 2) + городские афиши', status: 'pending' },
    { task: 'Мерч: получить тираж, начать продажи', status: 'pending' },
    { task: 'Розыгрыши билетов на радио', status: 'pending' },
  ],
  9: [
    { task: 'Массовая публикация кружков (10+ за неделю)', status: 'pending' },
    { task: 'Посевы в ТГ (волна 3) — все каналы', status: 'pending' },
    { task: 'FOMO-контент: сколько билетов осталось', status: 'pending' },
  ],
  10: [
    { task: 'Финальные анонсы — обратный отсчёт', status: 'pending' },
    { task: 'Розыгрыши билетов (красивые конвертики)', status: 'pending' },
    { task: 'Тайм-лайн дня фестиваля опубликован', status: 'pending' },
  ],
  11: [
    { task: 'Финальный пост утром 11 июля', status: 'pending' },
    { task: 'Проверка логистики площадки', status: 'pending' },
    { task: 'Фотограф + видеограф — финальный бриф', status: 'pending' },
  ],
  12: [
    { task: 'Пост-фест: фото, видео, благодарности', status: 'pending' },
    { task: 'Сбор обратной связи', status: 'pending' },
    { task: 'Финансовый отчёт', status: 'pending' },
  ],
  13: [
    { task: 'Ретроспектива: что сработало, что нет', status: 'pending' },
    { task: 'Отчёт партнёрам', status: 'pending' },
  ],
  14: [
    { task: 'Архивация материалов', status: 'pending' },
    { task: 'Планирование следующего года (если есть)', status: 'pending' },
  ],
};

// ─── Functions ──────────────────────────────────────────────────────────────

function parseDate(dateStr) {
  // Parse YYYY-MM-DD as local date
  const parts = dateStr.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function diffDays(dateA, dateB) {
  return Math.round((dateA - dateB) / (1000 * 60 * 60 * 24));
}

/**
 * Get upcoming milestones within the next N days
 */
function getUpcomingMilestones(daysAhead) {
  const now = today();
  const results = [];

  for (const ms of MILESTONES) {
    const msDate = parseDate(ms.date);
    const daysLeft = diffDays(msDate, now);

    if (daysLeft >= 0 && daysLeft <= daysAhead) {
      results.push({
        date: ms.date,
        name: ms.name,
        daysLeft: daysLeft,
        isOverdue: false
      });
    }
  }

  // Sort by daysLeft ascending (closest first)
  results.sort((a, b) => a.daysLeft - b.daysLeft);
  return results;
}

/**
 * Get this week's tasks for Женя
 */
function getWeekTasks(weekNumber) {
  const tasks = WEEKLY_TASKS[weekNumber];
  if (!tasks) return [];
  // Return a copy to avoid mutation
  return tasks.map(t => ({ task: t.task, status: t.status }));
}

/**
 * Get all overdue milestones
 */
function getOverdueMilestones() {
  const now = today();
  const results = [];

  for (const ms of MILESTONES) {
    const msDate = parseDate(ms.date);
    const daysOverdue = diffDays(now, msDate);

    if (daysOverdue > 0) {
      results.push({
        date: ms.date,
        name: ms.name,
        daysOverdue: daysOverdue
      });
    }
  }

  // Sort by daysOverdue descending (most overdue first)
  results.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return results;
}

/**
 * Get current week number (week 1 starts April 7, 2026)
 */
function getCurrentWeekNumber() {
  const now = today();
  const daysSinceStart = diffDays(now, WEEK1_START);

  if (daysSinceStart < 0) return 0; // Before week 1
  return Math.floor(daysSinceStart / 7) + 1;
}

/**
 * Get days left until festival
 */
function getDaysLeft() {
  const now = today();
  return Math.max(0, diffDays(FESTIVAL_DATE, now));
}

/**
 * Format daily digest data — pulls together all sources
 */
function getDailyDigestData() {
  const now = today();
  const daysLeft = getDaysLeft();
  const weekNumber = getCurrentWeekNumber();

  // Milestones in next 14 days
  const milestones = getUpcomingMilestones(14).map(m => ({
    name: m.name,
    daysLeft: m.daysLeft
  }));

  // Overdue milestones
  const overdue = getOverdueMilestones().map(m => ({
    name: m.name,
    daysOverdue: m.daysOverdue
  }));

  // Week tasks
  const weekTasks = getWeekTasks(weekNumber).map(t => ({
    task: t.task
  }));

  // Live stats from tracking files
  const salesData = tracking.getSalesData();
  const ambassadorStats = tracking.getAmbassadorStats();
  const partnerStats = tracking.getPartnerStats();

  return {
    date: now.toISOString().slice(0, 10),
    daysLeft: daysLeft,
    weekNumber: weekNumber,
    milestones: milestones,
    overdue: overdue,
    weekTasks: weekTasks,
    ticketsSold: salesData.total,
    ambassadorsPitched: ambassadorStats.pitched + ambassadorStats.agreed + ambassadorStats.done,
    partnersConfirmed: partnerStats.confirmed
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  getUpcomingMilestones,
  getWeekTasks,
  getOverdueMilestones,
  getCurrentWeekNumber,
  getDailyDigestData,
  getDaysLeft,
  MILESTONES,
  WEEKLY_TASKS
};
