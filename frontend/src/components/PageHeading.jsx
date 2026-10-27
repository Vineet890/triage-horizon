import { cn } from '../lib/utils';

export default function PageHeading({
  theme = 'light',
  eyebrow = '',
  title,
  description = '',
  actions = null,
  className = '',
}) {
  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p
            className={cn(
              'text-sm font-semibold uppercase tracking-wide',
              isDark ? 'text-brand-strong' : 'text-brand-strong'
            )}
          >
            {eyebrow}
          </p>
        )}
        <h1
          className={cn(
            'mt-1 text-3xl font-semibold tracking-tight',
            isDark ? 'text-ink' : 'text-ink'
          )}
        >
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              'mt-2 max-w-3xl text-base text-pretty',
              isDark ? 'text-ink-secondary' : 'text-ink-secondary'
            )}
          >
            {description}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}
