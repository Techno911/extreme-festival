'use strict';

/**
 * init-tender-sheet.js
 * Создаёт Google Sheet «Тендеры: Эстрим Фест» по стандарту ЧиП 3.3
 * 5 листов-тендеров + 1 лист Обоснование
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

// ─── Auth ────────────────────────────────────────────────────────────────────

function getAuthClient() {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const raw = creds.web || creds.installed;
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  const auth = new google.auth.OAuth2(raw.client_id, raw.client_secret);
  auth.setCredentials(tokens);
  return auth;
}

// ─── Tender configs per type ─────────────────────────────────────────────────

const TENDER_CONFIGS = [
  {
    name: 'Тендер Трафик',
    title: 'СИСТЕМА ВЫБОРА ПОДРЯДЧИКА: ТРАФИК',
    colB: 'Агентство',
    colF: 'Мин бюджет',
    screening: ['Доступ к кабинетам', 'Без 100% предоплаты', 'Релевантный кейс', 'Ваш договор', 'Реалистичные сроки'],
    scoring: ['Релевантный опыт (30%)', 'Прозрачность (25%)', 'Гибкость (20%)', 'Цена (авто) (15%)', 'Коммуникация (10%)'],
  },
  {
    name: 'Тендер Дизайн',
    title: 'СИСТЕМА ВЫБОРА ПОДРЯДЧИКА: ДИЗАЙН',
    colB: 'Дизайнер/Агентство',
    colF: 'Форматы',
    screening: ['Дает исходники (AI/EPS)', 'Без 100% предоплаты', 'Есть референсы/кейсы', 'Правки включены (2-3)', 'Ваш договор'],
    scoring: ['Релевантный опыт (30%)', 'Соответствие стилю (25%)', 'Понятность работ (20%)', 'Цена (авто) (15%)', 'Коммуникация (10%)'],
  },
  {
    name: 'Тендер Разработка',
    title: 'СИСТЕМА ВЫБОРА ПОДРЯДЧИКА: РАЗРАБОТКА',
    colB: 'Разработчик/Студия',
    colF: 'Платформа',
    screening: ['Адаптивность (мобильные)', 'Без 100% предоплаты', 'Есть кейсы', 'Скорость (PageSpeed>80)', 'Ваш договор'],
    scoring: ['Релевантный опыт (30%)', 'Качество кода (25%)', 'Соответствие ТЗ (20%)', 'Цена (авто) (15%)', 'Коммуникация (10%)'],
  },
  {
    name: 'Тендер SMM',
    title: 'СИСТЕМА ВЫБОРА ПОДРЯДЧИКА: SMM',
    colB: 'SMM-агентство',
    colF: 'Платформы',
    screening: ['Понимают Tone of Voice', 'Без 100% предоплаты', 'Есть кейсы с метриками', 'Ваш договор', 'Один согласующий'],
    scoring: ['Релевантный опыт (30%)', 'Качество контента (25%)', 'Понимание KPI (20%)', 'Цена (авто) (15%)', 'Коммуникация (10%)'],
  },
  {
    name: 'Тендер Видео',
    title: 'СИСТЕМА ВЫБОРА ПОДРЯДЧИКА: ВИДЕО',
    colB: 'Продакшн/Видеограф',
    colF: 'Формат',
    screening: ['Дает исходники', 'Без 100% предоплаты', 'Есть референсы', 'Правки включены (2)', 'Ваш договор'],
    scoring: ['Релевантный опыт (30%)', 'Качество картинки (25%)', 'Соответствие референсам (20%)', 'Цена (авто) (15%)', 'Коммуникация (10%)'],
  },
];

// ─── Build sheet data ────────────────────────────────────────────────────────

function buildTenderHeaders(config) {
  return [
    [config.title],
    ['Цель: собрать ~30 контактов → получить мин 15 КП → отсев → скоринг → ТОП-3'],
    [],
    [
      '№', config.colB, 'Источник', 'Портфолио', 'Стоимость', config.colF,
      'КП', 'Сайт', 'Контакты', 'Комментарий',
      ...config.screening,
      'ПРОХОДИТ',
      ...config.scoring,
      'ИТОГО', 'МЕСТО', 'Статус', 'Статус бюджета',
    ],
    [
      '', '', '', '', '', '', '', '', '', '',
      'ДА/НЕТ', 'ДА/НЕТ', 'ДА/НЕТ', 'ДА/НЕТ', 'ДА/НЕТ',
      'Авто', '1-10', '1-10', '1-10', 'Авто', '1-10', 'Авто', 'Авто', '', 'Авто',
    ],
  ];
}

function buildTenderFormulas(startRow, endRow) {
  const rows = [];
  for (let i = startRow; i <= endRow; i++) {
    rows.push([
      i - startRow + 1, // A: №
      '', '', '', '', '', '', '', '', '', // B-J: пусто
      '', '', '', '', '', // K-O: ДА/НЕТ (ручной ввод)
      `=IF(COUNTIF(K${i}:O${i},"НЕТ")>0,"ОТКАЗ","ПРОХОДИТ")`, // P
      '', '', '', // Q-S: ручные оценки
      `=IFERROR(ROUND(10*(MIN($E$${startRow}:$E$${endRow})/E${i}),1),0)`, // T: Цена авто
      '', // U: ручная оценка
      `=IF(P${i}="ПРОХОДИТ",Q${i}*0.3+R${i}*0.25+S${i}*0.2+T${i}*0.15+U${i}*0.1,"")`, // V: ИТОГО
      `=IF(P${i}="ПРОХОДИТ",RANK(V${i},$V$${startRow}:$V$${endRow},0),"")`, // W: МЕСТО
      `=IF(W${i}="","",IF(W${i}<=3,"ТОП-3",""))`, // X: Статус
      `=IF(ISNUMBER(E${i}),IF($W$38="","",IF(E${i}<=$W$38,"В бюджете",IF(E${i}<=$W$38*1.2,"До +20%","Вне бюджета"))),"")`, // Y
    ]);
  }
  return rows;
}

function buildObosnovanie() {
  return [
    ['ОБОСНОВАНИЕ ВЫБОРА ДЛЯ РУКОВОДСТВА'],
    ['Заполните ячейки на зелёном фоне.'],
    [],
    ['ВХОДНЫЕ ДАННЫЕ'],
    ['Тип тендера:', ''],
    ['Выбранный подрядчик:', ''],
    ['Для чего проводился:', ''],
    [],
    ['1 КОНТЕКСТ'],
    ['Тип тендера', ''],
    ['Задача', ''],
    [],
    ['2 ПРОЦЕСС ОТБОРА'],
    ['Показатель', 'Значение', 'Цель'],
    ['Контактов собрано', '', '~30'],
    ['КП получено', '', '>=15'],
    ['Прошли отсев', '', '—'],
    ['Отказано', '', '—'],
    [],
    ['3 МЕТОДОЛОГИЯ'],
    ['Этап 1', 'Отсев по критичным требованиям'],
    ['Этап 2', 'Оценка по 5 взвешенным критериям'],
    [],
    ['4 ТОП-3'],
    ['Место', 'Агентство', 'Балл', 'Контакт'],
    ['1', '', '', ''],
    ['2', '', '', ''],
    ['3', '', '', ''],
    [],
    ['5 ВЫБРАННЫЙ ПОДРЯДЧИК'],
    ['Подрядчик', ''],
    ['Почему выбран', ''],
    ['Портфолио (кейс)', ''],
    ['Цена', ''],
    ['Сроки', ''],
    ['Риски', ''],
    [],
    ['6 СЛЕДУЮЩИЕ ШАГИ'],
    ['Договор подписан', 'ДА/НЕТ'],
    ['Предоплата 30%', 'ДА/НЕТ'],
    ['Kanban создан', 'ДА/НЕТ'],
    ['Еженедельный статус', 'ДА/НЕТ'],
    ['Права на материалы', 'ДА/НЕТ'],
  ];
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n========================================');
  console.log('  Создание тендерной таблицы');
  console.log('========================================\n');

  const auth = getAuthClient();
  const sheetsApi = google.sheets({ version: 'v4', auth });

  let spreadsheetId = process.env.GOOGLE_TENDER_SPREADSHEET_ID || null;

  if (spreadsheetId) {
    console.log('Использую существующую таблицу:', spreadsheetId);
  } else {
    console.log('Создаю новую таблицу...');
    const createRes = await sheetsApi.spreadsheets.create({
      requestBody: {
        properties: { title: 'Тендеры: Эстрим Фест', locale: 'ru_RU' },
        sheets: [
          ...TENDER_CONFIGS.map((c, i) => ({
            properties: { title: c.name, index: i, gridProperties: { columnCount: 25, rowCount: 42 } }
          })),
          { properties: { title: 'Обоснование', index: 5, gridProperties: { columnCount: 4, rowCount: 50 } } },
        ],
      },
    });
    spreadsheetId = createRes.data.spreadsheetId;
    console.log('✅ Таблица создана:', spreadsheetId);
  }

  // Fill each tender sheet
  for (const config of TENDER_CONFIGS) {
    console.log(`Заполняю лист «${config.name}»...`);

    // Headers (rows 1-5)
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: `'${config.name}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: buildTenderHeaders(config) },
    });

    // Formulas (rows 6-30)
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: `'${config.name}'!A6`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: buildTenderFormulas(6, 30) },
    });
  }

  // Обоснование
  console.log('Заполняю лист «Обоснование»...');
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: "'Обоснование'!A1",
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: buildObosnovanie() },
  });

  // Formatting
  console.log('Применяю форматирование...');
  const metaRes = await sheetsApi.spreadsheets.get({ spreadsheetId });
  const formatRequests = [];

  for (const sheet of metaRes.data.sheets) {
    const sid = sheet.properties.sheetId;
    // Row 1: title — bold, dark bg, white text
    formatRequests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 25 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.15, green: 0.15, blue: 0.15 },
            textFormat: { bold: true, fontSize: 13, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
    // Row 4: headers — bold, gray bg
    formatRequests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 25 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 },
            textFormat: { bold: true, fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
    // Freeze rows 1-5
    formatRequests.push({
      updateSheetProperties: {
        properties: { sheetId: sid, gridProperties: { frozenRowCount: 5 } },
        fields: 'gridProperties.frozenRowCount',
      },
    });
  }

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: formatRequests },
  });

  // Save to .env
  let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  if (envContent.includes('GOOGLE_TENDER_SPREADSHEET_ID=')) {
    envContent = envContent.replace(/GOOGLE_TENDER_SPREADSHEET_ID=.*/g, `GOOGLE_TENDER_SPREADSHEET_ID=${spreadsheetId}`);
  } else {
    envContent += `\nGOOGLE_TENDER_SPREADSHEET_ID=${spreadsheetId}\n`;
  }
  fs.writeFileSync(ENV_PATH, envContent);
  console.log('✅ GOOGLE_TENDER_SPREADSHEET_ID сохранён в .env');

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  console.log('\n========================================');
  console.log('  Готово!');
  console.log('========================================');
  console.log('\nТаблица:', url);
  console.log('\nВнутри:');
  TENDER_CONFIGS.forEach(c => console.log(`  - ${c.name}: 25 строк × 25 колонок, формулы скоринга`));
  console.log('  - Обоснование: шаблон для руководства\n');
}

main().catch(err => {
  console.error('\n❌ Ошибка:', err.message);
  process.exit(1);
});
