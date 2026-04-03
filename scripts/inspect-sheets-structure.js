'use strict';

/**
 * inspect-sheets-structure.js
 * Выводит структуру листов обеих Google Sheets (названия листов + заголовки первых 3 строк)
 */

const path = require('path');
const fs = require('fs');

const notifierDir = path.join(__dirname, '..', 'notifier');
require(path.join(notifierDir, 'node_modules', 'dotenv')).config({ path: path.join(notifierDir, '.env') });
const { google } = require(path.join(notifierDir, 'node_modules', 'googleapis'));

const TOKEN_PATH = path.join(notifierDir, '.google-token.json');
const CREDENTIALS_PATH = path.join(notifierDir, '.google-credentials.json');

function getAuthClient() {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const raw = creds.web || creds.installed;
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  const auth = new google.auth.OAuth2(raw.client_id, raw.client_secret);
  auth.setCredentials(tokens);
  return auth;
}

async function inspectSheet(sheetsApi, spreadsheetId, label) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`  ID: ${spreadsheetId}`);
  console.log('═'.repeat(60));

  const meta = await sheetsApi.spreadsheets.get({ spreadsheetId });
  const sheets = meta.data.sheets;

  console.log(`\nЛисты (${sheets.length}):`);
  for (const sheet of sheets) {
    const title = sheet.properties.title;
    const rows = sheet.properties.gridProperties.rowCount;
    const cols = sheet.properties.gridProperties.columnCount;
    console.log(`  • «${title}» — ${rows} строк × ${cols} колонок`);
  }

  // Показываем первые 3 строки каждого листа
  for (const sheet of sheets) {
    const title = sheet.properties.title;
    console.log(`\n─── Лист «${title}» — первые 3 строки ───`);
    try {
      const res = await sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range: `'${title}'!A1:AH3`,
      });
      const rows = res.data.values || [];
      rows.forEach((row, i) => {
        const preview = row.slice(0, 20).map((v, j) => {
          const col = String.fromCharCode(65 + j);
          return `${col}:${String(v).slice(0, 25)}`;
        }).join(' | ');
        console.log(`  Строка ${i + 1}: ${preview}`);
      });
    } catch (e) {
      console.log(`  (ошибка чтения: ${e.message})`);
    }
  }
}

async function main() {
  const auth = getAuthClient();
  const sheetsApi = google.sheets({ version: 'v4', auth });

  const SMM_ID = process.env.GOOGLE_SPREADSHEET_ID;
  const TENDER_ID = process.env.GOOGLE_TENDER_SPREADSHEET_ID;

  await inspectSheet(sheetsApi, SMM_ID, 'SMM-система: Эстрим Фест');
  await inspectSheet(sheetsApi, TENDER_ID, 'Тендеры: Эстрим Фест');
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
