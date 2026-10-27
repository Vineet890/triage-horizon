import {
  Activity,
  CheckCircle2,
  Clock3,
  MapPin,
  Route,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const TRACE_STEPS = [
  {
    label: 'Protocol matched',
    value: 'RESP-002 · Asthma exacerbation',
  },
  {
    label: 'Network checked',
    value: '4 facilities compared · live capacity',
  },
  {
    label: 'Decision prepared',
    value: 'Sector 19 · 1.6 km · 6 min',
  },
];

const CANDIDATES = [
  {
    name: 'Sector 19 Primary Care Clinic',
    detail: 'Primary care · 1.6 km · 25% load',
    score: 96,
    selected: true,
  },
  {
    name: 'Sunrise Multispecialty Hospital',
    detail: 'Hospital · 2.4 km · 94% load',
    score: 58,
    selected: false,
  },
  {
    name: 'Horizon Multispecialty Hospital',
    detail: 'Hospital · 3.1 km · 40% load',
    score: 71,
    selected: false,
  },
];

export default function RoutingConsole({ compact = false, className = '' }) {
  const candidates = compact ? CANDIDATES.slice(0, 2) : CANDIDATES;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'overflow-hidden rounded-[6px] border border-[#2A453D] bg-[#0C1F1A] text-[#E8EFEC]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#2A453D] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-[4px] border border-[#1E4A42] bg-[#0D9488] text-white">
            <Route className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
          <span className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-[#9FB3AD]">
            Routing console
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-[#1E4A42] bg-[#0B2C26] px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-[#5EEAD4]">
          <span className="h-1.5 w-1.5 rounded-[1px] bg-[#16A34A]" />
          Live
        </span>
      </div>

      <div className={cn('p-4 sm:p-5', compact && 'sm:p-4')}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#7E958E]">
              TH-2041 · 14:32 IST
            </p>
            <p className="mt-1.5 text-base font-semibold tracking-tight text-[#F3F7F5] sm:text-lg">
              Aarav Mehta, 24
            </p>
            <p className="mt-1 text-xs leading-5 text-[#A9BDB6] sm:text-[13px]">
              Persistent wheezing · reliever used twice
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border border-[#7A5A12] bg-[#3B2A08] px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[#FBBF24]">
            <span className="h-1.5 w-1.5 rounded-[1px] bg-[#CA8A04]" />
            Moderate
          </span>
        </div>

        <div className="mt-4 border-t border-[#2A453D] pt-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#7E958E]">
              Agent trace
            </p>
            <span className="inline-flex items-center gap-1.5 font-mono text-[9px] text-[#5EEAD4]">
              <Activity className="h-3 w-3" />
              1.8s
            </span>
          </div>

          <ul className="mt-2.5 space-y-2">
            {TRACE_STEPS.map((step) => (
              <li key={step.label} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16A34A]" />
                <p className="min-w-0 text-[11px] leading-5 text-[#C7D6D1]">
                  <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#7E958E]">
                    {step.label}
                  </span>
                  <span className="mx-1.5 text-[#4E6A62]">/</span>
                  {step.value}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 border-t border-[#2A453D] pt-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#7E958E]">
              Facility match
            </p>
            <p className="font-mono text-[9px] text-[#7E958E]">
              {candidates.length} of 4
            </p>
          </div>

          <div className="mt-2.5 space-y-1.5">
            {candidates.map((candidate) => (
              <div
                key={candidate.name}
                className={cn(
                  'flex items-center gap-2.5 rounded-[4px] border px-2.5 py-2',
                  candidate.selected
                    ? 'border-[#0D9488] bg-[#0D2F29]'
                    : 'border-[#223B34] bg-[#0A1A16]'
                )}
              >
                <span
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-[3px] border',
                    candidate.selected
                      ? 'border-[#0D9488] bg-[#0D9488] text-white'
                      : 'border-[#2A453D] text-[#7E958E]'
                  )}
                >
                  {candidate.selected ? (
                    <MapPin className="h-3 w-3" />
                  ) : (
                    <span className="font-mono text-[8px]">—</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-[11px] font-medium',
                      candidate.selected ? 'text-[#F3F7F5]' : 'text-[#A9BDB6]'
                    )}
                  >
                    {candidate.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[8px] uppercase tracking-[0.06em] text-[#6F8880]">
                    {candidate.detail}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 font-mono text-[10px] font-semibold',
                    candidate.selected ? 'text-[#5EEAD4]' : 'text-[#7E958E]'
                  )}
                >
                  {candidate.score}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#2A453D] pt-3.5">
          <span className="inline-flex items-center gap-1.5 text-[10px] text-[#A9BDB6]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#5EEAD4]" />
            Route locked · clinician review
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5EEAD4]">
            <Clock3 className="h-3 w-3" />6 min ETA
          </span>
        </div>
      </div>
    </div>
  );
}
