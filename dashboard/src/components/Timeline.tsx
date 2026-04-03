import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { phases, milestones } from '../data/timeline';
import { getCurrentWeek } from '../data/kpis';
import type { useDashboardState } from '../hooks/useDashboardState';

interface TimelineProps {
  dashState: ReturnType<typeof useDashboardState>;
}

export function Timeline({ dashState: _dashState }: TimelineProps) {
  const currentWeek = getCurrentWeek();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Таймлайн: 14 недель до фестиваля</h1>
        <p className="text-sm text-text-dim mt-1">
          4 фазы: Узнаваемость → Прогрев → Ажиотаж → Последний шанс.
          {currentWeek > 0 && currentWeek <= 14 && (
            <span className="text-brand ml-1">Сейчас: неделя {currentWeek}</span>
          )}
        </p>
      </div>

      {/* Phase overview bar */}
      <div className="flex rounded-xl overflow-hidden h-10 border border-border">
        {phases.map((phase) => {
          const totalWeeks = phase.weeks.length;
          const widthPct = (totalWeeks / 14) * 100;
          const isCurrent = phase.weeks.some((w) => w.number === currentWeek);
          return (
            <div
              key={phase.id}
              className={`flex items-center justify-center text-xs font-medium text-white transition-all ${isCurrent ? 'ring-2 ring-white/50' : ''}`}
              style={{ width: `${widthPct}%`, backgroundColor: phase.color }}
            >
              {phase.name}
            </div>
          );
        })}
      </div>

      {/* Milestone markers */}
      <div>
        <h2 className="text-sm font-semibold text-text-dim uppercase tracking-wider mb-3">Критические точки</h2>
        <div className="flex gap-2 flex-wrap">
          {milestones.map((m, i) => {
            const date = new Date(m.date);
            const isOverdue = date < new Date() && !m.done;
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  isOverdue
                    ? 'border-danger/60 bg-danger/15 text-danger'
                    : m.critical
                      ? 'border-danger/40 bg-danger/10 text-danger'
                      : 'border-border bg-surface-2 text-text-dim'
                }`}
              >
                {(m.critical || isOverdue) && <AlertTriangle size={10} />}
                <span>{date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                <span className="opacity-50">—</span>
                <span>{m.title}</span>
                <span className="opacity-40 hidden sm:inline">({m.fallback})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phases detail */}
      {phases.map((phase) => (
        <div key={phase.id} className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: phase.color }}
            />
            <h2 className="text-lg font-semibold text-text">{phase.name}</h2>
            <span className="text-sm text-text-dim">{phase.subtitle}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 ml-6">
            {phase.weeks.map((week) => {
              const doneTasks = week.tasks.filter((t) => t.done).length;
              const weekStart = new Date(week.startDate);
              const weekEnd = new Date(week.endDate);
              const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
              const isCurrent = week.number === currentWeek;
              const isPast = weekEnd < new Date();

              return (
                <div
                  key={week.number}
                  className={`bg-surface-2 border rounded-2xl p-4 transition-all ${
                    isCurrent
                      ? 'border-brand/50 ring-1 ring-brand/20'
                      : isPast
                        ? 'border-border/50 opacity-60'
                        : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text">
                        Неделя {week.number}
                      </span>
                      {isCurrent && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-brand/20 text-brand font-medium">
                          сейчас
                        </span>
                      )}
                      <span className="text-xs text-text-dim">
                        {fmt(weekStart)} — {fmt(weekEnd)}
                      </span>
                    </div>
                    <span className="text-xs text-text-dim">
                      {doneTasks}/{week.tasks.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {week.tasks.map((task, ti) => (
                      <div key={ti} className="flex items-start gap-2">
                        {task.done ? (
                          <CheckCircle2 size={16} className="text-success mt-0.5 shrink-0" />
                        ) : (
                          <Circle size={16} className="text-text-dim mt-0.5 shrink-0" />
                        )}
                        <span className={`text-sm flex-1 ${task.done ? 'text-text-dim line-through' : 'text-text'}`}>
                          {task.title}
                        </span>
                        {task.critical && (
                          <AlertTriangle size={10} className="text-danger shrink-0 mt-1" />
                        )}
                        <span className="text-xs px-1.5 py-0.5 rounded bg-surface-3 text-text-dim shrink-0">
                          {task.section}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
