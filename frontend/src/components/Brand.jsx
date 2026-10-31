import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

/**
 * Triage Horizon mark: Interlocking pastel green TH monogram with ECG pulse wave & sunrise.
 */
export function BrandMark({ className = '', title = 'Triage Horizon' }) {
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-[#A3C9B4]/50 bg-white p-0.5 shadow-xs transition-all duration-300 group-hover:border-[#7CA982] group-hover:shadow-[0_0_12px_rgba(124,169,130,0.3)]',
        className
      )}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
    >
      <img
        src="/logo.png"
        alt="Triage Horizon"
        className="h-full w-full object-contain"
        loading="eager"
      />
    </span>
  );
}

/**
 * Full visual logo representation (emblem + typography + tagline).
 */
export function BrandFullLogo({ className = 'h-16 w-auto' }) {
  return (
    <img
      src="/logo.png"
      alt="Triage Horizon - Your Health Journey. One Place."
      className={cn('object-contain', className)}
    />
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
        'group inline-flex min-w-0 items-center gap-3 rounded-lg py-1 transition-opacity hover:opacity-95',
        className
      )}
      aria-label="Triage Horizon home"
    >
      <BrandMark className="h-10 w-10 ring-1 ring-[#7CA982]/20" />
      <span className="min-w-0">
        <span
          className={cn(
            'block whitespace-nowrap text-[17px] font-extrabold tracking-tight',
            light ? 'text-white' : 'text-[#3D6B56] dark:text-[#E2EFE7]'
          )}
        >
          Triage{' '}
          <span
            className={
              light ? 'text-[#A3C9B4]' : 'text-[#7CA982] dark:text-[#A3C9B4]'
            }
          >
            Horizon
          </span>
        </span>
        {showTagline && !compact && (
          <span
            className={cn(
              'block whitespace-nowrap font-sans text-[8px] font-bold uppercase tracking-[0.16em]',
              light ? 'text-[#C5DED0]' : 'text-[#6A8578] dark:text-[#9BB8A9]'
            )}
          >
            YOUR HEALTH JOURNEY. ONE PLACE.
          </span>
        )}
      </span>
    </Link>
  );
}

export default BrandLockup;
