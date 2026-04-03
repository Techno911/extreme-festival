// Dashboard state management
// Reads from /api/state (served by dashboard-server), falls back to localStorage

export interface DashboardState {
  lastUpdated: string;
  lastUpdatedBy: string;
  kpis: {
    tickets: number;
    budgetSpent: number;
    ambassadors: number;
    partners: number;
    bloggersReach: number;
    contentDrafts: number;
    sectionsReady: number;
    tendersLaunched: number;
  };
  checkpoints: Record<string, boolean>; // "sectionId:checkpointIndex" → true/false
  changelog: ChangelogEntry[];
  sections?: Record<string, { artifacts: { path: string; size: number; modified: string }[]; count: number }>;
}

export interface ChangelogEntry {
  timestamp: string;
  agent: string;
  action: string;
  summary: string;
}

const STATE_KEY = 'extremefest-dashboard-state';
const API_URL = '/api/state';

function getDefaultState(): DashboardState {
  return {
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: 'system',
    kpis: {
      tickets: 16,
      budgetSpent: 0,
      ambassadors: 0,
      partners: 1,
      bloggersReach: 0,
      contentDrafts: 32,
      sectionsReady: 13,
      tendersLaunched: 0,
    },
    checkpoints: {},
    changelog: [],
  };
}

// Load from API, fallback to localStorage, fallback to defaults
export async function loadState(): Promise<DashboardState> {
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(STATE_KEY, JSON.stringify(data));
      return data;
    }
  } catch {
    // API not available, use localStorage
  }

  const stored = localStorage.getItem(STATE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // corrupted
    }
  }

  return getDefaultState();
}

// Save to API + localStorage
export async function saveState(state: DashboardState): Promise<void> {
  state.lastUpdated = new Date().toISOString();
  localStorage.setItem(STATE_KEY, JSON.stringify(state));

  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  } catch {
    // API not available, localStorage is our persistence
  }
}

// Toggle a checkpoint
export function toggleCheckpoint(
  state: DashboardState,
  sectionId: string,
  checkpointIndex: number
): DashboardState {
  const key = `${sectionId}:${checkpointIndex}`;
  const newCheckpoints = { ...state.checkpoints };
  newCheckpoints[key] = !newCheckpoints[key];

  return {
    ...state,
    checkpoints: newCheckpoints,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: 'user',
  };
}

// Check if a checkpoint is done (from state override or default data)
export function isCheckpointDone(
  state: DashboardState,
  sectionId: string,
  checkpointIndex: number,
  defaultDone: boolean
): boolean {
  const key = `${sectionId}:${checkpointIndex}`;
  if (key in state.checkpoints) {
    return state.checkpoints[key];
  }
  return defaultDone;
}

// Calculate section progress from state
export function calcSectionProgress(
  state: DashboardState,
  sectionId: string,
  totalCheckpoints: number,
  checkpointDefaults: boolean[]
): number {
  let done = 0;
  for (let i = 0; i < totalCheckpoints; i++) {
    if (isCheckpointDone(state, sectionId, i, checkpointDefaults[i])) {
      done++;
    }
  }
  return totalCheckpoints > 0 ? Math.round((done / totalCheckpoints) * 100) : 0;
}
