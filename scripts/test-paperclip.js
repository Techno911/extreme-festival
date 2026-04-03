'use strict';
const path = require('path');
const notifierDir = path.join(__dirname, '..', 'notifier');
require(path.join(notifierDir, 'node_modules', 'dotenv')).config({ path: path.join(notifierDir, '.env') });
const paperclip = require(path.join(notifierDir, 'paperclip'));

async function run() {
  const running = await paperclip.isRunning();
  console.log('Paperclip running:', running);
  if (!running) { console.log('⚠️ Paperclip не запущен'); return; }

  const issue = await paperclip.createIssue(
    '[Тест] Проверка интеграции',
    'Тестовый Issue создан из paperclip.js через API',
    'researcher'
  );
  console.log('✅ Issue:', JSON.stringify(issue, null, 2));
  console.log('URL:', paperclip.getIssueUrl(issue.id));
}
run().catch(e => { console.error(e.message); process.exit(1); });
