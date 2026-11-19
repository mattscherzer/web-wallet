import { FileText } from 'lucide-react';
import {
  monthYearLabel,
  periodKey,
  periodLabel,
  periodMonthName,
  previousMonth,
  type Period,
} from '../../domain/reports';

interface ReportEmptyProps {
  period: Period;
  onShow: (period: Period) => void;
  onPick: () => void;
}

export default function ReportEmpty({ period, onShow, onPick }: ReportEmptyProps) {
  const previous = previousMonth(period);
  const inOneMonth = periodKey(period).length === 'YYYY-MM'.length;
  return (
    <div className="report-empty">
      <span className="report-empty__icon">
        <FileText size={40} aria-hidden="true" />
      </span>
      <h2 className="report-empty__title">
        Nothing to report for {inOneMonth ? periodMonthName(period) : periodLabel(period)}
      </h2>
      <p className="report-empty__text">
        No entries were recorded in this period. Opening balances and the reserve are unchanged.
      </p>
      <div className="report-empty__actions">
        <button type="button" className="btn btn--primary" onClick={() => onShow(previous)}>
          Show {monthYearLabel(previous)}
        </button>
        <button type="button" className="btn btn--outline" onClick={onPick}>
          Pick another period
        </button>
      </div>
    </div>
  );
}
