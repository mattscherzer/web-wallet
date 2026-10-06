import { useOptionalWallet } from '../wallet/WalletContext';

export default function ReportsPage() {
  const walletName = useOptionalWallet()?.current?.name;
  return (
    <div className="page-header">
      <h1 className="page-header__title">Reports</h1>
      {walletName && <p className="page-header__subtitle">{walletName}</p>}
    </div>
  );
}
