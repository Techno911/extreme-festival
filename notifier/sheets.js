'use strict';

/**
 * Google Sheets API module for ExtremeFest SMM system
 *
 * Auth: OAuth2 with refresh token (set up once via scripts/google-auth-setup.js)
 * Or: Service Account (JSON key file)
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH
  || path.join(__dirname, '.google-credentials.json');
const TOKEN_PATH = path.join(__dirname, '.google-token.json');

const SHEET_STRATEGY = 'Стратегия';
const SHEET_CONTENT = 'Контентная';

// Column mapping for Контентная (v3.7 etalon structure)
// Row 3 = headers, rows 4+ = data
// A: День, B: Дата, C: Рубрика, D: ID, E: Этап воронки, F: Маяк,
// G: Ссылка на медиа, H: Текст, I: Цель текста, J: Продающая часть,
// K: Как сделать интересным, L: Формат, M: Охват план, N: Охват факт,
// O: ERR% план, P: ERR% факт, Q: Статус (кастомное поле бота)
// R+: баланс воронки (авто-формулы, не трогаем)
const COL = {
  DAY: 'A', DATE: 'B', RUBRIC: 'C', SID: 'D', STAGE: 'E',
  BEACON: 'F', MEDIA_LINK: 'G', TEXT: 'H', TEXT_GOAL: 'I', SELLING: 'J',
  MECHANIC: 'K', FORMAT: 'L', REACH_PLAN: 'M', REACH_FACT: 'N',
  ERR_PLAN: 'O', ERR_FACT: 'P', STATUS: 'Q'
};

// First data row (after header row 3)
const DATA_START_ROW = 4;

// ─── Auth ────────────────────────────────────────────────────────────────────

let sheetsApi = null;

async function getAuth() {
  // Option 1: Service Account
  if (fs.existsSync(CREDENTIALS_PATH)) {
    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
    const creds = JSON.parse(content);

    if (creds.type === 'service_account') {
      const auth = new google.auth.GoogleAuth({
        keyFile: CREDENTIALS_PATH,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      return auth;
    }

    // Option 2: OAuth2 with client_id/client_secret + saved token
    if (creds.installed || creds.web) {
      const { client_id, client_secret, redirect_uris } = creds.installed || creds.web;
      const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

      if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        oauth2.setCredentials(token);
        // Auto-refresh
        oauth2.on('tokens', (tokens) => {
          if (tokens.refresh_token) {
            const saved = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
            saved.refresh_token = tokens.refresh_token;
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(saved, null, 2));
          }
        });
        return oauth2;
      }

      throw new Error(
        'OAuth token not found. Run: node scripts/google-auth-setup.js'
      );
    }
  }

  throw new Error(
    `Google credentials not found at ${CREDENTIALS_PATH}. ` +
    'See scripts/GOOGLE_SETUP.md for setup instructions.'
  );
}

async function getSheets() {
  if (!sheetsApi) {
    const auth = await getAuth();
    sheetsApi = google.sheets({ version: 'v4', auth });
  }
  return sheetsApi;
}

// ─── READING ─────────────────────────────────────────────────────────────────

/**
 * Get content plan for a specific week
 * @param {number} weekNum - week number (1-14)
 * @returns {Array<Object>} posts for the week
 */
async function getWeekPlan(weekNum) {
  if (!SPREADSHEET_ID) return [];
  const sheets = await getSheets();
  const range = `${SHEET_CONTENT}!A${DATA_START_ROW}:Q300`;

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const rows = res.data.values || [];
    return rows
      .map((row, idx) => ({ ...rowToPost(row), rowIndex: idx + DATA_START_ROW }))
      .filter(post => {
        // Filter by week number computed from date
        if (!post.date) return false;
        return getWeekFromDate(post.date) === weekNum;
      });
  } catch (err) {
    console.error('getWeekPlan error:', err.message);
    return [];
  }
}

/**
 * Compute week number from date string (DD.MM.YYYY or DD.MM)
 * Festival starts April 6, 2026 = Week 1
 */
