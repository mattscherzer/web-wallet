const LABELS = {
  edited: 'Edited',
  removed: 'Removed',
} as const;

interface StatusChipProps {
  variant: keyof typeof LABELS;
}

export default function StatusChip({ variant }: StatusChipProps) {
  return <span className={`status-chip status-chip--${variant}`}>{LABELS[variant]}</span>;
}
