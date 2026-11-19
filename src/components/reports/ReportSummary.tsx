import { Shield } from 'lucide-react';
import { periodLabel, shortDate, type Report } from '../../domain/reports';
import { euros, signedEuros } from './money';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="report-row num">
      <span>{label}</span>
      <span>{children}</span>
    </div>
  );
}

export default function ReportSummary({ report }: { report: Report }) {
  const { period } = report;
  return (
    <section aria-labelledby="report-summary-title" className="report-card">
      <h2 id="report-summary-title" className="report-card__title">
        {periodLabel(period)}
      </h2>
      <Row label={`Available on ${shortDate(period.start)}`}>{euros(report.openingAvailable)}</Row>
      <Row label="Money in">
        <strong className="report-in">{signedEuros(report.moneyIn)}</strong>
      </Row>
      <Row label="Money out">
        <strong>{signedEuros(-report.moneyOut)}</strong>
      </Row>
      <Row label="Moved to reserve">
        <strong>{signedEuros(-report.movedToReserve)}</strong>
      </Row>
      <div className="report-row report-row--total num">
        <span>Available on {shortDate(period.end)}</span>
        <span className="report-total">{euros(report.closingAvailable)}</span>
      </div>
      <div className="report-reserve num">
        <span className="report-reserve__label">
          <Shield size={18} aria-hidden="true" />
          Reserve (not available)
        </span>
        <strong>{euros(report.closingReserve)}</strong>
      </div>
    </section>
  );
}