function getWeekFromDate(dateStr) {
  if (!dateStr) return 0;
  const parts = String(dateStr).split('.');
  if (parts.length < 2) return 0;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parts[2] ? parseInt(parts[2], 10) : 2026;
  const date = new Date(year, month - 1, day);
  const festStart = new Date(2026, 3, 6); // April 6 = week 1
  const diffDays = Math.floor((date - festStart) / 86400000);
  if (diffDays < 0) return 0; // pre-festival
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Get funnel balance (привлечение/прогрев/продажа/лояльность)
 */
async function getFunnelBalance() {
  if (!SPREADSHEET_ID) return null;
  const sheets = await getSheets();

  try {
    // Funnel balance table: Контентная!R5:V8
    // R=Этап, S=Кол-во, T=%факт, U=Цель, V=Рекомендация
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_CONTENT}!R5:V8`,
    });

    const rows = res.data.values || [];
    return rows.map(row => ({
      stage: row[0] || '',
      count: row[1] || '0',
      percent: row[2] || '0%',
      target: row[3] || '',
      recommendation: row[4] || '',
    }));
  } catch (err) {
    console.error('getFunnelBalance error:', err.message);
    return null;
  }
}

/**
 * Get posts filtered by status
 * @param {string} status - Бэклог/Черновик/На проверке/Одобрен/Опубликован
 */
async function getPostsByStatus(status) {
  if (!SPREADSHEET_ID) return [];
  const sheets = await getSheets();

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_CONTENT}!A${DATA_START_ROW}:Q300`,
    });

    const rows = res.data.values || [];
    return rows
      .map((row, idx) => ({ ...rowToPost(row), rowIndex: idx + DATA_START_ROW }))
      .filter(post => post.status === status);
  } catch (err) {
    console.error('getPostsByStatus error:', err.message);
    return [];
  }
}

/**
 * Get rubric statistics (average reach and ERR per rubric)
 */
async function getRubricStats() {
  if (!SPREADSHEET_ID) return [];
  const sheets = await getSheets();

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_CONTENT}!A${DATA_START_ROW}:Q300`,
    });

    const rows = res.data.values || [];
    const stats = {};

    for (const row of rows) {
      // C=rubric(2), N=reachFact(13), P=errFact(15)
      const rubric = row[2];
      const reachFact = parseFloat(row[13]) || 0;
      const errFact = parseFloat(String(row[15] || '').replace('%', '').replace(',', '.')) || 0;
      if (!rubric || !reachFact) continue;

      if (!stats[rubric]) stats[rubric] = { count: 0, totalReach: 0, totalErr: 0 };
      stats[rubric].count++;
      stats[rubric].totalReach += reachFact;
      stats[rubric].totalErr += errFact;
    }

    return Object.entries(stats).map(([rubric, data]) => ({
      rubric,
      posts: data.count,
      avgReach: Math.round(data.totalReach / data.count),
      avgErr: (data.totalErr / data.count).toFixed(2) + '%',
    }));
  } catch (err) {
    console.error('getRubricStats error:', err.message);
    return [];
  }
}

// ─── WRITING ─────────────────────────────────────────────────────────────────

/**
 * Add a draft post to the content plan
 * @param {Object} post - post data
 * @returns {number} row index where it was added
 */
async function addDraftPost(post) {
  if (!SPREADSHEET_ID) return -1;
  const sheets = await getSheets();

  try {
    // Find first empty row (scan column A from DATA_START_ROW)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_CONTENT}!A${DATA_START_ROW}:A300`,
    });

    const existingRows = (res.data.values || []).length;
    const newRow = existingRows + DATA_START_ROW;

    // New column mapping: A=day, B=date, C=rubric, D=sid, E=stage, F=beacon,
    // G=mediaLink, H=text, I=textGoal, J=selling, K=mechanic, L=format,
    // M=reachPlan, N=reachFact(empty), O=errPlan, P=errFact(empty), Q=status
    const values = [[
      post.day || '',           // A: День
      post.date || '',          // B: Дата
      post.rubric || '',        // C: Рубрика
      post.sid || '',           // D: ID
      post.stage || '',         // E: Этап воронки
      post.beacon || '',        // F: Маяк
      post.mediaLink || '',     // G: Ссылка на медиа
      post.text || '',          // H: Текст
      post.textGoal || '',      // I: Цель текста
      post.selling || '',       // J: Продающая часть
      post.mechanic || '',      // K: Как сделать интересным
      post.format || '',        // L: Формат
      post.reachPlan || '',     // M: Охват план
      '',                       // N: Охват факт (пусто)
      post.errPlan || '',       // O: ERR% план
      '',                       // P: ERR% факт (пусто)
      'Черновик',               // Q: Статус
    ]];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_CONTENT}!A${newRow}:Q${newRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return newRow;
  } catch (err) {
    console.error('addDraftPost error:', err.message);
    return -1;
  }
}

