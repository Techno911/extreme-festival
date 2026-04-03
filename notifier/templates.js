'use strict';

/**
 * Шаблоны сообщений Telegram для Notifier
 * Все функции принимают данные и возвращают строку с форматированием Markdown
 */

/**
 * Ежедневный дайджест (10:00 МСК)
 */
function dailyDigest({ date, tasksToday, urgentItems, ticketsSold, daysLeft }) {
  const urgentBlock = urgentItems && urgentItems.length > 0
    ? `\n🔥 <b>Горит:</b>\n${urgentItems.map(i => `• ${i}`).join('\n')}`
    : '';

  return `📋 <b>Дайджест ${date}</b>

📅 Сегодня нужно:
${tasksToday.map(t => `• ${t}`).join('\n')}
${urgentBlock}

🎫 Продано билетов: <b>${ticketsSold}</b>
⏳ До феста: <b>${daysLeft} дней</b>`;
}

/**
 * Статус прогресса по запросу /check-status
 */
function progressStatus({ done, inProgress, notStarted, deadlines }) {
  const doneBlock = done.length > 0
    ? `✅ <b>Готово:</b>\n${done.map(i => `• ${i}`).join('\n')}\n`
    : '';
  const inProgBlock = inProgress.length > 0
    ? `🔄 <b>В работе:</b>\n${inProgress.map(i => `• ${i}`).join('\n')}\n`
    : '';
  const notStartedBlock = notStarted.length > 0
    ? `⏳ <b>Не начато:</b>\n${notStarted.map(i => `• ${i}`).join('\n')}\n`
    : '';
  const deadlineBlock = deadlines && deadlines.length > 0
    ? `🔥 <b>Дедлайны этой недели:</b>\n${deadlines.map(i => `• ${i}`).join('\n')}`
    : '';

  return `📊 <b>Текущий прогресс</b>\n\n${doneBlock}${inProgBlock}${notStartedBlock}${deadlineBlock}`;
}

/**
 * Вердикт Critic по идее
 */
function criticVerdict({ idea, verdict, role1, role2, role3, recommendation }) {
  const verdictEmoji = verdict === 'approve' ? '✅' : verdict === 'revise' ? '⚠️' : '❌';
  const verdictText = verdict === 'approve' ? 'Делаем' : verdict === 'revise' ? 'Доработать' : 'Не стоит';

  return `🎯 <b>Валидация идеи</b>

💬 Идея: <i>${idea}</i>

${verdictEmoji} <b>${verdictText}</b>

👴 Металлист 40 лет: ${role1}

📊 Маркетолог: ${role2}

🎪 Организатор: ${role3}

📌 <b>Рекомендация:</b> ${recommendation}`;
}

/**
 * Уведомление о новом посте для Жени
 */
function newDraftPost({ rubric, platform, preview, filePath }) {
  return `✍️ <b>Новый черновик поста</b>

📌 Рубрика: ${rubric}
📢 Платформа: ${platform}

Превью:
<i>${preview}</i>

📁 Полный текст: <code>${filePath}</code>

Одобри / правь / в корзину 👇`;
}

/**
 * Статус трекинга амбассадоров
 */
function ambassadorStatus({ date, total, written, replied, agreed, done, followUpToday }) {
  const followUpBlock = followUpToday && followUpToday.length > 0
    ? `\n📨 *Follow-up сегодня:*\n${followUpToday.map(a => `• ${a}`).join('\n')}`
    : '';

  return `🎸 <b>Трекинг амбассадоров ${date}</b>

📊 Всего в базе: ${total}
🟡 Написали: ${written}
🟠 Ответили: ${replied}
🟢 Согласились: ${agreed}
✅ Готово (материал получен): ${done}
${followUpBlock}

🎯 Цель: 15+ кругляшков к середине июня`;
}

/**
 * Еженедельный отчёт продаж (пятница)
 */
function weeklySalesReport({ weekNumber, soldThisWeek, totalSold, target, percentDone, forecast, topChannel }) {
  const trend = soldThisWeek > 0 ? `📈 +${soldThisWeek} за неделю` : `📉 Продаж на этой неделе не было`;

  return `📊 <b>Отчёт продаж — неделя ${weekNumber}</b>

${trend}

🎫 Продано всего: <b>${totalSold}</b> из ${target}
📈 Выполнение: <b>${percentDone}%</b>
🔮 Прогноз к 11 июля: ~${forecast} билетов

${topChannel ? `💡 Топ-канал этой недели: ${topChannel}` : ''}`;
}

/**
 * Уведомление о завершении задачи агентом
 */
function taskCompleted({ agentName, taskName, outputPath, summary }) {
  return `✅ <b>Задача завершена</b>

🤖 Агент: ${agentName}
📋 Задача: ${taskName}

${summary}

📁 Результат: <code>${outputPath}</code>`;
}

module.exports = {
  dailyDigest,
  progressStatus,
  criticVerdict,
  newDraftPost,
  ambassadorStatus,
  weeklySalesReport,
  taskCompleted
};
