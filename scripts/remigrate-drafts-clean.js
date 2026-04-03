'use strict';
const path = require('path');
const fs = require('fs');
const notifierDir = path.join(__dirname, '..', 'notifier');
require(path.join(notifierDir, 'node_modules', 'dotenv')).config({ path: path.join(notifierDir, '.env') });
const { google } = require(path.join(notifierDir, 'node_modules', 'googleapis'));
const TOKEN_PATH = path.join(notifierDir, '.google-token.json');
const CREDENTIALS_PATH = path.join(notifierDir, '.google-credentials.json');

function getAuth() {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const raw = creds.web || creds.installed;
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  const auth = new google.auth.OAuth2(raw.client_id, raw.client_secret);
  auth.setCredentials(tokens);
  return auth;
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const DRAFTS_DIR = path.join(__dirname, '..', 'output', 'drafts');

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function getRubric(filename) {
  const f = filename.toLowerCase();
  if (f.includes('анонс-лайнапа')) return 'Презентация группы';
  if (f.includes('группа-недели')) return 'Презентация группы';
  if (f.includes('хедлайнер')) return 'Презентация группы';
  if (f.includes('extreme-opros')) return 'Extreme Opros';
  if (f.includes('скейт')) return 'Скейт + экстрим';
  if (f.includes('закулисье') || f.includes('backstage')) return 'Закулисье / организация';
  if (f.includes('площадка')) return 'Закулисье / организация';
  if (f.includes('партнёр') || f.includes('ernie')) return 'Закулисье / организация';
  if (f.includes('логистика') || f.includes('faq')) return 'Логистика / FAQ';
  if (f.includes('мерч')) return 'Мерч-витрина';
  if (f.includes('розыгрыш')) return 'Розыгрыш / FOMO';
  if (f.includes('скетч') || f.includes('комикс')) return 'Комикс с маскотами';
  if (f.includes('fast-food')) return 'Атмосфера / вайб';
  if (f.includes('атмосфера')) return 'Атмосфера / вайб';
  if (f.includes('last-call') || f.includes('fomo')) return 'Обратный отсчёт';
  return 'Атмосфера / вайб';
}

function extractMeta(content, patterns) {
  for (const pat of patterns) {
    const re = new RegExp(pat + '\\s*(.+)', 'i');
    const m = content.match(re);
    if (m) return m[1].trim().replace(/\*\*/g, '');
  }
  return '';
}

function extractTitle(content) {
  // Look for H1: # Черновик поста — TITLE  or  # Черновик: TITLE
  const m = content.match(/^#\s+Черновик[^—\-:]*[—\-:]\s*(.+)/m);
  if (m) return m[1].trim();
  // Fallback: first H1
  const h1 = content.match(/^#\s+(.+)/m);
  if (h1) return h1[1].trim();
  return '';
}

function parseDraft(filename) {
  // Only process date-prefixed .md files
  const dateMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})-/);
  if (!dateMatch) return null;

  const [, yyyy, mm, dd] = dateMatch;
  const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const dayOfWeek = DAY_NAMES[dateObj.getDay()];
  const dateFormatted = `${dd}.${mm}`;

  const filePath = path.join(DRAFTS_DIR, filename);
  const content = fs.readFileSync(filePath, 'utf8');

  const title = extractTitle(content);
  const sid = extractMeta(content, ['>\\s*S-ID:', 'S-ID:', '\\*\\*S-ID:\\*\\*']);
  const stage = extractMeta(content, ['>\\s*Этап:', 'Этап:', '\\*\\*Этап:\\*\\*']);
  const selling = extractMeta(content, ['>\\s*Продающая:', '\\*\\*Продающая часть:\\*\\*', '\\*\\*Продающая:\\*\\*', 'Продающая:']);
  const format = extractMeta(content, ['>\\s*Формат:', '\\*\\*Формат:\\*\\*', 'Формат:']);
  const rubric = getRubric(filename);

  return {
    dayOfWeek,
    dateFormatted,
    dateSortKey: `${yyyy}-${mm}-${dd}`,
    rubric,
    sid,
    stage,
    title,
    filename,
    selling,
    format: format || 'Пост ВК',
  };
}

async function main() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // Step 1: Clear old data
  console.log('Clearing Контентная!A4:Q150...');
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Контентная!A4:Q150',
  });
  console.log('Cleared.');

  // Step 2: Read draft files
  const files = fs.readdirSync(DRAFTS_DIR).filter(f => f.endsWith('.md'));
  console.log(`Found ${files.length} .md files in drafts/`);

  // Step 3-5: Parse each file
  const rows = [];
  for (const file of files) {
    const parsed = parseDraft(file);
    if (!parsed) {
      console.log(`  Skipped (no date): ${file}`);
      continue;
    }
    rows.push(parsed);
  }

  // Step 7: Sort by date
  rows.sort((a, b) => a.dateSortKey.localeCompare(b.dateSortKey));

  // Step 6: Build sheet rows
  const sheetData = rows.map(r => [
    r.dayOfWeek,         // A
    r.dateFormatted,     // B
    r.rubric,            // C
    r.sid,               // D
    r.stage,             // E
    '',                  // F: маяк
    '',                  // G: ссылка на медиа
    r.title,             // H: title ONLY, one line
    r.filename,          // I: filename
    r.selling,           // J: selling part
    'Органический пост', // K: mechanic
    r.format,            // L: format
    '3000',              // M: reach plan
    '',                  // N: reach fact
    '3,0%',              // O: ERR plan
    '',                  // P: ERR fact
    '',                  // Q: status
  ]);

  // Step 8: Write
  const range = `Контентная!A4:Q${4 + sheetData.length - 1}`;
  console.log(`Writing ${sheetData.length} rows to ${range}...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: sheetData },
  });

  // Step 9: Summary
  const firstDate = rows[0]?.dateFormatted || '?';
  const lastDate = rows[rows.length - 1]?.dateFormatted || '?';
  console.log(`\nDone! ${sheetData.length} rows written.`);
  console.log(`Date range: ${firstDate} — ${lastDate}`);
  console.log('\nRows:');
  sheetData.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r[1]} ${r[0]} | ${r[2]} | ${r[7]}`);
  });
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
