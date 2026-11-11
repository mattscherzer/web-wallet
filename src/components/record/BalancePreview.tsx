import { getAccountLabel, type AccountId } from '../../domain/accounts';
import { emptyBalances } from '../../domain/balances';
import { recordPreview, type RecordForm } from '../../domain/recordForm';
import { formatCurrency } from '../../utils/formatCurrency';

/** Balances as they will be after saving; `balances` is null until they have really been fetched. */
export default function BalancePreview({
  form,
  balances,
}: {
  form: RecordForm;
  balances: Record<AccountId, number> | null;
}) {
  const preview = recordPreview(form, balances ?? emptyBalances());
  return (
    <div className="preview" aria-live="polite">
      {balances === null && <p className="preview__line">Checking balances…</p>}
      {balances !== null &&
        preview.lines.map((line, i) => (
          <p key={`${line.accountId}-${i}`} className="preview__line">
            <span>{getAccountLabel(line.accountId)}</span>
            <span className="num">→ {formatCurrency(line.after)}</span>
          </p>
        ))}
      {balances !== null && (
        <p className="preview__line">
          <span>Available</span>
          <span className="num">→ {formatCurrency(preview.availableAfter)}</span>
        </p>
      )}
    </div>
  );
}
