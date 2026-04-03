'use strict';

/**
 * Migrate existing draft posts from output/drafts/ to Google Sheet
 *
 * Usage: node scripts/migrate-drafts-to-sheet.js
 *
 * Reads all .md files from output/drafts/, parses metadata,
 * and writes them to the Контентная sheet as draft rows.
 * Skips ШАБЛОН files.
 */

const fs = require('fs');
const path = require('path');

const notifierDir = path.join(__dirname, '..', 'notifier');
require(path.join(notifierDir, 'node_modules', 'dotenv')).config({ path: path.join(notifierDir, '.env') });

const sheets = require(path.join(notifierDir, 'sheets'));

// ─── Draft directory ─────────────────────────────────────────────────────────

const DRAFTS_DIR = path.join(__dirname, '../output/drafts');

// ─── Parse draft file ─────────────────────────────────────────────────────────

/**
 * Parse a draft markdown file and extract metadata for Google Sheet
 */
function parseDraftFile(filePath, filename) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Parse date from filename (YYYY-MM-DD-slug.md)
  const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  const dateStr = dateMatch ? dateMatch[1] : '';

  // Convert date string to DD.MM.YYYY
  let date = '';
  if (dateStr) {
    const [y, m, d] = dateStr.split('-');
    date = `${d}.${m}.${y}`;
  }

  // Calculate week number (festival starts April 6, 2026 = Week 1)
  let week = '';
  let day = '';
  if (dateStr) {
    const festStart = new Date('2026-04-06');
    const postDate = new Date(dateStr);
    const diffDays = Math.floor((postDate - festStart) / 86400000);
    if (diffDays >= 0) {
      week = String(Math.floor(diffDays / 7) + 1);
      const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      const jsDay = postDate.getDay(); // 0=Sun
      const ruDay = jsDay === 0 ? 6 : jsDay - 1;
      day = dayNames[ruDay];
    } else {
      // Pre-festival drafts (March)
      week = '0';
      day = '';
    }
  }

  // Parse header block (lines starting with >)
  const meta = {};
  for (const line of lines) {
    const cleaned = line.replace(/^>\s*/, '').trim();

    if (cleaned.includes('Рубрика:')) {
      meta.rubric = cleaned.replace('Рубрика:', '').replace(/\(.*\)/, '').trim();
    }
    if (cleaned.includes('Платформа:')) {
      const p = cleaned.replace('Платформа:', '').trim();
      // Extract primary platform
      if (p.includes('ВКонтакте')) meta.format = 'Пост ВК';
      else if (p.includes('TG') || p.includes('ТГ')) meta.format = 'Пост ТГ';
      else meta.format = 'Пост';
    }
    if (cleaned.includes('S-ID:')) {
      meta.sid = cleaned.replace('S-ID:', '').trim().split(' ')[0];
    }
    if (cleaned.includes('AJTBD-сегмент:') || cleaned.includes('Сегмент:')) {
      meta.stage = cleaned.includes('Привлечение') ? 'Привлечение'
        : cleaned.includes('Прогрев') ? 'Прогрев'
        : cleaned.includes('Продажа') ? 'Продажа'
        : cleaned.includes('Лояльность') ? 'Лояльность'
        : '';
    }
  }

  // Infer stage from rubric name if not found in meta
  if (!meta.stage && meta.rubric) {
    const r = meta.rubric.toLowerCase();
    if (r.includes('анонс') || r.includes('группа недели') || r.includes('скейт') || r.includes('логистик')) {
      meta.stage = 'Привлечение';
    } else if (r.includes('опрос') || r.includes('закулисье') || r.includes('партнёр') || r.includes('хедлайнер') || r.includes('площадка') || r.includes('комикс') || r.includes('скетч')) {
      meta.stage = 'Прогрев';
    } else if (r.includes('мерч') || r.includes('fomo') || r.includes('розыгрыш') || r.includes('bilety') || r.includes('билеты')) {
      meta.stage = 'Продажа';
    } else if (r.includes('амбассадор') || r.includes('fast food') || r.includes('атмосфер')) {
      meta.stage = 'Прогрев';
    }
  }

  // Infer S-ID from rubric if not found
  if (!meta.sid && meta.rubric) {
    const SID_MAP = {
      'Группа недели': 'S-01',
      'Анонс лайнапа': 'S-01',
      'Extreme Opros': 'S-10',
      'Атмосфера': 'S-09',
      'Скейт': 'S-16',
      'Fast Food': 'S-16',
      'Продажа FOMO': 'S-12',
      'Скетч Оли': 'S-04',
      'Мерч': 'S-14',
      'Партнёр': 'S-11',
      'Хедлайнер': 'S-01',
      'Амбассадор': 'S-07',
      'Логистика': 'S-20',
      'Розыгрыш': 'S-12',
      'FAQ': 'S-20',
    };
    for (const [key, sid] of Object.entries(SID_MAP)) {
      if (meta.rubric.toLowerCase().includes(key.toLowerCase())) {
        meta.sid = sid;
        break;
      }
    }
  }

  // Extract title from H1
  const titleLine = lines.find(l => l.startsWith('# Черновик поста'));
  const title = titleLine ? titleLine.replace(/^# Черновик поста[—\-–]\s*/i, '').trim() : filename;

  // Extract main post text (first variant after ---\n\n)
  let text = '';
  const separators = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') separators.push(i);
  }

  if (separators.length >= 2) {
    // Text is between first and second ---
    const start = separators[0] + 1;
    const end = separators[1];
    const textLines = lines.slice(start, end).filter(l => l.trim() !== '' && !l.startsWith('>') && !l.startsWith('## ВАРИАНТ'));
    text = textLines.join('\n').trim().slice(0, 2000); // Limit for Sheet cell
  }

  // Derive selling part (продающая часть) from text
  const sellingPart = text.includes('TicketsCloud') || text.includes('[ссылка')
    ? 'А→Б: читаю → покупаю билет'
    : text.includes('дата') || text.includes('11 июля')
    ? 'А→Б: узнал → запомнил дату'
    : '';

  // Derive mechanic
  let mechanic = 'Органический пост';
  if (filename.includes('розыгрыш')) mechanic = 'Розыгрыш';
  if (filename.includes('опрос')) mechanic = 'Опрос / интерактив';
  if (filename.includes('fast-food')) mechanic = 'Рубрика / серия';
  if (filename.includes('серия')) mechanic = 'Рубрика / серия';
  if (filename.includes('партнёр')) mechanic = 'Партнёрский пост';
  if (filename.includes('амбассадор')) mechanic = 'Кругляшок амбассадора';

  return {
    week,
    day,
    date,
    rubric: meta.rubric || title,
    sid: meta.sid || '',
    stage: meta.stage || '',
    beacon: '',
    mediaLink: '',
    text,
    textGoal: title,
    selling: sellingPart,
    mechanic,
    format: meta.format || 'Пост ВК',
    reachPlan: getReachPlan(meta.stage),
    errPlan: '3%',
  };
}