/**
 * Update post status (called by bot inline buttons)
 * @param {number} rowIndex - row number in sheet
 * @param {string} status - new status
 */
async function updatePostStatus(rowIndex, status) {
  if (!SPREADSHEET_ID) return false;
  const sheets = await getSheets();

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_CONTENT}!Q${rowIndex}`, // Q = STATUS
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[status]] },
    });
    return true;
  } catch (err) {
    console.error('updatePostStatus error:', err.message);
    return false;
  }
}

/**
 * Update post metrics (reach and ERR actual)
 */
async function updatePostMetrics(rowIndex, reach, err) {
  if (!SPREADSHEET_ID) return false;
  const sheets = await getSheets();

  try {
    // N=реach fact, P=err fact
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `${SHEET_CONTENT}!N${rowIndex}`, values: [[reach]] },
          { range: `${SHEET_CONTENT}!P${rowIndex}`, values: [[err]] },
        ],
      },
    });
    return true;
  } catch (err2) {
    console.error('updatePostMetrics error:', err2.message);
    return false;
  }
}

/**
 * Add an idea to backlog (from voice message)
 */
async function addIdeaToBacklog(text) {
  return addDraftPost({
    rubric: 'Гибкий слот',
    text: text,
    status: 'Бэклог',
  });
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────

function getCurrentWeekNumber() {
  const festStart = new Date('2026-04-06'); // Week 1 starts April 6
  const now = new Date();
  const diff = Math.floor((now - festStart) / (7 * 86400000));
  return Math.max(1, Math.min(14, diff + 1));
}

function getSheetUrl() {
  if (!SPREADSHEET_ID) return 'Google Sheet не настроен. Запустите scripts/init-smm-sheet.js';
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`;
}

function rowToPost(row) {
  // A=day(0), B=date(1), C=rubric(2), D=sid(3), E=stage(4), F=beacon(5),
  // G=mediaLink(6), H=text(7), I=textGoal(8), J=selling(9), K=mechanic(10),
  // L=format(11), M=reachPlan(12), N=reachFact(13), O=errPlan(14),
  // P=errFact(15), Q=status(16)
  return {
    day: row[0] || '',
    date: row[1] || '',
    rubric: row[2] || '',
    sid: row[3] || '',
    stage: row[4] || '',
    beacon: row[5] || '',
    mediaLink: row[6] || '',
    text: row[7] || '',
    textGoal: row[8] || '',
    selling: row[9] || '',
    mechanic: row[10] || '',
    format: row[11] || '',
    reachPlan: row[12] || '',
    reachFact: row[13] || '',
    errPlan: row[14] || '',
    errFact: row[15] || '',
    status: row[16] || 'Бэклог',
  };
}

/**
 * Check if sheets module is configured
 */
function isConfigured() {
  return !!(SPREADSHEET_ID && (fs.existsSync(CREDENTIALS_PATH) || fs.existsSync(TOKEN_PATH)));
}

// ─── TENDER FUNCTIONS ────────────────────────────────────────────────────────

const TENDER_SPREADSHEET_ID = process.env.GOOGLE_TENDER_SPREADSHEET_ID || null;

const TENDER_TYPES = ['Трафик', 'Дизайн', 'Разработка', 'SMM', 'Видео'];

/**
 * Get summary for a specific tender type
 */
