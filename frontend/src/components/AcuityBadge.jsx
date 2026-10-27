import { getAcuityMeta } from '../lib/clinical';
import { cn } from '../lib/utils';

const TONES = {
  CRITICAL:
    'border-signal-danger-border bg-signal-danger-soft text-signal-danger-ink',
  HIGH: 'border-signal-high-border bg-signal-high-soft text-signal-high-ink',
  MODERATE:
    'border-signal-amber-border bg-signal-amber-soft text-signal-amber-ink',
  LOW: 'border-signal-success-border bg-signal-success-soft text-signal-success-ink',
};

const DOTS = {
  CRITICAL: 'bg-signal-danger',
  HIGH: 'bg-signal-high',
  MODERATE: 'bg-signal-amber',
  LOW: 'bg-signal-success',
};

export default function AcuityBadge({ acuity = 'LOW', size = 'md', className = '' }) {
  const meta = getAcuityMeta(acuity);
  const tone = TONES[meta.code] ?? TONES.LOW;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-[4px] border font-semibold',
        size === 'lg' ? 'px-4 py-2 text-base' : 'px-3 py-1 text-sm',
        tone,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'rounded-[2px]',
          size === 'lg' ? 'h-2.5 w-2.5' : 'h-2 w-2',
          DOTS[meta.code] ?? DOTS.LOW
        )}
      />
      {meta.label}
    </span>
  );
}
