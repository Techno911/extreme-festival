# Paperclip API Research
# Для интеграции Telegram-бот → Paperclip

> Исследование: Артём Чирков / Researcher agent
> Дата: 2026-04-01
> Источники: github.com/paperclipai/paperclip (docs/api/, docs/adapters/)

---

## КЛЮЧЕВОЙ ВЫВОД ПО АРХИТЕКТУРЕ

**Как Claude попадает в Paperclip:**

```
Paperclip (оркестратор)
      │
      ├── Запускает claude_local адаптер по расписанию (heartbeat)
      │   └── Передаёт агенту PAPERCLIP_API_KEY (short-lived JWT)
      │
      └── Агент (Claude Code) сам вызывает Paperclip API
          через Authorization: Bearer $PAPERCLIP_API_KEY
```

**Paperclip НЕ использует Claude API напрямую.** Он запускает `claude` CLI процесс локально. Claude Code (подписка Max $200) авторизуется через `claude login` на сервере. Ни API-ключ Anthropic, ни ваши расходы — Paperclip не видит.

**Telegram-бот вызывает Paperclip API напрямую** через `POST /api/companies/{companyId}/issues` с board-operator auth (trusted mode локально — без токена, или с токеном в prod).

---

## 1. БАЗОВЫЙ URL И АУТЕНТИФИКАЦИЯ

```
Base URL: http://localhost:3100/api
```

### Режимы аутентификации

| Режим | Кто использует | Как |
|-------|---------------|-----|
| **Local Trusted Mode** | Board operator (бот на том же сервере) | Нет заголовка нужен — все запросы автоматически как board operator |
| **Agent Run JWT** | claude_local агент во время heartbeat | `Authorization: Bearer $PAPERCLIP_API_KEY` (инжектируется автоматически) |
| **Agent API Key** | Внешние системы от имени агента | `POST /api/agents/{agentId}/keys` → получить ключ раз, хранить |
| **User session cookie** | Браузер (UI) | Не нужен для бота |

**Важно для нашего бота:** если бот запущен на том же сервере что и Paperclip — аутентификация не нужна (Local Trusted Mode). В prod с HTTPS — нужен agent API key.

---

## 2. КАК СОЗДАТЬ ISSUE ПРОГРАММНО

### POST /api/companies/{companyId}/issues

```javascript
// Создать задачу для агента
const response = await axios.post(
  `${PAPERCLIP_BASE_URL}/api/companies/${COMPANY_ID}/issues`,
  {
    title: "Идея от Артёма: переименовать фест",
    description: "Артём наговорил голосовое: рассмотреть вариант названия ExtremeFest вместо Эстрим Фест",
    status: "todo",           // todo | backlog | in_progress | blocked | in_review | done | cancelled
    priority: "high",          // critical | high | medium | low
    assigneeAgentId: "agent-42",  // ID агента-critic или null для CEO
    projectId: "project-1",    // обязательно привязать к проекту
    goalId: "goal-1",          // опционально
  },
  {
    headers: {
      'Content-Type': 'application/json',
      // Только если нужна аутентификация:
      // 'Authorization': `Bearer ${PAPERCLIP_API_KEY}`
    }
  }
);
const issue = response.data; // { id: "issue-123", title: ..., ... }
```

### Lifecycle статусов

```
backlog → todo → in_progress → in_review → done
                    ↑               ↓
                 blocked       in_progress
```

Терминальные: `done`, `cancelled`

---

## 3. КАК НАЗНАЧИТЬ АГЕНТА НА ЗАДАЧУ

**Вариант А: при создании** — передать `assigneeAgentId` в POST.

**Вариант Б: при обновлении** — PATCH после создания:

```javascript
await axios.patch(
  `${PAPERCLIP_BASE_URL}/api/issues/${issueId}`,
  {
    assigneeAgentId: "critic-agent-id",
    comment: "Назначено на Critic для валидации"
  }
);
```

**Вариант В: агент сам берёт задачу** (checkout) — агент вызывает:

```
POST /api/issues/{issueId}/checkout
{
  "agentId": "{yourAgentId}",
  "expectedStatuses": ["todo"]
}
```
Это атомарная операция. Если 409 — другой агент уже взял. Не ретраить.

---

## 4. КАК ПОЛУЧИТЬ ОТВЕТ/РЕЗУЛЬТАТ АГЕНТА

Агент пишет результат в **комментарий к задаче** и/или **меняет статус на done**:

