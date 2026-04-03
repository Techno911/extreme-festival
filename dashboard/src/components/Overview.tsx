import { ExternalLink, CheckCircle2, Circle, AlertTriangle, Clock, Zap, History } from 'lucide-react';
import { sections, type Section, type SectionStatus } from '../data/sections';
import { milestones, phases } from '../data/timeline';
import { getCurrentWeek } from '../data/kpis';
import { SHEETS_MAIN, SHEETS_TENDER } from '../data/links';
import type { useDashboardState } from '../hooks/useDashboardState';

function statusBadge(status: SectionStatus) {
  const map = {
    'done': { cls: 'bg-success/20 text-success', label: 'Готово' },
    'in-progress': { cls: 'bg-warning/20 text-warning', label: 'В работе' },
    'not-started': { cls: 'bg-text-dim/20 text-text-dim', label: 'Не начат' },
    'blocked': { cls: 'bg-danger/20 text-danger', label: 'Заблокирован' },
  };
  const { cls, label } = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs ${cls}`}>{label}</span>;
}

function SectionCard({ section, onClick, dashState }: {
  section: Section;
  onClick: () => void;
  dashState: ReturnType<typeof useDashboardState>;
}) {
  const { isCheckpointDone } = dashState;
  let doneCount = 0;
  section.checkpoints.forEach((cp, i) => {
    if (isCheckpointDone(section.id, i, cp.done)) doneCount++;
  });
  const totalCount = section.checkpoints.length;
  const liveProgress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const liveStatus: SectionStatus = liveProgress === 100 ? 'done' : liveProgress > 0 ? 'in-progress' : section.status;

  return (
    <button
      onClick={onClick}
      className="bg-surface-2 border border-border rounded-2xl p-4 text-left hover:border-brand/50 transition-all w-full group"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div>
            <div className="text-sm font-medium text-text">{section.title}</div>
            <div className="text-xs text-text-dim">{section.subtitle}</div>
          </div>
        </div>
        {statusBadge(liveStatus)}
      </div>

      <div className="w-full h-1.5 rounded-full bg-surface-3 mt-3 mb-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${liveProgress}%`,
            backgroundColor: liveProgress === 100 ? '#22C55E' : liveProgress > 0 ? '#EAB308' : '#333',
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-text-dim">
        <span>{doneCount}/{totalCount} чекпоинтов</span>
        {section.budget && section.budget !== '—' && (
          <span className="text-brand">{section.budget}</span>
        )}
        {section.deadline && <span>{section.deadline}</span>}
      </div>

      {section.keyMetric && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-text-dim">{section.keyMetric}</span>
          <span className="font-medium text-text">{section.keyMetricValue}</span>
        </div>
      )}
    </button>
  );
}

interface OverviewProps {
  onNavigate: (id: string) => void;
  dashState: ReturnType<typeof useDashboardState>;
}

