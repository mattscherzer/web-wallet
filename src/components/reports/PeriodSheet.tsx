import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import BottomSheet from '../BottomSheet';
import FormError from '../FormError';
import {
  daysLabel,
  isSamePeriod,
  periodDays,
  periodLabel,
  presetPeriod,
  QUICK_PICKS,
  validatePeriod,
  type Period,
  type PeriodUnit,
  type Report,
} from '../../domain/reports';
import { euros } from './money';

type Tab = PeriodUnit | 'custom';

const TABS: { id: Tab; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Custom' },
];

const UNITS: PeriodUnit[] = ['month', 'quarter', 'year'];

interface Position {
  tab: Tab;
  offset: number;
}

function positionOf(period: Period, today: string): Position {
  for (const unit of UNITS) {
    for (const offset of [0, -1]) {
      if (isSamePeriod(period, presetPeriod(unit, offset, today))) return { tab: unit, offset };
    }
  }
  return { tab: 'custom', offset: 0 };
}

interface PeriodSheetProps {
  initial: Period;
  today: string;
  reportFor: (period: Period) => Report | null;
  onApply: (period: Period) => void;
  onClose: () => void;
}

export default function PeriodSheet({ initial, today, reportFor, onApply, onClose }: PeriodSheetProps) {
  const [draft, setDraft] = useState(initial);
  const [{ tab, offset }, setPosition] = useState(() => positionOf(initial, today));
  const problem = validatePeriod(draft);
  const preview = problem ? null : reportFor(draft);

  const pick = (period: Period) => {
    setDraft(period);
    setPosition(positionOf(period, today));
  };
  const step = (unit: PeriodUnit, to: number) => {
    setPosition({ tab: unit, offset: to });
    setDraft(presetPeriod(unit, to, today));
  };
  const edit = (change: Partial<Period>) => {
    setDraft({ ...draft, ...change });
    setPosition({ tab: 'custom', offset: 0 });
  };

  return (
    <BottomSheet title="Report period" showClose onClose={onClose} className="report-sheet">
      <div role="group" aria-label="Period type" className="period-tabs period-tabs--four">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`period-tab${tab === id ? ' period-tab--active' : ''}`}
            aria-pressed={tab === id}
            onClick={() => (id === 'custom' ? setPosition({ tab: 'custom', offset: 0 }) : step(id, 0))}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== 'custom' && (
        <div className="report-stepper">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Previous ${tab}`}
            onClick={() => step(tab, offset - 1)}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <span className="num report-stepper__label">{periodLabel(draft)}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Next ${tab}`}
            disabled={offset === 0}
            onClick={() => step(tab, offset + 1)}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="report-dates">
        <label className="report-date">
          <span className="report-date__label">From</span>
          <input type="date" value={draft.start} onChange={(e) => edit({ start: e.target.value })} />
        </label>
        <label className="report-date">
          <span className="report-date__label">To</span>
          <input type="date" value={draft.end} onChange={(e) => edit({ end: e.target.value })} />
        </label>
      </div>

      <fieldset className="report-picks">
        <legend>Quick picks</legend>
        <div className="report-picks__list">
          {QUICK_PICKS.map((quick) => {
            const period = quick.period(today);
            const pressed = isSamePeriod(draft, period);
            return (
              <button
                key={quick.label}
                type="button"
                className={`filter-pill${pressed ? ' filter-pill--active' : ''}`}
                aria-pressed={pressed}
                onClick={() => pick(period)}
              >
                {quick.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {problem && <FormError>{problem}</FormError>}
      {preview && (
        <p className="report-live num">
          {daysLabel(periodDays(draft))} · {preview.entryCount} {preview.entryCount === 1 ? 'entry' : 'entries'} ·
          Opening Available {euros(preview.openingAvailable)}
        </p>
      )}

      <div className="report-sheet__actions">
        <button type="button" className="btn btn--outline" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" disabled={problem !== null} onClick={() => onApply(draft)}>
          <Check size={20} aria-hidden="true" />
          Apply period
        </button>
      </div>
    </BottomSheet>
  );
}
