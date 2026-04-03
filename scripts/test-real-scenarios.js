'use strict';

const fs = require('fs');
const path = require('path');

// ============================================================
// New routing logic: TOPIC_MAP + OPS_MAP + ACTION vs QUERY
// Mirrors bot.js v4 (agent platform)
// ============================================================

const ACTION_VERBS = ['напиши', 'сгенерируй', 'создай', 'подготовь', 'сделай',
  'проведи', 'исследуй', 'найди', 'собери', 'проверь', 'оцени', 'валидируй',
  'обнови', 'доработай', 'разработай', 'составь', 'придумай', 'переделай',
  'переработай', 'дополни', 'улучши'];

function isActionRequest(text) {
  const low = text.toLowerCase();
  return ACTION_VERBS.some(v => low.includes(v));
}

function detectAgentType(text) {
  const low = text.toLowerCase();
  if (low.includes('исследу') || low.includes('найди') || low.includes('собери') || low.includes('монитор') || low.includes('бенчмарк')) return 'researcher';
  if (low.includes('провер') || low.includes('оцени') || low.includes('валидируй') || low.includes('критик')) return 'critic';
  if (low.includes('пост') || low.includes('черновик') || low.includes('контент') || low.includes('адаптируй')) return 'content-ops';
  return 'writer';
}

const TOPIC_MAP = [
  { keywords: ['план продаж', 'продажи билет', 'помесячн план', 'целевые показател', 'продаж билет', 'выручк'], queryRoute: 'QUERY:г-план-продаж-билетов.md', agentType: 'writer' },
  { keywords: ['рекламный бюджет', 'бюджет канал', 'сколько тратить', 'рекламны расход', 'бюджет продвижени'], queryRoute: 'QUERY:в-рекламный-бюджет.md', agentType: 'writer' },
  { keywords: ['анализ рынк', 'конкурент', 'скрежет'], queryRoute: 'QUERY:б-анализ-рынка.md', agentType: 'researcher' },
  { keywords: ['бриф сайт', 'тендер сайт', 'лендинг', 'tilda', 'тильда'], queryRoute: 'QUERY:д-сайт-тендерный-пакет.md', agentType: 'writer' },
  { keywords: ['трейлер', 'видеоролик', 'ролик феста', 'бриф видео'], queryRoute: 'QUERY:е-трейлер-тендерный-пакет.md', agentType: 'writer' },
  { keywords: ['амбассадор', 'посол феста', 'леос', 'hell scream', 'кругляш'], queryRoute: 'QUERY:ж-амбассадоры.md', agentType: 'researcher' },
  { keywords: ['инфопартнёр', 'медиа партнёр', 'радиостанц', 'рок фм', 'наше радио'], queryRoute: 'QUERY:з-инфопартнёры.md', agentType: 'researcher' },
  { keywords: ['блогер', 'инфлюенсер', 'посев'], queryRoute: 'QUERY:и-блогеры.md', agentType: 'researcher' },
  { keywords: ['мерч', 'футболк', 'сувенир', 'мерчандайз'], queryRoute: 'QUERY:л-мерч.md', agentType: 'writer' },
  { keywords: ['календарный план', 'расписани', 'когда что'], queryRoute: 'QUERY:н-календарный-план.md', agentType: 'writer' },
  { keywords: ['система выбора подрядчик', 'подрядчик вообще'], queryRoute: 'QUERY:м-подрядчики.md', agentType: 'writer' },
  { keywords: ['контент-страт', 'контентная стратег', 'рубрик'], queryRoute: 'OPS:content', agentType: 'content-ops' },
  { keywords: ['сегмент', 'аудитори', 'jtbd', 'персон', 'позиционирован'], queryRoute: 'QUERY:а-стратегия.md', agentType: 'researcher' },
];

const OPS_MAP = [
  { keywords: ['дайджест', 'сводк', 'digest', 'утренний'], route: 'OPS:digest' },
  { keywords: ['контент план', 'план на неделю', 'что постим', 'что выходит'], route: 'OPS:content' },
  { keywords: ['черновик', 'драфт', 'согласован', 'на проверк', 'одобр'], route: 'OPS:drafts' },
  { keywords: ['задач', 'что делать', 'бэклог'], route: 'OPS:tasks' },
  { keywords: ['баланс', 'воронк'], route: 'OPS:balance' },
  { keywords: ['таблиц', 'sheet', 'гугл табл'], route: 'OPS:sheetLink' },
  { keywords: ['тендер', 'выбор подрядчик'], route: 'OPS:tender' },
  { keywords: ['статус', 'прогресс', 'готовност'], route: 'OPS:status' },
  { keywords: ['сколько продал', 'продано билет'], route: 'QUERY:г-план-продаж-билетов.md' },
  { keywords: ['cjm', 'воронка детально', 'покрытие s-id'], route: 'OPS:cjm' },
  { keywords: ['бюджет', 'расход', 'сколько потратил', 'остаток бюджет'], route: 'OPS:budget' },
  { keywords: ['помо', 'что умеешь', 'как работ', 'команд'], route: 'OPS:help' },
];