export function Overview({ onNavigate, dashState }: OverviewProps) {
  const { isCheckpointDone } = dashState;

  // Count statuses using live state
  let doneCount = 0;
  let inProgressCount = 0;
  let notStartedCount = 0;
  for (const s of sections) {
    let doneCps = 0;
    s.checkpoints.forEach((cp, i) => {
      if (isCheckpointDone(s.id, i, cp.done)) doneCps++;
    });
    const pct = s.checkpoints.length > 0 ? doneCps / s.checkpoints.length : 0;
    if (pct === 1) doneCount++;
    else if (pct > 0 || s.status === 'in-progress') inProgressCount++;
    else notStartedCount++;
  }

  const upcomingMilestones = milestones.filter((m) => !m.done).slice(0, 5);

  // Recent changelog
  const recentChanges = (dashState.state?.changelog ?? []).slice(-3).reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">Маркетинговая тактика</h1>
        <p className="text-sm text-text-dim mt-1">
          Эстрим Фест — 11 июля 2026, Москва. 12 групп + иностранный хедлайнер. Цель: 1000+ билетов.
        </p>
      </div>

      {/* TODAY — what Женя should do RIGHT NOW */}
      <div className="bg-surface-2 border-2 border-brand/40 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-brand" />
          <h2 className="text-base font-semibold text-text">Сегодня</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-brand/5 border border-brand/20">
            <span className="text-brand mt-0.5">1.</span>
            <div>
              <div className="text-sm text-text">Отправь питч Rock FM</div>
              <div className="text-xs text-text-dim mt-1">
                Скопируй из <a href="/api/file?path=output/outreach/partners/rockfm-pitch-final.md" target="_blank" className="text-brand hover:underline">rockfm-pitch-final.md</a> → вставь в ТГ редактору
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-3 border border-border">
            <span className="text-text-dim mt-0.5">2.</span>
            <div>
              <div className="text-sm text-text">Отправь 3 питча амбассадорам</div>
              <div className="text-xs text-text-dim mt-1">
                Файлы в <a href="/api/file?path=output/outreach/ambassadors/01_leos.md" target="_blank" className="text-brand hover:underline">outreach/ambassadors/</a> — Леос, Титаев, Master
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-3 border border-border">
            <span className="text-text-dim mt-0.5">3.</span>
            <div>
              <div className="text-sm text-text">Отправь бриф 5 подрядчикам сайта</div>
              <div className="text-xs text-text-dim mt-1">
                Письмо: <a href="/api/file?path=output/outreach/tender-site/outreach-letter.md" target="_blank" className="text-brand hover:underline">outreach-letter.md</a> + бриф: <a href="/api/file?path=output/outreach/tender-site/marketing-brief.md" target="_blank" className="text-brand hover:underline">marketing-brief.md</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        <a
          href={SHEETS_MAIN}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-text hover:border-brand/50 transition-colors"
        >
          <ExternalLink size={14} />
          Контент-план
        </a>
        <a
          href={SHEETS_TENDER}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-text hover:border-brand/50 transition-colors"
        >
          <ExternalLink size={14} />
          Тендеры
        </a>
        <button
          onClick={() => onNavigate('timeline')}
          className="flex items-center gap-2 bg-brand text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-brand-dark transition-colors"
        >
          Таймлайн →
        </button>
        <button
          onClick={() => onNavigate('changelog')}
          className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-text hover:border-brand/50 transition-colors"
        >
          <History size={14} />
          Лог изменений
        </button>
      </div>

      {/* This Week */}
      <ThisWeekBlock />

      {/* Recent changes from agents */}
      {recentChanges.length > 0 && (
        <div className="bg-surface-2 border border-brand/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <History size={16} className="text-brand" />
            <h2 className="text-sm font-semibold text-text">Последние обновления от агентов</h2>
          </div>
          <div className="space-y-2">
            {recentChanges.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-text-dim shrink-0">
                  {new Date(entry.timestamp).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-surface-3 text-brand shrink-0">{entry.agent}</span>
                <span className="text-text">{entry.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestones */}
      <div>
        <h2 className="text-lg font-semibold text-text mb-3">Ближайшие дедлайны</h2>
        <div className="space-y-2">
          {upcomingMilestones.map((m, i) => {
            const date = new Date(m.date);
            const now = new Date();
            const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const isUrgent = daysLeft <= 14;
            const isOverdue = daysLeft < 0;

            return (
              <div
                key={i}
                className={`flex items-center gap-4 bg-surface-2 border rounded-xl p-3 transition-colors ${
                  isOverdue ? 'border-danger/50 bg-danger/5' : m.critical ? 'border-danger/30' : 'border-border'
                }`}
              >
                <div className={`text-center min-w-[60px] ${isOverdue ? 'text-danger' : isUrgent ? 'text-warning' : 'text-text-dim'}`}>
                  <div className="text-lg font-bold tabular-nums">{isOverdue ? `+${Math.abs(daysLeft)}` : daysLeft}</div>
                  <div className="text-xs">{isOverdue ? 'просрочен' : 'дней'}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">{m.title}</span>
                    {m.critical && <AlertTriangle size={12} className="text-danger shrink-0" />}
                  </div>
                  <div className="text-xs text-text-dim mt-0.5">
                    {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — Fallback: {m.fallback}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All sections grid */}
      <div>
        <h2 className="text-lg font-semibold text-text mb-3">Все разделы тактики</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              onClick={() => onNavigate(section.id)}
              dashState={dashState}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ThisWeekBlock() {
  const weekNum = getCurrentWeek();
  let currentWeek = null;
  let currentPhase = null;
  for (const phase of phases) {
    const found = phase.weeks.find((w) => w.number === weekNum);
    if (found) {
      currentWeek = found;
      currentPhase = phase;
      break;
    }
  }

  if (!currentWeek || !currentPhase) {
    const preStart = weekNum === 0;
    return (
      <div className="bg-surface-2 border border-brand/30 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={18} className="text-brand" />
          <h2 className="text-base font-semibold text-text">
            {preStart ? 'Старт через несколько дней' : 'Фестиваль завершён'}
          </h2>
        </div>
        <p className="text-sm text-text-dim">
          {preStart
            ? 'Кампания стартует 7 апреля. Подготовься: тендер на сайт, первые питчи инфопартнёрам.'
            : 'Маркетинговая кампания завершена.'}
        </p>
      </div>
    );
  }

  const doneTasks = currentWeek.tasks.filter((t) => t.done).length;
  const weekStart = new Date(currentWeek.startDate);
  const weekEnd = new Date(currentWeek.endDate);
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  return (
    <div className="bg-surface-2 border border-brand/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-brand" />
          <h2 className="text-base font-semibold text-text">
            Эта неделя — {currentPhase.name}
          </h2>
          <span className="text-xs text-text-dim">
            Неделя {weekNum} ({fmt(weekStart)} — {fmt(weekEnd)})
          </span>
        </div>
        <span className="text-xs text-text-dim">{doneTasks}/{currentWeek.tasks.length}</span>
      </div>
      <div className="space-y-2">
        {currentWeek.tasks.map((task, i) => (
          <div key={i} className="flex items-start gap-2">
            {task.done ? (
              <CheckCircle2 size={16} className="text-success mt-0.5 shrink-0" />
            ) : (
              <Circle size={16} className="text-text-dim mt-0.5 shrink-0" />
            )}
            <span className={`text-sm flex-1 ${task.done ? 'text-text-dim line-through' : 'text-text'}`}>
              {task.title}
            </span>
            {task.critical && <AlertTriangle size={10} className="text-danger shrink-0 mt-1" />}
            <span className="text-xs px-1.5 py-0.5 rounded bg-surface-3 text-text-dim shrink-0">
              {task.section}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
