'use strict';

/**
 * google-auth-setup.js
 * Получение OAuth2 refresh_token для Google Sheets API.
 * Запускать один раз, затем токен лежит в notifier/.google-token.json
 *
 * Зависимости берём из notifier/node_modules
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');
const { execSync } = require('child_process');

// Подтягиваем зависимости из notifier/
const notifierDir = path.join(__dirname, '..', 'notifier');
const { google } = require(path.join(notifierDir, 'node_modules', 'googleapis'));

const CREDENTIALS_PATH = path.join(notifierDir, '.google-credentials.json');
const TOKEN_PATH = path.join(notifierDir, '.google-token.json');
const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

// ─── Проверяем credentials ───────────────────────────────────────────────────

if (!fs.existsSync(CREDENTIALS_PATH)) {
  console.error(`\n❌ Файл credentials не найден: ${CREDENTIALS_PATH}`);
  console.error('Скачай OAuth2 client JSON из Google Cloud Console и сохрани его туда.');
  console.error('Подробнее — scripts/GOOGLE_SETUP.md\n');
  process.exit(1);
}

let credentials;
try {
  credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
} catch (e) {
  console.error('\n❌ Не удалось прочитать credentials JSON:', e.message);
  process.exit(1);
}

// Поддерживаем оба формата: {web: ...} и {installed: ...}
const creds = credentials.web || credentials.installed;
if (!creds) {
  console.error('\n❌ Неверный формат credentials.json — ожидается ключ "web" или "installed".');
  process.exit(1);
}

const { client_id, client_secret } = creds;
const oauth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

// ─── Генерируем URL и открываем браузер ─────────────────────────────────────

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

console.log('\n========================================');
console.log('  Авторизация Google OAuth2');
console.log('========================================\n');
console.log('1. Сейчас откроется браузер.');
console.log('2. Войди в Google-аккаунт и разреши доступ.');
console.log('3. Тебя перекинет обратно — скрипт всё поймает сам.\n');
console.log('Если браузер не открылся — скопируй ссылку вручную:\n');
console.log(authUrl);
console.log('');

// Пробуем открыть браузер (macOS / Linux / Windows)
try {
  const cmd =
    process.platform === 'darwin' ? `open "${authUrl}"` :
    process.platform === 'win32' ? `start "" "${authUrl}"` :
    `xdg-open "${authUrl}"`;
  execSync(cmd);
} catch (_) {
  // Не страшно — пользователь откроет вручную
}

// ─── Локальный сервер для callback ──────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname !== '/oauth2callback') {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = parsedUrl.query.code;
  const error = parsedUrl.query.error;

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Ошибка авторизации: ' + error + '</h2><p>Закрой вкладку и попробуй снова.</p>');
    console.error('\n❌ Ошибка OAuth:', error);
    server.close();
    return;
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Код авторизации не получен.</h2>');
    server.close();
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('\n✅ Токен сохранён:', TOKEN_PATH);
    console.log('   refresh_token:', tokens.refresh_token ? '*** (есть)' : '⚠️  ОТСУТСТВУЕТ — попробуй снова с параметром prompt=consent');

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html><body style="font-family:sans-serif;padding:40px;max-width:500px">
        <h2 style="color:#4CAF50">✅ Авторизация успешна!</h2>
        <p>Токен сохранён в <code>${TOKEN_PATH}</code></p>
        <p>Закрой эту вкладку и запусти следующий скрипт:</p>
        <pre style="background:#f4f4f4;padding:12px;border-radius:4px">node scripts/init-smm-sheet.js</pre>
      </body></html>
    `);
  } catch (err) {
    console.error('\n❌ Не удалось обменять код на токен:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Ошибка при получении токена.</h2><p>' + err.message + '</p>');
  }

  server.close(() => {
    console.log('\nСкрипт завершён. Теперь запусти:');
    console.log('  node scripts/init-smm-sheet.js\n');
  });
});

server.listen(REDIRECT_PORT, () => {
  console.log(`Ожидаю callback на http://localhost:${REDIRECT_PORT}/oauth2callback ...`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Порт ${REDIRECT_PORT} уже занят. Останови другой процесс и попробуй снова.`);
  } else {
    console.error('\n❌ Ошибка сервера:', err.message);
  }
  process.exit(1);
});
