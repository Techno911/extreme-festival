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

const SPREADSHEET_ID = process.env.GOOGLE_TENDER_SPREADSHEET_ID || '1o3jBARgnhlT8mKgBbqyCJuL7qjIxnUQx4YM7EwNTY5w';
const SHEETS = ['Тендер Трафик', 'Тендер Дизайн', 'Тендер Разработка', 'Тендер SMM', 'Тендер Видео'];
const START_ROW = 6;
const END_ROW = 30;

function buildColumnFormulas(col, startRow, endRow) {
  const formulas = [];
  for (let i = startRow; i <= endRow; i++) {
    let f;
    switch (col) {
      case 'P':
        f = `=IF(COUNTIF(K${i}:O${i},"НЕТ")>0,"ОТКАЗ","ПРОХОДИТ")`;
        break;
      case 'T':
        f = `=IFERROR(ROUND(10*(MIN($E$${startRow}:$E$${endRow})/E${i}),1),0)`;
        break;
      case 'V':
        f = `=IF(P${i}="ПРОХОДИТ",Q${i}*0.3+R${i}*0.25+S${i}*0.2+T${i}*0.15+U${i}*0.1,"")`;
        break;
      case 'W':
        f = `=IF(P${i}="ПРОХОДИТ",RANK(V${i},$V$${startRow}:$V$${endRow},0),"")`;
        break;
      case 'X':
        f = `=IF(W${i}="","",IF(W${i}<=3,"ТОП-3",""))`;
        break;
      case 'Y':
        f = `=IF(ISNUMBER(E${i}),IF($W$38="","",IF(E${i}<=$W$38,"В бюджете",IF(E${i}<=$W$38*1.2,"До +20%","Вне бюджета"))),"")`;
        break;
    }
    formulas.push([f]);
  }
  return formulas;
}

async function main() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const COLUMNS = ['P', 'T', 'V', 'W', 'X', 'Y'];

  for (const sheetName of SHEETS) {
    console.log(`\n--- ${sheetName} ---`);
    for (const col of COLUMNS) {
      const range = `'${sheetName}'!${col}${START_ROW}:${col}${END_ROW}`;
      const values = buildColumnFormulas(col, START_ROW, END_ROW);
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
      console.log(`  ${col}${START_ROW}:${col}${END_ROW} — OK (${values.length} formulas)`);
    }
    console.log(`  ${sheetName} — all formulas restored`);
  }

  console.log('\nDone: scoring formulas restored in all 5 tender sheets.');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
