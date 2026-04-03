import {
  LayoutDashboard,
  Calendar,
  FileText,
  Target,
  Ticket,
  Users,
  Radio,
  Megaphone,
  PenTool,
  ShoppingBag,
  Wrench,
  BarChart3,
  Flag,
  Wallet,
  ChevronLeft,
  ChevronRight,
  History,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  section?: string;
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'timeline', label: 'Таймлайн', icon: Calendar },
  { id: 'strategy', label: 'А Стратегия', icon: Target, section: 'А' },
  { id: 'market', label: 'Б Рынок', icon: BarChart3, section: 'Б' },
  { id: 'budget', label: 'В Бюджет', icon: Wallet, section: 'В' },
  { id: 'sales', label: 'Г Продажи', icon: Ticket, section: 'Г' },
  { id: 'site', label: 'Д Сайт', icon: FileText, section: 'Д' },
  { id: 'trailer', label: 'Е Трейлер', icon: Flag, section: 'Е' },
  { id: 'ambassadors', label: 'Ж Амбассадоры', icon: Users, section: 'Ж' },
  { id: 'partners', label: 'З Партнёры', icon: Radio, section: 'З' },
  { id: 'bloggers', label: 'И Блогеры', icon: Megaphone, section: 'И' },
  { id: 'content', label: 'К Контент', icon: PenTool, section: 'К' },
  { id: 'merch', label: 'Л Мерч', icon: ShoppingBag, section: 'Л' },
  { id: 'contractors', label: 'М Подрядчики', icon: Wrench, section: 'М' },
  { id: 'calendar', label: 'Н Календарь', icon: Calendar, section: 'Н' },
  { id: 'changelog', label: 'Лог изменений', icon: History },
];

interface SidebarProps {
  active: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ active, onNavigate, collapsed, onToggle }: SidebarProps) {
  const fest = new Date('2026-07-11');
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((fest.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <aside
      className="fixed top-0 left-0 h-screen bg-surface-2 border-r border-border flex flex-col z-50 transition-all duration-200"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-sm shrink-0">
              EF
            </div>
            <span className="text-sm font-semibold text-text truncate">Эстрим Фест</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="ml-auto text-text-dim hover:text-text p-1"
          aria-label={collapsed ? 'Развер��уть' : 'Свернуть'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors
                ${isActive
                  ? 'bg-brand text-white font-medium'
                  : 'text-text-dim hover:text-text hover:bg-surface-3'
                }
              `}
              aria-label={item.label}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border text-xs text-text-dim">
        {!collapsed && (
          <div className="space-y-1">
            <div>11 июля 2026 — Москва</div>
            <div className="text-brand font-medium">{daysLeft} дней до феста</div>
          </div>
        )}
      </div>
    </aside>
  );
}
