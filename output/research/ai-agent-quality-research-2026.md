# Quality Assurance для Multi-Agent AI систем

> Дата проверки: 2026-04-03
> Цель: Best practices для обеспечения качества output в multi-agent системах, генерирующих маркетинговые документы
> Контекст: 12+ AI-агентов, связанные артефакты, нет чётких критериев приёмки
> Источников проверено: 13

---

## ИТОГОВАЯ ТАБЛИЦА

| # | Тема | Ключевая находка | Цифра/порог | Источник | Дата |
|---|------|-----------------|-------------|----------|------|
| 1 | Главный барьер к production | Quality — барьер #1 для агентов | 32% организаций называют качество главной проблемой | LangChain State of Agent Engineering | 2025 |
| 2 | Acceptance criteria в промпте | Явные критерии приёмки в промпте = структурированный JSON с pass/fail по каждому | Формат: `{"reason": "...", "pass": bool, "score": 0.0-1.0}` | Promptfoo / Ragas | 2025 |
| 3 | Self-review агента | Агент способен оценить собственный output, но с предвзятостью. Митигация: отдельный промпт-оценщик, не task-performer | 27% людей меняли ревью после LLM-фидбека (ICLR 2025, 20K ревью) | arxiv 2504.09737 | 2025 |
| 4 | Peer-review (агент проверяет агента) | LLM4Review: Author → Reviewer → Reviser → Meta-Reviewer. 84% согласие с экспертами | 4 роли, round-based protocol, rubric-based critiques | OpenReview LLM4Review | 2025 |
| 5 | Рубрики для оценки | AdaRubric: динамические рубрики под каждый тип задачи. N=5 измерений. Надёжность: Krippendorff α ≥ 0.80 | 4.3/5.0 релевантность vs экспертные рубрики | arxiv AdaRubric 2603.21362 | 2026 |
| 6 | Evaluation methods (что используют) | Human review: 59.8%, LLM-as-judge: 53.3%, ROUGE/BLEU: редко | 52.4% offline evals, 37.3% online evals | LangChain State of Agents | 2025 |
| 7 | Task completion vs policy adherence | Агент с 100% task completion может иметь только 33% policy adherence | 13.1% recall по контексту памяти при полном завершении задачи | arxiv 2512.12791 | 2025 |
| 8 | Information Degradation в цепочке агентов | Задача «деградирует» по мере прохождения через агентов — оригинальный goal вытесняется из контекста | Агент C получает «разбавленную» версию от Агента B | LangGraph vs CrewAI production 2026 | 2026 |
| 9 | Few-shot в промпте | 3-5 примеров = лучший инструмент для консистентности формата. Но: 1 пример > несколько для judge-задач | «Few-shot prompting is still king for consistent formatting» | LangChain / Monte Carlo | 2025 |
| 10 | Human-in-the-loop триггеры | Escalate если: уверенность < порога, действие необратимо, регуляторный риск, конфликт данных | Confidence threshold — организация устанавливает сама | StackAI / Orkes.io | 2025 |
| 11 | DimensionAwareFilter | Высокий общий балл НЕ скрывает провал по одному измерению | Фильтр: s̄ⱼ ≥ θⱼ для каждого измерения отдельно | AdaRubric arxiv | 2026 |
| 12 | Provenance и traceability артефактов | PROV-AGENT: расширение W3C PROV + MCP для отслеживания каждого tool call, prompt, response | Typed nodes: prompt / action / validation. Edges: temporal + semantic | arxiv PROV-AGENT 2508.02866 | 2025 |
| 13 | LLM-as-judge scoring | Целые числа (1-5) работают лучше float для LLM-судей | «Float scores are not great — LLM-as-judge does better with categorical integers» | Monte Carlo Data | 2025 |

---

## 1. КАК СТАВИТЬ ЗАДАЧИ АГЕНТАМ — ACCEPTANCE CRITERIA В ПРОМПТЕ

