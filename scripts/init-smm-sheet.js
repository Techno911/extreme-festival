'use strict';

/**
 * init-smm-sheet.js
 * Создаёт Google Sheet "SMM-система: Эстрим Фест" с двумя листами:
 *   - Стратегия  (карта коммуникаций, S-01…S-25)
 *   - Контентная (рубрикатор на 14 недель)
 *
 * Зависимости берём из notifier/node_modules
 * Переменные окружения читаем из notifier/.env
 */

const path = require('path');
const fs = require('fs');

const notifierDir = path.join(__dirname, '..', 'notifier');

// dotenv
require(path.join(notifierDir, 'node_modules', 'dotenv')).config({
  path: path.join(notifierDir, '.env'),
});

const { google } = require(path.join(notifierDir, 'node_modules', 'googleapis'));

const TOKEN_PATH = path.join(notifierDir, '.google-token.json');
const CREDENTIALS_PATH = path.join(notifierDir, '.google-credentials.json');
const ENV_PATH = path.join(notifierDir, '.env');

// ─── Авторизация ─────────────────────────────────────────────────────────────

function getAuthClient() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('\n❌ Файл credentials не найден:', CREDENTIALS_PATH);
    console.error('Запусти сначала: node scripts/google-auth-setup.js\n');
    process.exit(1);
  }
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('\n❌ Токен не найден:', TOKEN_PATH);
    console.error('Запусти сначала: node scripts/google-auth-setup.js\n');
    process.exit(1);
  }

  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const raw = creds.web || creds.installed;
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

  const auth = new google.auth.OAuth2(raw.client_id, raw.client_secret);
  auth.setCredentials(tokens);
  return auth;
}

// ─── Утилиты ─────────────────────────────────────────────────────────────────

