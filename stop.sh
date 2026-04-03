#!/bin/bash
# stop.sh — Остановка всей системы ExtremeFest

echo "🛑 Останавливаю систему..."

# Бот
if pgrep -f "node bot.js" > /dev/null 2>&1; then
  pkill -f "node bot.js" && echo "✅ Бот остановлен"
else
  echo "   Бот не запущен"
fi

# Paperclip
if pgrep -f "paperclipai" > /dev/null 2>&1; then
  pkill -f "paperclipai" && echo "✅ Paperclip остановлен"
else
  echo "   Paperclip не запущен"
fi

# Дашборд-сервер
if pgrep -f "dashboard-server.js" > /dev/null 2>&1; then
  pkill -f "dashboard-server.js" && echo "✅ Дашборд-сервер остановлен"
else
  echo "   Дашборд-сервер не запущен"
fi

echo "Готово."
