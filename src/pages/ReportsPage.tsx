import { useOptionalWallet } from '../wallet/useWallet';

export default function ReportsPage() {
  const walletName = useOptionalWallet()?.current?.name;
  return (
    <div className="page-header">
      <div>
        <h1 className="page-header__title">Reports</h1>
        {walletName && <p className="page-header__subtitle">{walletName}</p>}
      </div>
    </div>
  );
}