### Проблема
32% организаций называют качество главным барьером к production (LangChain, 2025). Основная причина — задача определена нечётко, агент не знает что считается «готово».

### Паттерн: Prompt Contract

Acceptance criteria должны быть частью промпта — явно, не имплицитно:

```
Задача: [глагол + конкретный результат]

Критерии приёмки (ВСЕ должны быть выполнены):
- [ ] Формат: [структура JSON / Markdown / таблица]
- [ ] Объём: [точные цифры — не «кратко», а «200-300 символов»]
- [ ] Содержание: [что ОБЯЗАТЕЛЬНО включить]
- [ ] Ограничения: [что запрещено — AI-язык, канцелярит, конкретные слова]
- [ ] Источники: [минимум N источников / обязательны ссылки]

Output format:
{
  "result": "...",
  "self_check": {
    "criterion_1": {"pass": true/false, "reason": "..."},
    "criterion_2": {"pass": true/false, "reason": "..."}
  }
}
```

**Ключевые правила (из Promptfoo / Ragas, 2025):**
- Один критерий = одно измерение (не «хорошо написано», а «не использует слова уникальный/профессиональный»)
- Числовые ограничения работают лучше качественных: «под 100 слов» > «кратко»
- JSON с `pass/fail` по каждому критерию — верифицируемый выход

### Паттерн: Scaffold Prompt

Вместо «напиши пост» — обёртка с guard-rails:

```
Ты — копирайтер метал-фестиваля. Твоя задача: {task}.

Шаги (выполни последовательно):
1. Определи ключевое сообщение (1 предложение)
2. Напиши черновик
3. Проверь себя: нет ли слов [список запрещённых]
4. Выдай финальный текст + self_check

Примеры правильного тона:
[пример 1]
[пример 2]
```

**Few-shot best practice:** 3-5 примеров для форматирования. Для judge-задач — достаточно 1 примера (больше не улучшает, иногда ухудшает — Monte Carlo Data, 2025).

---

## 2. SELF-REVIEW: МОЖЕТ ЛИ АГЕНТ САМА СЕБЯ ОЦЕНИТЬ?

### Вывод из исследований

Да, но с двумя условиями:
1. Оценщик и исполнитель — **разные промпты** (не один системный промпт)
2. Судья оценивает **по явным критериям**, не «является ли это хорошим»

### Предвзятости LLM-судей (Monte Carlo Data, 2025)

| Тип предвзятости | Описание | Митигация |
|-----------------|---------|-----------|
| Order bias | Первый вариант оценивается выше | Рандомизировать порядок вариантов |
| Verbosity bias | Длинный ответ получает выше | Явно запрещать оценку по длине |
| Self-model bias | Агент предпочитает свой стиль | Отдельная модель для оценки |

### Рабочий шаблон Self-Review промпта

```
Ты — строгий редактор. Тебе дан текст и критерии.
ЗАДАЧА: вынеси вердикт по каждому критерию.

ТЕКСТ ДЛЯ ОЦЕНКИ:
{{output}}

КРИТЕРИИ (оцени каждый независимо):
1. Нет запрещённых слов (уникальный, качественный, профессиональный): pass/fail
2. Объём: pass если 200-300 символов, fail иначе
3. Тон: pass если «как друг в баре», fail если официальный
4. Наличие конкретных цифр/фактов: pass/fail

Ответ строго в JSON:
{
  "criteria": [
    {"id": 1, "pass": true/false, "evidence": "цитата из текста"},
    ...
  ],
  "overall_pass": true/false,
  "top_issue": "главная проблема если есть"
}
```

**Принцип:** Судья должен цитировать текст (evidence), а не абстрактно объяснять. Иначе оценка — галлюцинация.

---

## 3. PEER-REVIEW: ОДИН АГЕНТ ПРОВЕРЯЕТ ДРУГОГО

### Паттерн LLM4Review (OpenReview, 2025)

