---
name: generate-tactic
description: "Generate a section of the marketing tactic document"
argument-hint: "[section: a|b|c|d|e|f|g|h|i|k]"
---
Генерация раздела маркетинговой тактики.

1. Определи какой раздел нужен ($ARGUMENTS)
2. Запусти Agent(researcher) — собрать данные для раздела
3. Запусти Agent(writer) — написать раздел на основе данных researcher'а
4. Запусти Agent(critic) — валидация в 3 ролях
5. Если critic дал ⚠️/❌ — вернуть writer'у с правками
6. Сохранить финальную версию в output/tactic/
7. Вывести summary: что написано, что валидировано, какие замечания
