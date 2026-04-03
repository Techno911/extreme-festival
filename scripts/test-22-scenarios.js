'use strict';

/**
 * test-22-scenarios.js
 * Прогоняет 22 тестовых сценария через логику бота без реального Telegram
 * Проверяет: NLP → правильный handler, тактика → правильный файл, агент → правильный тип
 */

const path = require('path');
const fs = require('fs');

const notifierDir = path.join(__dirname, '..', 'notifier');
require(path.join(notifierDir, 'node_modules', 'dotenv')).config({ path: path.join(notifierDir, '.env') });

// ─── Переиспользуем логику из bot.js без запуска Telegram ───────────────────

const TACTIC_DIR = path.join(__dirname, '../output/tactic');

// Копируем INTENT_MAP + detectAgentTask логику из bot.js
function detectAgentTask(text) {
  const low = text.toLowerCase();
  const isGenerate = ['напиши', 'сгенерируй', 'создай', 'подготовь', 'сделай',
    'проведи', 'исследуй', 'найди', 'собери', 'проверь', 'оцени', 'валидируй',
    'обнови', 'доработай'].some(v => low.includes(v));
  if (!isGenerate) return null;
  if (low.includes('исследу') || low.includes('найди') || low.includes('собери') || low.includes('монитор')) return 'researcher';
  if (low.includes('провер') || low.includes('оцени') || low.includes('валидируй') || low.includes('критик')) return 'critic';
  return 'writer';
}

const INTENT_MAP = [
  // Тактика
  { keywords: ['сегмент', 'аудитори', 'целев', 'jtbd', 'персон', 'стратеги'], route: 'TACTIC:а-стратегия.md' },
  { keywords: ['анализ рынк', 'конкурент', 'скрежет'], route: 'TACTIC:б-анализ-рынка.md' },
  { keywords: ['рекламный бюджет', 'бюджет канал', 'сколько тратить', 'рекламны расход'], route: 'TACTIC:в-рекламный-бюджет.md' },
  { keywords: ['план продаж', 'продажи билет', 'выручк', 'продаж билет'], route: 'TACTIC:г-план-продаж-билетов.md' },
  { keywords: ['бриф сайт', 'тендер сайт', 'лендинг', 'tilda', 'тильда'], route: 'TACTIC:д-сайт-тендерный-пакет.md' },
  { keywords: ['трейлер', 'видеоролик', 'ролик феста', 'бриф видео'], route: 'TACTIC:е-трейлер-тендерный-пакет.md' },
  { keywords: ['амбассадор', 'посол феста', 'леос', 'hell scream'], route: 'TACTIC:ж-амбассадоры.md' },
  { keywords: ['инфопартнёр', 'радиостанц', 'рок фм', 'наше радио', 'медиа партнёр'], route: 'TACTIC:з-инфопартнёры.md' },
  { keywords: ['блогер', 'инфлюенсер', 'посев', 'blogger'], route: 'TACTIC:и-блогеры.md' },
  { keywords: ['мерч', 'футболк', 'сувенир', 'мерчандайз'], route: 'TACTIC:л-мерч.md' },
  { keywords: ['календарный план', 'дедлайн', 'когда что'], route: 'TACTIC:н-календарный-план.md' },
  // Операции
  { keywords: ['контент', 'план на', 'публикаци', 'что постим', 'контент план'], route: 'OP:content' },
  { keywords: ['черновик', 'драфт', 'одобр', 'согласован'], route: 'OP:drafts' },
  { keywords: ['задач', 'что делать', 'на неделю'], route: 'OP:tasks' },
  { keywords: ['баланс', 'воронк', 'привлечен', 'прогрев'], route: 'OP:balance' },
  { keywords: ['таблиц', 'sheet', 'ссылк', 'гугл'], route: 'OP:sheet' },
  { keywords: ['тендер', 'подрядчик', 'выбор подрядчик'], route: 'OP:tender' },
  { keywords: ['статус', 'прогресс', 'готовност'], route: 'OP:status' },
  { keywords: ['продаж', 'билет', 'продано', 'сколько купил'], route: 'OP:sales' },
  { keywords: ['помо', 'что умеешь', 'команд'], route: 'OP:help' },
];

function simulateMessage(text) {
  const low = text.toLowerCase();

  // Агентская задача?
  const agent = detectAgentTask(text);
  if (agent) return `AGENT:${agent}`;

  // INTENT_MAP
  const matched = INTENT_MAP.find(intent =>
    intent.keywords.some(kw => low.includes(kw))
  );
  if (matched) return matched.route;
  return 'UNKNOWN';
}

function checkTacticFile(fileName) {
  return fs.existsSync(path.join(TACTIC_DIR, fileName)) ? '✅ файл есть' : '❌ файл отсутствует';
}

// ─── 22 сценария ─────────────────────────────────────────────────────────────

