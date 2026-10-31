import { Loader2, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ThinkingLog({
  steps = [],
  title = 'Algorithmic Clinical Reasoning',
  active = false,
  className = '',
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-700/80 bg-slate-900/95 p-5 text-slate-100 shadow-lg backdrop-blur-md',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-400">
          <Terminal aria-hidden="true" className="h-4 w-4" />
          <span>{title}</span>
        </div>
        {active && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-teal-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
            </span>
            Inferring
          </span>
        )}
      </div>

      <ol className="mt-4 space-y-2.5">
        {steps.map((step, index) => (
          <li
            key={`${index}-${step}`}
            className="flex items-start gap-3 font-mono text-xs leading-relaxed text-slate-300"
          >
            <span className="shrink-0 font-bold text-teal-500">
              [{String(index + 1).padStart(2, '0')}]
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {active && (
        <div className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3 font-mono text-xs font-semibold text-teal-400">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-teal-400" />
          Synthesizing clinical recommendation…
        </div>
      )}
    </div>
  );
}
