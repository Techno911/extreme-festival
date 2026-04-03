---
name: validate-idea
description: "Validate a marketing idea through 3-role critic review"
argument-hint: "[idea text or voice transcript]"
---
Валидация идеи через critic.

1. Получить идею ($ARGUMENTS)
2. Запусти Agent(critic) с текстом идеи
3. Вернуть вердикт: ✅/⚠️/❌ + рекомендации
4. Если ✅ — предложить следующий шаг (какой агент берёт в работу)