```javascript
// Подписаться на комментарии к задаче (polling)
const response = await axios.get(
  `${PAPERCLIP_BASE_URL}/api/issues/${issueId}/comments`
);
const comments = response.data; // массив комментариев

// Проверить статус задачи
const issue = await axios.get(`${PAPERCLIP_BASE_URL}/api/issues/${issueId}`);
if (issue.data.status === 'done') {
  // агент завершил
}
```

**Webhook как альтернатива polling** — Paperclip поддерживает Routines с webhook-триггером. Можно создать Routine, которая стреляет POST на наш бот когда агент завершил задачу.

**Документы как результаты** — агент может записать структурированный результат:

```javascript
// Агент сохраняет результат как документ
PUT /api/issues/{issueId}/documents/result
{
  "title": "Вердикт Critic",
  "format": "markdown",
  "body": "# Вердикт\n\n✅ Делаем..."
}

// Бот читает документ
GET /api/issues/{issueId}/documents/result
```

---

## 5. КАК РАБОТАЮТ HEARTBEAT (SCHEDULED) АГЕНТЫ

### Что такое heartbeat

Агент просыпается по расписанию. Paperclip:
1. Создаёт `run` для агента
2. Инжектирует `PAPERCLIP_API_KEY` (JWT на 1 run)
3. Запускает `claude` CLI процесс с `promptTemplate`
4. Claude Code выполняет задачи, вызывает Paperclip API
5. Сессия сохраняется — следующий heartbeat продолжает с того же места

### Настройка heartbeat у агента

В UI Paperclip или через API: настроить `heartbeatIntervalSec` при создании агента. Наши агенты из архитектурного плана:

| Агент | Heartbeat |
|-------|-----------|
| CEO | 4ч |
| Researcher | 8ч |
| Writer | 4ч |
| Critic | по запросу (trigger) |
| ContentOps | 2 раза/нед |
| Notifier | 1ч |

### Как вызвать heartbeat вручную (из бота)

```javascript
// Принудительно разбудить агента
await axios.post(
  `${PAPERCLIP_BASE_URL}/api/agents/${agentId}/heartbeat/invoke`
);
```

---

## 6. KAK РАБОТАЕТ claude_local АДАПТЕР (ИНТЕГРАЦИЯ CLAUDE)

### Архитектура

```
Paperclip Server (порт 3100)
    │
    ├── Когда приходит heartbeat-time:
    │   1. Создаёт Run record в БД
    │   2. Инжектирует PAPERCLIP_API_KEY env var
    │   3. Запускает: claude --print --output-format stream-json --add-dir /tmp/skills-symlinks
    │   4. Claude Code процесс работает, читает env, вызывает /api/...
    │   5. По завершении — парсит output, сохраняет в Run
    │
    └── Сессия персистируется: resumeId сохраняется между запусками
```

### Конфигурация агента (claude_local)

```json
{
  "name": "Researcher",
  "role": "researcher",
  "adapterType": "claude_local",
  "adapterConfig": {
    "cwd": "/Users/techno/Desktop/Extreme_festival",
    "model": "claude-sonnet-4-6",
    "promptTemplate": "Ты Разведчик — агент Эстрим Феста...",
    "timeoutSec": 600,
    "maxTurnsPerRun": 50,
    "dangerouslySkipPermissions": false
  }
}
```

### Что Claude Code видит внутри heartbeat

```bash
PAPERCLIP_API_KEY=<short-lived JWT>  # для вызовов Paperclip API
ANTHROPIC_API_KEY=<если API-режим>   # не нужен при claude login

# Claude Code сам вызывает:
GET http://localhost:3100/api/agents/me           # узнать свой ID
GET http://localhost:3100/api/agents/me/inbox-lite  # входящие задачи
PATCH http://localhost:3100/api/issues/{id}        # обновить задачу
```

### Авторизация через Claude Max (подписка, не API)

```bash
# На VPS:
claude login    # → URL → открыть на Mac → авторизоваться
# Сессия сохраняется в ~/.claude/

# Paperclip запускает claude process — он использует эту сессию
# ANTHROPIC_API_KEY НЕ нужен
```

---

## 7. ROUTINES — SCHEDULED AGENTS (правильный термин)

Heartbeat агентов — это Routines в API. Отдельно от Issues.

### Создать routine (scheduled task) программно

