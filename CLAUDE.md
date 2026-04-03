# ExtremeFest Marketing — Claude Code Project

## Проект
Маркетинговая тактика для метал-фестиваля «Эстрим Фест» (11 июля 2026, Москва).
Два режима: генерация документа (10 разделов а—к) → операционка до 11 июля.

## Контекст
@context/ExtremeFest_Context.md — полный контекст проекта (25К слов)
@context/contract.md — структура договора
@.claude/rules/constraints.md — красные линии

## Агенты
- researcher: веб-ресёрч, мониторинг, сбор данных
- writer: тексты, брифы, шаблоны, документы
- critic: валидация в 3 ролях (метал-скуф / маркетолог / организатор)
- content-ops: черновики постов, адаптация контента

## Ключевые команды
- /generate-tactic [раздел] — сгенерировать раздел тактики
- /validate-idea — валидация идеи через critic
- /research [тема] — запустить ресёрч
- /draft-post [рубрика] — черновик поста
- /check-status — дайджест прогресса
- /run-tender [тип] — тендерный процесс

## Workflow
1. Plan mode для сложных задач
2. /compact при ~50% контекста
3. Каждый раздел → researcher собирает данные → writer пишет → critic валидирует
4. Результаты в output/tactic/ и output/research/

## Абсолютные запреты
- НЕ генерировать AI-арт / AI-изображения
- НЕ писать канцеляритом, пафосом, корпоративным языком
- НЕ предлагать задачи для большой команды (исполнитель один — Женя)
- НЕ критиковать группу Master / Олега Грановского
- НЕ рекомендовать мультик дороже 50к
- НЕ удалять файлы в context/

## Тон текстов
Как друг в баре. Грубовато, с юмором, без пафоса. Конкретика > вода.
Аудитория: метал-скуфы 35-45 лет, ненавидят «вылизанное» и AI-текст.

## Gotchas — извлечённые уроки (обновлять после каждого провала)

### Браузерная автоматизация (Chrome) — уроки из 3-часовой сессии
- **Angular Material**: `el.value = x` + `dispatchEvent('input')` не обновляет Angular model. Рабочий путь: `pyautogui.typewrite()` (физический набор) или `document.execCommand('insertText')` + `keydown Enter`
- **Angular chip-input (mat-chip-grid)**: DOM-элемент 0×0 px, невидим. Focus + execCommand + Enter через mat-chip-input
- **Angular checkbox (mat-checkbox)**: Несколько JS-кликов = model/DOM рассинхрон. Полная цепочка pointer events на `.mat-mdc-checkbox-touch-target`
- **Скачивание файлов**: JS `click()` = synthetic event → Chrome блокирует download. `pyautogui.click()` = trusted, но координаты viewport ≠ screen. Формула: `screen_y = window.screenY + (outerHeight - innerHeight) + viewport_y`
- **GCP OAuth client_secret**: Новый UI (Google Auth Platform, 2026) СКРЫВАЕТ секрет. Кнопка Download JSON УДАЛЕНА из таблицы клиентов. Путь: клик по имени клиента → секция "Client secrets" → "+ Add secret" → копировать
- **Chrome Preferences**: `prompt_for_download` сбрасывается. Не редактировать JSON напрямую
- **Control Chrome MCP**: `"missing value"` = undefined/void. Top-level await не работает. `Array.map().join()` иногда возвращает void — читай свойства по одному
- **Кириллическая раскладка**: `pyautogui.typewrite()` печатает по keycode → латиницу. Для кириллицы: `pbcopy` + AppleScript `keystroke "v" using command down`
- **Overlay `.cfc-page-overlay`**: GCP Console ставит overlay — блокирует клики. Скрывать: `overlay.style.display = 'none'`
- **Cookie decryption (Chrome macOS)**: AES-128-CBC, v10 prefix, PBKDF2-SHA1 1003 iterations, "saltysalt". Первый блок = мусор. НЕ рабочий путь для авторизации — слишком хрупко

### Правило 5 минут (КРИТИЧНО)
- Если автоматизация внешнего веб-UI не даёт результат за 5 минут → **ПОЛНЫЙ СТОП**
- Определи минимальное ручное действие (обычно 30-60 сек для пользователя)
- Попроси пользователя сделать ТОЛЬКО это одно действие
- Продолжи автоматизацию с того места
- **Антипаттерн**: 3 часа на кнопку "Download JSON" → 30 сек "скопируй секрет"

### Google Sheets API
- Лист по умолчанию = 26 колонок (A-Z). Для AB+: `gridProperties: { columnCount: N }` при создании
- `frozenColumnCount` конфликтует с `mergeCells` → не замораживай колонки если есть merge
- Справочники размещай в T-Y (внутри 26), а не AB+
- `valueInputOption: 'USER_ENTERED'` — формулы интерпретируются. `'RAW'` — нет

