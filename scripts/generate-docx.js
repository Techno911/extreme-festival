'use strict';

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak, LevelFormat, Header, Footer,
  PageNumber, BorderStyle
} = require('docx');

const TACTIC_DIR = path.join(__dirname, '../output/tactic');
const OUTPUT_PATH = path.join(__dirname, '../output/EXTREMEFEST_TACTIC_v2.docx');

// ─── Section order per contract v2 ──────────────────────────────────────────

const SECTIONS = [
  { file: 'а-стратегия.md', label: 'а) Стратегия продвижения' },
  { file: 'б-анализ-рынка.md', label: 'б) Анализ рынка и конкурентной среды' },
  { file: 'в-рекламный-бюджет.md', label: 'в) Ориентировочный рекламный бюджет' },
  { file: 'г-план-продаж-билетов.md', label: 'г) Помесячный план продаж билетов' },
  { file: 'д-сайт-тендерный-пакет.md', label: 'д) Техническое задание на сайт' },
  { file: 'е-трейлер-тендерный-пакет.md', label: 'е) Концепция видеотрейлера' },
  { file: 'ж-амбассадоры.md', label: 'ж) План работы с амбассадорами' },
  { file: 'з-инфопартнёры.md', label: 'з) Стратегия информационного партнёрства' },
  { file: 'и-блогеры.md', label: 'и) План работы с блогерами' },
  { file: 'к-контент-стратегия.md', label: 'к) Контентная стратегия' },
  { file: 'л-мерч.md', label: 'л) Рекомендации по мерчу' },
  { file: 'м-подрядчики.md', label: 'м) Подбор удалённых подрядчиков' },
  { file: 'н-календарный-план.md', label: 'н) Календарный план' },
];

// ─── Markdown to paragraphs (simplified) ────────────────────────────────────

function mdToParagraphs(md) {
  const lines = md.split('\n');
  const paragraphs = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip metadata lines
    if (trimmed.startsWith('>') && (trimmed.includes('Writer') || trimmed.includes('Researcher') || trimmed.includes('Дата:') || trimmed.includes('Статус:'))) continue;
    if (trimmed === '---') continue;
    if (trimmed === '```') continue;

    // Headings
    if (trimmed.startsWith('# ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text: trimmed.replace(/^# /, ''), bold: true, size: 32, font: 'Arial' })]
      }));
    } else if (trimmed.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
        children: [new TextRun({ text: trimmed.replace(/^## /, ''), bold: true, size: 28, font: 'Arial' })]
      }));
    } else if (trimmed.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: trimmed.replace(/^### /, ''), bold: true, size: 24, font: 'Arial' })]
      }));
    } else if (trimmed.startsWith('| ') && !trimmed.includes('---')) {
      // Table row → render as fixed-width text
      paragraphs.push(new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: trimmed, size: 18, font: 'Courier New' })]
      }));
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const text = trimmed.replace(/^[-•]\s*/, '');
      const runs = parseBoldItalic(text);
      paragraphs.push(new Paragraph({
        spacing: { after: 60 },
        indent: { left: 360 },
        children: [new TextRun({ text: '• ', size: 22, font: 'Arial' }), ...runs]
      }));
    } else if (/^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s*/, '');
      const num = trimmed.match(/^(\d+)\./)[1];
      const runs = parseBoldItalic(text);
      paragraphs.push(new Paragraph({
        spacing: { after: 60 },
        indent: { left: 360 },
        children: [new TextRun({ text: `${num}. `, size: 22, font: 'Arial' }), ...runs]
      }));
    } else if (trimmed.startsWith('> ')) {
      const text = trimmed.replace(/^>\s*/, '');
      paragraphs.push(new Paragraph({
        spacing: { after: 80 },
        indent: { left: 720 },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: 'F97316', space: 10 } },
        children: [new TextRun({ text, italics: true, size: 22, font: 'Arial', color: '666666' })]
      }));
    } else if (trimmed === '') {
      paragraphs.push(new Paragraph({ spacing: { after: 80 } }));
    } else {
      const runs = parseBoldItalic(trimmed);
      paragraphs.push(new Paragraph({
        spacing: { after: 80 },
        children: runs
      }));
    }
  }

  return paragraphs;
}

function parseBoldItalic(text) {
  const runs = [];
  // Simple bold parsing: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: 22, font: 'Arial' }));
    } else {
      runs.push(new TextRun({ text: part, size: 22, font: 'Arial' }));
    }
  }
  return runs;
}

// ─── Build document ─────────────────────────────────────────────────────────

async function build() {
  const children = [];

  // Title page
  children.push(new Paragraph({ spacing: { before: 3000 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'МАРКЕТИНГОВАЯ ТАКТИКА', bold: true, size: 48, font: 'Arial' })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: 'ЭСТРИМ ФЕСТ', bold: true, size: 60, font: 'Arial', color: 'F97316' })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: '11 июля 2026 | Москва', size: 28, font: 'Arial', color: '666666' })]
  }));
  children.push(new Paragraph({ spacing: { before: 1500 } }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Разработчик: Артём Чирков', size: 24, font: 'Arial' })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Заказчик: Евгений Аржевский', size: 24, font: 'Arial' })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    children: [new TextRun({ text: 'Версия 2.0 | Апрель 2026', size: 22, font: 'Arial', color: '999999' })]
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // TOC
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: 'Оглавление', bold: true, size: 32, font: 'Arial' })]
  }));
  for (let i = 0; i < SECTIONS.length; i++) {
    children.push(new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `${i + 1}. ${SECTIONS[i].label}`, size: 24, font: 'Arial' })]
    }));
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Sections
  for (const section of SECTIONS) {
    const filePath = path.join(TACTIC_DIR, section.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Missing: ${section.file}`);
      continue;
    }
    const md = fs.readFileSync(filePath, 'utf8');
    const sectionParas = mdToParagraphs(md);
    children.push(...sectionParas);
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // Footer note
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 600 },
    children: [new TextRun({ text: 'Конец документа. Версия 2.0 от 2026-04-01.', size: 20, font: 'Arial', color: '999999', italics: true })]
  }));

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 22 } }
      }
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1440, right: 1260, bottom: 1440, left: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Эстрим Фест — Маркетинговая тактика v2.0', size: 16, font: 'Arial', color: '999999', italics: true })]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Стр. ', size: 16, font: 'Arial', color: '999999' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '999999' })]
          })]
        })
      },
      children
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT_PATH, buffer);
  console.log(`✅ DOCX created: ${OUTPUT_PATH} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

build().catch(err => { console.error(err); process.exit(1); });
