import type { ChangeEvent, Dispatch, KeyboardEvent } from 'react';
import { ArrowLeft, Undo2 } from 'lucide-react';
import {
  DENOMINATIONS,
  parseCount,
  pieceSummary,
  totalCents,
  type CountAction,
  type CountState,
  type Mode,
} from '../utils/cashCount';
import { formatCurrency } from '../utils/formatCurrency';

interface CashCountViewProps {
  state: CountState;
  dispatch: Dispatch<CountAction>;
  onApply: (total: number) => void;
  onClose: () => void;
  locale?: string;
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'add', label: 'Add' },
  { id: 'remove', label: 'Remove' },
  { id: 'type', label: 'Type' },
];

const HINTS: Record<Mode, string> = {
  add: 'Tap a note or coin to add one.',
  remove: 'Removing: tap a note or coin to take one away.',
  type: 'Type how many of each you counted.',
};

export function CashCountView({ state, dispatch, onApply, onClose, locale }: CashCountViewProps) {
  const { counts, history, mode } = state;
  const cents = totalCents(counts);
  const money = (amountCents: number) => formatCurrency(amountCents / 100, locale);

  // A zero count is shown as an empty field with a "0" placeholder, so typing "1" gives 1, not "01".
  const fieldText = (n: number) => (n === 0 ? '' : String(n));

  const renderEntry = (index: number) => {
    const d = DENOMINATIONS[index];
    return (
      <div className="count-entry" key={d.label}>
        <span className="count-entry__label">{d.label}</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="count-entry__input"
          aria-label={`Number of ${d.label} ${d.kind}`}
          placeholder="0"
          value={fieldText(counts[index])}
          // Every keystroke counts, so the total is live and nothing is lost if a button is tapped next.
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            dispatch({ type: 'set', index, value: parseCount(e.currentTarget.value), typing: true })
          }
          // Leaving the field ends the typing burst, so the next entry is its own undo step.
          onBlur={() => dispatch({ type: 'set', index, value: counts[index] })}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            const fields = Array.from(
              e.currentTarget.closest('.count-body')?.querySelectorAll<HTMLInputElement>('.count-entry__input') ?? [],
            );
            const next = fields[fields.indexOf(e.currentTarget) + 1];
            if (next) next.focus();
            else e.currentTarget.blur();
          }}
        />
      </div>
    );
  };

  const renderTile = (index: number) => {
    const d = DENOMINATIONS[index];
    const n = counts[index];
    const on = n > 0;
    const classes = [
      'count-tile',
      d.kind === 'coins' ? 'count-tile--coin' : 'count-tile--note',
      on ? 'count-tile--on' : '',
      on && mode === 'remove' ? 'count-tile--remove' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button
        key={d.label}
        type="button"
        className={classes}
        aria-label={`${d.label} ${d.kind}: ${n}. ${mode === 'remove' ? 'Tap to remove one' : 'Tap to add one'}`}
        onClick={() => dispatch({ type: mode === 'remove' ? 'remove' : 'add', index })}
      >
        <span className="count-tile__face">{d.label}</span>
        <span className="count-tile__sub">{on ? money(n * d.cents) : '—'}</span>
        <span className="count-tile__badge" aria-hidden="true">
          {n}
        </span>
      </button>
    );
  };

  const section = (title: string, firstIndex: number, lastIndex: number) => {
    const indexes = Array.from({ length: lastIndex - firstIndex + 1 }, (_, i) => firstIndex + i);
    return (
      <section className="count-section" aria-labelledby={`count-${title.toLowerCase()}`}>
        <h2 className="count-section__title" id={`count-${title.toLowerCase()}`}>
          {title}
        </h2>
        <div className="count-grid">
          {indexes.map(mode === 'type' ? renderEntry : renderTile)}
        </div>
      </section>
    );
  };

  return (
    <div className="count-screen" role="dialog" aria-modal="true" aria-labelledby="count-title">
      <header className="count-header">
        <button
          type="button"
          className="count-icon-btn"
          aria-label="Back to the form"
          onClick={onClose}
        >
          <ArrowLeft size={24} aria-hidden="true" />
        </button>
        <h1 className="count-header__title" id="count-title">
          Count cash
        </h1>
        <button type="button" className="count-clear" onClick={() => dispatch({ type: 'clear' })}>
          Clear
        </button>
      </header>

      <div className="count-body">
        <section className="count-total">
          <span className="count-total__label">Counted</span>
          <span className="count-total__amount" aria-live="polite">
            {money(cents)}
          </span>
          <span className="count-total__pieces">{pieceSummary(counts)}</span>
        </section>

        {section('Notes', 0, 3)}
        {section('Coins', 4, DENOMINATIONS.length - 1)}

        <p className="count-hint">{HINTS[mode]}</p>
      </div>

      <footer className="count-footer">
        <button
          type="button"
          className="count-apply"
          disabled={cents === 0}
          onClick={() => onApply(cents / 100)}
        >
          {`Use ${money(cents)} as amount`}
        </button>
        <div className="count-toolbar" role="toolbar" aria-label="Counting tools">
          <div className="count-modes" role="group" aria-label="What a tap does">
            {MODES.map((m) => {
              const on = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`count-mode${on ? ' count-mode--on' : ''}${on && m.id === 'remove' ? ' count-mode--remove' : ''}`}
                  aria-pressed={on}
                  onClick={() => dispatch({ type: 'setMode', mode: m.id })}
                >
                  {on ? `✓ ${m.label}` : m.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="count-icon-btn count-undo"
            aria-label="Undo last tap"
            disabled={history.length === 0}
            onClick={() => dispatch({ type: 'undo' })}
          >
            <Undo2 size={24} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  );
}