### Node.js скрипты в этом проекте
- Зависимости в `notifier/node_modules/`. Путь: `require(path.join(notifierDir, 'node_modules', 'MODULE'))`
- `const fs = require('fs'); const path = require('path');` — ПЕРВЫМИ, до любых `path.join()`
- dotenv: `require(...'dotenv').config({ path: path.join(notifierDir, '.env') })` — после path

### Архитектура AI-штаба (КРИТИЧНО — извлечено 2 апреля 2026)

**Бот = тупая труба.** Бот НЕ маршрутизирует задачи по агентам. Всё не-slash → CMO в Paperclip. CMO сам разбивает. Исключение: read-only запросы ("покажи", "что по") → читают файл напрямую, 0 токенов.

**Paperclip API gotchas:**
- `getIssue()` → `/api/issues/{id}` (НЕ `/api/companies/{id}/issues/{id}` — тот возвращает 404)
- `getInbox()` фильтр: `['backlog', 'todo']` + stale `in_progress` (no activeRun) — иначе застревают
- `checkoutIssue()` expectedStatuses: `['backlog', 'todo', 'in_progress']` — для восстановления после краша
- Heartbeat invoke = POST `/api/agents/{id}/heartbeat/invoke` — без него агент не проснётся
- Self-re-invoke: после completeIssue → проверь inbox → POST heartbeat на себя если есть ещё задачи
- localhost ссылки НЕ кликабельны в Telegram — показывай как `<code>localhost:3100</code>`
- `role` в Paperclip = enum (cmo, researcher, engineer, designer, qa). Произвольные значения не принимает

**Оргструктура Paperclip:**
- CMO наверху, 4 специалиста reportsTo CMO
- Notifier удалён — не нужен в архитектуре
- Роли: CMO=cmo, Researcher=researcher, Writer=engineer, ContentOps=designer, Critic=qa

### Работа с пользователем (REFLECT — 2 апреля 2026)

**НЕ СПРАШИВАЙ НИЧЕГО.** Пользователь дал полный доступ. `--dangerously-skip-permissions`. Делай работу молча.

**НЕ ПРЕДЛАГАЙ ВАРИАНТЫ.** "Хотите A или B?" — ЗАПРЕЩЕНО. Выбери лучший и делай.

**НЕ ОБЪЯСНЯЙ ЧТО БУДЕШЬ ДЕЛАТЬ.** Просто делай. Объясняй только результат.

**Терминальный Claude Code:** пользователь работает в Terminal.app на MacBook. `claude --dangerously-skip-permissions` в директории проекта. НЕ `claude -p` (headless режим без UI — пользователь не видит прогресс и путается).

**Слона есть поэтапно (совет Ивана):**
- Каждый шаг отдельно. Убедись что работает → следующий
- НЕ давай Claude весь roadmap — он начнёт торопиться и ломать
- Если шаг не работает за 5 мин → СТОП, диагностика, а не следующий шаг

**Уборка за собой:** После тестов — отменяй старые issues (PATCH cancelled). Не оставляй мусор в backlog. Пользователь это ценит.

**Лимиты Claude Max ($100):** 3 раза в день попадал в лимит. НЕ переключай модели (Opus→Sonnet) — теряется контекст. Лучше всё на одной модели. Экономь токены: read-only запросы → файл напрямую, НЕ через CMO.

**Permission prompts — главная боль:** Пользователь потратил 19 часов, большая часть — на нажатие "разрешить". Решение: `--dangerously-skip-permissions` в терминале или полный allowlist в settings.json.

### Эталонные таблицы и данные (REFLECT — 3 апреля 2026)

**НЕ создавать таблицы с нуля.** Если у пользователя есть эталонная таблица (xlsx, Google Sheets) — скопировать её структуру до пикселя. Формулы (VLOOKUP, COUNTIF) не трогать. Агенты пишут ТОЛЬКО в data-строки. Пользователь: "зачем было ломать мою таблицу и с нуля собирать такое дерьмо".

**НЕ мыслить мелко.** Если задача выглядит маленькой — подумай шире. Предложи полный CJM, весь путь, все чекпоинты. Пользователь: "это очень мелкая работа, нужно в 5 раз масштабнее".

**Сначала локально, потом сервер.** Деплой на VPS ТОЛЬКО после того как всё идеально работает на localhost. Не перескакивать.

**Длинные промпты → в файл.** Не вставлять промпты с бэктиками напрямую в bash — ломается. Сохранять в /tmp/task.txt, потом `claude -p "$(cat /tmp/task.txt)"` или `Прочитай /tmp/task.txt и выполни`.