```javascript
// Создать routine для Researcher (каждые 8 часов)
const routine = await axios.post(
  `${PAPERCLIP_BASE_URL}/api/companies/${COMPANY_ID}/routines`,
  {
    title: "Researcher: мониторинг конкурентов",
    description: "Каждые 8 часов проверять активность Скрежет металла и других конкурентов",
    assigneeAgentId: RESEARCHER_AGENT_ID,
    projectId: PROJECT_ID,
    concurrencyPolicy: "coalesce_if_active",
    catchUpPolicy: "skip_missed"
  }
);

// Добавить cron-триггер
await axios.post(
  `${PAPERCLIP_BASE_URL}/api/routines/${routine.data.id}/triggers`,
  {
    kind: "schedule",
    cronExpression: "0 */8 * * *",  // каждые 8 часов
    timezone: "Europe/Moscow"
  }
);
```

### Типы триггеров

| Тип | Использование | Пример |
|-----|--------------|--------|
| `schedule` | Cron-расписание | `"0 */4 * * *"` — каждые 4 часа |
| `webhook` | HTTP POST от внешней системы | Telegram-бот → Paperclip |
| `api` | Ручной вызов через API | `POST /api/routines/{id}/run` |

### Пример: Telegram-бот пушит задачу → агент реагирует через webhook

```javascript
// 1. Создать routine для Critic с webhook-триггером
const routine = await axios.post(`/api/companies/${COMPANY_ID}/routines`, {
  title: "Critic: валидация идей",
  assigneeAgentId: CRITIC_AGENT_ID,
  projectId: PROJECT_ID
});

const trigger = await axios.post(`/api/routines/${routine.data.id}/triggers`, {
  kind: "webhook",
  signingMode: "bearer"
});

// trigger.data.publicId → сохранить для вызова из бота

// 2. Когда приходит голосовое от Артёма:
// Бот создаёт Issue
const issue = await axios.post(`/api/companies/${COMPANY_ID}/issues`, {
  title: `Идея: ${text}`,
  assigneeAgentId: CRITIC_AGENT_ID,
  projectId: PROJECT_ID
});

// Бот запускает webhook → агент просыпается
await axios.post(
  `${PAPERCLIP_BASE_URL}/api/routine-triggers/public/${trigger.data.publicId}/fire`,
  { context: `Новая идея: issue ${issue.data.id}` },
  { headers: { 'Authorization': `Bearer ${WEBHOOK_TRIGGER_SECRET}` } }
);
```

---

## 8. ПОЛУЧИТЬ companyId И agentId

Прежде чем создавать Issues нужны IDs. Получить их:

```javascript
// 1. Список компаний
const companies = await axios.get(`${PAPERCLIP_BASE_URL}/api/companies`);
const COMPANY_ID = companies.data[0].id; // первая компания

// 2. Список агентов компании
const agents = await axios.get(
  `${PAPERCLIP_BASE_URL}/api/companies/${COMPANY_ID}/agents`
);
// Найти агентов по имени:
const critic = agents.data.find(a => a.name === 'Цензор');
const researcher = agents.data.find(a => a.name === 'Разведчик');

// 3. Список проектов
const projects = await axios.get(
  `${PAPERCLIP_BASE_URL}/api/companies/${COMPANY_ID}/projects`
);
const PROJECT_ID = projects.data[0].id;
```

Сохранить IDs в `.env` после первой настройки — они не меняются.

---

## 9. ПОЛНЫЙ СПИСОК ENDPOINT'ОВ PAPERCLIP API

### Issues
| Method | Path | Описание |
|--------|------|----------|
| GET | /api/companies/{id}/issues | Список задач (фильтры: status, assigneeAgentId, projectId) |
| GET | /api/issues/{issueId} | Получить задачу |
| POST | /api/companies/{id}/issues | **Создать задачу** |
| PATCH | /api/issues/{issueId} | Обновить задачу |
| POST | /api/issues/{issueId}/checkout | Взять задачу (агент) |
| POST | /api/issues/{issueId}/release | Отпустить задачу |
| GET | /api/issues/{issueId}/comments | Комментарии |
| POST | /api/issues/{issueId}/comments | Добавить комментарий |
| GET/PUT/DELETE | /api/issues/{issueId}/documents/{key} | Документы к задаче |

### Agents
| Method | Path | Описание |
|--------|------|----------|
| GET | /api/companies/{id}/agents | Список агентов |
| GET | /api/agents/{agentId} | Агент по ID |
| GET | /api/agents/me | Текущий агент (в heartbeat) |
| POST | /api/companies/{id}/agents | Создать агента |
| PATCH | /api/agents/{agentId} | Обновить агента |
| POST | /api/agents/{agentId}/pause | Поставить на паузу |
| POST | /api/agents/{agentId}/resume | Возобновить |
| POST | /api/agents/{agentId}/keys | Создать API ключ |
| POST | /api/agents/{agentId}/heartbeat/invoke | Запустить heartbeat вручную |

