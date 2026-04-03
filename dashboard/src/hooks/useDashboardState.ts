import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type DashboardState,
  loadState,
  saveState,
  toggleCheckpoint as toggleCp,
  isCheckpointDone as isCpDone,
} from '../data/state';

const POLL_INTERVAL = 10_000; // 10 seconds

export function useDashboardState() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const prevChangelogLength = useRef(0);

  // Initial load
  useEffect(() => {
    loadState().then((s) => {
      setState(s);
      prevChangelogLength.current = s.changelog.length;
      setLoading(false);
    });
  }, []);

  // Poll for updates from bot/agents
  useEffect(() => {
    const interval = setInterval(async () => {
      const fresh = await loadState();
      setState((prev) => {
        if (!prev) return fresh;
        // Only update if the API state is newer
        if (fresh.lastUpdated > prev.lastUpdated && fresh.lastUpdatedBy !== 'user') {
          return fresh;
        }
        return prev;
      });
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Toggle checkpoint
  const toggleCheckpoint = useCallback(
    (sectionId: string, checkpointIndex: number) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = toggleCp(prev, sectionId, checkpointIndex);
        saveState(next);
        return next;
      });
    },
    []
  );

  // Check if checkpoint is done
  const isCheckpointDone = useCallback(
    (sectionId: string, checkpointIndex: number, defaultDone: boolean): boolean => {
      if (!state) return defaultDone;
      return isCpDone(state, sectionId, checkpointIndex, defaultDone);
    },
    [state]
  );

  // Update a KPI value
  const updateKpi = useCallback(
    (key: keyof DashboardState['kpis'], value: number) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          kpis: { ...prev.kpis, [key]: value },
          lastUpdated: new Date().toISOString(),
          lastUpdatedBy: 'user',
        };
        saveState(next);
        return next;
      });
    },
    []
  );

  // Get new changelog entries since last check
  const getNewChanges = useCallback((): DashboardState['changelog'] => {
    if (!state) return [];
    const newEntries = state.changelog.slice(prevChangelogLength.current);
    prevChangelogLength.current = state.changelog.length;
    return newEntries;
  }, [state]);

  return {
    state,
    loading,
    toggleCheckpoint,
    isCheckpointDone,
    updateKpi,
    getNewChanges,
    changelog: state?.changelog ?? [],
  };
}
