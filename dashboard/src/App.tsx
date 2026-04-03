import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { KPIBar } from './components/KPIBar';
import { Overview } from './components/Overview';
import { Timeline } from './components/Timeline';
import { SectionDetail } from './components/SectionDetail';
import { Changelog } from './components/Changelog';
import { useDashboardState } from './hooks/useDashboardState';

const SECTION_PAGES = [
  'strategy', 'market', 'budget', 'sales', 'site', 'trailer',
  'ambassadors', 'partners', 'bloggers', 'content', 'merch', 'contractors', 'calendar',
];

function App() {
  const [page, setPage] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const dashState = useDashboardState();

  if (dashState.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <span className="text-brand font-bold text-lg">EF</span>
          </div>
          <div className="text-sm text-text-dim">Загрузка дашборда...</div>
        </div>
      </div>
    );
  }

  const isSectionPage = SECTION_PAGES.includes(page);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        active={page}
        onNavigate={setPage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main
        className="flex-1 flex flex-col min-h-screen transition-all duration-200"
        style={{ marginLeft: sidebarCollapsed ? 64 : 240 }}
      >
        <KPIBar state={dashState.state} />

        <div className="flex-1 p-6">
          {page === 'overview' && (
            <Overview onNavigate={setPage} dashState={dashState} />
          )}
          {page === 'timeline' && <Timeline dashState={dashState} />}
          {page === 'changelog' && <Changelog entries={dashState.changelog} />}
          {isSectionPage && (
            <SectionDetail
              sectionId={page}
              onBack={() => setPage('overview')}
              dashState={dashState}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
