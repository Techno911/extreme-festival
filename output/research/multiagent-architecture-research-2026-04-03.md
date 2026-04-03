# Multi-Agent Architecture: Best Practices Research

> Дата проверки: 2026-04-03
> Цель: Найти best practices для построения multi-agent системы (применимо к AI-штабу Эстрим Феста)
> Источников проверено: 12

---

## ИТОГОВАЯ ТАБЛИЦА

| # | Тема | Ключевая находка | Цифра/порог | Источник | Дата |
|---|------|-----------------|-------------|----------|------|
| 1 | Фреймворки: иерархия | CrewAI — роли как у людей (sequential/hierarchical), LangGraph — граф-узлы с полным контролем, AutoGen — peer-to-peer диалог | CrewAI: Hub-and-spoke по умолчанию | DataCamp / o-mega.ai | 2026-02-23 |
| 2 | Инструменты на агента | Anthropic: «fewer thoughtful tools > many». Конкретный лимит не называется, но: перегруз инструментами = «confuse the agent» | 58 инструментов из 5 MCP-серверов = 55K токенов ДО старта диалога | anthropic.com/engineering | 2025 |
| 3 | Span of control (hub-and-spoke) | Hub-spoke: ПОТОЛОК ~7 специалистов на одного оркестратора. Mesh: не более 4-8. Иерархия 2 уровня лучше 3+ | 7 агентов max на hub; mesh 3-8; иерархия: 3-5 на supervisora | augmentcode.com | 2025 |
| 4 | Декомпозиция ролей | Domain > Functional для сложных задач. При 16+ инструментах координация агентов даёт «непропорциональные» издержки | 16+ tools = domain decomp. ломается | Google Research | 2025 |
| 5 | Паттерны коммуникации | Hub-and-spoke: лучший баланс успех/ошибки. Peer-to-peer (mesh): ошибки × 17.2x (без оркестратора). Иерархия 2 уровня: оптимум | Централизованное: ошибки ×4.4x vs независимые ×17.2x | Google Research / gurusup.com | 2025 |
| 6 | Agency Swarm / OpenAI Swarm | Гибридный паттерн: иерархия снаружи + mesh внутри команды (leaf nodes) | Prod-рекомендация: hybrid для >5 агентов | OpenAI Swarm / swarms.world | 2025 |
| 7 | Microsoft AutoGen | Domain supervisor → 3-5 specialist workers per domain. «Introduce supervisors as architecture scales» | Ratio: 1:3–5 | developer.microsoft.com | 2026 |
| 8 | Последовательные задачи | Все multi-agent варианты УХУДШАЮТ результат на последовательных задачах | -39% до -70% производительности | Google Research | 2025 |

---

## 1. ФРЕЙМВОРКИ — ИЕРАРХИЯ АГЕНТОВ