async function getTenderSummary(type) {
  if (!TENDER_SPREADSHEET_ID) return null;
  const sheetsApi = await getSheets();

  const sheetName = `Тендер ${type}`;
  try {
    const res = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: TENDER_SPREADSHEET_ID,
      range: `'${sheetName}'!A6:Y30`,
    });

    const rows = (res.data.values || []).filter(r => r[1] && r[1].trim());
    const total = rows.length;
    const passed = rows.filter(r => (r[15] || '').includes('ПРОХОДИТ')).length;
    const rejected = rows.filter(r => (r[15] || '').includes('ОТКАЗ')).length;

    // TOP-3: rows with rank <= 3 (column W = index 22)
    const top3 = rows
      .filter(r => r[22] && parseInt(r[22], 10) <= 3)
      .sort((a, b) => parseInt(a[22], 10) - parseInt(b[22], 10))
      .map(r => ({
        rank: parseInt(r[22], 10),
        name: r[1] || '',
        score: r[21] || '0',
        budgetStatus: r[24] || '',
      }));

    return { type, total, passed, rejected, top3 };
  } catch (err) {
    console.error(`getTenderSummary(${type}) error:`, err.message);
    return null;
  }
}

/**
 * Get summary for ALL tender types
 */
async function getAllTendersSummary() {
  const results = [];
  for (const type of TENDER_TYPES) {
    const summary = await getTenderSummary(type);
    results.push(summary || { type, total: 0, passed: 0, rejected: 0, top3: [] });
  }
  return results;
}

/**
 * Add contractor to tender sheet
 */
async function addContractor(type, data) {
  if (!TENDER_SPREADSHEET_ID) return -1;
  const sheetsApi = await getSheets();
  const sheetName = `Тендер ${type}`;

  try {
    const res = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: TENDER_SPREADSHEET_ID,
      range: `'${sheetName}'!A6:A30`,
    });
    const rows = res.data.values || [];
    let nextRow = 6;
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i][0] || rows[i][0] === '') break;
      nextRow = 6 + i + 1;
    }

    const values = [[
      nextRow - 5,         // A: №
      data.name || '',     // B: Название
      data.source || '',   // C: Источник
      data.portfolio || '',// D: Портфолио
      data.price || '',    // E: Стоимость
      data.extra || '',    // F: Доп. инфо
      data.kp || '',       // G: КП
      data.site || '',     // H: Сайт
      data.contacts || '', // I: Контакты
      data.comment || '',  // J: Комментарий
    ]];

    await sheetsApi.spreadsheets.values.update({
      spreadsheetId: TENDER_SPREADSHEET_ID,
      range: `'${sheetName}'!A${nextRow}:J${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return nextRow;
  } catch (err) {
    console.error(`addContractor(${type}) error:`, err.message);
    return -1;
  }
}

/**
 * Update contractor scoring (columns Q-U)
 */
async function updateContractorScore(type, rowIndex, scores) {
  if (!TENDER_SPREADSHEET_ID) return false;
  const sheetsApi = await getSheets();
  const sheetName = `Тендер ${type}`;

  try {
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId: TENDER_SPREADSHEET_ID,
      range: `'${sheetName}'!Q${rowIndex}:U${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[scores.experience, scores.quality, scores.fit, '', scores.communication]] },
    });
    return true;
  } catch (err) {
    console.error(`updateContractorScore error:`, err.message);
    return false;
  }
}

function getTenderSheetUrl() {
  if (!TENDER_SPREADSHEET_ID) return 'Тендерная таблица не настроена. Запустите scripts/init-tender-sheet.js';
  return `https://docs.google.com/spreadsheets/d/${TENDER_SPREADSHEET_ID}`;
}

// ─── CJM / S-ID метрики ──────────────────────────────────────────────────────

// S-ID → этап воронки маппинг (из smm-karta-kommunikatsiy.md)
const SID_STAGES = {
  'S-01': 'Привлечение', 'S-02': 'Прогрев', 'S-03': 'Продажа', 'S-04': 'Лояльность',
  'S-05': 'Привлечение', 'S-06': 'Прогрев', 'S-07': 'Продажа', 'S-08': 'Лояльность',
  'S-09': 'Привлечение', 'S-10': 'Прогрев', 'S-11': 'Прогрев', 'S-12': 'Продажа',
  'S-13': 'Привлечение', 'S-14': 'Прогрев', 'S-15': 'Лояльность',
  'S-16': 'Привлечение', 'S-17': 'Прогрев', 'S-18': 'Прогрев', 'S-19': 'Продажа',
  'S-20': 'Продажа', 'S-21': 'Продажа', 'S-22': 'Привлечение', 'S-23': 'Продажа',
  'S-24': 'Прогрев', 'S-25': 'Прогрев',
};

