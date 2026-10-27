import { Loader2, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ThinkingLog({
  steps = [],
  title = 'AI triage reasoning',
  active = false,
  className = '',
}) {
  return (
    <div
      className={cn(
        'rounded-[6px] border border-border-strong bg-surface-muted p-4',
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-secondary">
        <Terminal aria-hidden="true" className="h-4 w-4" />
        {title}
      </div>

      <ol className="mt-3 space-y-2">
        {steps.map((step, index) => (
          <li
            key={`${index}-${step}`}
            className="flex gap-3 font-mono text-sm leading-6 text-ink-secondary"
          >
            <span className="shrink-0 text-ink-muted">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {active && (
        <div className="mt-3 flex items-center gap-2 font-mono text-sm text-brand-strong">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Processing clinical decision…
        </div>
      )}
    </div>
  );
}