### CrewAI
- **Подход:** role-based (как реальная команда). Агент = Role + Goal + Backstory + Tools
- **Режимы:** `sequential` (конвейер) или `hierarchical` (менеджер распределяет задачи)
- **Hub-and-spoke:** встроен. Manager Agent = оркестратор, Worker Agents = исполнители
- **Фокус:** быстрый прототип, человекоподобные роли
- **Ограничение:** менеджер-агент становится бутылочным горлышком при масштабировании
- **Источник:** [DataCamp](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen), [o-mega.ai](https://o-mega.ai/articles/langgraph-vs-crewai-vs-autogen-top-10-agent-frameworks-2026)

### LangGraph
- **Подход:** граф-узлы. Агенты = ноды, переходы = рёбра с условиями
- **Иерархия:** явно строится через supervisory nodes. Поддерживает hierarchical teams
- **Hub-and-spoke:** реализуется через supervisor node + worker nodes
- **Фокус:** production, аудит, compliance. Высокий контроль
- **Рекомендация:** использовать если нужна предсказуемость; CrewAI — для быстрого PoC
- **Источник:** [LangChain blog](https://blog.langchain.com/choosing-the-right-multi-agent-architecture/)

### AutoGen (Microsoft)
- **Подход:** conversational. Агенты = участники диалога, могут менять роли
- **Иерархия:** децентрализованная. Агенты договариваются через переписку
- **Паттерн:** peer-to-peer по умолчанию. Hub реализуется через GroupChatManager
- **Фокус:** итеративная доработка кода, исследования с неопределённым workflow
- **Ограничение:** O(N²) коммуникационных путей при росте числа агентов
- **Источник:** [developer.microsoft.com](https://developer.microsoft.com/blog/designing-multi-agent-intelligence)

### Agency Swarm (VRSEN)
- **Подход:** агентства как организации. CEO → специалисты, строгие communication flows
- **Иерархия:** явная, настраивается через agency chart
- **Паттерн:** hub-and-spoke с явными разрешёнными связями между агентами
- **Особенность:** каждый агент имеет собственный набор инструментов, минимальное пересечение
- **Источник:** github.com/VRSEN/agency-swarm

### Paperclip (текущий проект)
- **Подход:** issue-based задачи, агенты берут из inbox
- **Иерархия:** CMO сверху → 4 агента (researcher, writer, content-ops, critic)
- **Паттерн:** hub-and-spoke через CMO. Бот = тупая труба, не маршрутизирует
- **Особенность:** heartbeat для активации агентов, self-re-invoke после завершения
- **Источник:** internal research paperclip-api-research.md

---

## 2. ОПТИМАЛЬНОЕ КОЛИЧЕСТВО ИНСТРУМЕНТОВ НА АГЕНТА

### Рекомендация Anthropic (официальная)

Из статьи [Writing effective tools for AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents):

> "We recommend building a few thoughtful tools targeting specific high-impact workflows... Too many tools or overlapping tools can also distract agents from pursuing efficient strategies."

**Конкретные данные:**
- 58 инструментов из 5 MCP-серверов = ~55K токенов контекста ДО диалога
- Внутренние инструменты Anthropic = 134K токенов до оптимизации
- Решение: Tool Search Tool — динамическая загрузка только нужных инструментов

**Принципы дизайна инструментов:**
1. Consolidate: объединяй связанные операции в один инструмент
2. Namespace: разграничивай группы через префиксы
3. Context efficiency: возвращай только high-signal данные
4. No overlap: пересечение функций = путаница агента

**Вывод:** нет «магического числа», но практика показывает: 5-10 инструментов на агента = комфортная зона. Более 20 — нужна динамическая загрузка или разбивка по агентам.

---

## 3. SPAN OF CONTROL — СКОЛЬКО ПОДЧИНЁННЫХ НА ОДНОГО АГЕНТА

| Архитектура | Оптимум подчинённых | Максимум | Источник |
|------------|-------------------|---------|---------|
| Hub-and-spoke | 3-5 специалистов | 7 | augmentcode.com |
| Mesh (peer-to-peer) | 3-4 | 8 | gurusup.com |
| Иерархическое дерево | 3-5 на каждый узел | — | Microsoft |
| Потолок пропускной способности hub | — | 6.7 задач/сек при 3-сек LLM call + 20 агентах | gurusup.com |

**Ключевые находки:**
- Mesh из N агентов = N(N-1)/2 соединений. При N=10 → 45 соединений = хаос
- Два уровня иерархии лучше трёх: минимизируются «compression boundaries»
- Оркестратор > 7 подчинённых → нужен либо внешний memory store, либо добавление supervisors

**Вывод для Эстрим Феста (CMO + 4 агента):** текущая структура CMO → 4 специалиста — в оптимуме. 1:4 = хороший span of control.

---

## 4. ДЕКОМПОЗИЦИЯ РОЛЕЙ: ФУНКЦИОНАЛЬНАЯ vs ДОМЕННАЯ

### Функциональная декомпозиция
Роли = этапы процесса: Planner → Generator → Critic → Verifier

**Плюсы:**
- Чёткие границы ответственности
- Хорошо для pipeline задач с предсказуемым потоком

**Минусы:**
- Агент не владеет предметной областью
- Тяжело маршрутизировать нестандартные запросы

**Примеры:** MetaGPT (PM → Architect → Dev → QA), конвейеры GenEscape

### Доменная декомпозиция
Роли = экспертные области: Researcher + Writer + ContentOps + Critic

**Плюсы:**
- Агент = эксперт в теме → меньше контекстных потерь
- Проще добавить нового специалиста не ломая структуру
- Лучше для непредсказуемых задач

**Минусы:**
- При 16+ инструментах в домене: координационные издержки растут непропорционально

**Рекомендация Google Research (2025):** для комплексных задач с параллельным выполнением — доменная. Для строго последовательных процессов — функциональная (но сам multi-agent подход там хуже одного агента).

**Вывод для Эстрим Феста:** текущая структура (researcher / writer / content-ops / critic) = доменная. Правильный выбор для маркетинга с непредсказуемыми задачами.

---

## 5. ПАТТЕРНЫ КОММУНИКАЦИИ: СРАВНЕНИЕ

### Данные Google Research (180 конфигураций)

| Паттерн | Ошибки (множитель) | Производительность | Отказоустойчивость |
|---------|-------------------|-------------------|--------------------|
| Один агент | ×1.0 (baseline) | Baseline | н/д |
| Независимые параллельные (без оркестратора) | **×17.2** | +80.9% на параллельных задачах | Нет контроля ошибок |
| Hub-and-spoke (централизованное) | **×4.4** | Лучший баланс | SPOF |
| Иерархия 2 уровня | ~×4-6 | Высокая | Средняя |

### Данные gurusup.com (latency benchmark)

| Паттерн | Задержка | Масштабируемость | Управляемость |
|---------|---------|----------------|--------------|
| Hub-and-spoke | 2-5 сек/задача | Средняя | Высокая |
| Mesh (peer-to-peer) | 5-15 сек/итерация | Низкая (O(N²)) | Средняя |
| Иерархия | 6-12 сек min | Высокая (логарифм) | Высокая |
| Pipeline | Кумулятивная | Средняя (bottleneck = самое медленное звено) | Высокая |

### Вывод по паттернам

**Hub-and-spoke (через CMO) — правильный выбор для Эстрим Феста:**
- Ошибки ×4.4 vs ×17.2 у независимых агентов
- Простота debugging и аудита
- Bottleneck (CMO) — компромисс, приемлемый при 4 подчинённых
- «Тупая труба» бот → CMO — архитектурно верно (из CLAUDE.md)

**Когда peer-to-peer лучше:**
- Задачи с высокой неопределённостью и нужен «brainstorm» между агентами
- Короткие циклы итерации (AutoGen стиль)

**Когда иерархия (3+ уровня) оправдана:**
- 20+ агентов
- Несколько доменов (Finance + Legal + HR)
- Для 5 агентов — избыточно

---

## 6. ПРИМЕНЕНИЕ К ТЕКУЩЕЙ АРХИТЕКТУРЕ ЭСТРИМ ФЕСТА

### Текущая структура (из CLAUDE.md)

```
Telegram Bot (труба)
       ↓
     CMO (Paperclip, cmo)
    /  |  |  \
 R    W   CO   C
```

R = Researcher, W = Writer (engineer), CO = ContentOps (designer), C = Critic (qa)

### Оценка по исследованию

| Параметр | Текущее | Рекомендация | Оценка |
|----------|---------|--------------|--------|
| Паттерн | Hub-and-spoke | Hub-and-spoke | OK |
| Span of control | 1:4 | 1:3-7 | OK |
| Декомпозиция | Доменная | Доменная (для маркетинга) | OK |
| Уровни иерархии | 2 (CMO + специалисты) | 2 оптимально | OK |
| Инструментов на агента | ~5-7 (skills) | 5-10 | OK |
| Бот как маршрутизатор | Нет (труба) | Правильно — не маршрутизирует | OK |

**Вывод:** текущая архитектура соответствует best practices. Улучшение — только если появятся новые домены (например, outreach-агент отдельно от researcher).

### Потенциальные улучшения

1. **Tool overlap**: проверить не дублируют ли researcher и content-ops инструменты (поиск по ВК)
2. **Parallel execution**: задачи без зависимостей (ресёрч блогеров + ресёрч конкурентов) CMO должен выдавать параллельно, не последовательно
3. **Error containment**: critic как валидатор снижает каскадные ошибки — правильная роль в hub-and-spoke
4. **Self-re-invoke**: после completeIssue проверять inbox — избегает простоя агентов

---

## ИСТОЧНИКИ

1. [DataCamp: CrewAI vs LangGraph vs AutoGen](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen)
2. [o-mega.ai: Top AI Agent Frameworks 2026](https://o-mega.ai/articles/langgraph-vs-crewai-vs-autogen-top-10-agent-frameworks-2026)
3. [LangChain Blog: Choosing Multi-Agent Architecture](https://blog.langchain.com/choosing-the-right-multi-agent-architecture/)
4. [Anthropic Engineering: Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
5. [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
6. [Google Research: Scaling Agent Systems](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/)
7. [Microsoft: Designing Multi-Agent Intelligence](https://developer.microsoft.com/blog/designing-multi-agent-intelligence)
8. [Augment Code: Enterprise Multi-Agent Patterns](https://www.augmentcode.com/guides/multi-agent-ai-architecture-patterns-enterprise)
9. [gurusup.com: Agent Orchestration Patterns](https://gurusup.com/blog/agent-orchestration-patterns)
10. [Swarms Architecture Docs](https://docs.swarms.world/en/latest/swarms/concept/swarm_architectures/)
11. [dev.to: Complete Multi-Agent Guide 2026](https://dev.to/pockit_tools/langgraph-vs-crewai-vs-autogen-the-complete-multi-agent-ai-orchestration-guide-for-2026-2d63)
12. [OpenAgents Blog: Frameworks Compared 2026](https://openagents.org/blog/posts/2026-02-23-open-source-ai-agent-frameworks-compared)
