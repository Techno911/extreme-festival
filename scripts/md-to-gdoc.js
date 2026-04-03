#!/usr/bin/env node
/**
 * md-to-gdoc.js — Конвертирует .md артефакт в Google Doc и возвращает ссылку
 * 
 * Использование: node scripts/md-to-gdoc.js <path-to-md> <doc-title>
 * Пример: node scripts/md-to-gdoc.js output/outreach/tender-site/marketing-brief.md "Маркетинговый бриф — Эстрим Фест"
 * 
 * Результат: ссылка на Google Doc (доступ по ссылке без авторизации)
 */

const path = require('path');
const fs = require('fs');
const notifierDir = path.join(__dirname, '..', 'notifier');
require(path.join(notifierDir, 'node_modules', 'dotenv')).config({ path: path.join(notifierDir, '.env') });
const { google } = require(path.join(notifierDir, 'node_modules', 'googleapis'));

async function main() {
  const mdPath = process.argv[2];
  const title = process.argv[3] || path.basename(mdPath, '.md');

  if (!mdPath || !fs.existsSync(mdPath)) {
    console.error('Usage: node scripts/md-to-gdoc.js <path-to-md> <doc-title>');
    process.exit(1);
  }

  // Auth
  const credPath = path.join(notifierDir, '.google-credentials.json');
  const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  const oauth = new google.auth.OAuth2(creds.installed.client_id, creds.installed.client_secret);
  oauth.setCredentials(JSON.parse(fs.readFileSync(path.join(notifierDir, '.google-token.json'), 'utf8')));

  const docs = google.docs({ version: 'v1', auth: oauth });
  const drive = google.drive({ version: 'v3', auth: oauth });

  // Read markdown
  const content = fs.readFileSync(mdPath, 'utf8');

  // Create empty doc
  const doc = await docs.documents.create({ requestBody: { title } });
  const docId = doc.data.documentId;

  // Insert content as plain text (Google Docs API)
  // Simple approach: insert the full text, then format headers
  const cleanContent = content
    .replace(/^>.*$/gm, '') // remove blockquotes (metadata)
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, '')) // remove code fences but keep content
    .replace(/\*\*(.+?)\*\*/g, '$1') // remove bold markers (will be text)
    .replace(/^#{1,3}\s+/gm, '') // remove heading markers
    .replace(/^---$/gm, '—————————————————————') // hr
    .replace(/^\|.*\|$/gm, (line) => line.replace(/\|/g, '\t').trim()) // tables to tabs
    .trim();

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [{
        insertText: {
          location: { index: 1 },
          text: cleanContent,
        }
      }]
    }
  });

  // Make publicly accessible via link
  await drive.permissions.create({
    fileId: docId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    }
  });

  const url = `https://docs.google.com/document/d/${docId}/edit`;
  console.log(JSON.stringify({ docId, url, title }));
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
