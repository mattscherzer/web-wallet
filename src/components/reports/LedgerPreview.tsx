import { Link } from 'react-router';
import { shortDate, type Report } from '../../domain/reports';
import { euros, signedEuros } from './money';

const PREVIEW_ROWS = 3;

export default function LedgerPreview({ report }: { report: Report }) {
  const newestFirst = [...report.entries].reverse().slice(0, PREVIEW_ROWS);
  return (
    <section aria-labelledby="ledger-title">
      <div className="ledger-head">
        <h2 id="ledger-title" className="ledger-head__title">
          Ledger preview
        </h2>
        <span className="ledger-head__meta">
          Newest first · {report.entryCount} {report.entryCount === 1 ? 'entry' : 'entries'}
        </span>
      </div>
      <ul className="ledger-list">
        {newestFirst.map((row) => (
          <li key={row.entry.id} className="ledger-row num">
            <span className="ledger-row__main">
              <Link to={`/history/${row.entry.id}`} className="ledger-row__link">
                <span className="ledger-row__date">{shortDate(row.entry.date)}</span> · {row.title}
              </Link>
              {row.availableChange !== 0 && (
                <span className={`ledger-row__amount${row.availableChange > 0 ? ' report-in' : ''}`}>
                  <span className="sr-only">{row.availableChange > 0 ? 'Money in ' : 'Money out '}</span>
                  {signedEuros(row.availableChange)}
                </span>
              )}
            </span>
            <span className="ledger-row__after">
              Available {euros(row.available)} · Reserve {euros(row.reserve)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
