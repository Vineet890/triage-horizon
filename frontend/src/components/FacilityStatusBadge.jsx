import { getFacilityStatusMeta } from '../lib/clinical';
import { cn } from '../lib/utils';

const TONES = {
  AVAILABLE:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
  LIMITED:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
  BUSY: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300',
  OFFLINE:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300',
};

const DOTS = {
  AVAILABLE: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
  LIMITED: 'bg-amber-500',
  BUSY: 'bg-orange-500',
  OFFLINE: 'bg-rose-500',
};

export default function FacilityStatusBadge({ status = 'AVAILABLE', className = '' }) {
  const meta = getFacilityStatusMeta(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-xs',
        TONES[status] ?? TONES.LIMITED,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          DOTS[status] ?? DOTS.LIMITED
        )}
      />
      <span>{meta.label}</span>
    </span>
  );
}