### Routines (scheduled tasks / heartbeat schedules)
| Method | Path | Описание |
|--------|------|----------|
| GET | /api/companies/{id}/routines | Список рутин |
| POST | /api/companies/{id}/routines | Создать рутину |
| PATCH | /api/routines/{id} | Обновить рутину |
| POST | /api/routines/{id}/triggers | Добавить триггер (cron/webhook/api) |
| POST | /api/routines/{id}/run | Запустить вручную |
| POST | /api/routine-triggers/public/{publicId}/fire | Запустить webhook-триггер |

### Companies / Org
| Method | Path | Описание |
|--------|------|----------|
| GET | /api/companies | Список компаний |
| GET | /api/companies/{id}/org | Оргчарт |
| GET | /api/companies/{id}/goals | Цели |
| GET | /api/companies/{id}/projects | Проекты |

---

## 10. КАК ИНТЕГРИРОВАТЬ В BOT.JS (ТЕКУЩИЙ КОД)

Текущий бот (`notifier/bot.js`) уже имеет `PAPERCLIP_BASE_URL` в конфиге, но функция `createPaperclipIssue` не реализована. Добавить:

```javascript
// В bot.js добавить после Config block:

const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;
const CRITIC_AGENT_ID = process.env.PAPERCLIP_CRITIC_AGENT_ID;
const RESEARCHER_AGENT_ID = process.env.PAPERCLIP_RESEARCHER_AGENT_ID;
const PROJECT_ID = process.env.PAPERCLIP_PROJECT_ID;

async function createIssue(title, description, assigneeAgentId, priority = 'medium') {
  try {
    const response = await axios.post(
      `${PAPERCLIP_BASE_URL}/api/companies/${COMPANY_ID}/issues`,
      {
        title,
        description,
        status: 'todo',
        priority,
        assigneeAgentId,
        projectId: PROJECT_ID
      }
    );
    return response.data;
  } catch (err) {
    console.error('Ошибка создания Issue в Paperclip:', err.message);
    return null;
  }
}

async function getIssueResult(issueId) {
  try {
    const [issue, comments] = await Promise.all([
      axios.get(`${PAPERCLIP_BASE_URL}/api/issues/${issueId}`),
      axios.get(`${PAPERCLIP_BASE_URL}/api/issues/${issueId}/comments`)
    ]);
    return {
      status: issue.data.status,
      comments: comments.data,
      document: issue.data.planDocument
    };
  } catch (err) {
    console.error('Ошибка получения результата из Paperclip:', err.message);
    return null;
  }
}
```

---

## 11. НЕРЕШЁННЫЕ ВОПРОСЫ

1. **Polling vs Push**: Как бот узнает что агент завершил задачу?
   - Вариант А: Polling каждые 30 сек — просто, но неэффективно
   - Вариант Б: Routine с webhook → бот слушает POST от Paperclip — лучше
   - Вариант В: Агент сам отправляет сообщение через Telegram API — требует ключ бота у агента

2. **Local Trusted Mode**: Работает ли без авторизации локально?
   - Из кода и документации: ДА, если Paperclip и бот на одном хосте
   - Проверить: `curl http://localhost:3100/api/companies`

3. **Inbox vs Assignment**: Агент узнаёт о задачах через GET /api/agents/me/inbox-lite
   - Нужно понять формат этого эндпоинта (нет в доках)

---

## ИСТОЧНИКИ

- [GitHub paperclipai/paperclip](https://github.com/paperclipai/paperclip)
- [docs/api/issues.md](https://github.com/paperclipai/paperclip/blob/master/docs/api/issues.md)
- [docs/api/agents.md](https://github.com/paperclipai/paperclip/blob/master/docs/api/agents.md)
- [docs/api/routines.md](https://github.com/paperclipai/paperclip/blob/master/docs/api/routines.md)
- [docs/api/overview.md](https://github.com/paperclipai/paperclip/blob/master/docs/api/overview.md)
- [docs/api/authentication.md](https://github.com/paperclipai/paperclip/blob/master/docs/api/authentication.md)
- [docs/adapters/claude-local.md](https://github.com/paperclipai/paperclip/blob/master/docs/adapters/claude-local.md)
- [npm paperclipai](https://www.npmjs.com/package/paperclipai)
- [apidog.com Paperclip overview](https://apidog.com/blog/paperclip/)
