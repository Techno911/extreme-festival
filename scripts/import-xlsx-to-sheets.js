'use strict';

/**
 * import-xlsx-to-sheets.js
 * Загружает эталонные xlsx-файлы в Google Drive как нативные Google Sheets
 * Сохраняет новые ID в notifier/.env
 */

const path = require('path');
const fs = require('fs');

const notifierDir = path.join(__dirname, '..', 'notifier');

require(path.join(notifierDir, 'node_modules', 'dotenv')).config({
  path: path.join(notifierDir, '.env'),
});

const { google } = require(path.join(notifierDir, 'node_modules', 'googleapis'));

const TOKEN_PATH = path.join(notifierDir, '.google-token.json');
const CREDENTIALS_PATH = path.join(notifierDir, '.google-credentials.json');
const ENV_PATH = path.join(notifierDir, '.env');

const XLSX_SMM = '/Users/techno/Downloads/Чирков и партнеры. SMM-система 3.7.xlsx';
const XLSX_TENDER = '/Users/techno/Downloads/Чирков и партнеры. Система выбора подрядчика 3.3.xlsx';

function getAuthClient() {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const raw = creds.web || creds.installed;
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  const auth = new google.auth.OAuth2(raw.client_id, raw.client_secret);
  auth.setCredentials(tokens);
  return auth;
}

function updateEnv(key, value) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}\n`;
  }
  fs.writeFileSync(ENV_PATH, content);
}

async function uploadXlsxAsSheet(drive, filePath, title) {
  console.log(`\nЗагружаю «${path.basename(filePath)}» → «${title}»...`);

  const fileSize = fs.statSync(filePath).size;
  console.log(`  Размер файла: ${(fileSize / 1024).toFixed(1)} KB`);

  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    },
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: fs.createReadStream(filePath),
    },
    fields: 'id,name,webViewLink',
  });

  const { id, name, webViewLink } = res.data;
  console.log(`  ✅ Загружено: ${name}`);
  console.log(`  ID: ${id}`);
  console.log(`  URL: ${webViewLink}`);
  return id;
}

async function main() {
  console.log('\n========================================');
  console.log('  Импорт эталонных xlsx → Google Sheets');
  console.log('========================================\n');

  // Проверяем наличие файлов
  if (!fs.existsSync(XLSX_SMM)) {
    console.error(`❌ Файл не найден: ${XLSX_SMM}`);
    process.exit(1);
  }
  if (!fs.existsSync(XLSX_TENDER)) {
    console.error(`❌ Файл не найден: ${XLSX_TENDER}`);
    process.exit(1);
  }

  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  // Загружаем SMM-систему
  const smmId = await uploadXlsxAsSheet(drive, XLSX_SMM, 'SMM-система: Эстрим Фест');

  // Загружаем систему выбора подрядчика
  const tenderId = await uploadXlsxAsSheet(drive, XLSX_TENDER, 'Тендеры: Эстрим Фест');

  // Сохраняем новые ID в .env
  updateEnv('GOOGLE_SPREADSHEET_ID', smmId);
  updateEnv('GOOGLE_TENDER_SPREADSHEET_ID', tenderId);

  console.log('\n========================================');
  console.log('  Готово!');
  console.log('========================================');
  console.log(`\nSMM: https://docs.google.com/spreadsheets/d/${smmId}/edit`);
  console.log(`Тендеры: https://docs.google.com/spreadsheets/d/${tenderId}/edit`);
  console.log('\n✅ ID сохранены в notifier/.env');
  console.log('\nСледующий шаг: запусти node scripts/inspect-sheets-structure.js');
  console.log('  чтобы посмотреть структуру листов и обновить sheets.js');
}

main().catch(err => {
  console.error('\n❌ Ошибка:', err.message);
  if (err.errors) console.error(err.errors);
  process.exit(1);
});
