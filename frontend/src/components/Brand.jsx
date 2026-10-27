import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

/**
 * Triage Horizon mark: an ECG trace rising over a horizon line.
 * The tile stays deep forest in both themes so the identity is stable.
 */
export function BrandMark({ className = '', title = '' }) {
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-[6px] border border-brand/25 bg-[var(--mark-bg)] text-[var(--mark-ink)]',
        className
      )}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className="h-[62%] w-[62%]"
        aria-hidden="true"
      >
        <path
          d="M4.5 19.4h5.4l2.3-6.1 3.7 9.4 2.7-7 1.7 3.7h6.2"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 25.2h23"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-x-[18%] top-0 h-px bg-white/20"
      />
    </span>
  );
}

export function BrandLockup({
  to = '/',
  light = false,
  compact = false,
  showTagline = true,
  className = '',
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group inline-flex min-w-0 items-center gap-2.5 rounded-[4px]',
        className
      )}
      aria-label="Triage Horizon home"
    >
      <BrandMark className="h-8 w-8 transition-colors group-hover:border-brand/50" />
      <span className="min-w-0">
        <span
          className={cn(
            'block whitespace-nowrap text-[15px] font-semibold leading-tight tracking-[-0.02em]',
            light ? 'text-forest-ink' : 'text-ink'
          )}
        >
          Triage Horizon
        </span>
        {showTagline && !compact && (
          <span
            className={cn(
              'mt-0.5 block whitespace-nowrap font-mono text-[8px] font-medium uppercase tracking-[0.2em]',
              light ? 'text-forest-faint' : 'text-ink-muted'
            )}
          >
            Clinical network
          </span>
        )}
      </span>
    </Link>
  );
}

export default BrandLockup;
