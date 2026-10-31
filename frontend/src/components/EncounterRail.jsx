import { Check } from 'lucide-react';
import { cn, formatRelativeTime } from '../lib/utils';

const STEPS = [
  { key: 'INTAKE', label: 'Intake', shortLabel: 'Intake' },
  { key: 'TRIAGED', label: 'Triaged', shortLabel: 'Triage' },
  { key: 'ROUTING', label: 'Routing', shortLabel: 'Route' },
  { key: 'ACCEPTANCE', label: 'Acceptance', shortLabel: 'Accept' },
  { key: 'EN_ROUTE', label: 'En route', shortLabel: 'En route' },
  { key: 'CLOSED', label: 'Closed', shortLabel: 'Closed' },
];

const STATUS_TO_STEP = {
  INTAKE: 0,
  TRIAGED: 1,
  ROUTING: 2,
  AWAITING_ACCEPTANCE: 3,
  ACCEPTED: 3,
  EN_ROUTE: 4,
  CLOSED: 5,
};

const STATUS_LABELS = {
  INTAKE: 'Intake',
  TRIAGED: 'Triaged',
  ROUTING: 'Routing',
  AWAITING_ACCEPTANCE: 'Awaiting Acceptance',
  ACCEPTED: 'Accepted',
  EN_ROUTE: 'En route',
  CLOSED: 'Completed',
};

const STATUS_BADGE_CLASSES = {
  INTAKE: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  TRIAGED: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
  ROUTING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  AWAITING_ACCEPTANCE: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  ACCEPTED: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
  EN_ROUTE: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
  CLOSED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
};

export default function EncounterRail({
  encounter,
  className = '',
  compact = false,
  dense = false,
}) {
  if (!encounter?.id) return null;

  const activeIndex = STATUS_TO_STEP[encounter.status] ?? 0;
  const badgeClass =
    STATUS_BADGE_CLASSES[encounter.status] ?? STATUS_BADGE_CLASSES.TRIAGED;
  const facilityName =
    encounter.facility_name ??
    encounter.selected_facility?.name ??
    'Awaiting destination assignment';
  const clinician = encounter.assigned_doctor_name;
  const updatedAt = encounter.updated_at ?? encounter.created_at;

  return (
    <section
      aria-label={`Encounter progress for ${encounter.id}`}
      className={cn(
        'rounded-2xl border border-border/80 bg-surface shadow-xs transition-all duration-200',
        compact ? 'p-4' : 'p-5',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/50 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {encounter.id}
          </span>
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
              badgeClass
            )}
          >
            {STATUS_LABELS[encounter.status] ?? encounter.status}
          </span>
        </div>

        <p className="min-w-0 truncate text-xs font-medium text-ink-muted">
          <span className="font-semibold text-ink">{facilityName}</span>
          {clinician ? ` · Dr. ${clinician}` : ''}
          {updatedAt ? ` · ${formatRelativeTime(updatedAt)}` : ''}
        </p>
      </div>

      <div className={cn('mt-4', !dense && 'overflow-x-auto pb-1')}>
        <ol
          className={cn(
            'flex w-full items-start',
            !dense && (compact ? 'sm:min-w-[480px]' : 'sm:min-w-[560px]')
          )}
        >
          {STEPS.map((step, index) => {
            const state =
              index < activeIndex
                ? 'complete'
                : index === activeIndex
                  ? 'active'
                  : 'pending';
            const isComplete = state === 'complete';
            const isActive = state === 'active';

            return (
              <li
                key={step.key}
                className="relative flex min-w-0 flex-1 flex-col items-center text-center"
                aria-current={isActive ? 'step' : undefined}
              >
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute right-1/2 h-0.5 w-full transition-colors duration-300',
                      dense ? 'top-2' : 'top-2.5 sm:top-3',
                      index <= activeIndex
                        ? 'bg-emerald-500'
                        : 'bg-slate-200 dark:bg-slate-800'
                    )}
                  />
                )}

                <span
                  className={cn(
                    'relative z-10 grid place-items-center rounded-full font-bold transition-all duration-300',
                    dense
                      ? 'h-4 w-4 text-[9px]'
                      : 'h-5 w-5 text-[10px] sm:h-6 sm:w-6 sm:text-xs',
                    isComplete &&
                    'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]',
                    isActive &&
                    'bg-teal-600 text-white ring-4 ring-teal-500/20 shadow-[0_0_12px_rgba(13,148,136,0.5)]',
                    state === 'pending' &&
                    'border border-slate-300 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                  )}
                >
                  {isComplete ? (
                    <Check
                      aria-hidden="true"
                      className={dense ? 'h-2.5 w-2.5' : 'h-3 w-3 sm:h-3.5 sm:w-3.5'}
                      strokeWidth={3}
                    />
                  ) : (
                    index + 1
                  )}
                </span>

                <span
                  className={cn(
                    'mt-2.5 whitespace-nowrap text-xs font-semibold tracking-tight transition-colors duration-200',
                    isComplete && 'text-emerald-600 dark:text-emerald-400',
                    isActive && 'text-teal-600 dark:text-teal-400',
                    state === 'pending' && 'text-slate-400 dark:text-slate-600'
                  )}
                >
                  {dense ? (
                    step.shortLabel
                  ) : (
                    <>
                      <span className="sm:hidden">{step.shortLabel}</span>
                      <span className="hidden sm:inline">{step.label}</span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
