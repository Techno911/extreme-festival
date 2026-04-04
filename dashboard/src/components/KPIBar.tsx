import { AlertTriangle } from 'lucide-react';
import { getDaysUntilFestival } from '../data/kpis';
import type { DashboardState } from '../data/state';

interface KPIBarProps {
  state: DashboardState | null;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
}

// Expected tickets by date (linear interpolation from plan)
function getExpectedTickets(): number {
  const start = new Date('2026-03-01').getTime();
  const end = new Date('2026-07-11').getTime();
  const now = Date.now();
  const pct = Math.max(0, Math.min(1, (now - start) / (end - start)));
  return Math.round(pct * 1000);
}

export function KPIBar({ state }: KPIBarProps) {
  const days = getDaysUntilFestival();
  const k = state?.kpis;
  const lastUpdated = state?.lastUpdated;

  const tickets = k?.tickets ?? 16;
  const expected = getExpectedTickets();

  // Days color: green >60, yellow 30-60, red <30
  const daysColor = days <= 30 ? 'text-danger' : days <= 60 ? 'text-warning' : 'text-brand';

  const kpis = [
    { id: 'tickets', label: 'Билеты', current: tickets, context: `ожидание ~${expected}`, critical: tickets < expected * 0.5 },
    { id: 'ambassadors', label: 'Амбассадоры', current: k?.ambassadors ?? 0, target: 15 },
    { id: 'partners', label: 'Партнёры', current: k?.partners ?? 1, target: 10 },
    { id: 'reach', label: 'Охват', current: k?.bloggersReach ?? 0, target: 500000 },
  ];

  // Timestamp
  const updatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' })
    : '';

  return (
    <div className="bg-surface-2 border-b border-border px-6 py-2 sticky top-0 z-40">
      <div className="flex items-center gap-6 overflow-x-auto scrollbar-thin">
        {/* Days counter — urgency color */}
        <div className="flex items-center gap-2 pr-6 border-r border-border shrink-0">
          <div className={`text-3xl font-bold tabular-nums ${daysColor}`}>{days}</div>
          <div className="text-xs text-text-dim leading-tight">
            дней до<br />фестиваля
          </div>
        </div>

        {/* Tickets with context */}
        <div className="flex items-center gap-2 shrink-0">
          <div>
            <div className="text-xs text-text-dim">Билеты</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-lg font-semibold tabular-nums ${kpis[0].critical ? 'text-danger' : 'text-text'}`}>
                {tickets}
              </span>
              <span className="text-xs text-text-dim">/ 1k</span>
            </div>
            <div className="text-[10px] text-text-dim">{kpis[0].context}</div>
          </div>
          {kpis[0].critical && <AlertTriangle size={14} className="text-danger" />}
        </div>

        {/* Other KPIs — compact */}
        {kpis.slice(1).map((kpi) => (
          <div key={kpi.id} className="shrink-0 hidden sm:block">
            <div className="text-xs text-text-dim">{kpi.label}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold tabular-nums text-text">{formatNumber(kpi.current)}</span>
              <span className="text-xs text-text-dim">/ {formatNumber(kpi.target!)}</span>
            </div>
          </div>
        ))}

        {/* Timestamp */}
        {updatedStr && (
          <div className="ml-auto shrink-0 text-[10px] text-text-dim hidden md:block">
            Обновлено {updatedStr}
          </div>
        )}
      </div>
    </div>
  );
}
