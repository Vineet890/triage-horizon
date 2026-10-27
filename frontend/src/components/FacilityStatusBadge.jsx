import { getFacilityStatusMeta } from '../lib/clinical';
import { cn } from '../lib/utils';

const TONES = {
  AVAILABLE:
    'border-signal-success-border bg-signal-success-soft text-signal-success-ink',
  LIMITED:
    'border-signal-amber-border bg-signal-amber-soft text-signal-amber-ink',
  BUSY: 'border-signal-high-border bg-signal-high-soft text-signal-high-ink',
  OFFLINE:
    'border-signal-danger-border bg-signal-danger-soft text-signal-danger-ink',
};

const DOTS = {
  AVAILABLE: 'bg-signal-success',
  LIMITED: 'bg-signal-amber',
  BUSY: 'bg-signal-high',
  OFFLINE: 'bg-signal-danger',
};

export default function FacilityStatusBadge({ status = 'AVAILABLE', className = '' }) {
  const meta = getFacilityStatusMeta(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-[4px] border px-3 py-1 text-sm font-semibold',
        TONES[status] ?? TONES.LIMITED,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-2 w-2 rounded-[2px]',
          DOTS[status] ?? DOTS.LIMITED
        )}
      />
      {meta.label}
    </span>
  );
}
