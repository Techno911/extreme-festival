---
name: Paperclip API — результаты исследования
description: Полная документация Paperclip API: эндпоинты, create issue, агенты, heartbeat, claude_local интеграция
type: reference
---

Полное исследование выполнено 2026-04-01. Источник: github.com/paperclipai/paperclip docs/api/

**Ключевые файлы:**
- Полный отчёт: `/Users/techno/Desktop/Extreme_festival/output/research/paperclip-api-research.md`

**Критически важные факты:**

1. **Create Issue**: `POST /api/companies/{companyId}/issues` — payload: title, description, status, priority, assigneeAgentId, projectId
2. **Auth**: локально (Local Trusted Mode) — авторизация НЕ нужна. В prod — Bearer token
3. **Claude интеграция**: Paperclip запускает `claude` CLI, инжектирует PAPERCLIP_API_KEY JWT. Claude Max подписка ($200/мес) — без API ключа
4. **Heartbeat** — это Routines API. Триггеры: cron / webhook / api
5. **Агент узнаёт о задачах**: GET /api/agents/me/inbox-lite (internal, не задокументирован публично)
6. **Результат агента**: комментарии к issue + статус done + документы (PUT /api/issues/{id}/documents/{key})
7. **Invoke heartbeat вручную**: `POST /api/agents/{agentId}/heartbeat/invoke`
8. **Checkout (взять задачу атомарно)**: `POST /api/issues/{issueId}/checkout` — 409 = занято, не ретраить

**Нерешённые вопросы:**
- Как бот узнаёт что агент завершил? Polling vs webhook
- Работает ли Local Trusted Mode из коробки?

**Why:** Нужно для интеграции Telegram-бота с Paperclip
**How to apply:** При реализации функции createIssue в notifier/bot.js
