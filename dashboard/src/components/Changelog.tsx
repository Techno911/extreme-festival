import { History, Bot, User, Settings } from 'lucide-react';
import type { ChangelogEntry } from '../data/state';

interface ChangelogProps {
  entries: ChangelogEntry[];
}

const agentIcons: Record<string, typeof Bot> = {
  system: Settings,
  user: User,
};

export function Changelog({ entries }: ChangelogProps) {
  const sorted = [...entries].reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Лог изменений</h1>
        <p className="text-sm text-text-dim mt-1">
          Все обновления от AI-агентов и ручные изменения
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-surface-2 border border-border rounded-2xl p-8 text-center">
          <History size={32} className="text-text-dim mx-auto mb-3" />
          <div className="text-sm text-text-dim">Пока нет записей. Отправь задачу в Telegram — и здесь появится отчёт.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((entry, i) => {
            const Icon = agentIcons[entry.agent] ?? Bot;
            const date = new Date(entry.timestamp);

            return (
              <div key={i} className="flex gap-4 bg-surface-2 border border-border rounded-xl p-4">
                <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
                      {entry.agent}
                    </span>
                    <span className="text-xs text-text-dim">
                      {date.toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-xs text-text-dim opacity-50">{entry.action}</span>
                  </div>
                  <div className="text-sm text-text">{entry.summary}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
