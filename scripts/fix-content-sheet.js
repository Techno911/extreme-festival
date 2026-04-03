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

const RUBRICS = [
  'Презентация группы',
  'Extreme Opros',
  'Закулисье / организация',
  'Скейт + экстрим',
  'Мерч-витрина',
  'Атмосфера / вайб',
  'Логистика / FAQ',
  'Комикс с маскотами',
  'Как будет на фесте',
  'Обратный отсчёт',
];

async function main() {
  const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
  if (!SPREADSHEET_ID) {
    console.error('❌ GOOGLE_SPREADSHEET_ID not set in .env');
    process.exit(1);
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Find sheetId of "Контентная"
  console.log('🔍 Looking for sheet "Контентная"...');
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const contentSheet = spreadsheet.data.sheets.find(
    (s) => s.properties.title === 'Контентная'
  );
  if (!contentSheet) {
    console.error('❌ Sheet "Контентная" not found. Available sheets:');
    spreadsheet.data.sheets.forEach((s) => console.log('   -', s.properties.title));
    process.exit(1);
  }
  const sheetId = contentSheet.properties.sheetId;
  console.log(`✅ Found "Контентная" (sheetId: ${sheetId})`);

  // 2. Set data validation on column C (index 2), rows 4-150
  console.log('📝 Setting rubric dropdown on C4:C150...');
  const values = RUBRICS.map((r) => ({ userEnteredValue: r }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 3,   // row 4 (0-based)
              endRowIndex: 150,   // row 150
              startColumnIndex: 2, // column C
              endColumnIndex: 3,
            },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values,
              },
              showCustomUi: true,
              strict: false,
            },
          },
        },
      ],
    },
  });

  console.log('✅ Dropdown set! 10 rubrics:');
  RUBRICS.forEach((r, i) => console.log(`   ${i + 1}. ${r}`));
  console.log('🎸 Done — dental clinic rubrics replaced with ExtremeFest rubrics.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