Применён к 20K академических ревью на ICLR 2025. Результат: 27% авторов обновили ревью после фидбека системы.

Архитектура:
```
Author (создаёт)
    ↓
Reviewer (rubric-based критика)
    ↓
Reviser (конвертирует критику в план изменений)
    ↓
Meta-Reviewer (accept / continue / reject)
```

**Адаптация для маркетинговых артефактов:**
```
Writer-агент → создаёт черновик
    ↓
Critic-агент → rubric-based оценка (5 измерений)
    ↓
Writer-агент → правки по конкретным замечаниям
    ↓
Critic-агент → финальный вердикт
    ↓
Human (Женя) → утверждение
```

### Что делает peer-review эффективным

- Reviewer работает по **рубрике** (не «хорош ли текст», а «соответствует ли он критерию X»)
- Meta-Reviewer имеет **явные пороги**: accept ≥ N баллов, continue если одно измерение < порога, reject если несколько провалены
- Reviewer **не знает** кто создал артефакт — слепое ревью снижает предвзятость

---

## 4. РУБРИКИ ДЛЯ ОЦЕНКИ — ADAVERB FRAMEWORK

### Ключевая находка: AdaRubric (arxiv 2603.21362, 2026)

Фиксированные рубрики не работают для разных задач: «хороший пост про группу» и «хороший бриф для подрядчика» — разные критерии. AdaRubric генерирует рубрику динамически из описания задачи.

### Структура рубрики (5 измерений)

Для каждой задачи: N = 5 ортогональных измерений, каждое с весом wⱼ (сумма = 1.0).

**Пример рубрики для поста «группа недели»:**

| Измерение | Вес | Уровень 5 | Уровень 3 | Уровень 1 |
|-----------|-----|----------|----------|----------|
| Тон (не официальный) | 0.30 | Разговорный, с юмором, без пафоса | Нейтральный, иногда формальный | Официальный, канцелярит |
| Конкретность | 0.25 | Есть цифры, даты, факты о группе | Есть имена, нет деталей | Общие слова без фактов |
| Соответствие аудитории | 0.25 | Металлисты 35-45, узнают своё | Широкая аудитория | Непонятно кому |
| Отсутствие запрещённых слов | 0.10 | Ни одного | 1-2 нарушения | 3+ нарушений |
| Призыв к действию | 0.10 | Конкретный (ссылка/дата) | Есть, но размытый | Отсутствует |

Финальный балл: S = 0.30×s₁ + 0.25×s₂ + 0.25×s₃ + 0.10×s₄ + 0.10×s₅

### DimensionAwareFilter — критически важно

**Проблема:** агент набрал 4.2/5.0 в среднем, но по тону — 1/5. Без DimensionAwareFilter — проходит.

**Правило:** артефакт проходит контроль только если **каждое** измерение ≥ минимального порога.

```
Пример для поста:
- Тон ≥ 3 (обязательно — аудитория ненавидит официоз)
- Конкретность ≥ 3
- Соответствие аудитории ≥ 3
- Запрещённые слова ≥ 4 (нулевая толерантность)
- CTA ≥ 2

Если хотя бы одно < порога → Не принято, возврат на доработку
```

### Надёжность рубрики

Рубрика пригодна к использованию если Krippendorff's α ≥ 0.80 (согласованность между независимыми прогонами). При α < 0.80 — переформулировать критерии.

---

## 5. СВЯЗАННОСТЬ АРТЕФАКТОВ — DEPENDENCY GRAPH

### Проблема Information Degradation

В цепочке Writer → Critic → Writer оригинальный goal «вымывается» из контекста. Агент C получает «разбавленную» версию задачи от Агента B. Источник: LangGraph vs CrewAI production guide, 2026.

**Митигация:** каждый артефакт содержит в себе ссылку на исходный briefe + acceptance criteria.

### Граф зависимостей для маркетинговых артефактов

