import { useReducer } from 'react';
import { useCountScreenKeys } from '../hooks/useCountScreenKeys';
import { CashCountView } from './CashCountView';
import { applyAndClose, countReducer, initialCountState } from '../domain/cashCount';

interface CashCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (total: number) => void;
}

function CountOverlay({ onClose, onApply }: Omit<CashCalculatorProps, 'isOpen'>) {
  const [state, dispatch] = useReducer(countReducer, undefined, initialCountState);
  useCountScreenKeys(onClose);

  return (
    <CashCountView
      state={state}
      dispatch={dispatch}
      onClose={onClose}
      onApply={(total) => applyAndClose(total, onApply, onClose)}
    />
  );
}

export default function CashCalculator({ isOpen, onClose, onApply }: CashCalculatorProps) {
  return isOpen ? <CountOverlay onClose={onClose} onApply={onApply} /> : null;
}
