'use strict';

/**
 * clear-and-remigrate.js
 * 1. Очищает demo-данные из Контентная (строки 4+) и тендерных листов (строки 6+)
 * 2. Мигрирует 25 черновиков ExtremeFest в новые таблицы
 */

const path = require('path');
const fs = require('fs');

const notifierDir = path.join(__dirname, '..', 'notifier');
require(path.join(notifierDir, 'node_modules', 'dotenv')).config({ path: path.join(notifierDir, '.env') });

const { google } = require(path.join(notifierDir, 'node_modules', 'googleapis'));
const TOKEN_PATH = path.join(notifierDir, '.google-token.json');
const CREDENTIALS_PATH = path.join(notifierDir, '.google-credentials.json');

const DRAFTS_DIR = path.join(__dirname, '../output/drafts');

const SMM_ID = process.env.GOOGLE_SPREADSHEET_ID;
const TENDER_ID = process.env.GOOGLE_TENDER_SPREADSHEET_ID;

function getAuthClient() {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const raw = creds.web || creds.installed;
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  const auth = new google.auth.OAuth2(raw.client_id, raw.client_secret);
  auth.setCredentials(tokens);
  return auth;
}

// ─── Parse draft ──────────────────────────────────────────────────────────────

function parseDraftFile(filePath, filename) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Date from filename
  const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  const dateStr = dateMatch ? dateMatch[1] : '';

  let date = '', day = '';
  if (dateStr) {
    const [y, m, d] = dateStr.split('-');
    date = `${d}.${m}.${y}`;
    const jsDay = new Date(dateStr).getDay();
    const ruDay = jsDay === 0 ? 6 : jsDay - 1;
    day = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][ruDay];
  }

  const meta = {};
  for (const line of lines) {
    const cleaned = line.replace(/^>\s*/, '').trim();
    if (cleaned.includes('Рубрика:')) meta.rubric = cleaned.replace('Рубрика:', '').replace(/\(.*\)/, '').trim();
    if (cleaned.includes('Платформа:')) {
      const p = cleaned.replace('Платформа:', '').trim();
      if (p.includes('ВКонтакте')) meta.format = 'Пост ВК';
      else if (p.includes('TG') || p.includes('ТГ')) meta.format = 'Пост ТГ';
      else meta.format = 'Пост';
    }
    if (cleaned.includes('S-ID:')) meta.sid = cleaned.replace('S-ID:', '').trim().split(' ')[0];
    if (cleaned.includes('AJTBD-сегмент:') || cleaned.includes('Сегмент:')) {
      meta.stage = cleaned.includes('Привлечение') ? 'Привлечение'
        : cleaned.includes('Прогрев') ? 'Прогрев'
        : cleaned.includes('Продажа') ? 'Продажа'
        : cleaned.includes('Лояльность') ? 'Лояльность' : '';
    }
  }

  if (!meta.stage && meta.rubric) {
    const r = meta.rubric.toLowerCase();
    if (r.includes('анонс') || r.includes('группа') || r.includes('скейт') || r.includes('логистик')) meta.stage = 'Привлечение';
    else if (r.includes('опрос') || r.includes('закулисье') || r.includes('партнёр') || r.includes('хедлайнер') || r.includes('площадка') || r.includes('комикс') || r.includes('скетч')) meta.stage = 'Прогрев';
    else if (r.includes('мерч') || r.includes('fomo') || r.includes('розыгрыш') || r.includes('билет')) meta.stage = 'Продажа';
    else if (r.includes('амбассадор') || r.includes('fast food') || r.includes('атмосфер')) meta.stage = 'Прогрев';
  }

  if (!meta.sid && meta.rubric) {
    const SID_MAP = {
      'Группа недели': 'S-01', 'Анонс лайнапа': 'S-01', 'Extreme Opros': 'S-10',
      'Атмосфера': 'S-09', 'Скейт': 'S-16', 'Fast Food': 'S-16',
      'Продажа FOMO': 'S-12', 'Скетч Оли': 'S-04', 'Мерч': 'S-14',
      'Партнёр': 'S-11', 'Хедлайнер': 'S-01', 'Амбассадор': 'S-07',
      'Логистика': 'S-20', 'Розыгрыш': 'S-12', 'FAQ': 'S-20',
    };
    for (const [key, sid] of Object.entries(SID_MAP)) {
      if (meta.rubric.toLowerCase().includes(key.toLowerCase())) { meta.sid = sid; break; }
    }
  }

  // Title
  const titleLine = lines.find(l => l.startsWith('# Черновик поста'));
  const title = titleLine ? titleLine.replace(/^# Черновик поста[—\-–]\s*/i, '').trim() : filename;

  // Text
  let text = '';
  const separators = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') separators.push(i);
  }
  if (separators.length >= 2) {
    const textLines = lines.slice(separators[0] + 1, separators[1])
      .filter(l => l.trim() !== '' && !l.startsWith('>') && !l.startsWith('## ВАРИАНТ'));
    text = textLines.join('\n').trim().slice(0, 2000);
  }

  const sellingPart = text.includes('TicketsCloud') || text.includes('[ссылка')
    ? 'А→Б: читаю → покупаю билет'
    : text.includes('11 июля') ? 'А→Б: узнал → запомнил дату' : '';

  let mechanic = 'Органический пост';
  if (filename.includes('розыгрыш')) mechanic = 'Розыгрыш';
  if (filename.includes('опрос')) mechanic = 'Опрос / интерактив';
  if (filename.includes('fast-food')) mechanic = 'Рубрика / серия';
  if (filename.includes('партнёр')) mechanic = 'Партнёрский пост';
  if (filename.includes('амбассадор')) mechanic = 'Кругляшок амбассадора';

  const stageReach = { 'Привлечение': '3000', 'Прогрев': '2000', 'Продажа': '2500', 'Лояльность': '1500' };

  return {
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
    reachPlan: stageReach[meta.stage] || '2000',
    errPlan: '3%',
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const auth = getAuthClient();
  const sheetsApi = google.sheets({ version: 'v4', auth });

  console.log('\n========================================');
  console.log('  Очистка demo-данных + Миграция черновиков');
  console.log('========================================\n');

  // 1. Очищаем Контентная — строки 4-150 (удаляем stomatology sample)
  console.log('1. Очищаю demo-данные в «Контентная» (строки 4-150)...');
  await sheetsApi.spreadsheets.values.clear({
    spreadsheetId: SMM_ID,
    range: "'Контентная'!A4:Q150",
  });
  console.log('   ✅ Очищено\n');

  // 2. Очищаем demo-данные из каждого тендерного листа (строки 6-35)
  const tenderSheets = ['Тендер Трафик', 'Тендер Дизайн', 'Тендер Разработка', 'Тендер SMM', 'Тендер Видео'];
  console.log('2. Очищаю demo-данные в тендерных листах...');
  for (const sheetName of tenderSheets) {
    await sheetsApi.spreadsheets.values.clear({
      spreadsheetId: TENDER_ID,
      range: `'${sheetName}'!A6:Z35`,
    });
    console.log(`   ✅ «${sheetName}» — очищено`);
  }
  console.log();

  // 3. Мигрируем черновики ExtremeFest
  console.log('3. Мигрирую черновики ExtremeFest...\n');
  const files = fs.readdirSync(DRAFTS_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('ШАБЛОН') && f.match(/^\d{4}-/))
    .sort();

  console.log(`   Найдено ${files.length} файлов\n`);

  let row = 4; // Start at row 4
  let success = 0;
  let errors = 0;

  for (const filename of files) {
    const filePath = path.join(DRAFTS_DIR, filename);
    try {
      const post = parseDraftFile(filePath, filename);
      console.log(`   📝 ${post.date || '??'} | ${post.day || '-'} | ${post.rubric} | ${post.stage}`);

      const values = [[
        post.day || '',
        post.date || '',
        post.rubric || '',
        post.sid || '',
        post.stage || '',
        post.beacon || '',
        post.mediaLink || '',
        post.text || '',
        post.textGoal || '',
        post.selling || '',
        post.mechanic || '',
        post.format || '',
        post.reachPlan || '',
        '',           // реach fact
        post.errPlan || '',
        '',           // err fact
        'Черновик',
      ]];

      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: SMM_ID,
        range: `'Контентная'!A${row}:Q${row}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });

      row++;
      success++;
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`   ❌ ${filename}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`✅ Мигрировано: ${success} черновиков (строки 4-${row - 1})`);
  if (errors > 0) console.log(`❌ Ошибок: ${errors}`);

  console.log('\n========================================');
  console.log(`SMM: https://docs.google.com/spreadsheets/d/${SMM_ID}/edit`);
  console.log(`Тендеры: https://docs.google.com/spreadsheets/d/${TENDER_ID}/edit`);
  console.log('========================================\n');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