/** Преобразует 0-based col index в букву (0 → A, 25 → Z, 26 → AA) */
function colLetter(n) {
  let s = '';
  n += 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** range notation, e.g. A1:I1 */
function range(c1, r1, c2, r2) {
  return `${colLetter(c1)}${r1}:${colLetter(c2)}${r2}`;
}

/** Дата понедельника недели n (0-based), начиная с 2026-04-07 */
function weekStart(weekIndex) {
  const base = new Date('2026-04-07T00:00:00');
  base.setDate(base.getDate() + weekIndex * 7);
  return base;
}

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Форматирует дату как ДД.ММ.ГГГГ */
function fmtDate(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// ─── Данные: S-ID карта ───────────────────────────────────────────────────────

const S_ROWS = [
  ['S-01','Свои в тусовке','Привлечение','Триггер','Объявили лайнап группы которую знаю','Пост: группа недели — факты без пафоса','Пост/Карусель','А→Б: слышу → еду живьём','AJTBD'],
  ['S-02','Свои в тусовке','Прогрев','Ценность','Хочу снова увидеть живьём','Reels/Stories: кадры с репетиции','Reels','Соцдок: это реально происходит','AJTBD'],
  ['S-03','Свои в тусовке','Продажа','Критерий','Первый фест — боюсь разочароваться','Пост: стандарт отбора групп','Пост','Экспертиза → закрытие барьера','AJTBD'],
  ['S-04','Свои в тусовке','Лояльность','Результат','Хочу быть среди своих','Скетч от Оли: узнаваемая ситуация','Картинка','Узнавание = репост','AJTBD'],
  ['S-05','Паломники','Привлечение','Триггер','Иностранный хедлайнер','Пост: анонс хедлайнера','Пост','Дефицит: первый за N лет','AJTBD'],
  ['S-06','Паломники','Прогрев','Барьер','Не знаю как добраться','Пост-FAQ: логистика, электрички','Пост/Stories','Снятие тревоги → билет','AJTBD'],
  ['S-07','Паломники','Продажа','Текущее решение','Сравниваю с другими фестами','Пост: Мы другие — факты','Пост','А→Б: езжу на всё → нашёл свой','AJTBD'],
  ['S-08','Паломники','Лояльность','Ценность','Хочу рассказать друзьям','Кругляшок от амбассадора','Видео 30-60с','Соцдок: свой человек рекомендует','AJTBD'],
  ['S-09','Скептики','Привлечение','Барьер','Боюсь что будет шумно/страшно','Пост: атмосфера — что будет','Пост','А→Б: не знаю → ясная картинка','AJTBD'],
  ['S-10','Скептики','Прогрев','Триггер','Друг зовёт, не знаю группы','Extreme Opros: вопрос из тусовки','Карусель','Вовлечение + снятие чужеродности','AJTBD'],
  ['S-11','Скептики','Прогрев','Критерий','Хочу понять: для меня это?','Комикс с маскотами','Картинка','Идентификация: я узнал себя','AJTBD'],
  ['S-12','Скептики','Продажа','Текущее решение','Думаю пойти на Китаев','FOMO-пост: X билетов осталось','Пост','Срочность без давления','AJTBD'],
  ['S-13','Музыканты','Привлечение','Ценность','Хочу посмотреть как работают топы','Пост: backstage технической части','Пост','Экспертный контент → ценность','AJTBD'],
  ['S-14','Музыканты','Прогрев','Триггер','Услышал группу — хочу разобрать звук','Партнёрский пост Ernie Ball','Пост','А→Б: слышу → понимаю как сделан','AJTBD'],
  ['S-15','Музыканты','Лояльность','Результат','Хочу познакомиться с музыкантами','Анонс: backstage-зона','Stories','Нетворкинг как ценность','AJTBD'],
  ['S-16','Искатели нового','Привлечение','Триггер','Приятель-скейтер зовёт','Пост: скейт-зона — что там реально','Пост/Reels','А→Б: скейт → фест с металлом','AJTBD'],
  ['S-17','Искатели нового','Прогрев','Барьер','Боюсь что металл — не моё','Fast Food серия','Серия постов','Мост: зайди на 30 мин','AJTBD'],
  ['S-18','Искатели нового','Прогрев','Ценность','Хочу новых впечатлений','Визуальный пост: площадка','Карусель','Масштаб: не концерт — событие','AJTBD'],
  ['S-19','Искатели нового','Продажа','Критерий','Один билет — стоит ли?','Stories-серия: пока внутри → снаружи','Stories 3 слайда','Один билет = два мира','AJTBD'],
  ['S-20','Резерв','Продажа','-','Розыгрыш билетов','Розыгрыш у блогера/в аккаунте','Пост','FOMO + вовлечение','Резерв'],
  ['S-21','Резерв','Продажа','-','Мерч-витрина','Карусель с ценами','Карусель','Мерч как точка входа','Резерв'],
  ['S-22','Резерв','Прогрев','-','Как добраться — FAQ','Текстовый пост за 2 нед','Пост','Снятие логистического барьера','Резерв'],
  ['S-23','Резерв','Продажа','-','Last Call','7 дней / 3 дня / завтра','Пост','Последний шанс','Резерв'],
  ['S-24','Резерв','Лояльность','-','Амбассадор-кругляшок','Видео от Леоса или другого','Видео','Соцдок от знаменитости','Резерв'],
  ['S-25','Резерв','Привлечение','-','Партнёрский анонс','Ernie Ball + другие','Пост','Авторитет партнёра','Резерв'],
];

// Рубрики по дням недели
const WEEKLY_RUBRICS = [
  { day: 'Пн', rubric: 'Группа недели',    sid: 'S-01', stage: 'Привлечение' },
  { day: 'Вт', rubric: 'Extreme Opros',    sid: 'S-10', stage: 'Прогрев'     },
  { day: 'Ср', rubric: 'Атмосфера',        sid: 'S-09', stage: 'Прогрев'     },
  { day: 'Чт', rubric: 'Скейт / Fast Food',sid: 'S-16', stage: 'Привлечение' },
  { day: 'Пт', rubric: 'Продажа FOMO',     sid: 'S-12', stage: 'Продажа'     },
  { day: 'Сб', rubric: 'Скетч Оли',        sid: 'S-04', stage: 'Лояльность'  },
  { day: 'Вс', rubric: 'Гибкий слот',      sid: '-',    stage: '-'            },
];

// ─── Построение листа "Стратегия" ────────────────────────────────────────────

function buildStrategiyaData() {
  const rows = [];

  // Row 1: заголовок
  rows.push(['КАРТА КОММУНИКАЦИЙ']);
  // Row 2: пустая
  rows.push([]);
  // Row 3: колонки
  rows.push(['ID','Сегмент ЦА','Этап воронки','Тип JTBD','Элемент JTBD','Сценарий контента','Формат','Продающая часть','Источник']);
  // Rows 4-28: данные
  for (const r of S_ROWS) {
    rows.push(r);
  }

  return rows;
}

// Данные для столбцов K-O (блок "Покрытие воронки") — вставляем через отдельный range
function buildFunnelCoverageData() {
  // K3:O3 — заголовок блока
  // K3: Этап, L3: Сценариев, M3: % факт, N3: % план, O3: Статус
  // K4:O7 — данные
  return [
    ['ПОКРЫТИЕ ВОРОНКИ', '', '', '', ''],
    ['Этап', 'Сценариев', '% факт', '% план', 'Статус'],
    ['Привлечение', '=COUNTIF(C4:C28,"Привлечение")', '=IF(SUM(L4:L7)=0,"",TEXT(L4/SUM(L4:L7),"0%"))', '40%', '=IF(ABS(VALUE(SUBSTITUTE(M4,"%",""))/100-VALUE(SUBSTITUTE(N4,"%",""))/100)>0.1,"⚠️","✅")'],
    ['Прогрев',    '=COUNTIF(C4:C28,"Прогрев")',    '=IF(SUM(L4:L7)=0,"",TEXT(L5/SUM(L4:L7),"0%"))', '35%', '=IF(ABS(VALUE(SUBSTITUTE(M5,"%",""))/100-VALUE(SUBSTITUTE(N5,"%",""))/100)>0.1,"⚠️","✅")'],
    ['Продажа',   '=COUNTIF(C4:C28,"Продажа")',    '=IF(SUM(L4:L7)=0,"",TEXT(L6/SUM(L4:L7),"0%"))', '15%', '=IF(ABS(VALUE(SUBSTITUTE(M6,"%",""))/100-VALUE(SUBSTITUTE(N6,"%",""))/100)>0.1,"⚠️","✅")'],
    ['Лояльность','=COUNTIF(C4:C28,"Лояльность")', '=IF(SUM(L4:L7)=0,"",TEXT(L7/SUM(L4:L7),"0%"))', '10%', '=IF(ABS(VALUE(SUBSTITUTE(M7,"%",""))/100-VALUE(SUBSTITUTE(N7,"%",""))/100)>0.1,"⚠️","✅")'],
  ];
}

// ─── Построение листа "Контентная" ───────────────────────────────────────────

function buildContentnayaData() {
  const rows = [];

  // Row 1: заголовок
  rows.push(['SMM-РУБРИКАТОР: ЭСТРИМ ФЕСТ']);
  // Row 2: пустая
  rows.push([]);
  // Row 3: заголовки колонок A-R
  rows.push([
    'Нед','День','Дата','Рубрика','S-ID','Этап',
    'Маяк','Ссылка медиа','Текст','Цель текста',
    'Прод. часть','Механика','Формат',
    'Охват план','Охват факт','ERR% план','ERR% факт','Статус'
  ]);

  // Rows 4-101: 14 нед × 7 дней
  let rowNum = 4;
  for (let w = 0; w < 14; w++) {
    const monday = weekStart(w);
    for (let d = 0; d < 7; d++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + d);
      const { day, rubric, sid, stage } = WEEKLY_RUBRICS[d];

      rows.push([
        `Нед ${w + 1}`,
        day,
        fmtDate(dayDate),
        rubric,
        sid,
        stage,
        '', // Маяк — заполняет Женя
        '', // Ссылка медиа
        '', // Текст
        '', // Цель текста
        '', // Прод. часть
        '', // Механика
        '',  // Формат
        '',  // Охват план
        '',  // Охват факт
        '',  // ERR% план
        '',  // ERR% факт
        'Бэклог',
      ]);
      rowNum++;
    }
  }

  return rows;
}

// Справочник рубрик (AB3:AF10)
function buildRubricRef() {
  return [
    ['Рубрика', 'ID', 'Этап', 'Формат', 'Маяк'],
    ['Группа недели',     'S-01', 'Привлечение', 'Пост/Карусель', ''],
    ['Extreme Opros',     'S-10', 'Прогрев',     'Карусель',      ''],
    ['Атмосфера',         'S-09', 'Прогрев',     'Пост',          ''],
    ['Скейт / Fast Food', 'S-16', 'Привлечение', 'Reels',         ''],
    ['Продажа FOMO',      'S-12', 'Продажа',     'Пост',          ''],
    ['Скетч Оли',         'S-04', 'Лояльность',  'Картинка',      ''],
    ['Гибкий слот',       '-',    '-',            '-',             ''],
  ];
}

// Баланс воронки для Контентной (T3:W8)
function buildFunnelBalanceContent() {
  return [
    ['БАЛАНС ВОРОНКИ', '', '', ''],
    ['Этап', 'Постов', '% факт', '% план'],
    ['Привлечение', '=COUNTIF(F4:F101,"Привлечение")', '=IF(SUM(U4:U7)=0,"",TEXT(U4/SUM(U4:U7),"0%"))', '40%'],
    ['Прогрев',    '=COUNTIF(F4:F101,"Прогрев")',    '=IF(SUM(U4:U7)=0,"",TEXT(U5/SUM(U4:U7),"0%"))', '35%'],
    ['Продажа',   '=COUNTIF(F4:F101,"Продажа")',    '=IF(SUM(U4:U7)=0,"",TEXT(U6/SUM(U4:U7),"0%"))', '15%'],
    ['Лояльность','=COUNTIF(F4:F101,"Лояльность")', '=IF(SUM(U4:U7)=0,"",TEXT(U7/SUM(U4:U7),"0%"))', '10%'],
  ];
}

// ─── Форматирование через batchUpdate ─────────────────────────────────────────

function buildFormattingRequests(sheetId, sheetName) {
  const requests = [];

  // Заголовок строки 1: жирный, центр, крупный шрифт, светлый фон
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 26 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
          textFormat: { bold: true, fontSize: 14, foregroundColor: { red: 1, green: 1, blue: 1 } },
          horizontalAlignment: 'CENTER',
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
    },
  });

  // Row 3: заголовки колонок — жирный, серый фон
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 26 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 },
          textFormat: { bold: true, fontSize: 10 },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  });

  // Заморозить первые 3 строки и первую колонку
  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: { frozenRowCount: 3 },
      },
      fields: 'gridProperties.frozenRowCount',
    },
  });

  return requests;
}