/**
 * Planned reach by funnel stage
 */
function getReachPlan(stage) {
  switch (stage) {
    case 'Привлечение': return '3000';
    case 'Прогрев': return '2000';
    case 'Продажа': return '2500';
    case 'Лояльность': return '1500';
    default: return '2000';
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!sheets.isConfigured()) {
    console.error('❌ Google Sheets не настроен. Запустите: node scripts/google-auth-setup.js');
    process.exit(1);
  }

  const files = fs.readdirSync(DRAFTS_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('ШАБЛОН') && f.match(/^\d{4}-/))
    .sort();

  console.log(`\n📂 Найдено ${files.length} черновиков для миграции\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const filename of files) {
    const filePath = path.join(DRAFTS_DIR, filename);

    try {
      const post = parseDraftFile(filePath, filename);

      console.log(`📝 ${filename}`);
      console.log(`   Рубрика: ${post.rubric}`);
      console.log(`   Дата: ${post.date} (нед ${post.week}, ${post.day})`);
      console.log(`   Этап: ${post.stage} | S-ID: ${post.sid} | Формат: ${post.format}`);

      const rowIndex = await sheets.addDraftPost(post);

      if (rowIndex > 0) {
        console.log(`   ✅ Записан в строку ${rowIndex}\n`);
        successCount++;
      } else {
        console.log(`   ⚠️  Не удалось записать (возможно Sheet не настроен)\n`);
        errorCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));

    } catch (err) {
      console.error(`   ❌ Ошибка: ${err.message}\n`);
      errorCount++;
    }
  }

  console.log('─────────────────────────────────────────');
  console.log(`✅ Успешно: ${successCount}`);
  if (errorCount > 0) console.log(`❌ Ошибки: ${errorCount}`);
  console.log('\n🎯 Миграция завершена!');
  console.log('Откройте Google Sheet и проверьте лист «Контентная»');
  if (process.env.GOOGLE_SPREADSHEET_ID) {
    console.log(`🔗 https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SPREADSHEET_ID}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
