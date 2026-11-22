import { useSyncExternalStore } from 'react';

export interface BoardTheme { id: string; name: string; light: string; dark: string; frame: string; coordLight: string; coordDark: string; }
export const BOARD_THEMES: BoardTheme[] = [
  { id: 'walnut', name: 'Walnut', light: '#ecd9b8', dark: '#a9784f', frame: '#3a2718', coordLight: '#a9784f', coordDark: '#ecd9b8' },
  { id: 'emerald', name: 'Emerald', light: '#eeeed2', dark: '#6f9a55', frame: '#1f3a22', coordLight: '#6f9a55', coordDark: '#eeeed2' },
  { id: 'midnight', name: 'Midnight', light: '#c9d4e8', dark: '#4d6b9d', frame: '#15203a', coordLight: '#4d6b9d', coordDark: '#c9d4e8' },
  { id: 'marble', name: 'Marble', light: '#ebebee', dark: '#8b93a5', frame: '#2c2f38', coordLight: '#8b93a5', coordDark: '#ebebee' },
  { id: 'rosewood', name: 'Rosewood', light: '#f2dcd2', dark: '#b2665b', frame: '#3b1d1b', coordLight: '#b2665b', coordDark: '#f2dcd2' },
  { id: 'obsidian', name: 'Obsidian', light: '#8c97a3', dark: '#38424d', frame: '#0e1217', coordLight: '#38424d', coordDark: '#8c97a3' },
];

export interface Settings {
  theme: string;
  pieceSet: string;
  sound: boolean;
  volume: number;
  showLegal: boolean;
  showCoords: boolean;
  animate: boolean;
  evalBar: boolean;
  autoQueen: boolean;
  level: string;
  personality: string;
  playerColor: 'white' | 'black' | 'random';
  clock: string;           // 'off' or 'minutes+increment'
  humanDelay: boolean;
  showAiThoughts: boolean;
  confirmResign: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'walnut', pieceSet: 'classic2d', sound: true, volume: 0.6, showLegal: true, showCoords: true, animate: true,
  evalBar: false, autoQueen: false, level: 'intermediate', personality: 'allround', playerColor: 'white', clock: 'off',
  humanDelay: true, showAiThoughts: true, confirmResign: true,
};

const KEY = 'project-grandmaster.settings.v1';
let current: Settings = (() => {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
})();
const listeners = new Set<() => void>();

export function getSettings(): Settings { return current; }
export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
  listeners.forEach(l => l());
}
export function useSettings(): Settings {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, getSettings);
}

export interface ClockSpec { minutes: number; inc: number; }
export function parseClock(s: string): ClockSpec | null {
  if (!s || s === 'off') return null;
  const [m, i] = s.split('+').map(Number);
  return { minutes: m, inc: i || 0 };
}
export const CLOCK_PRESETS = ['off', '1+0', '3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10', '30+0'];