const SID_NAMES = {
  'S-01': 'Группа недели', 'S-02': 'Backstage/репетиция', 'S-03': 'Стандарт отбора',
  'S-04': 'Скетч Оли', 'S-05': 'Хедлайнер анонс', 'S-06': 'FAQ логистика',
  'S-07': 'Мы другие', 'S-08': 'Кругляшок амбассадора', 'S-09': 'Атмосфера',
  'S-10': 'Extreme Opros', 'S-11': 'Комикс маскоты', 'S-12': 'FOMO билеты',
  'S-13': 'Backstage техника', 'S-14': 'Ernie Ball партнёр', 'S-15': 'Backstage-зона нетворк',
  'S-16': 'Скейт-зона', 'S-17': 'Fast Food серия', 'S-18': 'Площадка визуал',
  'S-19': 'Снаружи скейт → внутри металл', 'S-20': 'Розыгрыш', 'S-21': 'Мерч-витрина',
  'S-22': 'FAQ маршруты', 'S-23': 'Last Call обратный отсчёт', 'S-24': 'Амбассадор видео',
  'S-25': 'Ernie Ball партнёрский',
};

async function getSIDMetrics() {
  const api = await getSheetsApi();
  if (!api) return null;
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_CONTENT}'!D${DATA_START_ROW}:P200`,
  });
  const rows = res.data.values || [];
  const metrics = {};
  for (const row of rows) {
    const sid = (row[0] || '').trim();
    if (!sid || !sid.startsWith('S-')) continue;
    const reachFact = parseFloat(row[10]) || 0;
    const errFact = parseFloat((row[12] || '').replace(',', '.').replace('%', '')) || 0;
    if (!metrics[sid]) {
      metrics[sid] = { count: 0, totalReach: 0, totalErr: 0, name: SID_NAMES[sid] || sid, stage: SID_STAGES[sid] || '?' };
    }
    metrics[sid].count++;
    metrics[sid].totalReach += reachFact;
    metrics[sid].totalErr += errFact;
  }
  for (const sid in metrics) {
    const m = metrics[sid];
    m.avgReach = m.count > 0 ? Math.round(m.totalReach / m.count) : 0;
    m.avgErr = m.count > 0 ? (m.totalErr / m.count).toFixed(1) : '0';
  }
  return metrics;
}

async function getSIDCoverage() {
  const metrics = await getSIDMetrics();
  if (!metrics) return null;
  const allSIDs = Object.keys(SID_STAGES);
  const stages = { 'Привлечение': { target: 40, sids: [] }, 'Прогрев': { target: 25, sids: [] }, 'Продажа': { target: 20, sids: [] }, 'Лояльность': { target: 15, sids: [] } };
  for (const sid of allSIDs) {
    const stage = SID_STAGES[sid];
    const m = metrics[sid];
    stages[stage].sids.push({
      sid, name: SID_NAMES[sid] || sid,
      count: m ? m.count : 0,
      avgReach: m ? m.avgReach : 0,
      covered: m ? m.count > 0 : false,
    });
  }
  for (const stage in stages) {
    const s = stages[stage];
    s.total = s.sids.length;
    s.covered = s.sids.filter(x => x.covered).length;
    s.totalPosts = s.sids.reduce((sum, x) => sum + x.count, 0);
  }
  return stages;
}

module.exports = {
  // Reading — SMM
  getWeekPlan,
  getFunnelBalance,
  getPostsByStatus,
  getRubricStats,
  // Writing — SMM
  addDraftPost,
  updatePostStatus,
  updatePostMetrics,
  addIdeaToBacklog,
  // Reading — Tenders
  getTenderSummary,
  getAllTendersSummary,
  // Writing — Tenders
  addContractor,
  updateContractorScore,
  // CJM / S-ID
  getSIDMetrics,
  getSIDCoverage,
  SID_STAGES,
  SID_NAMES,
  // Utils
  getCurrentWeekNumber,
  getWeekFromDate,
  getSheetUrl,
  getTenderSheetUrl,
  isConfigured,
};
