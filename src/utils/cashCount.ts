export type Mode = 'add' | 'remove' | 'type';

export interface Denomination {
  label: string;
  cents: number;
  kind: 'notes' | 'coins';
}

export const DENOMINATIONS: readonly Denomination[] = [
  { label: '€50', cents: 5000, kind: 'notes' },
  { label: '€20', cents: 2000, kind: 'notes' },
  { label: '€10', cents: 1000, kind: 'notes' },
  { label: '€5', cents: 500, kind: 'notes' },
  { label: '€2', cents: 200, kind: 'coins' },
  { label: '€1', cents: 100, kind: 'coins' },
  { label: '50c', cents: 50, kind: 'coins' },
  { label: '20c', cents: 20, kind: 'coins' },
  { label: '10c', cents: 10, kind: 'coins' },
  { label: '5c', cents: 5, kind: 'coins' },
  { label: '2c', cents: 2, kind: 'coins' },
  { label: '1c', cents: 1, kind: 'coins' },
];

export const MAX_COUNT = 9999;
export const HISTORY_LIMIT = 100;

export interface CountState {
  counts: number[];
  history: number[][];
  mode: Mode;
  /** Index of the field being typed in, so a burst of keystrokes there is one undo step. */
  typing?: number | null;
}

export type CountAction =
  | { type: 'add'; index: number }
  | { type: 'remove'; index: number }
  | { type: 'set'; index: number; value: number; typing?: boolean }
  | { type: 'clear' }
  | { type: 'undo' }
  | { type: 'setMode'; mode: Mode };

export function initialCountState(): CountState {
  return { counts: DENOMINATIONS.map(() => 0), history: [], mode: 'add' };
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_COUNT, Math.floor(value)));
}

/** Apply new counts, recording one undo step; unchanged counts leave the state as is. */
function commit(state: CountState, counts: number[]): CountState {
  if (counts.every((n, i) => n === state.counts[i])) return state;
  return {
    ...state,
    counts,
    history: [...state.history, state.counts].slice(-HISTORY_LIMIT),
  };
}

function withCount(state: CountState, index: number, value: number): CountState {
  const counts = state.counts.slice();
  counts[index] = clamp(value);
  return commit(state, counts);
}

const endTyping = (state: CountState): CountState =>
  state.typing == null ? state : { ...state, typing: null };

export function countReducer(state: CountState, action: CountAction): CountState {
  if (action.type !== 'set') state = endTyping(state);
  switch (action.type) {
    case 'add':
      return withCount(state, action.index, state.counts[action.index] + 1);
    case 'remove':
      return withCount(state, action.index, state.counts[action.index] - 1);
    case 'set': {
      if (!action.typing) return endTyping(withCount(state, action.index, action.value));
      const value = clamp(action.value);
      if (value === state.counts[action.index]) return state;
      const counts = state.counts.slice();
      counts[action.index] = value;
      // Keystrokes in the field already being typed in fold into its single undo step.
      if (state.typing === action.index) {
        // Typing back to where the burst began leaves nothing to undo, so drop its step.
        const start = state.history[state.history.length - 1];
        if (start && counts.every((n, i) => n === start[i])) {
          return { ...state, counts, history: state.history.slice(0, -1), typing: null };
        }
        return { ...state, counts };
      }
      return { ...commit(state, counts), typing: action.index };
    }
    case 'clear':
      return commit(state, state.counts.map(() => 0));
    case 'undo': {
      if (state.history.length === 0) return state;
      return {
        ...state,
        counts: state.history[state.history.length - 1],
        history: state.history.slice(0, -1),
      };
    }
    case 'setMode':
      return { ...state, mode: action.mode };
  }
}

/** Digits only; empty or invalid text counts as 0. */
export function parseCount(text: string): number {
  const digits = text.normalize('NFKC').replace(/\D/g, '');
  return digits === '' ? 0 : clamp(parseInt(digits, 10));
}

/** Exact total in integer cents. */
export function totalCents(counts: readonly number[]): number {
  return DENOMINATIONS.reduce((sum, d, i) => sum + d.cents * counts[i], 0);
}

/** "2 notes · 1 coin" */
export function pieceSummary(counts: readonly number[]): string {
  let notes = 0;
  let coins = 0;
  DENOMINATIONS.forEach((d, i) => {
    if (d.kind === 'notes') notes += counts[i];
    else coins += counts[i];
  });
  return `${notes} ${notes === 1 ? 'note' : 'notes'} · ${coins} ${coins === 1 ? 'coin' : 'coins'}`;
}

/** Hand the total to the form, then close the screen (which discards the counts). */
export function applyAndClose(total: number, onApply: (total: number) => void, onClose: () => void): void {
  onApply(total);
  onClose();
}