// Merge ячеек A1:I1 (или A1:R1 для Контентной)
function buildMergeRequest(sheetId, endColIndex) {
  return {
    mergeCells: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: endColIndex },
      mergeType: 'MERGE_ALL',
    },
  };
}

// ─── Главная функция ──────────────────────────────────────────────────────────

async function main() {
  console.log('\n========================================');
  console.log('  Создание SMM-таблицы: Эстрим Фест');
  console.log('========================================\n');

  const auth = getAuthClient();
  const sheetsApi = google.sheets({ version: 'v4', auth });
  const driveApi = google.drive({ version: 'v3', auth });

  let spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || null;

  // ── Создаём или используем существующую таблицу ──
  if (spreadsheetId) {
    console.log('Использую существующую таблицу:', spreadsheetId);
  } else {
    console.log('Создаю новую таблицу...');
    const createRes = await sheetsApi.spreadsheets.create({
      requestBody: {
        properties: { title: 'SMM-система: Эстрим Фест', locale: 'ru_RU' },
        sheets: [
          { properties: { title: 'Стратегия',  index: 0 } },
          { properties: { title: 'Контентная', index: 1, gridProperties: { columnCount: 34 } } },
        ],
      },
    });
    spreadsheetId = createRes.data.spreadsheetId;
    console.log('✅ Таблица создана:', spreadsheetId);
  }

  // Получаем ID листов
  const metaRes = await sheetsApi.spreadsheets.get({ spreadsheetId });
  const sheets = metaRes.data.sheets;

  const strategiyaSheet = sheets.find(s => s.properties.title === 'Стратегия');
  const contentSheet    = sheets.find(s => s.properties.title === 'Контентная');

  if (!strategiyaSheet || !contentSheet) {
    console.error('❌ Не найдены листы "Стратегия" и/или "Контентная". Проверь таблицу вручную.');
    process.exit(1);
  }

  const strategiyaSheetId = strategiyaSheet.properties.sheetId;
  const contentSheetId    = contentSheet.properties.sheetId;

  // ── Записываем данные ───────────────────────────────────────────────────────

  console.log('Заполняю лист "Стратегия"...');

  // A1:I28
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: 'Стратегия!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: buildStrategiyaData() },
  });

  // K2:O8 — покрытие воронки
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: 'Стратегия!K2',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: buildFunnelCoverageData() },
  });

  console.log('Заполняю лист "Контентная"...');

  // A1:R101
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: 'Контентная!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: buildContentnayaData() },
  });

  // AB3:AF10 — справочник рубрик
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: 'Контентная!AB3',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: buildRubricRef() },
  });

  // T3:W8 — баланс воронки
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: 'Контентная!T3',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: buildFunnelBalanceContent() },
  });

  // ── Форматирование ──────────────────────────────────────────────────────────

  console.log('Применяю форматирование...');

  const formattingRequests = [
    buildMergeRequest(strategiyaSheetId, 9),   // A1:I1 в Стратегии
    buildMergeRequest(contentSheetId, 18),      // A1:R1 в Контентной
    ...buildFormattingRequests(strategiyaSheetId, 'Стратегия'),
    ...buildFormattingRequests(contentSheetId, 'Контентная'),
  ];

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: formattingRequests },
  });

  // ── Шарим с Женей ───────────────────────────────────────────────────────────

  const zhenyaEmail = process.env.ZHENYA_EMAIL;
  if (zhenyaEmail) {
    console.log(`Делюсь доступом с ${zhenyaEmail}...`);
    try {
      await driveApi.permissions.create({
        fileId: spreadsheetId,
        requestBody: { type: 'user', role: 'writer', emailAddress: zhenyaEmail },
        sendNotificationEmail: true,
        emailMessage: 'Женя, вот SMM-таблица для Эстрим Феста. Структура готова — можно работать.',
      });
      console.log('✅ Доступ выдан:', zhenyaEmail);
    } catch (err) {
      console.warn('⚠️  Не удалось выдать доступ:', err.message);
    }
  } else {
    console.log('ℹ️  ZHENYA_EMAIL не задан — доступ не выдавался. Добавь в notifier/.env');
  }

  // ── Сохраняем ID в .env ─────────────────────────────────────────────────────

  let envContent = '';
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf8');
  }

  if (envContent.includes('GOOGLE_SPREADSHEET_ID=')) {
    envContent = envContent.replace(/GOOGLE_SPREADSHEET_ID=.*/g, `GOOGLE_SPREADSHEET_ID=${spreadsheetId}`);
  } else {
    envContent += `\nGOOGLE_SPREADSHEET_ID=${spreadsheetId}\n`;
  }

  fs.writeFileSync(ENV_PATH, envContent);
  console.log('✅ GOOGLE_SPREADSHEET_ID сохранён в', ENV_PATH);

  // ── Финал ───────────────────────────────────────────────────────────────────

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  console.log('\n========================================');
  console.log('  Готово!');
  console.log('========================================');
  console.log('\nТаблица: ' + sheetUrl);
  console.log('\nЧто внутри:');
  console.log('  - Стратегия:  25 S-ID с картой коммуникаций + покрытие воронки');
  console.log('  - Контентная: 98 строк (14 нед × 7 дней) + баланс воронки + справочник рубрик');
  console.log('\nСледующий шаг: отправь ссылку Жене и попроси заполнить колонку "Маяк".\n');
}

main().catch(err => {
  console.error('\n❌ Ошибка:', err.message);
  if (err.code === 401 || (err.message && err.message.includes('invalid_grant'))) {
    console.error('Токен устарел. Запусти снова: node scripts/google-auth-setup.js\n');
  }
  process.exit(1);
});
