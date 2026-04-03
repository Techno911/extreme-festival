'use strict';
const path = require('path');
const fs = require('fs');
const notifierDir = path.join(__dirname, '..', 'notifier');
require(path.join(notifierDir, 'node_modules', 'dotenv')).config({ path: path.join(notifierDir, '.env') });
const { google } = require(path.join(notifierDir, 'node_modules', 'googleapis'));
const creds = JSON.parse(fs.readFileSync(path.join(notifierDir, '.google-credentials.json'), 'utf8'));
const raw = creds.web || creds.installed;
const tokens = JSON.parse(fs.readFileSync(path.join(notifierDir, '.google-token.json'), 'utf8'));
const auth = new google.auth.OAuth2(raw.client_id, raw.client_secret);
auth.setCredentials(tokens);
const sheetsApi = google.sheets({ version: 'v4', auth });

async function run() {
  const r1 = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_TENDER_SPREADSHEET_ID,
    range: "'Тендер Трафик'!A3:Z8"
  });
  console.log('=== ТЕНДЕР ТРАФИК строки 3-8 ===');
  (r1.data.values||[]).forEach((row,i) => {
    console.log('  стр'+(i+3)+': '+row.slice(0,15).join(' | '));
  });

  const r2 = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    range: "'Контентная'!A3:R8"
  });
  console.log('\n=== КОНТЕНТНАЯ строки 3-8 ===');
  (r2.data.values||[]).forEach((row,i) => {
    console.log('  стр'+(i+3)+': '+row.slice(0,18).join(' | '));
  });

  const r3 = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    range: "'Стратегия'!A3:J6"
  });
  console.log('\n=== СТРАТЕГИЯ строки 3-6 ===');
  (r3.data.values||[]).forEach((row,i) => {
    console.log('  стр'+(i+3)+': '+row.slice(0,10).join(' | '));
  });
}
run().catch(e => { console.error(e.message); process.exit(1); });