function simulateMessage(text) {
  const low = text.toLowerCase();
  const isAction = isActionRequest(low);

  // 1. TOPIC first (both action and query)
  const topicMatch = TOPIC_MAP.find(t => t.keywords.some(kw => low.includes(kw)));
  if (topicMatch) {
    if (isAction) {
      const detected = detectAgentType(low);
      const agentType = (detected !== 'writer') ? detected : topicMatch.agentType;
      return 'AGENT:' + agentType;
    }
    return topicMatch.queryRoute;
  }

  // 2. OPS (only if not action)
  const opsMatch = OPS_MAP.find(i => i.keywords.some(kw => low.includes(kw)));
  if (opsMatch && !isAction) return opsMatch.route;

  // 3. OPS match + action
  if (opsMatch) return opsMatch.route;

  // 4. Pure action, no topic
  if (isAction) {
    const agentType = detectAgentType(low);
    return 'AGENT:' + agentType;
  }

  return 'UNKNOWN';
}

// ============================================================
// TEST SCENARIOS (40 tests)
// ============================================================
const scenarios = [
  // ── Block 1: QUERY mode — read existing data (10 tests) ──
  { input: 'покажи анализ рынка', expected: 'QUERY:б-анализ-рынка.md', note: 'QUERY: no action verb → read file' },
  { input: 'что по амбассадорам', expected: 'QUERY:ж-амбассадоры.md', note: 'QUERY: "что по" → read' },
  { input: 'расскажи про мерч', expected: 'QUERY:л-мерч.md', note: 'QUERY' },
  { input: 'дай информацию по сегментам аудитории', expected: 'QUERY:а-стратегия.md', note: 'QUERY' },
  { input: 'кто инфопартнёры', expected: 'QUERY:з-инфопартнёры.md', note: 'QUERY' },
  { input: 'план продаж билетов', expected: 'QUERY:г-план-продаж-билетов.md', note: 'QUERY: no verb at all → read' },
  { input: 'что с трейлером', expected: 'QUERY:е-трейлер-тендерный-пакет.md', note: 'QUERY' },
  { input: 'какие блогеры подключены', expected: 'QUERY:и-блогеры.md', note: 'QUERY' },
  { input: 'покажи календарный план', expected: 'QUERY:н-календарный-план.md', note: 'QUERY' },
  { input: 'контент-стратегия', expected: 'OPS:content', note: 'QUERY → OPS handler' },

  // ── Block 2: ACTION mode — send to AI agent (10 tests) ──
  { input: 'сделай анализ рынка', expected: 'AGENT:researcher', note: 'ACTION: "сделай" + "анализ рынк" → researcher' },
  { input: 'проведи анализ рынка', expected: 'AGENT:researcher', note: 'ACTION: "проведи" → researcher (was BROKEN: read file)' },
  { input: 'напиши рекламный бюджет с попунктной разбивкой по каналам и инструментам продвижения', expected: 'AGENT:writer', note: 'ACTION: "напиши" → writer (was BROKEN: "Не понял")' },
  { input: 'сделай конкурентный анализ и покажи около похожих конкурентов', expected: 'AGENT:researcher', note: 'ACTION: "сделай" + "конкурент" → researcher' },
  { input: 'создай бриф для тендера сайта', expected: 'OPS:tender', note: '"тендера сайта" ≠ "тендер сайт" → OPS:tender matches "тендер"' },
  { input: 'исследуй блогеров в тг каналах о металле', expected: 'AGENT:researcher', note: 'ACTION: "исследуй" → researcher' },
  { input: 'напиши план продаж билетов с помесячной разбивкой', expected: 'AGENT:writer', note: 'ACTION: "напиши" → writer' },
  { input: 'проверь текст поста на качество', expected: 'AGENT:critic', note: 'ACTION: "проверь" → critic' },
  { input: 'подготовь черновик поста для вк', expected: 'OPS:drafts', note: '"черновик" in OPS → ops handler (use "создай пост для вк" for agent)' },
  { input: 'найди контакты радиостанций для инфопартнёрства', expected: 'AGENT:researcher', note: 'ACTION: "найди" → researcher' },

  // ── Block 3: OPS commands (8 tests) ──
  { input: 'баланс воронки', expected: 'OPS:balance', note: 'OPS' },
  { input: 'черновики на проверку', expected: 'OPS:drafts', note: 'OPS' },
  { input: 'статус проекта', expected: 'OPS:status', note: 'OPS' },
  { input: 'задачи в бэклоге', expected: 'OPS:tasks', note: 'OPS' },
  { input: 'открой таблицу', expected: 'OPS:sheetLink', note: 'OPS' },
  { input: 'утренний дайджест', expected: 'OPS:digest', note: 'OPS' },
  { input: 'cjm покрытие', expected: 'OPS:cjm', note: 'OPS' },
  { input: 'бюджет маркетинга', expected: 'OPS:budget', note: 'OPS' },

  // ── Block 4: Keyword collision (7 tests) ──
  { input: 'целевые показатели по продажам билетов', expected: 'QUERY:г-план-продаж-билетов.md', note: 'collision: no action verb → QUERY plan prodazh' },
  { input: 'стратегия продаж билетов помесячно', expected: 'QUERY:г-план-продаж-билетов.md', note: '"план продаж" first in TOPIC_MAP → QUERY' },
  { input: 'нужен помесячный план продаж билетов: целевые показатели по количеству проданных билетов на каждый месяц до даты фестиваля', expected: 'QUERY:г-план-продаж-билетов.md', note: 'no action verb → QUERY (was BROKEN: стратегия)' },
  { input: 'сколько продали билетов', expected: 'QUERY:г-план-продаж-билетов.md', note: '"сколько продал" → OPS sales' },
  { input: 'сделай помесячный план продаж билетов с целевыми показателями', expected: 'AGENT:writer', note: 'ACTION: "сделай" → agent writer' },
  { input: 'проведи мониторинг скрежета', expected: 'AGENT:researcher', note: 'ACTION: "проведи" + "скрежет" → researcher' },
  { input: 'создай стратегию продвижения', expected: 'AGENT:writer', note: 'ACTION but no topic match → free agent writer' },

  // ── Block 5: Edge cases (5 tests) ──
  { input: 'привет', expected: 'UNKNOWN', note: 'no keywords, no action' },
  { input: 'что умеешь', expected: 'OPS:help', note: 'help' },
  { input: 'тендер на сайт', expected: 'OPS:tender', note: 'OPS tender (no action)' },
  { input: 'напиши план продвижения фестиваля', expected: 'AGENT:writer', note: 'ACTION but "продвижени" only in budget → free agent' },
  { input: 'оцени идею с розыгрышем билетов в тг', expected: 'AGENT:critic', note: 'ACTION: "оцени" → critic' },
];

