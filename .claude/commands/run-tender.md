---
name: run-tender
description: "Launch a tender process for a contractor (site, trailer, merch, etc.)"
argument-hint: "[type: site|trailer|merch|video|design]"
---
Запуск тендерного процесса.

Использует @.claude/skills/tender-process/SKILL.md

1. Определи тип тендера ($ARGUMENTS)
2. Запусти Agent(researcher) — найти 30+ подрядчиков с контактами и ценами
3. Запусти Agent(writer) с skill tender-process — создать полный пакет:
   - Маркетинговый бриф (шаблон из references/brief-template.md)
   - Письмо первого контакта
   - Таблица скоринга (criteria из references/scoring-criteria.md)
   - Критерии отсева
   - Формула автоскоринга цены
   - Шаблон обоснования выбора
   - Чеклист онбординга
4. Сохранить пакет в output/tactic/ (раздел б или в)
5. Вывести: список подрядчиков, готовый пакет, следующий шаг (кому писать первому)
