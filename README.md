# Эстрим Фест — AI Marketing Platform

AI-компания из 12 агентов, которая создаёт и исполняет маркетинговую тактику для метал-фестиваля.
Один человек (организатор) + 12 AI-агентов = полноценный маркетинговый отдел.

## Архитектура

```
ТГ-бот → Paperclip (CMO → 3 Head → 7 Specialists + Critic) → React Dashboard → Google Sheets → ТГ-бот
```

### Орг-структура агентов (v5)

```
                           CMO
                      (оркестратор)
                   /     |      \       \
          Head of      Head of    Head of     Critic
          Strategy     Content    Growth    (независимый)
         /  |   \      /   \      /    \
  Researcher Tactic Audience Content Merch Outreach Growth
            Writer Analyst   Ops  Planner Writer  Scout
```

### 10 разделов договора → 12 агентов

| Раздел | Тема | Исполнители |
|--------|------|-------------|
| а | Стратегия продвижения | Audience Analyst + Researcher + Tactic Writer |
| б | Сайт Tilda (ТЗ + тендер) | Tactic Writer + Researcher |
| в | Видеотрейлер (концепция + тендер) | Tactic Writer + Researcher |
| г | Амбассадоры | Outreach Writer + Growth Scout |
| д | Инфопартнёры | Outreach Writer + Growth Scout |
| е | Блогеры | Outreach Writer + Growth Scout |
| ж | Контент-стратегия | ContentOps + Audience Analyst |
| з | Мерч | Merch Planner |
| и | Подрядчики | Tactic Writer + Researcher |
| к | Календарный план | Tactic Writer |

## Стек

- **Orchestration:** Paperclip AI (localhost:3100)
- **Agents:** Claude CLI (`claude -p`)
- **Bot:** node-telegram-bot-api (polling/webhook)
- **Dashboard:** React 19 + Vite + Tailwind CSS
- **Sheets:** Google Sheets API (googleapis)
- **Standards:** ЧиП 2.5 (маркетинговый бриф), ЧиП 3.2 (тендерный процесс)

## Запуск

```bash
# 1. Paperclip
npx paperclipai run --data-dir .paperclip

# 2. Бот (dev)
cd notifier && node bot.js

# 3. Дашборд
cd dashboard && npm run dev

# 4. Настройка агентов (после первого запуска Paperclip)
node scripts/setup-paperclip-agents.js
```

## Структура проекта

```
.claude/agents/      — 12 промпт-файлов агентов
.claude/skills/      — 14 скиллов (tender-process, ajtbd-research, content-strategy, ...)
.claude/rules/       — красные линии и правила аудитории
notifier/            — TG-бот + Paperclip клиент + agent-runner
dashboard/           — React-дашборд маркетинговой тактики
output/tactic/       — 14 разделов тактики (а-н)
output/drafts/       — 32+ черновика постов
output/research/     — 40+ исследований
output/tracking/     — трекинг амбассадоров, партнёров, блогеров, тендеров
output/outreach/     — шаблоны писем и предложений
context/             — контекст проекта (READ-ONLY)
scripts/             — утилиты (setup, migrate, auth)
```

## Фестиваль

- **Название:** Эстрим Фест (Extreme Fest)
- **Дата:** 11 июля 2026
- **Город:** Москва
- **Формат:** 1 день, клубный фестиваль, 2 сцены + скейт-зона
- **Лайнап:** 12 групп + иностранный хедлайнер
- **Цель:** 1000+ билетов

---

*Построено на Claude Code + Paperclip AI. Стандарты ЧиП (Чирков и партнёры).*
