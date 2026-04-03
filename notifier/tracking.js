'use strict';

const fs = require('fs');
const path = require('path');

const TRACKING_DIR = path.join(__dirname, '..', 'output', 'tracking');

// ─── Helpers ────────────────────────────────────────────────────────────────

function readFile(filename) {
  const filePath = path.join(TRACKING_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filename, content) {
  const filePath = path.join(TRACKING_DIR, filename);
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Parse markdown table rows from content.
 * Returns lines that start with | and contain status emojis or data.
 * Skips header rows (containing --- or column names like Имя, Статус etc.)
 */
function isDataRow(line) {
  return line.startsWith('|') &&
    !line.includes('---') &&
    !line.match(/^\|\s*#\s*\|/) &&
    !line.match(/^\|\s*Имя\s/) &&
    !line.match(/^\|\s*Категория\s/) &&
    !line.match(/^\|\s*Уровень\s/) &&
    !line.match(/^\|\s*Партнёр\s/) &&
    !line.match(/^\|\s*Станция\s/) &&
    !line.match(/^\|\s*Медиа\s/) &&
    !line.match(/^\|\s*Платформа\s/) &&
    !line.match(/^\|\s*Период\s/) &&
    !line.match(/^\|\s*Дата\s/) &&
    !line.match(/^\|\s*Тендер\s/) &&
    !line.match(/^\|\s*Волна\s/);
}

const STATUS_EMOJIS = ['🔴', '🟡', '🟠', '🟢', '✅', '📋', '🎯'];

function hasStatus(line) {
  return STATUS_EMOJIS.some(e => line.includes(e));
}

function getStatus(line) {
  // Return the last status emoji found in the line (typically the status column)
  let found = null;
  for (const emoji of STATUS_EMOJIS) {
    if (line.includes(emoji)) found = emoji;
  }
  return found;
}

function replaceStatus(line, newStatus) {
  // Replace any existing status emoji with the new one
  let result = line;
  for (const emoji of STATUS_EMOJIS) {
    result = result.split(emoji).join(newStatus);
  }
  return result;
}

function extractName(line) {
  // Extract bold name from table row: **Name** or **Name (Details)**
  const match = line.match(/\*\*([^*]+)\*\*/);
  return match ? match[1].trim() : null;
}

// ─── Ambassadors ────────────────────────────────────────────────────────────

function getAmbassadorStats() {
  const content = readFile('ambassadors.md');
  if (!content) return { total: 0, pitched: 0, agreed: 0, done: 0, notPitched: [] };

  const lines = content.split('\n');
  const stats = { total: 0, pitched: 0, agreed: 0, done: 0, notPitched: [] };

  for (const line of lines) {
    if (!isDataRow(line) || !hasStatus(line)) continue;

    const name = extractName(line);
    if (!name || name.startsWith('[')) continue; // skip placeholder rows like [Группа 5]

    stats.total++;
    const status = getStatus(line);

    if (status === '🟡' || status === '🟠') stats.pitched++;
    if (status === '🟢') stats.agreed++;
    if (status === '✅' || status === '📋' || status === '🎯') stats.done++;

    if (status === '🔴') {
      // Extract group info from the row
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      stats.notPitched.push({
        name: name,
        group: cols[1] || name, // col with name/group
        status: '🔴'
      });
    }
  }

  return stats;
}

function updateAmbassadorStatus(name, newStatus) {
  const content = readFile('ambassadors.md');
  if (!content) return false;

  const lines = content.split('\n');
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`**${name}**`) && hasStatus(lines[i])) {
      lines[i] = replaceStatus(lines[i], newStatus);
      found = true;
      break;
    }
  }

  if (!found) {
    // Try partial name match
    const nameLower = name.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const rowName = extractName(lines[i]);
      if (rowName && rowName.toLowerCase().includes(nameLower) && hasStatus(lines[i])) {
        lines[i] = replaceStatus(lines[i], newStatus);
        found = true;
        break;
      }
    }
  }

  if (found) {
    writeFile('ambassadors.md', lines.join('\n'));
  }
  return found;
}

// ─── Partners ───────────────────────────────────────────────────────────────

