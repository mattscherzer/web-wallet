import { useId, useState } from 'react';
import { Download } from 'lucide-react';
import BottomSheet from '../BottomSheet';
import FormError from '../FormError';
import { periodLabel, type Period } from '../../domain/reports';
import { reportFilename } from '../../domain/reportCsv';
import { couldnt } from '../../utils/copy';

interface ExportSheetProps {
  period: Period;
  walletName: string;
  includeRemoved: boolean;
  onIncludeRemovedChange: (on: boolean) => void;
  onChangePeriod: () => void;
  onExport: () => Promise<boolean>;
  onClose: () => void;
}

export default function ExportSheet({
  period,
  walletName,
  includeRemoved,
  onIncludeRemovedChange,
  onChangePeriod,
  onExport,
  onClose,
}: ExportSheetProps) {
  const hintId = useId();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const exportNow = () => {
    setFailed(false);
    setBusy(true);
    onExport()
      .then((exported) => (exported ? onClose() : setBusy(false)))
      .catch(() => {
        setFailed(true);
        setBusy(false);
      });
  };

  return (
    <BottomSheet title="Export report" showClose onClose={onClose} className="report-sheet">
      <div className="report-period-row">
        <span className="report-period-row__text">
          <span className="report-date__label">Period</span>
          <span className="num report-period-row__value">{periodLabel(period)}</span>
        </span>
        <button type="button" className="report-link" onClick={onChangePeriod}>
          Change
        </button>
      </div>

      <fieldset className="report-formats">
        <legend className="sr-only">Format</legend>
        <label className="report-format report-format--active">
          <input type="radio" name="report-format" checked readOnly />
          <span>
            <span className="report-format__name">CSV spreadsheet</span>
            <span className="report-format__hint">
              One row per entry with balances. Opens in Excel, Numbers or Sheets.
            </span>
          </span>
        </label>
        <label className="report-format">
          <input type="radio" name="report-format" disabled />
          <span>
            <span className="report-format__name">PDF to print or share</span>
            <span className="report-format__hint">Coming soon</span>
          </span>
        </label>
      </fieldset>

      <label className="report-switch">
        <span className="report-switch__text">
          <span className="report-switch__name">Include removed entries</span>
          <span id={hintId} className="report-format__hint">
            Marked Removed and left out of totals.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Include removed entries"
          aria-describedby={hintId}
          checked={includeRemoved}
          onChange={(e) => onIncludeRemovedChange(e.target.checked)}
        />
      </label>

      <p className="report-filename">{reportFilename(walletName, { period })}</p>

      {failed && <FormError>{couldnt('export the report')}</FormError>}

      <div className="report-sheet__actions">
        <button type="button" className="btn btn--outline" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={exportNow}>
          <Download size={20} aria-hidden="true" />
          Export CSV
        </button>
      </div>
    </BottomSheet>
  );
}
