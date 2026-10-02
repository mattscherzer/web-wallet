import { describe, expect, it } from 'vitest';
import type { CountAction, CountState } from './cashCount';

// Loaded dynamically so a missing module fails the assertion below instead of crashing the file.
const loaded = await import('./cashCount').catch(() => undefined);

function api() {
  expect(loaded, 'src/utils/cashCount.ts must exist').toBeDefined();
  return loaded!;
}

const run = (actions: CountAction[], from?: CountState) => {
  const { countReducer, initialCountState } = api();
  return actions.reduce(countReducer, from ?? initialCountState());
};

const withCounts = (counts: number[]): CountState => ({ ...api().initialCountState(), counts });

describe('denominations', () => {
  it('lists 4 notes then 8 coins, largest first, in integer cents', () => {
    const { DENOMINATIONS } = api();
    expect(DENOMINATIONS.map((d) => d.label)).toEqual([
      '€50', '€20', '€10', '€5', '€2', '€1', '50c', '20c', '10c', '5c', '2c', '1c',
    ]);
    expect(DENOMINATIONS.map((d) => d.cents)).toEqual([
      5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1,
    ]);
    expect(DENOMINATIONS.slice(0, 4).every((d) => d.kind === 'notes')).toBe(true);
    expect(DENOMINATIONS.slice(4).every((d) => d.kind === 'coins')).toBe(true);
  });

  it('starts at zero counts, Add mode, empty history', () => {
    const { initialCountState } = api();
    const s = initialCountState();
    expect(s.counts).toEqual(new Array(12).fill(0));
    expect(s.mode).toBe('add');
    expect(s.history).toEqual([]);
  });
});