```
ExtremeFest_Context.md (READ-ONLY)
    ├── Стратегия (раздел а)
    │       ├── AJTBD-синтез → сегменты
    │       └── Конкурентный анализ → позиционирование
    ├── Сайт-бриф (раздел б)
    │       ├── зависит от: Стратегия → позиционирование
    │       └── зависит от: AJTBD → сегменты ЦА
    ├── Трейлер-бриф (раздел в)
    │       ├── зависит от: Стратегия → тон
    │       └── зависит от: Сайт-бриф → визуальный стиль
    ├── Амбассадоры (раздел г)
    │       └── зависит от: Лайнап (ExtremeFest_Context)
    ├── Инфопартнёры (раздел д)
    │       └── зависит от: Стратегия → каналы
    ├── Блогеры (раздел е)
    │       └── зависит от: AJTBD → сегменты
    ├── Контент-стратегия (раздел ж)
    │       ├── зависит от: Стратегия → каналы, тон
    │       └── зависит от: AJTBD → сегменты
    └── Посты (output/drafts/)
            ├── зависит от: Контент-стратегия → рубрики
            └── зависит от: Лайнап (ExtremeFest_Context)
```

### Traceability — что должен содержать каждый артефакт

Обязательный фронтматтер каждого .md файла:

```markdown
---
artifact_id: post-gruppa-nedeli-master-2026-04-18
type: draft_post
created_by: content-ops
created_at: 2026-04-18
depends_on:
  - context/ExtremeFest_Context.md (лайнап, тон)
  - output/tactic/razdel-zh-content-strategy.md (рубрика S-01)
  - output/research/ajtbd-06-final-synthesis.md (сегмент «Свои в тусовке»)
acceptance_criteria:
  - тон: разговорный, не официальный
  - объём: 800-1000 знаков ВК
  - запрещено: уникальный, качественный, AI-звук
  - обязательно: конкретный факт о группе + дата 11 июля
version: 1.0
status: draft | reviewed | approved
reviewed_by: critic-agent
approved_by: null
---
```

### При изменении зависимости

Если меняется `ExtremeFest_Context.md` (например, обновляется лайнап):
1. Все артефакты с `depends_on: context/ExtremeFest_Context.md` помечаются `status: stale`
2. CMO создаёт задачу на ревью каждого stale-артефакта
3. Артефакт проходит повторную валидацию по своим acceptance criteria

---

## 6. EVALUATION FRAMEWORKS

### Что НЕ работает для маркетинговых текстов

**ROUGE / BLEU:** измеряют n-gram overlap с эталонным текстом. Бесполезны если нет golden set. LangChain: «Traditional ML metrics — limited adoption».

**ROUGE применим только для:** резюмирования (есть эталон), извлечения фактов (есть эталонный список фактов).

### Что работает

| Метод | Применимость | Порог | Инструмент |
|-------|-------------|-------|-----------|
| LLM-as-judge (rubric) | Тон, стиль, соответствие АЦ | pass/fail по рубрике | Promptfoo, Ragas, DeepEval |
| Task completion | Выполнена ли задача (есть конкретный файл?) | 100% — нет файла = задача не выполнена | Ручная проверка |
| Argument correctness | Правильно ли агент вызвал tool? | Tool call accuracy ≥ 95% | DeepEval |
| Tool correctness | Совпадают ли вызовы с golden set? | Exact match | DeepEval |
| Human review | Финальная проверка | 59.8% организаций используют | н/д |
| Conversation completeness | Multi-turn: удовлетворена ли задача? | Pass/fail | DeepEval evaluate_thread() |

### Amazon Bedrock evaluation framework (2025)

Три первичных метрики:
1. **Correctness** — фактическая точность ответа
2. **Faithfulness** — соответствие источникам (не галлюцинирует?)
3. **Helpfulness** — помогает ли пользователю решить задачу?

Для маркетинговых артефактов: Faithfulness = «основано ли на ExtremeFest_Context.md, а не выдумано».

