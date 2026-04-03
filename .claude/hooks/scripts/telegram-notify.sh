#!/bin/bash
# Хук: отправка уведомления в Telegram при завершении задачи агентом
# Используется как post-task hook в Claude Code

set -euo pipefail

# Читаем переменные окружения
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_ARTEM_CHAT_ID="${TELEGRAM_ARTEM_CHAT_ID:-}"

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_ARTEM_CHAT_ID" ]; then
  # Пробуем загрузить из .env если есть
  if [ -f "$(dirname "$0")/../../../notifier/.env" ]; then
    source "$(dirname "$0")/../../../notifier/.env"
  fi
fi

# Если всё ещё нет токена — тихо выходим (dev среда без бота)
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  exit 0
fi

# Получаем аргументы
TASK_NAME="${1:-Задача завершена}"
AGENT_NAME="${2:-agent}"
OUTPUT_PATH="${3:-}"
SUMMARY="${4:-}"

# Формируем сообщение
MESSAGE="✅ *Задача завершена*

🤖 Агент: ${AGENT_NAME}
📋 Задача: ${TASK_NAME}

${SUMMARY:+${SUMMARY}
}${OUTPUT_PATH:+📁 Результат: \`${OUTPUT_PATH}\`}"

# Отправляем в Telegram
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{
    \"chat_id\": \"${TELEGRAM_ARTEM_CHAT_ID}\",
    \"text\": \"${MESSAGE}\",
    \"parse_mode\": \"Markdown\"
  }" > /dev/null 2>&1 || true

exit 0
