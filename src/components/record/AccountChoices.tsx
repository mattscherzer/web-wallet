import { ACCOUNTS, type AccountId } from '../../domain/accounts';

interface AccountChoicesProps {
  name: string;
  value: AccountId;
  onPick: (id: AccountId) => void;
  /** Id for the selected option, so an error summary can link to it. */
  invalidId?: string;
}

export default function AccountChoices({ name, value, onPick, invalidId }: AccountChoicesProps) {
  return (
    <div className="choice-group" role="radiogroup" aria-label={name}>
      {ACCOUNTS.map((a) => (
        <label key={a.id} className={`choice${value === a.id ? ' choice--on' : ''}`}>
          <input
            type="radio"
            name={name}
            value={a.id}
            checked={value === a.id}
            onChange={() => onPick(a.id)}
            id={a.id === value ? invalidId : undefined}
          />
          <span>{a.name}</span>
        </label>
      ))}
    </div>
  );
}