### Режимы оценки (из arxiv 2512.12791)

| Режим | Когда | Пример |
|-------|-------|--------|
| Static Analysis | До исполнения | Проверить что промпт содержит acceptance criteria |
| Dynamic Execution | Во время | Мониторить tool calls, нет ли нарушений |
| LLM-as-Judge | После | Оценить финальный артефакт по рубрике |
| Agent-as-Judge | Аудит | Отдельный агент тестирует другого через симуляцию |

---

## 7. ПАТТЕРНЫ ИЗ CREWAI / LANGGRAPH / AGENCY SWARM

### CrewAI: Task Validation через Pydantic

**Проблема:** без явной структуры агент возвращает free-form text, который нельзя программно верифицировать.

**Решение:**
```python
from pydantic import BaseModel

class PostDraft(BaseModel):
    vk_text: str          # 800-1000 символов
    tg_text: str          # 200-300 символов
    forbidden_words_check: bool  # True = нет запрещённых слов
    has_cta: bool         # True = есть призыв к действию
    source_facts: list[str]  # список фактов с источниками

task = Task(
    description="...",
    output_pydantic=PostDraft
)
```

Без `output_pydantic` — агент возвращает что угодно. С ним — структурированный верифицируемый output.

**Information Degradation — митигация в CrewAI:**
- Передавай оригинальный acceptance criteria каждому агенту в цепочке явно
- Не полагайся на то, что предыдущий агент «передаст» цели корректно

### LangGraph: Explicit Validation Nodes

LangGraph позволяет добавить validation node между любыми агентами:

```
Writer Node → [Validation Node] → Critic Node → [Approval Gate] → Done
                    ↓ fail
               Writer Node (retry)
```

Validation Node проверяет:
- Структура соответствует Pydantic-схеме?
- Все обязательные поля заполнены?
- Нет запрещённых слов?

Если нет — автоматический retry. LangGraph делает retry loops явными и аудируемыми.

### Agency Swarm: Tool Isolation

Каждый агент — строго изолированный набор инструментов. Нет пересечения = нет путаницы «какой инструмент использовать».

Паттерн для quality: отдельный «QA Agent» с единственным инструментом `validate_artifact(artifact_id, criteria)`.

### Human-in-the-Loop: когда подключать человека

| Триггер | Действие | Реализация |
|---------|---------|-----------|
| Confidence score < порога | Эскалация на ревью | LangGraph: conditional edge |
| Действие необратимо (публикация, отправка партнёру) | Обязательное подтверждение | Approval gate |
| Регуляторный/репутационный риск | Стоп + алерт | Master / Олег Грановский |
| Конфликт данных | Ожидание разъяснения | Paperclip: блокер |
| Несколько measurement failures | Escalate, не retry | DimensionAwareFilter |

**Ключевое правило (Orkes.io, 2025):** High escalation rate = агент плохо откалиброван. Мониторь % задач, уходящих на human review — если > 20%, переписывай acceptance criteria.

---

## 8. ПРИМЕНЕНИЕ К СИСТЕМЕ ЭСТРИМ ФЕСТА

### Текущие проблемы (из задания)

| Проблема | Диагноз | Решение |
|---------|---------|---------|
| Артефакты без критериев приёмки | Нет prompt contract — агент не знает что «готово» | Добавить Acceptance Criteria секцию в каждый системный промпт |
| Непонятная польза артефакта | Нет поля «зачем нужен артефакт» в промпте | Добавить: «Этот артефакт нужен чтобы [конкретное действие Жени]» |
| Нет связи между артефактами | Нет фронтматтера с depends_on | Стандартизировать шаблон фронтматтера (см. раздел 5) |

### Минимальный viable improvement

1. **В каждый системный промпт агента добавить секцию «Acceptance Criteria»** — 5-7 конкретных, измеримых критериев с pass/fail.

2. **Обязать агента вернуть `self_check` в output** — JSON с вердиктом по каждому критерию.

