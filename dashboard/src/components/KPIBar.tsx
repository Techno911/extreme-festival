import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { getDaysUntilFestival } from '../data/kpis';
import type { DashboardState } from '../data/state';

interface KPIBarProps {
  state: DashboardState | null;
}

interface KPIDisplay {
  id: string;
  label: string;
  current: number;
  target: number;
  critical?: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
}

export function KPIBar({ state }: KPIBarProps) {
  const days = getDaysUntilFestival();
  const k = state?.kpis;

  const kpis: KPIDisplay[] = [
    { id: 'tickets', label: 'Билеты', current: k?.tickets ?? 16, target: 1000, critical: true },
    { id: 'budget', label: 'Бюджет', current: k?.budgetSpent ?? 0, target: 1500000 },
    { id: 'ambassadors', label: 'Амбассадоры', current: k?.ambassadors ?? 0, target: 15 },
    { id: 'partners', label: 'Партнёры', current: k?.partners ?? 1, target: 10 },
    { id: 'reach', label: 'Охват', current: k?.bloggersReach ?? 0, target: 500000 },
    { id: 'content', label: 'Черновики', current: k?.contentDrafts ?? 32, target: 100 },
    { id: 'sections', label: 'Разделы', current: k?.sectionsReady ?? 13, target: 13 },
    { id: 'tenders', label: 'Тендеры', current: k?.tendersLaunched ?? 0, target: 2, critical: true },
  ];

  return (
    <div className="bg-surface-2 border-b border-border px-6 py-3 sticky top-0 z-40">
      <div className="flex items-center gap-6 overflow-x-auto scrollbar-thin">
        {/* Days counter */}
        <div className="flex items-center gap-2 pr-6 border-r border-border shrink-0">
          <div className="text-3xl font-bold text-brand tabular-nums">{days}</div>
          <div className="text-xs text-text-dim leading-tight">
            дней до<br />фестиваля
          </div>
        </div>

        {/* KPIs */}
        {kpis.map((kpi) => {
          const pct = kpi.target > 0 ? Math.round((kpi.current / kpi.target) * 100) : 0;
          const isLow = pct < 10 && kpi.critical;

          return (
            <div key={kpi.id} className="flex items-center gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-xs text-text-dim truncate">{kpi.label}</div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg font-semibold tabular-nums ${isLow ? 'text-danger' : 'text-text'}`}>
                    {formatNumber(kpi.current)}
                  </span>
                  <span className="text-xs text-text-dim">/ {formatNumber(kpi.target)}</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                {isLow ? (
                  <AlertTriangle size={12} className="text-danger" />
                ) : pct >= 50 ? (
                  <TrendingUp size={12} className="text-success" />
                ) : pct > 0 ? (
                  <Minus size={12} className="text-text-dim" />
                ) : (
                  <TrendingDown size={12} className="text-text-dim" />
                )}
                <div className="w-12 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor: pct >= 80 ? '#22C55E' : pct >= 30 ? '#EAB308' : '#EF4444',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Scroll fade hint */}
        <div className="shrink-0 w-4" />
      </div>
    </div>
  );
}
