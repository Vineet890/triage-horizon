import { getAcuityMeta } from '../lib/clinical';
import { cn } from '../lib/utils';

const TONES = {
  CRITICAL:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300',
  HIGH: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300',
  MODERATE:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
  LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
};

const DOTS = {
  CRITICAL: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
  HIGH: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]',
  MODERATE: 'bg-amber-500',
  LOW: 'bg-emerald-500',
};

export default function AcuityBadge({ acuity = 'LOW', size = 'md', className = '' }) {
  const meta = getAcuityMeta(acuity);
  const tone = TONES[meta.code] ?? TONES.LOW;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border font-semibold shadow-xs transition-colors',
        size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs',
        tone,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'rounded-full',
          size === 'lg' ? 'h-2 w-2' : 'h-1.5 w-1.5',
          DOTS[meta.code] ?? DOTS.LOW
        )}
      />
      <span>{meta.label}</span>
    </span>
  );
}