3. **Critic-агент оценивает по рубрике, не интуитивно** — 5 измерений с весами, DimensionAwareFilter.

4. **Фронтматтер каждого .md файла** — кто создал, на что опирается, acceptance criteria.

5. **Approval gate перед публикацией / отправкой партнёру** — человек (Женя) видит self_check агента и рубрику critic.

### Пример: как должна выглядеть задача для content-ops

```markdown
Задача: черновик поста ВК «Группа недели» для группы Master

Контекст:
- Опирайся на: context/ExtremeFest_Context.md (раздел Лайнап)
- Рубрика: S-01 из context/smm-karta-kommunikatsiy.md
- Сегмент: «Свои в тусовке» (AJTBD)

Acceptance Criteria (все должны быть выполнены):
- [ ] Объём: 800-1000 знаков
- [ ] Тон: разговорный, «как друг за пивом», НЕ официальный
- [ ] Запрещённые слова: уникальный, качественный, незабываемый, AI-текст
- [ ] Обязательно: конкретный факт о группе (год основания, тур, альбом)
- [ ] Обязательно: дата «11 июля» и «Москва»
- [ ] Master / Олег Грановский: только уважительно

Формат output:
{
  "vk_text": "...",
  "self_check": {
    "volume": {"pass": true, "chars": 923},
    "tone": {"pass": true, "evidence": "цитата из текста"},
    "forbidden_words": {"pass": true, "found": []},
    "has_fact": {"pass": true, "fact": "Master основаны в 1990..."},
    "has_date": {"pass": true},
    "master_respect": {"pass": true}
  }
}
```

---

## ИСТОЧНИКИ

1. [LangChain State of Agent Engineering](https://www.langchain.com/state-of-agent-engineering) — 32% quality barrier, eval methods stats
2. [Promptfoo: LLM Rubric](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/) — acceptance criteria, pass/fail format
3. [Ragas: Rubrics-Based Evaluation](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/rubrics_based/) — DomainSpecificRubrics vs InstanceSpecificRubrics
4. [AdaRubric: Task-Adaptive Rubrics for LLM Agent Evaluation](https://arxiv.org/html/2603.21362) — dynamic rubrics, DimensionAwareFilter, Krippendorff α
5. [LLM4Review: Multi-Agent Peer Review Framework](https://openreview.net/forum?id=7dJ7BFv9AT) — Author→Reviewer→Reviser→Meta-Reviewer
6. [ICLR 2025: LLM feedback on 20K reviews](https://arxiv.org/abs/2504.09737) — 27% update rate, 12K suggestions
7. [Beyond Task Completion: Assessment Framework for Agentic AI](https://arxiv.org/html/2512.12791v1) — 4 pillars, 100% completion / 33% policy adherence paradox
8. [LLM-As-Judge: 7 Best Practices](https://www.montecarlodata.com/blog-llm-as-judge/) — integer scoring, step decomposition, bias types
9. [AI Agent Evaluation: Definitive Guide (Confident AI)](https://www.confident-ai.com/blog/definitive-ai-agent-evaluation-guide) — Task completion, argument correctness, tool correctness metrics
10. [PROV-AGENT: Provenance for Agentic Workflows](https://arxiv.org/abs/2508.02866) — W3C PROV extension, tool call traceability
11. [LangGraph vs CrewAI Production 2026](https://markaicode.com/vs/langgraph-vs-crewai-multi-agent-production/) — Information Degradation pattern
12. [Human-in-the-Loop Approval Gate](https://www.stackai.com/insights/human-in-the-loop-ai-agents-how-to-design-approval-workflows-for-safe-and-scalable-automation) — escalation triggers, approval patterns
13. [Rubric-Based Evaluation for Agentic Systems](https://medium.com/@aiforhuman/rubric-based-evaluation-for-agentic-systems-db6cb14d8526) — adaptive vs static rubrics, three-stage maturation
