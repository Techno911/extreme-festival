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
  const r = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    range: "'Контентная'!R3:X10"
  });
  console.log('=== КОНТЕНТНАЯ R3:X10 ===');
  (r.data.values||[]).forEach((row,i) => {
    if(row.some(v=>v)) console.log('  стр'+(i+3)+': '+row.join(' | '));
  });
  // Also check Стратегия funnel area K3:O8
  const r2 = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    range: "'Стратегия'!K3:P10"
  });
  console.log('\n=== СТРАТЕГИЯ K3:P10 ===');
  (r2.data.values||[]).forEach((row,i) => {
    if(row.some(v=>v)) console.log('  стр'+(i+3)+': '+row.join(' | '));
  });
}
run().catch(e => { console.error(e.message); process.exit(1); });
