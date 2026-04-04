import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, ExternalLink, AlertTriangle, ArrowLeft, Clock, Users } from 'lucide-react';
import { sections } from '../data/sections';
import { budgetLines, totalBudget, totalSpent } from '../data/budget';
import type { useDashboardState } from '../hooks/useDashboardState';

interface Contact { name: string; role: string; status: string; }

function ContactList({ type }: { type: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  useEffect(() => {
    fetch(`/api/contacts?type=${type}`).then(r => r.json()).then(setContacts).catch(() => {});
  }, [type]);
  if (contacts.length === 0) return null;
  const statusColors: Record<string, string> = {
    done: 'bg-success/20 text-success', agreed: 'bg-success/20 text-success',
    replied: 'bg-warning/20 text-warning', written: 'bg-brand/20 text-brand',
    new: 'bg-surface-3 text-text-dim',
  };
  const statusLabels: Record<string, string> = {
    done: 'Готово', agreed: 'Согласие', replied: 'Ответил', written: 'Написали', new: 'Новый',
  };
  return (
    <div className="bg-surface-2 border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Users size={16} className="text-brand" />
        <h2 className="text-base font-semibold text-text">Контакты ({contacts.length})</h2>
      </div>
      <div className="space-y-2">
        {contacts.map((c, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-3">
            <div>
              <div className="text-sm text-text">{c.name}</div>
              {c.role && <div className="text-xs text-text-dim">{c.role}</div>}
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[c.status] || statusColors.new}`}>
              {statusLabels[c.status] || c.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SectionDetailProps {
  sectionId: string;
  onBack: () => void;
  dashState: ReturnType<typeof useDashboardState>;
}

// Parse Russian date strings like "20 апр", "1 мая", "15 июня" to Date
function parseRuDate(s: string): Date | null {
  const months: Record<string, number> = {
    'янв': 0, 'фев': 1, 'мар': 2, 'апр': 3, 'мая': 4, 'май': 4,
    'июн': 5, 'июл': 6, 'авг': 7, 'сен': 8, 'окт': 9, 'ноя': 10, 'дек': 11,
    'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3,
    'июня': 5, 'июля': 6, 'августа': 7, 'сентября': 8,
    'октября': 9, 'ноября': 10, 'декабря': 11,
  };
  const parts = s.toLowerCase().trim().split(/\s+/);
  if (parts.length < 2) return null;
  const day = parseInt(parts[0]);
  const monthStr = parts[1];
  const month = months[monthStr];
  if (isNaN(day) || month === undefined) return null;
  return new Date(2026, month, day);
}

function isOverdue(deadline: string | undefined): boolean {
  if (!deadline) return false;
  const d = parseRuDate(deadline);
  if (!d) return false;
  return d < new Date();
}

function daysUntilDeadline(deadline: string): number | null {
  const d = parseRuDate(deadline);
  if (!d) return null;
  return Math.ceil((d.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
}

export function SectionDetail({ sectionId, onBack, dashState }: SectionDetailProps) {
  const section = sections.find((s) => s.id === sectionId);
  if (!section) return <div className="text-text-dim">Раздел не найден</div>;

  const { isCheckpointDone, toggleCheckpoint } = dashState;

  // Calculate live progress
  let doneCount = 0;
  section.checkpoints.forEach((cp, i) => {
    if (isCheckpointDone(sectionId, i, cp.done)) doneCount++;
  });
  const liveProgress = section.checkpoints.length > 0
    ? Math.round((doneCount / section.checkpoints.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-text-dim hover:text-text mb-3 transition-colors"
        >
          <ArrowLeft size={14} />
          Назад к обзору
        </button>

        <div>
          <h1 className="text-2xl font-bold text-text">{section.title}</h1>
          <p className="text-sm text-text-dim mt-1">{section.subtitle}</p>
        </div>
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetaCard label="Статус" value={statusLabel(liveProgress)} color={statusColor(liveProgress)} />
        <MetaCard label="Бюджет" value={section.budget || '—'} />
        <MetaCard label="Дедлайн" value={section.deadline || '—'} />
        <MetaCard label="Ответственный" value={section.responsible} />
      </div>

      {/* Progress */}
      <div className="bg-surface-2 border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-text">Прогресс</h2>
          <span className="text-sm text-text-dim">{doneCount}/{section.checkpoints.length} чекпоинтов</span>
        </div>
        <div className="w-full h-3 rounded-full bg-surface-3 mb-1 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${liveProgress}%`,
              backgroundColor: liveProgress === 100 ? '#22C55E' : liveProgress > 0 ? '#EAB308' : '#333',
            }}
          />
        </div>
        <div className="text-xs text-text-dim text-right">{liveProgress}%</div>
      </div>

      {/* Key metric */}
      {section.keyMetric && (
        <div className="bg-surface-2 border border-brand/20 rounded-2xl p-5">
          <div className="text-sm text-text-dim">{section.keyMetric}</div>
          <div className="text-3xl font-bold text-brand mt-1">{section.keyMetricValue}</div>
        </div>
      )}

      {/* Checkpoints — interactive! */}
      <div className="bg-surface-2 border border-border rounded-2xl p-5">
        <h2 className="text-base font-semibold text-text mb-4">Чекпоинты</h2>
        <div className="space-y-2">
          {section.checkpoints.map((cp, i) => {
            const done = isCheckpointDone(sectionId, i, cp.done);
            const overdue = !done && isOverdue(cp.deadline);
            const daysLeft = cp.deadline ? daysUntilDeadline(cp.deadline) : null;
            const urgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && !done;

            return (
              <button
                key={i}
                onClick={() => toggleCheckpoint(sectionId, i)}
                className={`
                  w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left
                  hover:border-brand/30
                  ${done
                    ? 'border-success/20 bg-success/5'
                    : overdue
                      ? 'border-danger/40 bg-danger/5'
                      : urgent
                        ? 'border-warning/30 bg-warning/5'
                        : 'border-border bg-surface-3'
                  }
                `}
              >
                {done ? (
                  <CheckCircle2 size={20} className="text-success mt-0.5 shrink-0" />
                ) : (
                  <Circle size={20} className={`mt-0.5 shrink-0 ${overdue ? 'text-danger' : 'text-text-dim'}`} />
                )}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${done ? 'text-text-dim line-through' : 'text-text font-medium'}`}>
                    {cp.title}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {cp.deadline && (
                      <div className={`text-xs flex items-center gap-1 ${overdue ? 'text-danger font-medium' : urgent ? 'text-warning' : 'text-text-dim'}`}>
                        {overdue ? <AlertTriangle size={10} /> : <Clock size={10} />}
                        {overdue
                          ? `Просрочен (${cp.deadline})`
                          : daysLeft !== null
                            ? `${cp.deadline} (${daysLeft} дн.)`
                            : cp.deadline}
                      </div>
                    )}
                    {cp.note && (
                      <div className="text-xs text-danger">{cp.note}</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Artifacts — files produced by agents */}
      {dashState.state?.sections?.[sectionId]?.artifacts?.length > 0 && (
        <div className="bg-surface-2 border border-border rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text mb-4">
            Артефакты ({dashState.state.sections[sectionId].artifacts.length})
          </h2>
          <div className="space-y-2">
            {dashState.state.sections[sectionId].artifacts.map((a: { path: string; name?: string; modified: string }, i: number) => {
              const name = a.name || a.path.split('/').pop() || a.path;
              const viewUrl = `/api/file?path=${encodeURIComponent(a.path)}`;
              return (
                <a
                  key={i}
                  href={viewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-3 hover:border-brand/40 transition-colors"
                >
                  <ExternalLink size={14} className="text-brand shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text truncate">{name}</div>
                    <div className="text-xs text-text-dim truncate">{a.path}</div>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(a.path); }}
                    className="text-xs text-text-dim hover:text-brand px-2 py-1 rounded hover:bg-surface-2 shrink-0 transition-colors"
                    title="Скопировать путь"
                  >
                    📋
                  </button>
                  {a.modified && (
                    <div className="text-xs text-text-dim shrink-0">
                      {new Date(a.modified).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Standards — ЧиП guides relevant to this section */}
      {(sectionId === 'site' || sectionId === 'trailer' || sectionId === 'contractors') && (
        <div className="bg-surface-2 border border-border rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text mb-3">Стандарты ЧиП</h2>
          <div className="space-y-2">
            <a href="/api/file?path=.claude/skills/tender-process/SKILL.md" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-3 text-sm text-text-dim hover:text-text transition-colors">
              <ExternalLink size={12} className="text-brand" />
              Стандарт тендера ЧиП 3.2 (двухэтапная оценка, автоскоринг)
            </a>
            <a href="/api/file?path=.claude/skills/moodboard-collection/SKILL.md" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-3 text-sm text-text-dim hover:text-text transition-colors">
              <ExternalLink size={12} className="text-brand" />
              Как собирать мудборд (Visual Style + UX + Анти)
            </a>
          </div>
        </div>
      )}
      {(sectionId === 'ambassadors' || sectionId === 'partners' || sectionId === 'bloggers') && (
        <div className="bg-surface-2 border border-border rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text mb-3">Стандарты ЧиП</h2>
          <div className="space-y-2">
            <a href="/api/file?path=.claude/skills/ambassador-outreach/SKILL.md" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-3 text-sm text-text-dim hover:text-text transition-colors">
              <ExternalLink size={12} className="text-brand" />
              Как работать с амбассадорами (питч, кругляшок, follow-up)
            </a>
            <a href="/api/file?path=.claude/rules/prompt-contract.md" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-3 text-sm text-text-dim hover:text-text transition-colors">
              <ExternalLink size={12} className="text-brand" />
              Prompt Contract (как ставить задачу AI-агенту)
            </a>
          </div>
        </div>
      )}
      {sectionId === 'content' && (
        <div className="bg-surface-2 border border-border rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text mb-3">Стандарты ЧиП</h2>
          <div className="space-y-2">
            <a href="/api/file?path=.claude/skills/content-strategy/SKILL.md" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-3 text-sm text-text-dim hover:text-text transition-colors">
              <ExternalLink size={12} className="text-brand" />
              Контент-стратегия ЧиП (хук, A→B, механика вовлечения)
            </a>
            <a href="/api/file?path=.claude/skills/smm-rubrikator/SKILL.md" target="_blank" rel="noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-3 text-sm text-text-dim hover:text-text transition-colors">
              <ExternalLink size={12} className="text-brand" />
              Рубрикатор (S-ID, баланс воронки, расписание)
            </a>
          </div>
        </div>
      )}
      {sectionId === 'merch' && (
        <div className="bg-surface-2 border border-border rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text mb-3">Стандарты ЧиП</h2>
          <a href="/api/file?path=.claude/skills/merch/SKILL.md" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-3 text-sm text-text-dim hover:text-text transition-colors">
            <ExternalLink size={12} className="text-brand" />
            Мерч: ассортимент, дизайн-бриф, производство
          </a>
        </div>
      )}

      {/* Mini-CRM for contact-heavy sections */}
      {sectionId === 'ambassadors' && <ContactList type="ambassadors" />}
      {sectionId === 'partners' && <ContactList type="partners" />}
      {sectionId === 'bloggers' && <ContactList type="bloggers" />}

      {/* Budget breakdown for budget section */}
      {sectionId === 'budget' && (
        <div className="bg-surface-2 border border-border rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text mb-4">Разбивка бюджета</h2>
          <div className="space-y-2">
            {budgetLines.map((line, i) => {
              const pct = totalBudget > 0 ? Math.round((line.planned / totalBudget) * 100) : 0;
              const spentPct = line.planned > 0 ? Math.round((line.spent / line.planned) * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text">{line.category}</span>
                      <span className="text-text-dim tabular-nums">
                        {(line.spent / 1000).toFixed(0)}к / {(line.planned / 1000).toFixed(0)}к
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-3 mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${spentPct > 0 ? spentPct : pct}%`,
                          backgroundColor: spentPct > 0 ? '#22C55E' : '#333',
                          opacity: spentPct > 0 ? 1 : 0.3,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-text-dim w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border text-sm font-medium">
            <span className="text-text">Итого</span>
            <span className="text-brand tabular-nums">
              {(totalSpent / 1000).toFixed(0)}к / {(totalBudget / 1000).toFixed(0)}к ₽
            </span>
          </div>
        </div>
      )}

      {/* Links */}
      {section.sheetsLink && (
        <a
          href={section.sheetsLink}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl p-4 text-sm text-text hover:border-brand/50 transition-colors"
        >
          <ExternalLink size={16} className="text-brand" />
          Открыть в Google Sheets
        </a>
      )}
    </div>
  );
}

function MetaCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-3">
      <div className="text-xs text-text-dim">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 ${color || 'text-text'}`}>{value}</div>
    </div>
  );
}

function statusLabel(progress: number): string {
  if (progress === 100) return 'Готово';
  if (progress > 0) return 'В работе';
  return 'Не начат';
}

function statusColor(progress: number): string {
  if (progress === 100) return 'text-success';
  if (progress > 0) return 'text-warning';
  return 'text-text-dim';
}
