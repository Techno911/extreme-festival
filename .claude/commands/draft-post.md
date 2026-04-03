---
name: draft-post
description: "Create a draft social media post for VK or TG"
argument-hint: "[rubric: band-intro|opros|behind-scenes|ticket-sale|countdown|partner|ambassador]"
---
Создать черновик поста.

Использует @.claude/skills/content-strategy/SKILL.md

1. Определи рубрику ($ARGUMENTS)
2. Запусти Agent(content-ops) — написать черновик по рубрике:
   - ВК: длинный (500-1500 зн.)
   - ТГ: короткий (200-500 зн.)
3. Запусти Agent(critic) — проверить тон (не AI, не фальшь, зайдёт скуфу?)
4. Вернуть правки content-ops если critic дал ⚠️/❌
5. Сохранить финал в output/drafts/[YYYY-MM-DD]-[рубрика].md