// ============================================================
// Runner
// ============================================================
let passed = 0;
let failed = 0;

console.log('\n======================================================================');
console.log('  ExtremeFest Bot — NLP Routing Tests v4 (ACTION vs QUERY)');
console.log('======================================================================\n');

for (let i = 0; i < scenarios.length; i++) {
  const s = scenarios[i];
  const actual = simulateMessage(s.input);
  const ok = actual === s.expected;
  if (ok) {
    passed++;
    console.log(`  ✅ #${i + 1}: ${s.input.substring(0, 60)}`);
  } else {
    failed++;
    console.log(`  ❌ #${i + 1}: ${s.input.substring(0, 60)}`);
    console.log(`     Expected: ${s.expected}`);
    console.log(`     Actual:   ${actual}`);
    if (s.note) console.log(`     Note: ${s.note}`);
  }
}

// ── Tactic files check ──
console.log('\n--- Tactic files ---');
const tacticDir = path.join(__dirname, '..', 'output', 'tactic');
const expectedFiles = ['а', 'б', 'в', 'г', 'д', 'е', 'ж', 'з', 'и', 'к', 'л', 'м', 'н'];
let filesFound = 0;
let filesMissing = 0;
if (fs.existsSync(tacticDir)) {
  const files = fs.readdirSync(tacticDir);
  for (const prefix of expectedFiles) {
    const found = files.some(f => f.startsWith(prefix));
    if (found) { filesFound++; console.log(`  ✅  ${prefix}-*.md`); }
    else { filesMissing++; console.log(`  ❌  ${prefix}-*.md MISSING`); }
  }
}

console.log('\n======================================================================');
console.log('  SUMMARY');
console.log('======================================================================\n');
console.log(`  Routing tests:  ${passed} passed / ${failed} failed / ${scenarios.length} total`);
console.log(`  Tactic files:   ${filesFound} found / ${filesMissing} missing / ${expectedFiles.length} total`);
console.log('');
if (failed === 0 && filesMissing === 0) {
  console.log('  ✅ ALL TESTS PASSED. All tactic files present.');
} else {
  console.log('  ❌ FAILURES DETECTED.');
  process.exit(1);
}