const SCENARIOS = [
  // БЛОК 1: Чтение разделов тактики
  { id: 1, input: 'дай сегменты аудитории', expect: 'TACTIC:а-стратегия.md', desc: 'Стратегия — сегменты' },
  { id: 2, input: 'кто конкуренты', expect: 'TACTIC:б-анализ-рынка.md', desc: 'Анализ рынка' },
  { id: 3, input: 'рекламный бюджет по каналам', expect: 'TACTIC:в-рекламный-бюджет.md', desc: 'Рекламный бюджет' },
  { id: 4, input: 'план продаж билетов по месяцам', expect: 'TACTIC:г-план-продаж-билетов.md', desc: 'План продаж' },
  { id: 5, input: 'бриф на сайт и лендинг', expect: 'TACTIC:д-сайт-тендерный-пакет.md', desc: 'Сайт' },
  { id: 6, input: 'концепция трейлера для феста', expect: 'TACTIC:е-трейлер-тендерный-пакет.md', desc: 'Трейлер' },
  { id: 7, input: 'кто амбассадоры, статус', expect: 'TACTIC:ж-амбассадоры.md', desc: 'Амбассадоры' },
  { id: 8, input: 'список инфопартнёров', expect: 'TACTIC:з-инфопартнёры.md', desc: 'Инфопартнёры' },
  { id: 9, input: 'какие блогеры в работе', expect: 'TACTIC:и-блогеры.md', desc: 'Блогеры' },
  { id: 10, input: 'что с мерчем и футболками', expect: 'TACTIC:л-мерч.md', desc: 'Мерч' },
  { id: 11, input: 'календарный план по дедлайнам', expect: 'TACTIC:н-календарный-план.md', desc: 'Календарный план' },

  // БЛОК 2: Операционные запросы
  { id: 12, input: 'покажи контент план на эту неделю', expect: 'OP:content', desc: 'Контент-план' },
  { id: 13, input: 'черновики для одобрения', expect: 'OP:drafts', desc: 'Черновики' },
  { id: 14, input: 'какие задачи на эту неделю', expect: 'OP:tasks', desc: 'Задачи' },
  { id: 15, input: 'баланс воронки', expect: 'OP:balance', desc: 'Баланс воронки' },
  { id: 16, input: 'ссылка на гугл таблицу', expect: 'OP:sheet', desc: 'Таблица' },
  { id: 17, input: 'статус тактики что готово', expect: 'OP:status', desc: 'Статус тактики' },
  { id: 18, input: 'сколько продали билетов', expect: 'OP:sales', desc: 'Продажи' },
  { id: 19, input: 'статус тендеров по подрядчикам', expect: 'OP:tender', desc: 'Тендеры' },

  // БЛОК 3: Агентские задачи
  { id: 20, input: 'исследуй конкурентов в треш-металле', expect: 'AGENT:researcher', desc: 'Задача researcher' },
  { id: 21, input: 'напиши пост про группу недели', expect: 'AGENT:writer', desc: 'Задача writer' },
  { id: 22, input: 'проверь бриф на трейлер', expect: 'AGENT:critic', desc: 'Задача critic' },
];

// ─── Запуск ───────────────────────────────────────────────────────────────────

function run() {
  console.log('\n' + '═'.repeat(70));
  console.log('  22 тестовых сценария — ExtremeFest Bot NLP');
  console.log('═'.repeat(70) + '\n');

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const s of SCENARIOS) {
    const result = simulateMessage(s.input);
    const ok = result === s.expect;
    if (ok) {
      passed++;
      process.stdout.write(`  ✅ #${String(s.id).padStart(2, '0')} ${s.desc}\n`);
    } else {
      failed++;
      failures.push(s);
      process.stdout.write(`  ❌ #${String(s.id).padStart(2, '0')} ${s.desc}\n`);
      console.log(`       Ввод:    «${s.input}»`);
      console.log(`       Ожидал: ${s.expect}`);
      console.log(`       Получил: ${result}`);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`  Результат: ${passed}/${SCENARIOS.length} прошли` + (failed > 0 ? ` | ${failed} упали` : ''));

  // Проверяем наличие файлов тактики
  console.log('\n  Проверка файлов тактики:');
  const tacticFiles = ['а-стратегия.md','б-анализ-рынка.md','в-рекламный-бюджет.md',
    'г-план-продаж-билетов.md','д-сайт-тендерный-пакет.md','е-трейлер-тендерный-пакет.md',
    'ж-амбассадоры.md','з-инфопартнёры.md','и-блогеры.md','к-контент-стратегия.md',
    'л-мерч.md','м-подрядчики.md','н-календарный-план.md'];
  for (const f of tacticFiles) {
    const exists = fs.existsSync(path.join(TACTIC_DIR, f));
    console.log(`    ${exists ? '✅' : '❌'} ${f}`);
  }

  console.log('\n' + '═'.repeat(70));
  if (failed === 0) {
    console.log('  🎉 Все 22 сценария прошли!');
  } else {
    console.log(`  ⚠️  ${failed} сценарий(ев) требуют исправления INTENT_MAP`);
  }
  console.log('═'.repeat(70) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

run();
