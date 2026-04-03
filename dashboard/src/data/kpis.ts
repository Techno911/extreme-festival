export interface KPI {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  critical?: boolean;
}

export const kpis: KPI[] = [
  { id: 'tickets', label: 'Билеты', current: 16, target: 1000, unit: 'шт', trend: 'up', critical: true },
  { id: 'budget-spent', label: 'Бюджет освоен', current: 0, target: 1500000, unit: '₽', trend: 'flat' },
  { id: 'ambassadors', label: 'Амбассадоры', current: 0, target: 15, unit: 'кругляшей', trend: 'flat' },
  { id: 'partners', label: 'Инфопартнёры', current: 1, target: 10, unit: 'шт', trend: 'flat' },
  { id: 'bloggers-reach', label: 'Охват блогеров', current: 0, target: 500000, unit: '', trend: 'flat' },
  { id: 'content', label: 'Черновики постов', current: 32, target: 100, unit: 'шт', trend: 'up' },
  { id: 'sections', label: 'Разделы тактики', current: 13, target: 13, unit: '/ 13', trend: 'up' },
  { id: 'tenders', label: 'Тендеры запущены', current: 0, target: 2, unit: 'шт', trend: 'flat', critical: true },
];

export function getDaysUntilFestival(): number {
  const fest = new Date('2026-07-11');
  const now = new Date();
  return Math.max(0, Math.ceil((fest.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export function getCurrentWeek(): number {
  const start = new Date('2026-04-07');
  const now = new Date();
  const diffDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 0;
  return Math.min(14, Math.floor(diffDays / 7) + 1);
}
