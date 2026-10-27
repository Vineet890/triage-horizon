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
  AWAITING_ACCEPTANCE: 'Awaiting acceptance',
  ACCEPTED: 'Accepted',
  EN_ROUTE: 'En route',
  CLOSED: 'Closed',
};

const STATUS_STYLES = {
  TRIAGED: {
    color: 'var(--brand-strong)',
    background: 'var(--brand-soft)',
    border: 'var(--brand-border)',
  },
  ROUTING: {
    color: 'var(--amber-ink)',
    background: 'var(--amber-soft)',
    border: 'var(--amber-border)',
  },
  AWAITING_ACCEPTANCE: {
    color: 'var(--amber-ink)',
    background: 'var(--amber-soft)',
    border: 'var(--amber-border)',
  },
  ACCEPTED: {
    color: 'var(--brand-strong)',
    background: 'var(--brand-soft)',
    border: 'var(--brand-border)',
  },
  EN_ROUTE: {
    color: 'var(--brand-strong)',
    background: 'var(--brand-soft)',
    border: 'var(--brand-border)',
  },
  CLOSED: {
    color: 'var(--success-ink)',
    background: 'var(--success-soft)',
    border: 'var(--success-border)',
  },
};

/**
 * Six-step encounter rail shared by the patient, physician and admin portals.
 * Complete steps are green, the current step is teal and future steps are gray.
 * All colours come from the design tokens so the admin dark theme works without
 * a second component.
 *
 * `dense` removes the fixed minimum width so the rail can sit inside narrow
 * admin cards without horizontal clipping.
 */
export default function EncounterRail({
  encounter,
  className = '',
  compact = false,
  dense = false,
}) {
  if (!encounter?.id) return null;

  const activeIndex = STATUS_TO_STEP[encounter.status] ?? 0;
  const statusStyle =
    STATUS_STYLES[encounter.status] ?? STATUS_STYLES.TRIAGED;
  const facilityName =
    encounter.facility_name ??
    encounter.selected_facility?.name ??
    'Awaiting destination';
  const clinician = encounter.assigned_doctor_name;
  const updatedAt = encounter.updated_at ?? encounter.created_at;

  return (
    <section
      aria-label={`Encounter progress for ${encounter.id}`}
      className={cn(
        'rounded-[6px] border border-border bg-surface',
        compact ? 'p-3.5' : 'p-4',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-ink-muted">
            {encounter.id}
          </span>
          <span
            className="rounded-[3px] border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{
              color: statusStyle.color,
              backgroundColor: statusStyle.background,
              borderColor: statusStyle.border,
            }}
          >
            {STATUS_LABELS[encounter.status] ?? encounter.status}
          </span>
        </div>

        <p className="min-w-0 truncate text-[11px] text-ink-muted">
          {facilityName}
          {clinician ? ` · ${clinician}` : ''}
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

            const nodeStyle = isComplete
              ? {
                  backgroundColor: 'var(--rail-complete)',
                  borderColor: 'var(--rail-complete)',
                  color: '#FFFFFF',
                }
              : isActive
                ? {
                    backgroundColor: 'var(--rail-active)',
                    borderColor: 'var(--rail-active)',
                    color: '#FFFFFF',
                  }
                : {
                    backgroundColor: 'rgb(var(--surface))',
                    borderColor: 'var(--rail-pending)',
                    color: 'var(--rail-pending)',
                  };

            const labelColor = isComplete
              ? 'var(--rail-complete)'
              : isActive
                ? 'var(--rail-active)'
                : 'var(--rail-pending)';

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
                      'absolute right-1/2 h-[2px] w-full',
                      dense ? 'top-[7px]' : 'top-[7px] sm:top-[9px]'
                    )}
                    style={{
                      backgroundColor:
                        index <= activeIndex
                          ? 'var(--rail-complete)'
                          : 'var(--rail-line)',
                    }}
                  />
                )}

                <span
                  className={cn(
                    'relative z-10 grid place-items-center rounded-[3px] border font-semibold',
                    dense
                      ? 'h-4 w-4 text-[8px]'
                      : 'h-4 w-4 text-[8px] sm:h-5 sm:w-5 sm:text-[9px]'
                  )}
                  style={nodeStyle}
                >
                  {isComplete ? (
                    <Check
                      aria-hidden="true"
                      className={
                        dense ? 'h-2.5 w-2.5' : 'h-2.5 w-2.5 sm:h-3 sm:w-3'
                      }
                      strokeWidth={3}
                    />
                  ) : (
                    index + 1
                  )}
                </span>

                <span
                  className={cn(
                    'mt-2 whitespace-nowrap font-semibold uppercase',
                    dense
                      ? 'text-[8px] tracking-[0.03em]'
                      : 'text-[8px] tracking-[0.03em] sm:text-[9px] sm:tracking-[0.07em]'
                  )}
                  style={{ color: labelColor }}
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
