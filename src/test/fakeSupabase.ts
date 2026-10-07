// In-memory stand-in for the Supabase client, for unit tests.
//
// It only applies the filters the code under test actually asked for: if the
// code forgets `.eq('wallet_id', id)`, rows of every wallet come back.

export type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string; code?: string } | null };
type Failure = { message: string; code?: string };

export interface FakeChannel {
  name: string;
  table: string;
  filter?: string;
  callback: () => void;
  removed: boolean;
}

export function createFakeSupabase(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(initial)) tables[name] = rows.map((r) => ({ ...r }));

  const queries: { table: string; op: string; filters: [string, unknown][]; limit?: number; ascending?: boolean }[] = [];
  const channels: FakeChannel[] = [];
  const failures = new Map<string, Failure>();
  const holds = new Map<string, Promise<void>>();
  let nextId = 1;

  /** Make the next operation on `table` (e.g. 'wallets:insert') fail. */
  function failNext(key: string, error: Failure) {
    failures.set(key, error);
  }

  /** Make the next `key` (e.g. 'transactions:select') answer only once the returned function is called. */
  function holdNext(key: string): () => void {
    let release!: () => void;
    holds.set(key, new Promise<void>((resolve) => (release = resolve)));
    return release;
  }

  class Query implements PromiseLike<Result> {
    private op: 'select' | 'insert' | 'update' = 'select';
    private payload: Row | Row[] = {};
    private filters: [string, unknown][] = [];
    private orders: { column: string; ascending: boolean }[] = [];
    private max?: number;
    private single_ = false;
    private window?: [number, number];

    private table: string;
    constructor(table: string) {
      this.table = table;
    }

    select() {
      return this;
    }
    insert(payload: Row | Row[]) {
      this.op = 'insert';
      this.payload = payload;
      return this;
    }
    update(payload: Row) {
      this.op = 'update';
      this.payload = payload;
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.push([column, value]);
      return this;
    }
    order(column: string, opts?: { ascending?: boolean }) {
      this.orders.push({ column, ascending: opts?.ascending ?? true });
      return this;
    }
    limit(n: number) {
      this.max = n;
      return this;
    }
    range(from: number, to: number) {
      this.window = [from, to];
      return this;
    }
    single() {
      this.single_ = true;
      return this;
    }

    private run(): Result {
      queries.push({
        table: this.table,
        op: this.op,
        filters: [...this.filters],
        limit: this.max,
        ascending: this.orders[0]?.ascending,
      });
      const key = `${this.table}:${this.op}`;
      const failure = failures.get(key);
      if (failure) {
        failures.delete(key);
        return { data: null, error: failure };
      }
      const rows = (tables[this.table] ??= []);

      if (this.op === 'insert') {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        const inserted = list.map((r) => ({
          id: `id-${nextId++}`,
          deleted: false,
          created_at: new Date(2026, 0, nextId).toISOString(),
          ...r,
        }));
        rows.push(...inserted);
        return { data: this.single_ ? inserted[0] : inserted, error: null };
      }

      let matched = rows.filter((r) => this.filters.every(([c, v]) => r[c] === v));

      if (this.op === 'update') {
        matched.forEach((r) => Object.assign(r, this.payload));
        return { data: matched, error: null };
      }

      for (const { column, ascending } of [...this.orders].reverse()) {
        matched = [...matched].sort((a, b) => {
          const x = String(a[column] ?? '');
          const y = String(b[column] ?? '');
          return ascending ? x.localeCompare(y) : y.localeCompare(x);
        });
      }
      // Like the real API: at most 1000 rows per request unless a range says otherwise.
      matched = this.window ? matched.slice(this.window[0], this.window[1] + 1) : matched.slice(0, 1000);
      if (this.max !== undefined) matched = matched.slice(0, this.max);
      if (this.single_) {
        return matched[0]
          ? { data: matched[0], error: null }
          : { data: null, error: { message: 'not found' } };
      }
      return { data: matched, error: null };
    }

    then<A = Result, B = never>(
      onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      const key = `${this.table}:${this.op}`;
      const held = holds.get(key);
      holds.delete(key);
      return Promise.resolve(held).then(() => this.run()).then(onfulfilled, onrejected);
    }
  }

  const client = {
    from: (table: string) => new Query(table),
    channel: (name: string) => {
      const pending: Partial<FakeChannel> = { name, removed: false };
      const handle = {
        on(_type: string, opts: { table: string; filter?: string }, callback: () => void) {
          pending.table = opts.table;
          pending.filter = opts.filter;
          pending.callback = callback;
          return handle;
        },
        subscribe() {
          channels.push(pending as FakeChannel);
          return handle;
        },
        __channel: pending,
      };
      return handle;
    },
    removeChannel: (handle: { __channel: Partial<FakeChannel> }) => {
      handle.__channel.removed = true;
    },
  };

  return {
    client,
    tables,
    queries,
    channels,
    failNext,
    holdNext,
    /** Fire the realtime callbacks of live channels on `table`. */
    emit(table: string) {
      channels.filter((c) => c.table === table && !c.removed).forEach((c) => c.callback());
    },
  };
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;

/** Two wallets: A has money, B is empty. Wallet A holds the "legacy" data. */
export function twoWalletRows() {
  return {
    wallets: [
      { id: 'wa', name: 'Thursday SLAA Meeting', currency: 'EUR', created_at: '2026-01-01T00:00:00Z' },
      { id: 'wb', name: 'Spring Convention 2027', currency: 'EUR', created_at: '2026-02-01T00:00:00Z' },
    ],
    transactions: [
      { id: 't1', wallet_id: 'wa', type: 'inflow', amount: 1000, date: '2026-03-01', account_id: 'bank', from_account_id: null, category: 'sales', notes: 'a1', deleted: false, created_at: '2026-03-01T10:00:00Z' },
      { id: 't2', wallet_id: 'wa', type: 'outflow', amount: 100.2, date: '2026-03-02', account_id: 'bank', from_account_id: null, category: 'rent', notes: 'a2', deleted: false, created_at: '2026-03-02T10:00:00Z' },
      { id: 't3', wallet_id: 'wa', type: 'inflow', amount: 50, date: '2026-03-03', account_id: 'cash', from_account_id: null, category: 'sales', notes: 'a3', deleted: false, created_at: '2026-03-03T10:00:00Z' },
      { id: 't4', wallet_id: 'wb', type: 'inflow', amount: 7, date: '2026-03-04', account_id: 'cash', from_account_id: null, category: 'sales', notes: 'b1', deleted: false, created_at: '2026-03-04T10:00:00Z' },
    ],
    audit_log: [
      { id: 'l1', wallet_id: 'wa', transaction_id: 't1', action: 'create', timestamp: '2026-03-01T10:00:00Z' },
      { id: 'l2', wallet_id: 'wb', transaction_id: 't4', action: 'create', timestamp: '2026-03-04T10:00:00Z' },
    ],
  };
}