function getPartnerStats() {
  const content = readFile('partners.md');
  if (!content) return { total: 0, contacted: 0, confirmed: 0, notContacted: [] };

  const lines = content.split('\n');
  const stats = { total: 0, contacted: 0, confirmed: 0, notContacted: [] };

  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---')) continue;
    if (!hasStatus(line)) continue;

    const name = extractName(line);
    if (!name) continue;

    // Skip header-like rows
    if (line.match(/^\|\s*#\s*\|/)) continue;

    stats.total++;
    const status = getStatus(line);

    if (status === '🟡' || status === '🟠') stats.contacted++;
    if (status === '🟢' || status === '✅' || status === '📋') stats.confirmed++;

    if (status === '🔴') {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      stats.notContacted.push({
        name: name,
        type: cols[2] || '',
        status: '🔴'
      });
    }
  }

  return stats;
}

function updatePartnerStatus(name, newStatus) {
  const content = readFile('partners.md');
  if (!content) return false;

  const lines = content.split('\n');
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`**${name}**`) && hasStatus(lines[i])) {
      lines[i] = replaceStatus(lines[i], newStatus);
      found = true;
      break;
    }
  }

  if (!found) {
    const nameLower = name.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const rowName = extractName(lines[i]);
      if (rowName && rowName.toLowerCase().includes(nameLower) && hasStatus(lines[i])) {
        lines[i] = replaceStatus(lines[i], newStatus);
        found = true;
        break;
      }
    }
  }

  if (found) {
    writeFile('partners.md', lines.join('\n'));
  }
  return found;
}

// ─── Bloggers ───────────────────────────────────────────────────────────────

function getBloggerStats() {
  const content = readFile('bloggers.md');
  if (!content) return { total: 0, published: 0, active: 0, notYet: [] };

  const lines = content.split('\n');
  const stats = { total: 0, published: 0, active: 0, notYet: [] };

  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---')) continue;
    if (!hasStatus(line)) continue;

    const name = extractName(line);
    if (!name) continue;
    if (line.match(/^\|\s*#\s*\|/)) continue;

    stats.total++;
    const status = getStatus(line);

    if (status === '✅') stats.published++;
    if (status === '🟡' || status === '🟠' || status === '🟢') stats.active++;

    if (status === '🔴') {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      stats.notYet.push({
        name: name,
        channel: cols[2] || '', // platform column
        status: '🔴'
      });
    }
  }

  return stats;
}

function updateBloggerStatus(name, newStatus) {
  const content = readFile('bloggers.md');
  if (!content) return false;

  const lines = content.split('\n');
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`**${name}**`) && hasStatus(lines[i])) {
      lines[i] = replaceStatus(lines[i], newStatus);
      found = true;
      break;
    }
  }

  if (!found) {
    const nameLower = name.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const rowName = extractName(lines[i]);
      if (rowName && rowName.toLowerCase().includes(nameLower) && hasStatus(lines[i])) {
        lines[i] = replaceStatus(lines[i], newStatus);
        found = true;
        break;
      }
    }
  }

  if (found) {
    writeFile('bloggers.md', lines.join('\n'));
  }
  return found;
}

// ─── Sales ──────────────────────────────────────────────────────────────────

function getSalesData() {
  const content = readFile('sales.md');
  if (!content) return { total: 0, lastUpdate: null, monthlyTargets: [] };

  // Extract current total
  const soldMatch = content.match(/Продано:\s*(\d+)/);
  const total = soldMatch ? parseInt(soldMatch[1]) : 0;

  // Extract last update date
  const dateMatch = content.match(/Дата обновления:\s*(\S+)/);
  const lastUpdate = dateMatch ? dateMatch[1] : null;

  // Extract monthly targets table
  const monthlyTargets = [];
  const lines = content.split('\n');
  let inTargets = false;

  for (const line of lines) {
    if (line.includes('Цели по месяцам') || line.includes('Период')) {
      inTargets = true;
      continue;
    }
    if (inTargets && line.startsWith('|') && !line.includes('---') && !line.includes('Период')) {
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 3) {
        monthlyTargets.push({
          month: cols[0],
          target: cols[1],
          actual: cols[2] === '—' ? null : cols[2]
        });
      }
    }
    if (inTargets && line.trim() === '' && monthlyTargets.length > 0) {
      inTargets = false;
    }
  }

  return { total, lastUpdate, monthlyTargets };
}

function updateSalesData(count, date) {
  const content = readFile('sales.md');
  if (!content) return false;

  const dateStr = date || new Date().toISOString().slice(0, 10);
  let updated = content;

  // Read previous count to calculate delta
  const prevMatch = updated.match(/Продано:\s*(\d+)/);
  const prevCount = prevMatch ? parseInt(prevMatch[1]) : 0;
  const delta = count - prevCount;

  // Update current total
  updated = updated.replace(/Продано:\s*\d+/, `Продано: ${count}`);

  // Update date
  updated = updated.replace(/Дата обновления:\s*\S+/, `Дата обновления: ${dateStr}`);

  // Add row to history table (before the last empty line in history section)
  const historyRow = `| ${dateStr} | ${count} | +${delta} | TicketsCloud | Обновление |`;
  const lines = updated.split('\n');
  let lastHistoryRow = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('|') && lines[i].includes('TicketsCloud')) {
      lastHistoryRow = i;
    }
  }
  if (lastHistoryRow >= 0) {
    lines.splice(lastHistoryRow + 1, 0, historyRow);
    updated = lines.join('\n');
  }

  writeFile('sales.md', updated);
  return true;
}

