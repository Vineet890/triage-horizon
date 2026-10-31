import {
  Activity,
  CheckCircle2,
  Clock3,
  MapPin,
  Route,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const TRACE_STEPS = [
  {
    label: 'Protocol matched',
    value: 'RESP-002 · Asthma exacerbation',
  },
  {
    label: 'Network evaluated',
    value: '5 facilities scored · live capacity',
  },
  {
    label: 'Optimal destination',
    value: 'Sector 19 · 1.6 km · 6 min',
  },
];

const CANDIDATES = [
  {
    name: 'Sector 19 Primary Care Clinic',
    detail: 'Primary Care · 1.6 km · 25% load',
    score: 96,
    selected: true,
  },
  {
    name: 'Horizon Multispecialty Hospital',
    detail: 'Tertiary Care · 3.1 km · 40% load',
    score: 71,
    selected: false,
  },
  {
    name: 'Sunrise Multispecialty Hospital',
    detail: 'Emergency Center · 2.4 km · 94% load',
    score: 58,
    selected: false,
  },
];

export default function RoutingConsole({ compact = false, className = '' }) {
  const candidates = compact ? CANDIDATES.slice(0, 2) : CANDIDATES;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur-xl',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/60 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/40">
            <Route className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Clinical Triage Engine
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live Stream
        </span>
      </div>

      <div className={cn('p-5 sm:p-6', compact && 'sm:p-4')}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              <span>ENC-2041</span>
              <span>·</span>
              <span>14:32 IST</span>
            </div>
            <p className="mt-1.5 text-lg font-bold tracking-tight text-white">
              Aarav Mehta, 24
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Persistent wheezing · Reliever inhaler used twice
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Moderate
          </span>
        </div>

        <div className="mt-5 border-t border-slate-800/80 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Manchester Protocol Trace
            </p>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-teal-400">
              <Zap className="h-3 w-3" />
              1.8s inference
            </span>
          </div>

          <ul className="mt-3 space-y-2">
            {TRACE_STEPS.map((step) => (
              <li key={step.label} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <p className="min-w-0 text-xs text-slate-300">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-slate-400">
                    {step.label}
                  </span>
                  <span className="mx-2 text-slate-600">:</span>
                  <span className="font-medium text-slate-100">{step.value}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 border-t border-slate-800/80 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Facility Scoring Matrix
            </p>
            <p className="font-mono text-[10px] text-slate-400">
              {candidates.length} of 5 evaluated
            </p>
          </div>

          <div className="mt-3 space-y-2">
            {candidates.map((candidate) => (
              <div
                key={candidate.name}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all',
                  candidate.selected
                    ? 'border-teal-500/50 bg-teal-950/40 shadow-xs'
                    : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700'
                )}
              >
                <span
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-lg',
                    candidate.selected
                      ? 'bg-teal-500 text-slate-950 shadow-xs'
                      : 'border border-slate-700 text-slate-500'
                  )}
                >
                  {candidate.selected ? (
                    <MapPin className="h-3.5 w-3.5" />
                  ) : (
                    <span className="font-mono text-[9px]">—</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-xs font-semibold',
                      candidate.selected ? 'text-white' : 'text-slate-300'
                    )}
                  >
                    {candidate.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-wider text-slate-400">
                    {candidate.detail}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 font-mono text-xs font-bold',
                    candidate.selected ? 'text-teal-400' : 'text-slate-500'
                  )}
                >
                  {candidate.score}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-teal-400" />
            Physician approval required
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-teal-400">
            <Clock3 className="h-3.5 w-3.5" /> 6 Min ETA
          </span>
        </div>
      </div>
    </div>
  );
}
