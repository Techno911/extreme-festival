---
name: html-report
description: "Use when generating an HTML dashboard of the marketing tactic — 14 sections with statuses, checkpoints, links to Google Sheets, and a bot action button. Dark metal theme. Output goes to output/reports/tactic-YYYY-MM-DD.html"
context: fork
---
# HTML Report Generator

## Когда использовать

Когда Женя просит «покажи статус тактики», «сделай дашборд», «HTML-отчёт» или «что сделано».
CMO генерирует HTML-файл из текущего состояния `output/tactic/` и `output/research/`.

## Структура HTML-файла

Базовый шаблон: @references/template.html

### Навигация (14 разделов)

| ID | Раздел | Файл-источник |
|----|--------|--------------|
| а | Стратегия | output/tactic/а-стратегия.md |
| б | Анализ рынка | output/tactic/б-анализ-рынка.md |
| в | Трейлер | output/tactic/в-трейлер-тендерный-пакет.md |
| г | Амбассадоры | output/tactic/г-амбассадоры.md |
| д | Сайт | output/tactic/д-сайт-тендерный-пакет.md |
| е | Трейлер-концепция | output/tactic/е-трейлер-концепция.md |
| ж | Амбассадоры-пайплайн | output/tactic/ж-амбассадоры-пайплайн.md |
| з | Инфопартнёры | output/tactic/з-инфопартнёры.md |
| и | Блогеры | output/tactic/и-блогеры.md |
| к | Контент-стратегия | output/tactic/к-контент-стратегия.md |
| л | Мерч | output/tactic/л-мерч.md |
| м | Подрядчики | output/tactic/м-подрядчики.md |
| н | Календарный план | output/tactic/н-календарный-план.md |
| о | Бюджет | output/tactic/о-бюджет.md |

### Статусы разделов (определяются по наличию файла)

| Статус | CSS-класс | Иконка | Условие |
|--------|----------|--------|---------|
| Готово | `status-done` | ✅ | Файл существует, >500 символов |
| В работе | `status-wip` | 🔄 | Файл существует, <500 символов |
| Не начато | `status-todo` | ⬜ | Файл отсутствует |
| Требует проверки | `status-review` | 👁 | Задан вручную в конфиге |

### Блоки каждого раздела

```
[Заголовок раздела] [Статус-бейдж]
├─ Краткое содержание (первые 3 абзаца из .md)
├─ Чекпоинты (извлечь чеклисты - [ ] / - [x] из файла)
├─ KPI раздела (строки содержащие ₽, %, дату)
└─ [Кнопка: Доработать через бот →]
```

## Алгоритм генерации

```javascript
// Псевдокод для CMO
1. Прочитать список файлов output/tactic/*.md
2. Для каждого раздела:
   a. Проверить существование файла → статус
   b. Извлечь первые 300 символов → превью
   c. Найти строки "- [ ]" и "- [x]" → чекпоинты
   d. Найти строки с ₽/% → KPI
3. Посчитать прогресс: done/total × 100
4. Вставить всё в шаблон (@references/template.html)
5. Сохранить в output/reports/tactic-YYYY-MM-DD.html
6. Вывести путь к файлу в stdout
```

## CSS — тёмная метал-эстетика

```css
/* Основные цвета */
--bg-primary:    #0d0d0d;   /* почти чёрный фон */
--bg-card:       #1a1a1a;   /* карточки */
--bg-nav:        #111111;   /* сайдбар */
--accent:        #cc0000;   /* красный акцент — металл */
--accent-hover:  #ff1a1a;
--text-primary:  #e8e8e8;
--text-muted:    #888888;
--border:        #2a2a2a;
--done-color:    #2d7a2d;   /* тёмно-зелёный */
--wip-color:     #7a5c2d;   /* тёмно-оранжевый */
--todo-color:    #3a3a3a;   /* серый */

/* Шрифт */
font-family: 'Courier New', Courier, monospace; /* моноширинный = технарский вид */
```

## JavaScript — навигация и прогресс

```javascript
// Плавная прокрутка к разделу
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    target?.scrollIntoView({ behavior: 'smooth' });
    // Подсветить активный пункт
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
  });
});

// Прогресс-бар (считается из data-атрибутов)
const done = document.querySelectorAll('[data-status="done"]').length;
const total = document.querySelectorAll('[data-status]').length;
document.getElementById('progress-bar').style.width = (done / total * 100) + '%';
document.getElementById('progress-text').textContent = `${done}/${total} разделов`;

// Кнопка "Доработать через бот" — копирует команду в буфер
document.querySelectorAll('.bot-action-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.dataset.cmd;
    navigator.clipboard.writeText(cmd);
    btn.textContent = 'Скопировано ✓';
    setTimeout(() => btn.textContent = 'Доработать через бот →', 2000);
  });
});
```

## Сохранение и вывод

```
output/reports/tactic-YYYY-MM-DD.html
```

После генерации вывести в stdout:
```
✅ HTML-отчёт создан: output/reports/tactic-2026-04-03.html
   Готово: X/14 разделов (X%)
   Откройте файл в браузере: open output/reports/tactic-2026-04-03.html
```

## Gotchas

- Не встраивай внешние CDN/шрифты — файл должен открываться офлайн
- Изображения — нет. Только текст и CSS
- Ссылка на Google Sheets — из переменной окружения `GOOGLE_SPREADSHEET_ID` в `.env`
- Кнопка бота копирует команду вида: «доработай раздел [X] тактики»
- Файл открывается через `open output/reports/tactic-*.html` в MacOS Terminal