// ─── Budget ─────────────────────────────────────────────────────────────────

function getBudgetData() {
  const content = readFile('budget.md');
  if (!content) return { totalBudget: 0, spent: 0, remaining: 0, items: [] };

  const lines = content.split('\n');
  const items = [];
  let totalBudget = 0;
  let spent = 0;

  // Try to parse budget summary
  const totalMatch = content.match(/Общий бюджет[:\s]*(\d[\d\s]*)/i);
  if (totalMatch) totalBudget = parseInt(totalMatch[1].replace(/\s/g, ''));

  const spentMatch = content.match(/Потрачено[:\s]*(\d[\d\s]*)/i);
  if (spentMatch) spent = parseInt(spentMatch[1].replace(/\s/g, ''));

  // Parse table rows
  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---')) continue;
    if (line.match(/^\|\s*#\s*\|/) || line.match(/^\|\s*Статья\s/i) || line.match(/^\|\s*Категория\s/i)) continue;

    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length >= 3) {
      const name = cols[0].replace(/\*\*/g, '').trim();
      if (!name || name === '#' || name === 'ИТОГО') continue;
      const plan = parseInt((cols[1] || '0').replace(/[^\d]/g, '')) || 0;
      const fact = parseInt((cols[2] || '0').replace(/[^\d]/g, '')) || 0;
      const rem = cols[3] ? parseInt(cols[3].replace(/[^\d]/g, '')) || 0 : plan - fact;
      items.push({ name, plan, fact, remaining: rem });
    }
  }

  // Compute totals from items if not found in header
  if (!totalBudget && items.length > 0) {
    totalBudget = items.reduce((s, it) => s + it.plan, 0);
    spent = items.reduce((s, it) => s + it.fact, 0);
  }

  return {
    totalBudget,
    spent,
    remaining: totalBudget - spent,
    items
  };
}

function updateBudgetItem(name, amount) {
  const content = readFile('budget.md');
  if (!content) return false;

  const lines = content.split('\n');
  let found = false;
  const nameLower = name.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|') || line.includes('---')) continue;

    const rowName = extractName(line) || '';
    const plainName = line.split('|').map(c => c.trim()).filter(Boolean)[0] || '';
    const checkName = (rowName || plainName).replace(/\*\*/g, '').trim().toLowerCase();

    if (checkName.includes(nameLower)) {
      // Update the "fact" column (3rd column, index 2)
      const cols = line.split('|');
      // cols[0] is empty (before first |), cols[1] is name, cols[2] is plan, cols[3] is fact
      if (cols.length >= 4) {
        cols[3] = ` ${amount} `;
        // Recalculate remaining if there's a 4th data column
        if (cols.length >= 5) {
          const plan = parseInt((cols[2] || '0').replace(/[^\d]/g, '')) || 0;
          cols[4] = ` ${plan - amount} `;
        }
        lines[i] = cols.join('|');
        found = true;
        break;
      }
    }
  }

  if (found) {
    writeFile('budget.md', lines.join('\n'));
  }
  return found;
}

// ─── Tenders ────────────────────────────────────────────────────────────────

function addTenderKP(type, contractor, price) {
  const content = readFile('tenders.md');
  if (!content) return false;

  const lines = content.split('\n');
  let found = false;
  const typeLower = type.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|') || line.includes('---')) continue;

    // Find tender row by type name
    if (line.toLowerCase().includes(typeLower)) {
      // Increment KP count: "0 / 30" → "1 / 30"
      lines[i] = line.replace(/(\d+)\s*\/\s*(\d+)/, (match, current, total) => {
        return `${parseInt(current) + 1} / ${total}`;
      });
      found = true;
      break;
    }
  }

  // Append KP details to the end of the file
  const kpLine = `\n| ${type} | ${contractor} | ${price} | ${new Date().toISOString().slice(0, 10)} |`;

  // Check if KP details section exists
  if (content.includes('## КП получены') || content.includes('## Полученные КП')) {
    lines.push(kpLine);
  } else {
    lines.push('');
    lines.push('## Полученные КП');
    lines.push('');
    lines.push('| Тендер | Подрядчик | Цена | Дата |');
    lines.push('|---|---|---|---|');
    lines.push(kpLine);
  }

  writeFile('tenders.md', lines.join('\n'));
  return true;
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  getAmbassadorStats,
  updateAmbassadorStatus,
  getPartnerStats,
  updatePartnerStatus,
  getBloggerStats,
  updateBloggerStatus,
  getSalesData,
  updateSalesData,
  getBudgetData,
  updateBudgetItem,
  addTenderKP
};
