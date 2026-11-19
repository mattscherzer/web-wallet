import { useState } from 'react';
import { HistorySkeleton } from '../components/LoadingSkeletons';
import NotLoaded from '../components/NotLoaded';
import ExportActions from '../components/reports/ExportActions';
import ExportSheet from '../components/reports/ExportSheet';
import LedgerPreview from '../components/reports/LedgerPreview';
import PeriodSheet from '../components/reports/PeriodSheet';
import PeriodTabs from '../components/reports/PeriodTabs';
import ReportEmpty from '../components/reports/ReportEmpty';
import ReportSummary from '../components/reports/ReportSummary';
import { presetPeriod } from '../domain/reports';
import { exportReport } from '../hooks/exportReport';
import { useReport } from '../hooks/useReport';
import { useOwnerConfirm } from '../auth/OwnerConfirm';
import { useAuth } from '../auth/useAuth';
import { getTodayString } from '../utils/dateHelpers';
import { useOptionalWallet } from '../wallet/useWallet';

type Sheet = { name: 'period'; backToExport: boolean } | { name: 'export' } | null;

export default function ReportsPage() {
  const wallet = useOptionalWallet()?.current;
  const { can } = useAuth();
  const confirmOwner = useOwnerConfirm();
  const [today] = useState(getTodayString);
  const [period, setPeriod] = useState(() => presetPeriod('month', 0, today));
  const [includeRemoved, setIncludeRemoved] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const { report, reportFor, loaded, failed, refresh } = useReport(period);

  const exportNow = async () => {
    if (!wallet || !(await confirmOwner())) return false;
    await exportReport(wallet.id, wallet.name, period, includeRemoved);
    return true;
  };
  const openExport = () => setSheet({ name: 'export' });
  const openPeriod = () => setSheet({ name: 'period', backToExport: false });
  const leavePeriod = () => setSheet(sheet?.name === 'period' && sheet.backToExport ? { name: 'export' } : null);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Reports</h1>
          {wallet && <p className="page-header__subtitle">{wallet.name}</p>}
        </div>
      </div>

      <PeriodTabs period={period} today={today} onSelect={setPeriod} onCustom={openPeriod} />

      {!loaded && (
        <NotLoaded failed={failed} what="the report" onRetry={() => void refresh()} skeleton={<HistorySkeleton />} />
      )}
      {report && report.entryCount === 0 && <ReportEmpty period={period} onShow={setPeriod} onPick={openPeriod} />}
      {report && report.entryCount > 0 && (
        <div className="report-body">
          <ReportSummary report={report} />
          {can('export') && <ExportActions onOpen={openExport} />}
          <LedgerPreview report={report} />
        </div>
      )}

      {sheet?.name === 'period' && (
        <PeriodSheet
          initial={period}
          today={today}
          reportFor={reportFor}
          onApply={(next) => {
            setPeriod(next);
            leavePeriod();
          }}
          onClose={leavePeriod}
        />
      )}
      {sheet?.name === 'export' && wallet && can('export') && (
        <ExportSheet
          period={period}
          walletName={wallet.name}
          onChangePeriod={() => setSheet({ name: 'period', backToExport: true })}
          includeRemoved={includeRemoved}
          onIncludeRemovedChange={setIncludeRemoved}
          onExport={exportNow}
          onClose={() => setSheet((now) => (now?.name === 'export' ? null : now))}
        />
      )}
    </>
  );
}
