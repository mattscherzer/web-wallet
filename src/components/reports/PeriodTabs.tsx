import { isSamePeriod, presetPeriod, type Period } from '../../domain/reports';

interface PeriodTabsProps {
  period: Period;
  today: string;
  onSelect: (period: Period) => void;
  onCustom: () => void;
}

export default function PeriodTabs({ period, today, onSelect, onCustom }: PeriodTabsProps) {
  const thisMonth = presetPeriod('month', 0, today);
  const lastMonth = presetPeriod('month', -1, today);
  const isThis = isSamePeriod(period, thisMonth);
  const isLast = isSamePeriod(period, lastMonth);
  const tabs = [
    { label: 'This month', pressed: isThis, onClick: () => onSelect(thisMonth) },
    { label: 'Last month', pressed: isLast, onClick: () => onSelect(lastMonth) },
    { label: 'Custom', pressed: !isThis && !isLast, onClick: onCustom },
  ];
  return (
    <div role="group" aria-label="Period" className="period-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.label}
          type="button"
          className={`period-tab${tab.pressed ? ' period-tab--active' : ''}`}
          aria-pressed={tab.pressed}
          onClick={tab.onClick}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
