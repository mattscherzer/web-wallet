import { auditEventTitle, type AuditEntry, type Transaction } from '../../domain/transaction';
import { formatCurrency } from '../../utils/formatCurrency';

const exactTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });

function amountOf(data?: Partial<Transaction> | null): number | undefined {
  return data?.amount === undefined ? undefined : Number(data.amount);
}

export default function HistoryEvent({ entry, author }: { entry: AuditEntry; author: string }) {
  const before = amountOf(entry.previous_data);
  const after = amountOf(entry.new_data);
  const notesBefore = entry.previous_data?.notes;
  const notesAfter = entry.new_data?.notes;

  return (
    <li className="history-log__event">
      <p className="history-log__title">{auditEventTitle(entry.action)}</p>
      <time className="history-log__time" dateTime={entry.timestamp}>
        {exactTime(entry.timestamp)}
      </time>
      <p className="history-log__reason">By {author}</p>
      {entry.action === 'update' && (
        <ul className="history-log__changes">
          {before !== undefined && after !== undefined && before !== after && (
            <li>
              Amount: <span className="sr-only">from </span>
              <span className="num">{formatCurrency(before)}</span>
              <span aria-hidden="true"> → </span>
              <span className="sr-only"> to </span>
              <span className="num">{formatCurrency(after)}</span>
            </li>
          )}
          {notesBefore !== undefined && notesAfter !== undefined && notesBefore !== notesAfter && (
            <li>
              Notes: <span className="sr-only">from </span>“{notesBefore}”<span aria-hidden="true"> → </span>
              <span className="sr-only"> to </span>“{notesAfter}”
            </li>
          )}
        </ul>
      )}
      {entry.reason && <p className="history-log__reason">Reason: {entry.reason}</p>}
      {entry.action === 'delete' && <p className="history-log__reason">No reason recorded</p>}
      {entry.note && <p className="history-log__reason">Note: {entry.note}</p>}
    </li>
  );
}
