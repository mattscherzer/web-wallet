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

export interface FakeUser {
  id: string;
  email: string;
  password: string;
}
type FakeSession = { user: { id: string; email: string } } | null;

export function createFakeSupabase(initial: Record<string, Row[]> = {}, opts: { users?: FakeUser[] } = {}) {
  const users = opts.users ?? [];
  let session: FakeSession = null;
  const authListeners = new Set<(event: string, session: FakeSession) => void>();
  const invocations: { name: string; body: unknown }[] = [];
  const functionAnswers = new Map<string, (body: unknown) => { data?: unknown; error?: { message: string } | null }>();
  const signOutScopes: (string | undefined)[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];
  const notify = (event: string) => authListeners.forEach((cb) => cb(event, session));

  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(initial)) tables[name] = rows.map((r) => ({ ...r }));

  const queries: { table: string; op: string; filters: [string, unknown][]; limit?: number; ascending?: boolean }[] =
    [];
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
        return matched[0] ? { data: matched[0], error: null } : { data: null, error: { message: 'not found' } };
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
      return Promise.resolve(held)
        .then(() => this.run())
        .then(onfulfilled, onrejected);
    }
  }

  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
      onAuthStateChange: (cb: (event: string, session: FakeSession) => void) => {
        authListeners.add(cb);
        return { data: { subscription: { unsubscribe: () => void authListeners.delete(cb) } } };
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const user = users.find((u) => u.email === email && u.password === password);
        if (!user) return { data: { session: null }, error: { message: 'Invalid login credentials' } };
        session = { user: { id: user.id, email: user.email } };
        notify('SIGNED_IN');
        return { data: { session }, error: null };
      },
      // The staff login function hands back tokens named `at-<user id>`; the fake knows which user that is.
      setSession: async ({ access_token }: { access_token: string; refresh_token: string }) => {
        const user = users.find((u) => `at-${u.id}` === access_token);
        if (!user) return { data: { session: null }, error: { message: 'Invalid session' } };
        session = { user: { id: user.id, email: user.email } };
        notify('SIGNED_IN');
        return { data: { session }, error: null };
      },
      signOut: async (opts?: { scope?: string }) => {
        signOutScopes.push(opts?.scope);
        session = null;
        notify('SIGNED_OUT');
        return { error: null };
      },
    },
    functions: {
      invoke: async (name: string, options?: { body?: unknown }) => {
        invocations.push({ name, body: options?.body });
        const answer = functionAnswers.get(name);
        if (answer) {
          const res = answer(options?.body);
          return { data: res.data ?? null, error: res.error ?? null };
        }
        return { data: { id: 'new-user' }, error: null };
      },
    },
    // `create_wallet` mirrors the database function: the wallet and the caller's owner membership in one step.
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === 'create_wallet') {
        const failure = failures.get('wallets:insert');
        if (failure) {
          failures.delete('wallets:insert');
          return { data: null, error: failure };
        }
        const wallet = {
          id: `id-${nextId++}`,
          name: String(args.name),
          currency: 'EUR',
          created_at: new Date().toISOString(),
        };
        (tables.wallets ??= []).push(wallet);
        if (session)
          (tables.wallet_members ??= []).push({ user_id: session.user.id, wallet_id: wallet.id, role: 'owner' });
        return { data: wallet.id, error: null };
      }
      return { data: null, error: { message: `unknown rpc ${name}` } };
    },
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
    invocations,
    signOutScopes,
    rpcCalls,
    /** Make a function answer with `{ data }` or `{ error }` instead of the default. */
    answerFunction(name: string, answer: (body: unknown) => { data?: unknown; error?: { message: string } | null }) {
      functionAnswers.set(name, answer);
    },
    /** Start with this user already logged in. */
    signIn(userId: string) {
      const u = users.find((x) => x.id === userId);
      if (!u) throw new Error(`unknown fake user ${userId}`);
      session = { user: { id: u.id, email: u.email } };
    },
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
      {
        id: 't1',
        wallet_id: 'wa',
        type: 'inflow',
        amount: 1000,
        date: '2026-03-01',
        account_id: 'bank',
        from_account_id: null,
        category: 'sales',
        notes: 'a1',
        deleted: false,
        created_at: '2026-03-01T10:00:00Z',
      },
      {
        id: 't2',
        wallet_id: 'wa',
        type: 'outflow',
        amount: 100.2,
        date: '2026-03-02',
        account_id: 'bank',
        from_account_id: null,
        category: 'rent',
        notes: 'a2',
        deleted: false,
        created_at: '2026-03-02T10:00:00Z',
      },
      {
        id: 't3',
        wallet_id: 'wa',
        type: 'inflow',
        amount: 50,
        date: '2026-03-03',
        account_id: 'cash',
        from_account_id: null,
        category: 'sales',
        notes: 'a3',
        deleted: false,
        created_at: '2026-03-03T10:00:00Z',
      },
      {
        id: 't4',
        wallet_id: 'wb',
        type: 'inflow',
        amount: 7,
        date: '2026-03-04',
        account_id: 'cash',
        from_account_id: null,
        category: 'sales',
        notes: 'b1',
        deleted: false,
        created_at: '2026-03-04T10:00:00Z',
      },
    ],
    audit_log: [
      { id: 'l1', wallet_id: 'wa', transaction_id: 't1', action: 'create', timestamp: '2026-03-01T10:00:00Z' },
      { id: 'l2', wallet_id: 'wb', transaction_id: 't4', action: 'create', timestamp: '2026-03-04T10:00:00Z' },
    ],
  };
}

export const FAKE_USERS: FakeUser[] = [
  { id: 'u-owner', email: 'olga@x.org', password: 'owner-pw' },
  { id: 'u-anna', email: 'u-anna@staff.invalid', password: 'never-used' },
];
export const FAKE_PROFILES: Row[] = [
  { id: 'u-owner', display_name: 'Olga', kind: 'owner' },
  { id: 'u-anna', display_name: 'Anna', kind: 'staff' },
];
export const FAKE_MEMBERS: Row[] = [
  { user_id: 'u-owner', wallet_id: 'wa', role: 'owner' },
  { user_id: 'u-anna', wallet_id: 'wa', role: 'staff' },
];
/** The same rows the migration seeds into `role_permissions`. */
export const FAKE_PERMISSIONS: Row[] = [
  ...['view', 'add_entry', 'edit_entry', 'remove_own_entry', 'create_category'].map((action) => ({
    role: 'staff',
    action,
  })),
  ...[
    'view',
    'add_entry',
    'edit_entry',
    'remove_entry',
    'remove_own_entry',
    'restore_entry',
    'create_category',
    'manage_wallet',
    'manage_staff',
    'export',
  ].map((action) => ({ role: 'owner', action })),
];
export const STAFF_LOGIN_OK = { session: { access_token: 'at-u-anna', refresh_token: 'rt-u-anna' } };
