#!/bin/bash
# start.sh — Запуск всей системы ExtremeFest локально
# Использование: ./start.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PAPERCLIP_DATA_DIR="$PROJECT_DIR/.paperclip"
PAPERCLIP_LOG="$PROJECT_DIR/.paperclip/paperclip.log"
BOT_LOG="$PROJECT_DIR/notifier/bot.log"

echo ""
echo "🤘 ExtremeFest System — запуск"
echo "================================"
echo "Директория: $PROJECT_DIR"
echo ""

# ── Проверяем node ──
NODE_BIN="/usr/local/bin/node"
if [ ! -f "$NODE_BIN" ]; then
  NODE_BIN=$(which node 2>/dev/null || echo "")
  if [ -z "$NODE_BIN" ]; then
    echo "❌ Node.js не найден"
    exit 1
  fi
fi
echo "✅ Node.js: $($NODE_BIN --version)"

# ── Проверяем npx ──
NPX_BIN="/usr/local/bin/npx"
if [ ! -f "$NPX_BIN" ]; then
  NPX_BIN=$(which npx 2>/dev/null || echo "")
fi

# ── Запускаем Paperclip если не запущен ──
if curl -s http://127.0.0.1:3100/api/health > /dev/null 2>&1; then
  echo "✅ Paperclip: уже запущен на :3100"
else
  echo "🔄 Запускаю Paperclip..."
  mkdir -p "$PAPERCLIP_DATA_DIR"
  "$NPX_BIN" paperclipai run \
    --data-dir "$PAPERCLIP_DATA_DIR" \
    >> "$PAPERCLIP_LOG" 2>&1 &
  PAPERCLIP_PID=$!
  echo "   PID: $PAPERCLIP_PID"
  sleep 6
  if curl -s http://127.0.0.1:3100/api/health > /dev/null 2>&1; then
    echo "✅ Paperclip: запущен на :3100"
  else
    echo "⚠️  Paperclip не ответил на :3100 (проверь $PAPERCLIP_LOG)"
  fi
fi

# ── Запускаем Telegram бота ──
echo "🔄 Запускаю Telegram бот..."
cd "$PROJECT_DIR/notifier"

# Проверяем что бот ещё не запущен
if pgrep -f "node bot.js" > /dev/null 2>&1; then
  echo "✅ Бот: уже запущен"
else
  "$NODE_BIN" bot.js >> "$BOT_LOG" 2>&1 &
  BOT_PID=$!
  sleep 2
  if kill -0 $BOT_PID 2>/dev/null; then
    echo "✅ Бот: запущен (PID: $BOT_PID)"
  else
    echo "❌ Бот упал при старте. Проверь $BOT_LOG"
    exit 1
  fi
fi

# ── Билд и запуск дашборда ──
DASHBOARD_DIR="$PROJECT_DIR/dashboard"
DASHBOARD_LOG="$PROJECT_DIR/dashboard-server.log"

if [ -d "$DASHBOARD_DIR/dist" ]; then
  echo "✅ Дашборд: уже собран"
else
  echo "🔄 Собираю дашборд..."
  cd "$DASHBOARD_DIR"
  "$NPX_BIN" vite build >> "$DASHBOARD_LOG" 2>&1
  cd "$PROJECT_DIR"
  if [ -f "$DASHBOARD_DIR/dist/index.html" ]; then
    echo "✅ Дашборд: собран"
  else
    echo "⚠️  Дашборд не собрался (проверь $DASHBOARD_LOG)"
  fi
fi

if pgrep -f "dashboard-server.js" > /dev/null 2>&1; then
  echo "✅ Дашборд-сервер: уже запущен"
else
  echo "🔄 Запускаю дашборд-сервер..."
  "$NODE_BIN" "$PROJECT_DIR/dashboard-server.js" >> "$DASHBOARD_LOG" 2>&1 &
  DASH_PID=$!
  sleep 1
  if kill -0 $DASH_PID 2>/dev/null; then
    echo "✅ Дашборд-сервер: запущен (PID: $DASH_PID)"
  else
    echo "⚠️  Дашборд-сервер упал (проверь $DASHBOARD_LOG)"
  fi
fi

echo ""
echo "================================"
echo "🎸 Система запущена!"
echo ""
echo "  Paperclip UI:  http://127.0.0.1:3100"
echo "  Дашборд:       http://127.0.0.1:3200"
echo "  Бот лог:       tail -f $BOT_LOG"
echo "  Paperclip лог: tail -f $PAPERCLIP_LOG"
echo "  Дашборд лог:   tail -f $DASHBOARD_LOG"
echo ""
echo "Остановить всё: ./stop.sh"
echo "================================"