describe('add', () => {
  it('increments only the tapped denomination', () => {
    const s = run([{ type: 'add', index: 0 }, { type: 'add', index: 0 }, { type: 'add', index: 7 }]);
    expect(s.counts[0]).toBe(2);
    expect(s.counts[7]).toBe(1);
    expect(s.counts.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('remove', () => {
  it('decrements and floors at zero', () => {
    const s = run([{ type: 'remove', index: 3 }], withCounts([0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(s.counts[3]).toBe(1);
    const z = run([{ type: 'remove', index: 3 }, { type: 'remove', index: 3 }], s);
    expect(z.counts[3]).toBe(0);
  });
});

describe('set', () => {
  const set = (value: number) => run([{ type: 'set', index: 1, value }]).counts[1];

  it('clamps to 0..9999 and sanitises non-integers', () => {
    const { MAX_COUNT } = api();
    expect(set(12)).toBe(12);
    expect(set(10000)).toBe(MAX_COUNT);
    expect(set(-4)).toBe(0);
    expect(set(Number.NaN)).toBe(0);
    expect(set(2.9)).toBe(2);
  });
});

describe('parseCount', () => {
  it('strips non-digits, turns empty into 0 and clamps', () => {
    const { MAX_COUNT, parseCount } = api();
    expect(parseCount('12')).toBe(12);
    expect(parseCount('1a2')).toBe(12);
    expect(parseCount('')).toBe(0);
    expect(parseCount('abc')).toBe(0);
    expect(parseCount('0009')).toBe(9);
    expect(parseCount('99999')).toBe(MAX_COUNT);
    expect(parseCount(' 7 ')).toBe(7);
    expect(parseCount('-5')).toBe(5);
  });
});

describe('modes', () => {
  it('switching mode keeps counts and undo history untouched', () => {
    const before = run([{ type: 'add', index: 0 }, { type: 'add', index: 5 }]);
    const after = run(
      [{ type: 'setMode', mode: 'remove' }, { type: 'setMode', mode: 'type' }, { type: 'setMode', mode: 'add' }],
      before,
    );
    expect(after.counts).toEqual(before.counts);
    expect(after.history).toEqual(before.history);
    expect(run([{ type: 'setMode', mode: 'remove' }], before).mode).toBe('remove');
  });
});

describe('undo and clear', () => {
  it('undo reverts exactly one step', () => {
    const s = run([{ type: 'add', index: 0 }, { type: 'add', index: 0 }, { type: 'undo' }]);
    expect(s.counts[0]).toBe(1);
    expect(s.history).toHaveLength(1);
  });

  it('clear zeroes everything and can be undone', () => {
    const counted = run([{ type: 'add', index: 0 }, { type: 'add', index: 9 }]);
    const cleared = run([{ type: 'clear' }], counted);
    expect(cleared.counts).toEqual(new Array(12).fill(0));
    expect(run([{ type: 'undo' }], cleared).counts).toEqual(counted.counts);
  });

  it('undo with empty history is a no-op', () => {
    const { countReducer, initialCountState } = api();
    const s = initialCountState();
    expect(countReducer(s, { type: 'undo' })).toEqual(s);
  });

  it('caps history at 100 steps', () => {
    const { HISTORY_LIMIT } = api();
    const adds: CountAction[] = Array.from({ length: 150 }, () => ({ type: 'add', index: 0 }));
    const s = run(adds);
    expect(s.counts[0]).toBe(150);
    expect(s.history).toHaveLength(HISTORY_LIMIT);
    const undone = run(Array.from({ length: 200 }, () => ({ type: 'undo' as const })), s);
    expect(undone.counts[0]).toBe(50);
    expect(undone.history).toHaveLength(0);
  });
});

describe('no-op changes', () => {
  it('never add an undo step', () => {
    const { MAX_COUNT } = api();
    const atMax = withCounts([MAX_COUNT, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(run([{ type: 'add', index: 0 }], atMax).history).toHaveLength(0);
    expect(run([{ type: 'remove', index: 1 }], atMax).history).toHaveLength(0);
    expect(run([{ type: 'set', index: 0, value: MAX_COUNT }], atMax).history).toHaveLength(0);
    expect(run([{ type: 'clear' }]).history).toHaveLength(0);
  });
});

describe('totalCents', () => {
  it('is exact in integer cents', () => {
    const { MAX_COUNT, totalCents } = api();
    // 3 x 10c + 1 x 5c + 2 x 1c = 37c, the case float math drifts on
    const counts = new Array(12).fill(0);
    counts[8] = 3;
    counts[9] = 1;
    counts[11] = 2;
    expect(totalCents(counts)).toBe(37);
    expect(totalCents(new Array(12).fill(MAX_COUNT))).toBe(88_871_112);
    expect(Number.isInteger(totalCents(new Array(12).fill(MAX_COUNT)))).toBe(true);
  });
});

describe('pieceSummary', () => {
  it('uses singular and plural forms', () => {
    const { pieceSummary } = api();
    const one = new Array(12).fill(0);
    one[0] = 1;
    one[4] = 1;
    expect(pieceSummary(one)).toBe('1 note · 1 coin');
    const coins = new Array(12).fill(0);
    coins[5] = 1;
    coins[6] = 1;
    expect(pieceSummary(coins)).toBe('0 notes · 2 coins');
    expect(pieceSummary(new Array(12).fill(0))).toBe('0 notes · 0 coins');
  });
});

describe('applyAndClose', () => {
  it('hands the total to the form and then closes', () => {
    const { applyAndClose } = api();
    const calls: string[] = [];
    applyAndClose(
      0.37,
      (total) => calls.push(`apply ${total}`),
      () => calls.push('close'),
    );
    expect(calls).toEqual(['apply 0.37', 'close']);
  });
});

describe('typing bursts', () => {
  const type = (index: number, value: number): CountAction => ({ type: 'set', index, value, typing: true });

  it('typing 123 in one field is a single undo step', () => {
    const s = run([type(0, 1), type(0, 12), type(0, 123)]);
    expect(s.counts[0]).toBe(123);
    expect(s.history).toHaveLength(1);
    expect(run([{ type: 'undo' }], s).counts[0]).toBe(0);
  });

  it('typing in another field starts a new undo step', () => {
    const s = run([type(0, 1), type(0, 12), type(1, 3)]);
    expect(s.history).toHaveLength(2);
    expect(run([{ type: 'undo' }], s).counts).toEqual(run([type(0, 1), type(0, 12)]).counts);
  });

  it('leaving the field ends the burst', () => {
    const s = run([type(0, 1), { type: 'set', index: 0, value: 1 }, type(0, 12)]);
    expect(s.counts[0]).toBe(12);
    expect(s.history).toHaveLength(2);
  });

  it('any other action ends the burst', () => {
    const s = run([type(0, 1), { type: 'setMode', mode: 'type' }, type(0, 12)]);
    expect(s.history).toHaveLength(2);
    const afterAdd = run([type(0, 1), { type: 'add', index: 1 }, type(0, 12)]);
    expect(afterAdd.history).toHaveLength(3);
  });

  it('typing a digit and deleting it again leaves no undo step', () => {
    const s = run([type(0, 5), type(0, 0)]);
    expect(s.counts[0]).toBe(0);
    expect(s.history).toHaveLength(0);
    // The next entry in that field is its own step again.
    const again = run([type(0, 5), type(0, 0), type(0, 7)]);
    expect(again.history).toHaveLength(1);
    expect(run([{ type: 'undo' }], again).counts[0]).toBe(0);
  });

  it('typing the value already there adds nothing', () => {
    const s = run([type(0, 1), type(0, 1)]);
    expect(s.history).toHaveLength(1);
    expect(run([type(0, 0)]).history).toHaveLength(0);
  });
});

describe('parseCount full-width digits', () => {
  it('reads full-width digits typed on some keyboards', () => {
    const { parseCount } = api();
    expect(parseCount('１２')).toBe(12);
  });
});
