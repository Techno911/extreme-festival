export interface BudgetLine {
  category: string;
  planned: number;
  spent: number;
  sectionId?: string; // links to a tactic section if exists
}

export const budgetLines: BudgetLine[] = [
  { category: 'Сайт (подрядчик)', planned: 200000, spent: 0, sectionId: 'site' },
  { category: 'Трейлер (видео)', planned: 150000, spent: 0, sectionId: 'trailer' },
  { category: 'Блогеры и посевы', planned: 300000, spent: 0, sectionId: 'bloggers' },
  { category: 'Таргет ВКонтакте', planned: 400000, spent: 0 },
  { category: 'Посевы Telegram', planned: 150000, spent: 0 },
  { category: 'Мерч (производство)', planned: 100000, spent: 0, sectionId: 'merch' },
  { category: 'Флаеры и полиграфия', planned: 50000, spent: 0 },
  { category: 'Резерв', planned: 150000, spent: 0 },
];

export const totalBudget = budgetLines.reduce((sum, l) => sum + l.planned, 0);
export const totalSpent = budgetLines.reduce((sum, l) => sum + l.spent, 0);
