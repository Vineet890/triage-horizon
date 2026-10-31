import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Bell,
  ChartColumn,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gauge,
  Hospital,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Users,
  UsersRound,
  Zap,
} from 'lucide-react';
import api, { getApiErrorMessage } from '../lib/api';
import {
  ACUITY_ORDER,
  getAcuityMeta,
  getCareTierLabel,
  getFacilityStatusMeta,
} from '../lib/clinical';
import { patientName } from '../lib/demoPatients';
import useTriageStore, {
  ACTIVE_ENCOUNTER_STATUSES,
} from '../store/useTriageStore';
import {
  cn,
  formatDate,
  formatFacilityType,
  formatRelativeTime,
  initials,
  titleCase,
} from '../lib/utils';
import ClinicalCard from '../components/ClinicalCard';
import AdminMap from '../components/AdminMap';
import EncounterRail from '../components/EncounterRail';
import FacilityStatusBadge from '../components/FacilityStatusBadge';
import PortalHeader from '../components/PortalHeader';
import AcuityBadge from '../components/AcuityBadge';
import NotificationPanel from '../components/NotificationPanel';
import TriageNotificationPopup from '../components/TriageNotificationPopup';

const STATUS_ORDER = { AVAILABLE: 0, LIMITED: 1, BUSY: 2, OFFLINE: 3 };

// The demo critical route terminates at this hospital, so it is the default
// outage target and makes the reroute broadcast immediately visible.
const DEMO_SHOCK_TARGET_ID = 'facility_003';

const PIPELINE_STATUSES = [
  'INTAKE',
  'TRIAGED',
  'ROUTING',
  'AWAITING_ACCEPTANCE',
  'ACCEPTED',
  'EN_ROUTE',
  'CLOSED',
];

const ENCOUNTER_STATUS_TONES = {
  TRIAGED: 'border-brand-border bg-brand-soft text-brand-strong',
  ROUTING: 'border-signal-amber-border bg-signal-amber-soft text-signal-amber-ink',
  AWAITING_ACCEPTANCE: 'border-signal-amber-border bg-signal-amber-soft text-signal-amber-ink',
  ACCEPTED: 'border-signal-success-border bg-signal-success-soft text-signal-success-ink',
  EN_ROUTE: 'border-signal-success-border bg-signal-success-soft text-signal-success-ink',
  CLOSED: 'border-border bg-surface text-ink-muted',
};

const ROLE_BADGES = {
  DOCTOR: 'border-brand-border bg-brand-soft text-brand-strong',
  PATIENT: 'border-border bg-surface text-ink-secondary',
  ADMIN: 'border-signal-amber-border bg-signal-amber-soft text-signal-amber-ink',
};

const STAT_TONES = {
  teal: 'text-brand-strong',
  red: 'text-signal-danger',
  amber: 'text-signal-amber',
  gray: 'text-ink-faint',
};

const STAT_DOTS = {
  teal: 'bg-brand',
  red: 'bg-signal-danger',
  amber: 'bg-signal-amber',
  gray: 'bg-ink-faint',
};

const ADMIN_NAV_GROUPS = [
  {
    label: 'Command',
    items: [
      {
        id: 'command',
        label: 'Command center',
        description: 'Live network picture',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        id: 'encounters',
        label: 'Encounters',
        description: 'Active patient cases',
        icon: Activity,
      },
      {
        id: 'facilities',
        label: 'Facilities',
        description: 'Capacity & resilience',
        icon: Hospital,
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        id: 'analytics',
        label: 'Analytics',
        description: 'Load & wait trends',
        icon: ChartColumn,
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        id: 'users',
        label: 'Users',
        description: 'Accounts & access',
        icon: UsersRound,
      },
    ],
  },
];

const ADMIN_VIEWS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
const DEFAULT_VIEW = 'command';

const ROLE_FILTERS = [
  { value: 'ALL', label: 'All accounts' },
  { value: 'PATIENT', label: 'Patients' },
  { value: 'DOCTOR', label: 'Doctors' },
  { value: 'ADMIN', label: 'Admins' },
];

function shortFacilityName(name = '') {
  return name
    .replace(' Multispecialty Hospital', '')
    .replace(' Teaching & Research Hospital', '')
    .replace(' Primary Care Clinic', '')
    .replace(' Mental Health Clinic', '');
}

function encounterFacilityName(encounter) {
  return (
    encounter?.facility_name ??
    encounter?.selected_facility?.name ??
    encounter?.facility_snapshot?.name ??
    'Awaiting destination'
  );
}

function encounterPatientName(encounter) {
  return encounter?.patient_name || patientName(encounter?.patient_id);
}

function encounterTimestamp(encounter) {
  return encounter?.updated_at ?? encounter?.created_at ?? null;
}

function EncounterStatusBadge({ status }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
        ENCOUNTER_STATUS_TONES[status] ?? ENCOUNTER_STATUS_TONES.CLOSED
      )}
    >
      {titleCase(String(status ?? '').replaceAll('_', ' '))}
    </span>
  );
}

// One bordered strip with hairline dividers replaces four separate cards, so
// the vitals read as a single instrument panel instead of bulk.
function StatStrip({ children, className = '' }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border xl:grid-cols-4',
        className
      )}
    >
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail, tone = 'gray' }) {
  return (
    <div className="bg-surface px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
          {label}
        </p>
        <Icon
          aria-hidden="true"
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            STAT_TONES[tone] ?? STAT_TONES.gray
          )}
        />
      </div>
      <p className="th-tabular mt-2.5 font-mono text-[26px] font-semibold leading-none tracking-[-0.03em] text-ink">
        {value}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-4 text-ink-muted">
        <span
          aria-hidden="true"
          className={cn(
            'h-1 w-1 shrink-0 rounded-[1px]',
            STAT_DOTS[tone] ?? STAT_DOTS.gray
          )}
        />
        {detail}
      </p>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm text-ink-secondary">{label}</dt>
      <dd className="break-words font-mono text-sm font-semibold text-ink sm:text-right">
        {value}
      </dd>
    </div>
  );
}

function ChartCard({ title, subtitle, children, value, valueLabel }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-ink-muted">{subtitle}</p>
        </div>
        {value != null && (
          <div className="shrink-0 text-right">
            <p className="th-tabular font-mono text-lg font-semibold leading-none text-ink">
              {value}
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
              {valueLabel}
            </p>
          </div>
        )}
      </div>
      <div className="h-[248px] w-full p-3 sm:p-4">{children}</div>
    </section>
  );
}

function ViewHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-5 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-strong">
          <span aria-hidden="true" className="h-px w-5 bg-brand" />
          {eyebrow}
        </p>
        <h1 className="mt-2.5 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[32px]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">
          {description}
        </p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

function LivePill({ connected, labelConnected, labelReconnecting }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-[11px] font-medium text-ink-secondary">
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 rounded-[1px]',
          connected ? 'bg-signal-success' : 'bg-signal-amber'
        )}
      />
      {connected ? labelConnected : labelReconnecting}
    </span>
  );
}

function RefreshButton({ loading, label, onClick }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="th-btn th-btn-secondary">
      <RefreshCw
        aria-hidden="true"
        className={cn('h-4 w-4', loading && 'animate-spin')}
      />
      {label}
    </button>
  );
}

function ViewLink({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-strong underline-offset-2 hover:underline"
    >
      {children}
      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted p-6 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface text-ink-muted">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-ink-muted">
        {description}
      </p>
      {action}
    </div>
  );
}

function AdminSidebar({ activeView, onViewChange }) {
  return (
    <>
      <nav
        aria-label="Administration sections"
        className="border-b border-forest-border bg-forest px-3 py-2 lg:hidden"
      >
        <div className="flex flex-wrap gap-1">
          {ADMIN_VIEWS.map((view) => {
            const Icon = view.icon;
            const isActive = activeView === view.id;

            return (
              <button
                key={view.id}
                type="button"
                onClick={() => onViewChange(view.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-200',
                  isActive
                    ? 'border-forest-border bg-forest-active text-forest-ink'
                    : 'border-transparent text-forest-muted hover:bg-white/5 hover:text-forest-ink'
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'h-4 w-4',
                    isActive ? 'text-forest-accent' : 'text-forest-faint'
                  )}
                />
                {view.label}
              </button>
            );
          })}
        </div>
      </nav>

      <aside className="hidden w-[248px] shrink-0 border-r border-forest-border bg-forest text-forest-ink lg:block">
        <div className="sticky top-16 flex max-h-[calc(100vh-4rem)] flex-col overflow-y-auto px-3 py-5">
          <p className="px-2 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-forest-faint">
            Network command
          </p>

          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.label} className="mt-5 first:mt-3">
              <p className="px-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-forest-faint">
                {group.label}
              </p>
              <nav className="mt-1.5 space-y-1" aria-label={group.label}>
                {group.items.map((view) => {
                  const Icon = view.icon;
                  const isActive = activeView === view.id;

                  return (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => onViewChange(view.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-forest-accent/30',
                        isActive
                          ? 'border-forest-border bg-forest-active text-forest-ink'
                          : 'border-transparent text-forest-muted hover:bg-white/[0.05] hover:text-forest-ink'
                      )}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-2 left-0 top-2 w-[2px] rounded-r-[1px] bg-forest-accent"
                        />
                      )}
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isActive ? 'text-forest-accent' : 'text-forest-faint'
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {view.label}
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 block text-xs',
                            isActive ? 'text-forest-muted' : 'text-forest-faint'
                          )}
                        >
                          {view.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}

          <div className="mt-auto pt-6">
            <div className="rounded-xl border border-forest-border bg-white/[0.04] p-3.5">
              <div className="flex items-center gap-2 text-forest-accent">
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                <p className="text-xs font-semibold text-forest-ink">
                  Role-based access
                </p>
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-forest-faint">
                Only network administrators can view registered accounts and
                facility controls.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function CommandView({
  analytics,
  analyticsError,
  analyticsLoading,
  loadAnalytics,
  activeEncounters,
  activeQueue,
  priorityEncounter,
  facilities,
  sortedFacilities,
  onlineFacilities,
  networkCapacity,
  criticalCount,
  socketConnected,
  onViewChange,
}) {
  return (
    <div>
      <ViewHeader
        eyebrow="Command center"
        title="Network command"
        description="The live picture across facilities, routes and the shared encounter backbone. Every state change is broadcast over Socket.IO."
        actions={
          <>
            <LivePill
              connected={socketConnected}
              labelConnected="Socket.IO connected"
              labelReconnecting="Socket reconnecting"
            />
            <RefreshButton
              loading={analyticsLoading}
              label="Refresh analytics"
              onClick={loadAnalytics}
            />
          </>
        }
      />

      {analyticsError && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-xl border border-signal-danger-border bg-signal-danger-soft px-3 py-3 text-sm text-signal-danger-ink"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {analyticsError}
        </div>
      )}

      <StatStrip className="mt-6">
        <StatCard
          icon={Hospital}
          label="Facilities online"
          value={`${onlineFacilities.length}/${facilities.length || 5}`}
          detail="Live operational status"
          tone="teal"
        />
        <StatCard
          icon={Gauge}
          label="Network load"
          value={`${networkCapacity}%`}
          detail={`${onlineFacilities.length} facilities reporting`}
          tone={networkCapacity >= 80 ? 'red' : 'amber'}
        />
        <StatCard
          icon={Users}
          label="Active queue"
          value={activeQueue.length}
          detail={`${criticalCount} critical case${criticalCount === 1 ? '' : 's'}`}
          tone={criticalCount > 0 ? 'red' : 'gray'}
        />
        <StatCard
          icon={Clock3}
          label="Avg triage time"
          value={`${analytics?.avg_triage_time_sec ?? '—'}s`}
          detail={`${analytics?.total_encounters ?? activeQueue.length} encounters tracked`}
          tone="gray"
        />
      </StatStrip>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">
              Priority case
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Newest reroute, otherwise highest acuity.
            </p>
          </div>
          <ViewLink onClick={() => onViewChange('encounters')}>
            Open queue
          </ViewLink>
        </div>

        {priorityEncounter ? (
          <EncounterRail encounter={priorityEncounter} className="mt-3" />
        ) : (
          <div className="mt-3">
            <EmptyState
              icon={Activity}
              title="No priority case"
              description="The rail activates when an encounter enters triage."
            />
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <AdminMap />

        <div className="space-y-6">
          <ClinicalCard className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  Facility readiness
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Capacity and emergency access
                </p>
              </div>
              <ViewLink onClick={() => onViewChange('facilities')}>
                Manage
              </ViewLink>
            </div>

            <ul className="divide-y divide-border">
              {sortedFacilities.map((facility) => {
                const meta = getFacilityStatusMeta(facility.status);

                return (
                  <li
                    key={facility.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-[1px]"
                      style={{ backgroundColor: meta.hex }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium leading-snug text-ink">
                        {facility.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-muted">
                        {facility.status === 'OFFLINE'
                          ? 'Offline · no routes'
                          : `${facility.capacity_pct}% load · ${facility.er_wait_min} min ER`}
                      </p>
                    </div>
                    <FacilityStatusBadge status={facility.status} />
                  </li>
                );
              })}
            </ul>
          </ClinicalCard>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onViewChange('facilities')}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-brand hover:bg-surface-strong"
            >
              <span>
                <span className="block text-sm font-semibold text-ink">
                  Run a shock
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Test resilience
                </span>
              </span>
              <Zap aria-hidden="true" className="h-4 w-4 shrink-0 text-signal-danger-ink" />
            </button>

            <button
              type="button"
              onClick={() => onViewChange('analytics')}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-brand hover:bg-surface-strong"
            >
              <span>
                <span className="block text-sm font-semibold text-ink">
                  Open analytics
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Load & wait trends
                </span>
              </span>
              <ChartColumn
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-brand-strong"
              />
            </button>
          </div>
        </div>
      </div>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">
              Active cases
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Highest-acuity encounters on the shared backbone.
            </p>
          </div>
          <ViewLink onClick={() => onViewChange('encounters')}>
            View all {activeEncounters.length}
          </ViewLink>
        </div>

        {activeQueue.length > 0 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeQueue.slice(0, 6).map((encounter) => (
              <EncounterRail
                key={encounter.id}
                encounter={encounter}
                compact
                dense
              />
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState
              icon={Activity}
              title="No active encounters"
              description="New triage cases will appear here as soon as a patient submits a symptom story."
            />
          </div>
        )}
      </section>
    </div>
  );
}

function EncountersView({ activeEncounters, activeQueue, focusPatientId }) {
  const [focusedId, setFocusedId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState('');
  const [doctorSelection, setDoctorSelection] = useState(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState(null);
  const upsertEncounter = useTriageStore((state) => state.upsertEncounter);

  const sortedEncounters = useMemo(() => {
    return [...activeQueue].sort((a, b) => {
      const acuityDelta =
        (ACUITY_ORDER[a.acuity] ?? 9) - (ACUITY_ORDER[b.acuity] ?? 9);
      if (acuityDelta !== 0) return acuityDelta;

      return (
        new Date(encounterTimestamp(b) ?? 0).getTime() -
        new Date(encounterTimestamp(a) ?? 0).getTime()
      );
    });
  }, [activeQueue]);

  const focusedEncounter =
    sortedEncounters.find(
      (encounter) => encounter.patient_id === focusPatientId
    ) ??
    sortedEncounters.find((encounter) => encounter.id === focusedId) ??
    sortedEncounters[0] ??
    null;

  useEffect(() => {
    if (!focusPatientId) return;
    const match = sortedEncounters.find(
      (encounter) => encounter.patient_id === focusPatientId
    );
    if (match) setFocusedId(match.id);
  }, [focusPatientId, sortedEncounters]);

  useEffect(() => {
    let active = true;

    api
      .get('/auth/users')
      .then(({ data }) => {
        if (active) {
          setDoctors(
            (Array.isArray(data) ? data : data?.users ?? []).filter(
              (user) => user.role === 'DOCTOR'
            )
          );
        }
      })
      .catch((requestError) => {
        if (active) {
          setDoctorsError(
            getApiErrorMessage(requestError, 'Unable to load doctor accounts.')
          );
        }
      })
      .finally(() => {
        if (active) setDoctorsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedDoctorId =
    doctorSelection?.encounterId === focusedEncounter?.id
      ? doctorSelection.doctorId
      : focusedEncounter?.assigned_doctor_id ?? '';

  const activePatientCounts = useMemo(() => {
    const counts = new Map();
    activeEncounters.forEach((encounter) => {
      if (encounter.assigned_doctor_id) {
        counts.set(
          encounter.assigned_doctor_id,
          (counts.get(encounter.assigned_doctor_id) ?? 0) + 1
        );
      }
    });
    return counts;
  }, [activeEncounters]);

  const canAssignDoctor = [
    'TRIAGED',
    'ROUTING',
    'AWAITING_ACCEPTANCE',
  ].includes(focusedEncounter?.status);

  const assignDoctor = async () => {
    if (!focusedEncounter?.id || !selectedDoctorId) return;

    setAssignmentLoading(true);
    setAssignmentError(null);
    setAssignmentSuccess(null);

    try {
      const { data } = await api.post(
        `/encounters/${focusedEncounter.id}/assign-doctor`,
        { doctor_id: selectedDoctorId }
      );
      upsertEncounter(data.encounter);
      setAssignmentSuccess({
        encounterId: data.encounter.id,
        message: `${data.encounter.assigned_doctor_name} assigned to this encounter.`,
      });
    } catch (requestError) {
      setAssignmentError({
        encounterId: focusedEncounter.id,
        message: getApiErrorMessage(
          requestError,
          'Unable to assign this doctor.'
        ),
      });
    } finally {
      setAssignmentLoading(false);
    }
  };

  const criticalCount = sortedEncounters.filter(
    (encounter) => encounter.acuity === 'CRITICAL'
  ).length;
  const awaitingCount = sortedEncounters.filter((encounter) =>
    ['TRIAGED', 'AWAITING_ACCEPTANCE'].includes(encounter.status)
  ).length;
  const enRouteCount = sortedEncounters.filter(
    (encounter) => encounter.status === 'EN_ROUTE'
  ).length;

  return (
    <div>
      <ViewHeader
        eyebrow="Operations"
        title="Active encounters"
        description="Every open case on the shared encounter backbone. Select a case to inspect its rail, destination and assigned clinician."
        actions={
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-[1px] bg-brand"
            />
            {activeEncounters.length} live
          </span>
        }
      />

      <StatStrip className="mt-6">
        <StatCard
          icon={Activity}
          label="Active encounters"
          value={sortedEncounters.length}
          detail="Open across the network"
          tone="teal"
        />
        <StatCard
          icon={AlertTriangle}
          label="Critical"
          value={criticalCount}
          detail="Immediate attention"
          tone={criticalCount > 0 ? 'red' : 'gray'}
        />
        <StatCard
          icon={Clock3}
          label="Awaiting acceptance"
          value={awaitingCount}
          detail="Clinician review pending"
          tone={awaitingCount > 0 ? 'amber' : 'gray'}
        />
        <StatCard
          icon={ArrowRight}
          label="En route"
          value={enRouteCount}
          detail="Patients travelling"
          tone="gray"
        />
      </StatStrip>

      {sortedEncounters.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Activity}
            title="No active encounters"
            description="Cases appear here after a patient submits a symptom story and the routing agent completes triage."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  Encounter queue
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Sorted by acuity, then most recent update.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-secondary">
                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                Shared record
              </span>
            </div>

            {/* Below xl the six-column queue becomes a tappable case list,
                keeping destination and update time visible without a
                horizontal scroll. */}
            <ul className="divide-y divide-border xl:hidden">
              {sortedEncounters.map((encounter) => {
                const isFocused = focusedEncounter?.id === encounter.id;

                return (
                  <li key={encounter.id}>
                    <button
                      type="button"
                      onClick={() => setFocusedId(encounter.id)}
                      aria-pressed={isFocused}
                      className={cn(
                        'flex w-full flex-col gap-3 px-4 py-4 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40',
                        isFocused
                          ? 'bg-surface-strong'
                          : 'hover:bg-surface-strong/70'
                      )}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              'grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-[10px] font-semibold',
                              isFocused
                                ? 'border-brand bg-brand-soft text-brand-strong'
                                : 'border-border bg-surface-muted text-ink-secondary'
                            )}
                          >
                            {initials(encounterPatientName(encounter))}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {encounterPatientName(encounter)}
                            </span>
                            <span className="mt-0.5 block font-mono text-[10px] text-ink-muted">
                              {encounter.id}
                            </span>
                          </span>
                        </span>
                        <ChevronRight
                          aria-hidden="true"
                          className={cn(
                            'mt-1 h-4 w-4 shrink-0',
                            isFocused ? 'text-brand-strong' : 'text-ink-muted'
                          )}
                        />
                      </span>

                      <span className="flex flex-wrap items-center gap-2">
                        <AcuityBadge acuity={encounter.acuity ?? 'LOW'} />
                        <EncounterStatusBadge status={encounter.status} />
                      </span>

                      <span className="flex items-end justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-xs text-ink-secondary">
                            {encounterFacilityName(encounter)}
                          </span>
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-ink-muted">
                            {getCareTierLabel(encounter.care_tier)}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-ink-muted">
                          {formatRelativeTime(encounterTimestamp(encounter))}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead className="bg-surface-muted">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Patient
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Acuity
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Destination
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Updated
                    </th>
                    <th className="w-8 px-2 py-3" aria-label="Open case" />
                  </tr>
                </thead>
                <tbody>
                  {sortedEncounters.map((encounter) => {
                    const isFocused = focusedEncounter?.id === encounter.id;

                    return (
                      <tr
                        key={encounter.id}
                        tabIndex={0}
                        aria-selected={isFocused}
                        onClick={() => setFocusedId(encounter.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setFocusedId(encounter.id);
                          }
                        }}
                        className={cn(
                          'cursor-pointer border-b border-border transition-colors duration-200 last:border-b-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand/40',
                          isFocused ? 'bg-surface-strong' : 'hover:bg-surface-strong/70'
                        )}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                'grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-[10px] font-semibold',
                                isFocused
                                  ? 'border-brand bg-brand-soft text-brand-strong'
                                  : 'border-border bg-surface-muted text-ink-secondary'
                              )}
                            >
                              {initials(encounterPatientName(encounter))}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink">
                                {encounterPatientName(encounter)}
                              </p>
                              <p className="mt-0.5 font-mono text-[10px] text-ink-muted">
                                {encounter.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <AcuityBadge acuity={encounter.acuity ?? 'LOW'} />
                        </td>
                        <td className="px-4 py-3.5">
                          <EncounterStatusBadge status={encounter.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="max-w-[220px] truncate text-sm text-ink-secondary">
                            {encounterFacilityName(encounter)}
                          </p>
                          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                            {getCareTierLabel(encounter.care_tier)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-ink-muted">
                          {formatRelativeTime(encounterTimestamp(encounter))}
                        </td>
                        <td className="px-2 py-3.5">
                          <ChevronRight
                            aria-hidden="true"
                            className={cn(
                              'h-4 w-4',
                              isFocused ? 'text-brand-strong' : 'text-ink-muted'
                            )}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-border bg-surface-muted px-5 py-3 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-[1px] bg-brand-solid"
                />
                Encounter state is shared across all three portals.
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide">
                GET /api/encounters?active=true
              </span>
            </div>
          </section>

          {focusedEncounter ? (
            <div className="space-y-4">
              <EncounterRail encounter={focusedEncounter} />

              <ClinicalCard>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">
                      Case detail
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      Shared record across patient, physician and admin portals.
                    </p>
                  </div>
                  <EncounterStatusBadge status={focusedEncounter.status} />
                </div>

                <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <div>
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-surface-muted text-xs font-semibold text-ink-secondary">
                        {initials(encounterPatientName(focusedEncounter))}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {encounterPatientName(focusedEncounter)}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-ink-muted">
                          {focusedEncounter.patient_id} · {focusedEncounter.id}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-ink-secondary">
                      {focusedEncounter.symptom ?? 'No symptom summary recorded.'}
                    </p>
                  </div>

                  <dl>
                    <SummaryRow
                      label="Acuity"
                      value={getAcuityMeta(focusedEncounter.acuity ?? 'LOW').label}
                    />
                    <SummaryRow
                      label="Care pathway"
                      value={getCareTierLabel(focusedEncounter.care_tier)}
                    />
                    <SummaryRow
                      label="Destination"
                      value={encounterFacilityName(focusedEncounter)}
                    />
                    <SummaryRow
                      label="Protocol"
                      value={focusedEncounter.protocol_matched || '—'}
                    />
                    <SummaryRow
                      label="Clinician"
                      value={focusedEncounter.assigned_doctor_name || 'Unassigned'}
                    />
                    <SummaryRow
                      label="Last update"
                      value={formatRelativeTime(
                        encounterTimestamp(focusedEncounter)
                      )}
                    />
                  </dl>
                </div>

                <div className="mt-5 border-t border-border pt-4">
                  <label
                    htmlFor="encounter-doctor"
                    className="block text-sm font-semibold text-ink"
                  >
                    Assign doctor
                  </label>
                  <p className="mt-1 text-xs text-ink-muted">
                    Each doctor can have at most 2 active patient encounters.
                    Assignment is locked after a doctor accepts the case.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select
                      id="encounter-doctor"
                      value={selectedDoctorId}
                      onChange={(event) => {
                        setDoctorSelection({
                          encounterId: focusedEncounter.id,
                          doctorId: event.target.value,
                        });
                        setAssignmentError(null);
                        setAssignmentSuccess(null);
                      }}
                      disabled={doctorsLoading || !canAssignDoctor}
                      className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {doctorsLoading ? 'Loading doctors…' : 'Select a doctor'}
                      </option>
                      {doctors.map((doctor) => {
                        const activeCount =
                          activePatientCounts.get(doctor.id) ?? 0;
                        const isCurrent =
                          doctor.id === focusedEncounter.assigned_doctor_id;
                        const isFull = activeCount >= 2 && !isCurrent;

                        return (
                          <option
                            key={doctor.id}
                            value={doctor.id}
                            disabled={isFull}
                          >
                            {doctor.name} · {activeCount}/2 active
                            {doctor.specialty ? ` · ${doctor.specialty}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={assignDoctor}
                      disabled={
                        assignmentLoading ||
                        !canAssignDoctor ||
                        !selectedDoctorId ||
                        selectedDoctorId === focusedEncounter.assigned_doctor_id
                      }
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-solid px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {assignmentLoading && (
                        <Loader2
                          aria-hidden="true"
                          className="h-4 w-4 animate-spin"
                        />
                      )}
                      {assignmentLoading ? 'Assigning…' : 'Assign doctor'}
                    </button>
                  </div>
                  {doctorsError && (
                    <p role="alert" className="mt-2 text-sm text-signal-danger-ink">
                      {doctorsError}
                    </p>
                  )}
                  {assignmentError?.encounterId === focusedEncounter.id && (
                    <p role="alert" className="mt-2 text-sm text-signal-danger-ink">
                      {assignmentError.message}
                    </p>
                  )}
                  {assignmentSuccess?.encounterId === focusedEncounter.id && (
                    <p role="status" className="mt-2 text-sm text-signal-success-ink">
                      {assignmentSuccess.message}
                    </p>
                  )}
                  {!canAssignDoctor && (
                    <p className="mt-2 text-xs text-ink-muted">
                      {focusedEncounter.status === 'CLOSED'
                        ? 'Closed encounters cannot be reassigned.'
                        : 'This encounter can no longer be reassigned.'}
                    </p>
                  )}
                  {!doctorsLoading && doctors.length === 0 && (
                    <p className="mt-2 text-xs text-ink-muted">
                      No doctor accounts are available. Refresh after adding a
                      doctor account.
                    </p>
                  )}
                </div>
              </ClinicalCard>
            </div>
          ) : (
            <EmptyState
              icon={Activity}
              title="Select an encounter"
              description="Choose a row to inspect the six-step rail and clinical handoff."
            />
          )}
        </div>
      )}
    </div>
  );
}

function FacilitiesView({
  facilities,
  sortedFacilities,
  onlineFacilities,
  networkCapacity,
  selectedFacility,
  resolvedId,
  setSelectedId,
  pulsingFacilityId,
  shockStatus,
  shockError,
  reroutedCount,
  isOfflineTarget,
  isRerouting,
  handleShock,
  ledger,
  analytics,
  analyticsLoading,
  loadAnalytics,
}) {
  const totalBeds = onlineFacilities.reduce(
    (sum, facility) => sum + (Number(facility.er_beds_available) || 0),
    0
  );
  const offlineCount = facilities.filter(
    (facility) => facility.status === 'OFFLINE'
  ).length;

  return (
    <div>
      <ViewHeader
        eyebrow="Operations"
        title="Facility network"
        description="Capacity, emergency access and resilience controls. Select any facility as the outage target; affected patient routes are reassigned immediately."
        actions={
          <RefreshButton
            loading={analyticsLoading}
            label="Refresh"
            onClick={loadAnalytics}
          />
        }
      />

      <StatStrip className="mt-6">
        <StatCard
          icon={Hospital}
          label="Facilities online"
          value={`${onlineFacilities.length}/${facilities.length || 5}`}
          detail={`${offlineCount} offline`}
          tone="teal"
        />
        <StatCard
          icon={Gauge}
          label="Network load"
          value={`${networkCapacity}%`}
          detail="Average occupancy"
          tone={networkCapacity >= 80 ? 'red' : 'amber'}
        />
        <StatCard
          icon={BedDouble}
          label="ER beds open"
          value={totalBeds}
          detail="Across online facilities"
          tone="gray"
        />
        <StatCard
          icon={Zap}
          label="Reroutes recorded"
          value={analytics?.reroute_frequency ?? ledger.length}
          detail="Since network start"
          tone="gray"
        />
      </StatStrip>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">
                Facility cards
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Select a facility to target it with an outage simulation.
              </p>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
              {facilities.length} connected nodes
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {sortedFacilities.map((facility) => {
              const capacity = Number(facility.capacity_pct) || 0;
              const statusMeta = getFacilityStatusMeta(facility.status);
              const isSelected = resolvedId === facility.id;
              const isPulsing = pulsingFacilityId === facility.id;

              return (
                <motion.button
                  key={facility.id}
                  type="button"
                  onClick={() => setSelectedId(facility.id)}
                  aria-pressed={isSelected}
                  aria-label={`Select ${facility.name} as outage target`}
                  whileTap={{ scale: 0.995 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    'rounded-xl border bg-surface p-5 text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30',
                    isSelected
                      ? 'border-brand'
                      : 'border-border hover:border-border-strong hover:bg-surface-strong',
                    isPulsing && 'border-signal-danger-border bg-signal-danger-soft'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-base font-semibold leading-snug text-ink">
                        {facility.name}
                      </p>
                    </div>
                    <FacilityStatusBadge status={facility.status} />
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink-muted">Capacity</span>
                      <span className="font-mono font-semibold text-ink">
                        {capacity}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-[2px] bg-surface-strong">
                      <motion.div
                        className="h-full rounded-[2px]"
                        animate={{ width: `${capacity}%` }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                        style={{ backgroundColor: statusMeta.hex }}
                      />
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                        ETA
                      </dt>
                      <dd className="mt-1 font-mono text-sm font-semibold text-ink">
                        {facility.status === 'OFFLINE'
                          ? '—'
                          : `${facility.eta_min} min`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                        ER wait
                      </dt>
                      <dd className="mt-1 font-mono text-sm font-semibold text-ink">
                        {facility.status === 'OFFLINE'
                          ? '—'
                          : `${facility.er_wait_min} min`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                        Beds
                      </dt>
                      <dd className="mt-1 flex items-center gap-1.5 font-mono text-sm font-semibold text-ink">
                        <BedDouble
                          aria-hidden="true"
                          className="h-3.5 w-3.5 text-ink-muted"
                        />
                        {facility.er_beds_available}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                      {facility.id}
                    </span>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand-strong">
                        <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                        Outage target
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        <div className="space-y-6">
          <ClinicalCard>
            <div className="flex items-center gap-2">
              <ShieldAlert aria-hidden="true" className="h-5 w-5 text-signal-danger-ink" />
              <h2 className="text-lg font-semibold text-ink">
                Simulate outage
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              The selected facility is taken offline, its capacity is set to zero and
              every affected patient route is reassigned.
            </p>

            <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Outage target
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {selectedFacility?.name ?? 'No facility selected'}
                  </p>
                  <p className="mt-1 font-mono text-xs text-ink-muted">
                    {selectedFacility?.id ?? '—'}
                  </p>
                </div>
                {selectedFacility && (
                  <FacilityStatusBadge status={selectedFacility.status} />
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleShock}
              disabled={!selectedFacility || isOfflineTarget || isRerouting}
              className={cn(
                'mt-4 inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl border px-5 text-sm font-semibold uppercase tracking-wide transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30',
                !selectedFacility || isOfflineTarget || isRerouting
                  ? 'border-signal-danger-border bg-signal-danger-soft text-signal-danger-ink'
                  : 'border-signal-danger-solid bg-signal-danger-solid text-white hover:bg-signal-danger-solid-hover'
              )}
            >
              {isRerouting ? (
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
              ) : (
                <Zap aria-hidden="true" className="h-5 w-5" />
              )}
              {isRerouting ? 'Simulating outage…' : 'Simulate facility shock'}
            </button>

            <div
              aria-live="polite"
              className={cn(
                'mt-4 flex items-start gap-3 rounded-xl border p-4 transition-colors duration-200',
                isRerouting
                  ? 'border-signal-danger-border bg-signal-danger-soft'
                  : 'border-border bg-surface-muted'
              )}
            >
              {shockStatus === 'rerouting' && (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-signal-danger-ink"
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Rerouting active cases…
                    </p>
                    <p className="mt-1 text-sm leading-6 text-ink-secondary">
                      Waiting for Socket.IO to confirm every affected route has been
                      reassigned.
                    </p>
                  </div>
                </>
              )}

              {shockStatus === 'done' && (
                <>
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-signal-success-ink"
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {reroutedCount > 0 ? 'New route assigned' : 'Facility offline'}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-ink-secondary">
                      {reroutedCount > 0
                        ? `${reroutedCount} patient route${
                            reroutedCount === 1 ? '' : 's'
                          } reassigned and broadcast via Socket.IO.`
                        : 'No active routes were affected by this outage.'}
                    </p>
                  </div>
                </>
              )}

              {shockStatus === 'error' && (
                <>
                  <AlertCircle
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-signal-danger-ink"
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Simulation failed
                    </p>
                    <p className="mt-1 text-sm leading-6 text-ink-secondary">
                      {shockError}
                    </p>
                  </div>
                </>
              )}

              {shockStatus === 'idle' && (
                <>
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-signal-amber-ink"
                  />
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Ready to simulate
                    </p>
                    <p className="mt-1 text-sm leading-6 text-ink-secondary">
                      Select an online facility, then run the outage simulation.
                    </p>
                  </div>
                </>
              )}
            </div>

            <dl className="mt-5 border-t border-border pt-4">
              <SummaryRow
                label="Diverted ER visits"
                value={analytics?.diverted_er_visits ?? '—'}
              />
              <SummaryRow
                label="Reroute frequency"
                value={analytics?.reroute_frequency ?? '—'}
              />
              <SummaryRow label="Live capacity" value={`${networkCapacity}%`} />
            </dl>
          </ClinicalCard>

          <ClinicalCard>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity aria-hidden="true" className="h-5 w-5 text-brand-strong" />
                <h2 className="text-lg font-semibold text-ink">
                  Reroute activity
                </h2>
              </div>
              <span className="font-mono text-xs text-ink-muted">
                {ledger.length} route{ledger.length === 1 ? '' : 's'}
              </span>
            </div>

            {ledger.length > 0 ? (
              <ul className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {ledger.map((route) => (
                  <li
                    key={`${route.patient_id}-${route.rerouted_at}`}
                    className="rounded-xl border border-border bg-surface-muted p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">
                        {patientName(route.patient_id)}
                      </p>
                      <span className="text-xs font-medium text-signal-success-ink">
                        {route.reroute_status === 'REROUTED'
                          ? 'New route assigned'
                          : route.reroute_status?.replaceAll('_', ' ') ??
                            'Route updated'}
                      </span>
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
                      <span>{route.previous_facility_name ?? 'Previous facility'}</span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 text-ink-muted" />
                      <span className="font-medium text-ink">
                        {route.selected_facility?.name ?? 'Manual coordination'}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {formatRelativeTime(route.rerouted_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4">
                <EmptyState
                  icon={ArrowRight}
                  title="No reroutes recorded"
                  description="Route assignments will appear here after an outage simulation."
                />
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-ink-muted">
              <Zap aria-hidden="true" className="h-3.5 w-3.5 text-signal-danger-ink" />
              Reroutes are invoked explicitly after every facility state change.
            </div>
          </ClinicalCard>
        </div>
      </div>
    </div>
  );
}

function AnalyticsView({
  analytics,
  analyticsError,
  analyticsLoading,
  loadAnalytics,
  capacityData,
  waitData,
  networkCapacity,
  sortedFacilities,
}) {
  const statusBreakdown = analytics?.status_breakdown ?? {};
  const acuityBreakdown = analytics?.acuity_breakdown ?? {};
  const maxStatusCount = Math.max(
    1,
    ...PIPELINE_STATUSES.map((status) => statusBreakdown[status] ?? 0)
  );
  const maxAcuityCount = Math.max(
    1,
    ...Object.keys(ACUITY_ORDER).map((acuity) => acuityBreakdown[acuity] ?? 0)
  );
  const generatedAt = analytics?.generated_at
    ? formatRelativeTime(analytics.generated_at)
    : 'Awaiting first refresh';

  return (
    <div>
      <ViewHeader
        eyebrow="Insights"
        title="Network analytics"
        description="Capacity, wait times and encounter flow derived from live facility state and the shared encounter store."
        actions={
          <>
            <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary">
              <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
              Updated {generatedAt}
            </span>
            <RefreshButton
              loading={analyticsLoading}
              label="Refresh analytics"
              onClick={loadAnalytics}
            />
          </>
        }
      />

      {analyticsError && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-xl border border-signal-danger-border bg-signal-danger-soft px-3 py-3 text-sm text-signal-danger-ink"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {analyticsError}
        </div>
      )}

      <StatStrip className="mt-6">
        <StatCard
          icon={Clock3}
          label="Avg triage time"
          value={`${analytics?.avg_triage_time_sec ?? '—'}s`}
          detail="Symptom to protocol match"
          tone="teal"
        />
        <StatCard
          icon={Activity}
          label="Total encounters"
          value={analytics?.total_encounters ?? '—'}
          detail={`${analytics?.active_encounters ?? 0} currently active`}
          tone="gray"
        />
        <StatCard
          icon={ArrowRight}
          label="Diverted ER visits"
          value={analytics?.diverted_er_visits ?? '—'}
          detail="Routed away from emergency"
          tone="gray"
        />
        <StatCard
          icon={ShieldCheck}
          label="Prescriptions sent"
          value={analytics?.prescriptions_sent ?? '—'}
          detail="Closed through the physician loop"
          tone="amber"
        />
      </StatStrip>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Facility capacity"
          subtitle="Current occupancy across the connected network."
          value={`${networkCapacity}%`}
          valueLabel="Network average"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={capacityData}
              margin={{ top: 20, right: 8, bottom: 4, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--chart-axis)' }}
                tickLine={false}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={50}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                cursor={{ fill: 'rgb(var(--ink) / 0.04)' }}
                contentStyle={{
                  background: 'rgb(var(--surface))',
                  border: '1px solid rgb(var(--border))',
                  borderRadius: '6px',
                  boxShadow: 'none',
                  color: 'rgb(var(--ink))',
                  fontSize: 14,
                }}
                labelStyle={{ color: 'rgb(var(--ink))', fontWeight: 600 }}
                itemStyle={{ color: 'rgb(var(--ink-secondary))' }}
                formatter={(value) => [`${value}%`, 'Capacity']}
              />
              <Bar dataKey="capacity" name="Capacity" barSize={26} radius={[3, 3, 0, 0]}>
                {capacityData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="capacity"
                  position="top"
                  fill="rgb(var(--ink-secondary))"
                  fontSize={11}
                  formatter={(value) => `${value}%`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Emergency wait times"
          subtitle="Expected ER wait in minutes by facility."
          value={`${Math.round(
            waitData.reduce((sum, entry) => sum + entry.wait, 0) /
              Math.max(1, waitData.length)
          )} min`}
          valueLabel="Network average"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={waitData}
              margin={{ top: 20, right: 8, bottom: 4, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--chart-axis)' }}
                tickLine={false}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(value) => `${value}m`}
              />
              <Tooltip
                cursor={{ fill: 'rgb(var(--ink) / 0.04)' }}
                contentStyle={{
                  background: 'rgb(var(--surface))',
                  border: '1px solid rgb(var(--border))',
                  borderRadius: '6px',
                  boxShadow: 'none',
                  color: 'rgb(var(--ink))',
                  fontSize: 14,
                }}
                labelStyle={{ color: 'rgb(var(--ink))', fontWeight: 600 }}
                itemStyle={{ color: 'rgb(var(--ink-secondary))' }}
                formatter={(value) => [`${value} min`, 'ER wait']}
              />
              <Bar dataKey="wait" name="ER wait" barSize={26} radius={[3, 3, 0, 0]}>
                {waitData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="wait"
                  position="top"
                  fill="rgb(var(--ink-secondary))"
                  fontSize={11}
                  formatter={(value) => `${value}m`}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ClinicalCard className="p-0">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-ink">
              Encounter pipeline
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Every encounter by current state.
            </p>
          </div>
          <ul className="space-y-3 p-5">
            {PIPELINE_STATUSES.map((status) => {
              const count = statusBreakdown[status] ?? 0;

              return (
                <li key={status} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-xs font-medium text-ink-secondary">
                    {titleCase(status.replaceAll('_', ' '))}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-[2px] bg-surface-strong">
                    <div
                      className="h-full rounded-[2px] bg-brand-solid"
                      style={{ width: `${(count / maxStatusCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-7 shrink-0 text-right font-mono text-xs font-semibold text-ink">
                    {count}
                  </span>
                </li>
              );
            })}
          </ul>
        </ClinicalCard>

        <ClinicalCard className="p-0">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-ink">
              Acuity mix
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Active encounters by clinical urgency.
            </p>
          </div>
          <ul className="space-y-3 p-5">
            {Object.keys(ACUITY_ORDER).map((acuity) => {
              const count = acuityBreakdown[acuity] ?? 0;
              const meta = getAcuityMeta(acuity);

              return (
                <li key={acuity} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs font-medium text-ink-secondary">
                    {meta.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-[2px] bg-surface-strong">
                    <div
                      className="h-full rounded-[2px]"
                      style={{
                        width: `${(count / maxAcuityCount) * 100}%`,
                        backgroundColor: meta.hex,
                      }}
                    />
                  </div>
                  <span className="w-7 shrink-0 text-right font-mono text-xs font-semibold text-ink">
                    {count}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border px-5 py-3 text-xs text-ink-muted">
            {analytics?.facility_count ?? 5} facilities ·{' '}
            {analytics?.active_encounters ?? 0} active cases
          </div>
        </ClinicalCard>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-ink">
            Facility operating detail
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Capacity, emergency wait and bed availability by node.
          </p>
        </div>
        {/* Card rows keep every operating metric visible on narrow screens. */}
        <ul className="divide-y divide-border xl:hidden">
          {sortedFacilities.map((facility) => {
            const meta = getFacilityStatusMeta(facility.status);
            const capacity = Number(facility.capacity_pct) || 0;

            return (
              <li key={facility.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-5 text-ink">
                      {facility.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] leading-4 text-ink-muted">
                      {facility.id} · {formatFacilityType(facility.type)}
                    </p>
                  </div>
                  <span className="shrink-0">
                    <FacilityStatusBadge status={facility.status} />
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <div>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
                      Capacity
                    </dt>
                    <dd className="mt-1 flex items-center gap-2">
                      <span className="h-1.5 w-full max-w-16 overflow-hidden rounded-[2px] bg-surface-strong">
                        <span
                          className="block h-full rounded-[2px]"
                          style={{
                            width: `${capacity}%`,
                            backgroundColor: meta.hex,
                          }}
                        />
                      </span>
                      <span className="font-mono text-xs font-semibold text-ink">
                        {capacity}%
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
                      ER wait
                    </dt>
                    <dd className="mt-1 font-mono text-xs text-ink-secondary">
                      {facility.status === 'OFFLINE'
                        ? '—'
                        : `${facility.er_wait_min} min`}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
                      ETA
                    </dt>
                    <dd className="mt-1 font-mono text-xs text-ink-secondary">
                      {facility.status === 'OFFLINE'
                        ? '—'
                        : `${facility.eta_min} min`}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
                      ER beds
                    </dt>
                    <dd className="mt-1 font-mono text-xs text-ink-secondary">
                      {facility.er_beds_available}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="bg-surface-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Facility
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Capacity
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  ER wait
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  ETA
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  ER beds
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedFacilities.map((facility) => {
                const meta = getFacilityStatusMeta(facility.status);
                const capacity = Number(facility.capacity_pct) || 0;

                return (
                  <tr
                    key={facility.id}
                    className="border-b border-border transition-colors last:border-b-0 hover:bg-surface-strong"
                  >
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-ink">
                        {facility.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-muted">
                        {facility.id} · {formatFacilityType(facility.type)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <FacilityStatusBadge status={facility.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-[2px] bg-surface-strong">
                          <div
                            className="h-full rounded-[2px]"
                            style={{
                              width: `${capacity}%`,
                              backgroundColor: meta.hex,
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold text-ink">
                          {capacity}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-ink-secondary">
                      {facility.status === 'OFFLINE'
                        ? '—'
                        : `${facility.er_wait_min} min`}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-ink-secondary">
                      {facility.status === 'OFFLINE'
                        ? '—'
                        : `${facility.eta_min} min`}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-ink-secondary">
                      {facility.er_beds_available}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RoleBadge({ role }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
        ROLE_BADGES[role] ?? ROLE_BADGES.PATIENT
      )}
    >
      {titleCase(role)}
    </span>
  );
}

function UsersView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [query, setQuery] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/auth/users');
      setUsers(Array.isArray(data) ? data : data?.users ?? []);
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, 'Unable to load registered users.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const doctorCount = users.filter((user) => user.role === 'DOCTOR').length;
  const patientCount = users.filter((user) => user.role === 'PATIENT').length;
  const adminCount = users.filter((user) => user.role === 'ADMIN').length;

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      if (roleFilter !== 'ALL' && user.role !== roleFilter) return false;
      if (!normalizedQuery) return true;

      return [user.name, user.email, user.specialty, user.licenseNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [users, roleFilter, query]);

  const clearFilters = () => {
    setRoleFilter('ALL');
    setQuery('');
  };

  return (
    <div>
      <ViewHeader
        eyebrow="Administration"
        title="Registered users"
        description="Registered, seeded and built-in demo accounts. Password hashes are stored with bcrypt and are never returned by the API."
        actions={
          <RefreshButton
            loading={loading}
            label="Refresh accounts"
            onClick={loadUsers}
          />
        }
      />

      <StatStrip className="mt-6">
        <StatCard
          icon={UsersRound}
          label="Total accounts"
          value={users.length}
          detail="Registered in the network"
          tone="teal"
        />
        <StatCard
          icon={Stethoscope}
          label="Doctors"
          value={doctorCount}
          detail="Physician accounts"
          tone="gray"
        />
        <StatCard
          icon={Users}
          label="Patients"
          value={patientCount}
          detail="Patient accounts"
          tone="gray"
        />
        <StatCard
          icon={ShieldCheck}
          label="Admins"
          value={adminCount}
          detail="Network operators"
          tone="amber"
        />
      </StatStrip>

      {error && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-xl border border-signal-danger-border bg-signal-danger-soft px-3 py-3 text-sm text-signal-danger-ink"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-col gap-4 border-b border-border p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Account directory
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {filteredUsers.length} of {users.length} account
              {users.length === 1 ? '' : 's'} · Newest first
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              role="group"
              aria-label="Filter by role"
              className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-muted p-1"
            >
              {ROLE_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setRoleFilter(filter.value)}
                  aria-pressed={roleFilter === filter.value}
                  className={cn(
                    'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    roleFilter === filter.value
                      ? 'bg-brand-soft text-brand-strong'
                      : 'text-ink-muted hover:text-ink'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, license…"
                aria-label="Search registered accounts"
                className="h-9 w-full rounded-xl border border-border bg-surface-muted pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 sm:w-64"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center gap-3 text-sm text-ink-secondary">
            <Loader2
              aria-hidden="true"
              className="h-5 w-5 animate-spin text-brand-strong"
            />
            Loading registered accounts…
          </div>
        ) : users.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface-muted text-ink-muted">
              <UsersRound aria-hidden="true" className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">
              No registered accounts yet
            </p>
            <p className="mt-1 max-w-sm text-sm leading-6 text-ink-muted">
              New patient and doctor signups, seeded clinicians and demo accounts
              appear here.
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface-muted text-ink-muted">
              <Search aria-hidden="true" className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">
              No accounts match your filters
            </p>
            <p className="mt-1 max-w-sm text-sm leading-6 text-ink-muted">
              Try a different role or clear the search to see every registered
              account.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-border-strong px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-strong"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {/* Below xl the five-column register becomes a stacked account
                list, so no role, specialty or date is hidden behind a
                horizontal scroll. */}
            <ul className="divide-y divide-border xl:hidden">
              {filteredUsers.map((user) => (
                <li
                  key={user.id ?? user.email}
                  className="px-4 py-4 transition-colors duration-200 hover:bg-surface-strong"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border bg-surface-muted text-[10px] font-semibold text-ink-secondary">
                      {initials(user.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-semibold text-ink">
                          {user.name}
                        </p>
                        <span className="shrink-0">
                          <RoleBadge role={user.role} />
                        </span>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">
                        {user.email}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                        {user.role === 'DOCTOR' && user.specialty && (
                          <span className="normal-case tracking-normal">
                            {user.specialty}
                          </span>
                        )}
                        {user.licenseNumber && <span>{user.licenseNumber}</span>}
                        <span>{formatDate(user.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden max-h-[calc(100vh-360px)] overflow-auto xl:block">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-surface-muted">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Name
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Email
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Role
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Specialty
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Created date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id ?? user.email}
                      className="border-b border-border transition-colors duration-200 last:border-b-0 hover:bg-surface-strong"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-border bg-surface-muted text-[10px] font-semibold text-ink-secondary">
                            {initials(user.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {user.name}
                            </p>
                            {user.licenseNumber && (
                              <p className="mt-0.5 font-mono text-[10px] text-ink-muted">
                                {user.licenseNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-ink-secondary">
                        {user.email}
                      </td>
                      <td className="px-4 py-3.5">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3.5 text-sm text-ink-secondary">
                        {user.role === 'DOCTOR' ? user.specialty || '—' : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-ink-muted">
                        {formatDate(user.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 border-t border-border bg-surface-muted px-5 py-3 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-[1px] bg-brand-solid"
            />
            Passwords are stored as bcrypt hashes.
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
            GET /api/auth/users
          </span>
        </div>
      </section>
    </div>
  );
}

export default function AdminPortal() {
  const facilities = useTriageStore((state) => state.facilities);
  const queue = useTriageStore((state) => state.queue);
  const encounters = useTriageStore((state) => state.encounters);
  const routeUpdates = useTriageStore((state) => state.routeUpdates);
  const updateFacility = useTriageStore((state) => state.updateFacility);
  const setEncounters = useTriageStore((state) => state.setEncounters);
  const socketConnected = useTriageStore((state) => state.socketConnected);
  const auth = useTriageStore((state) => state.auth);
  const triageNotifications = useTriageStore(
    (state) => state.triageNotifications
  );
  const adminName = auth?.name || 'Network Admin';

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const activeView = ADMIN_VIEWS.some((view) => view.id === requestedView)
    ? requestedView
    : DEFAULT_VIEW;

  const changeView = (nextView) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('patient_id');

    if (nextView === DEFAULT_VIEW) {
      nextParams.delete('view');
    } else {
      nextParams.set('view', nextView);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const openPatientEncounter = (patientId) => {
    if (!patientId) {
      changeView('encounters');
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', 'encounters');
    nextParams.set('patient_id', patientId);
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeView]);

  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');

  const [selectedId, setSelectedId] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [shockStatus, setShockStatus] = useState('idle');
  const [shockResult, setShockResult] = useState(null);
  const [shockError, setShockError] = useState('');
  const [shockStartedAt, setShockStartedAt] = useState(0);
  const [shockedFacilityId, setShockedFacilityId] = useState('');
  const [pulsingFacilityId, setPulsingFacilityId] = useState('');
  const [pulseNonce, setPulseNonce] = useState(0);

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError('');

    try {
      const { data } = await api.get('/analytics');
      setAnalytics(data);
    } catch (requestError) {
      setAnalyticsError(
        getApiErrorMessage(requestError, 'Unable to load network analytics.')
      );
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    let active = true;

    api
      .get('/encounters?active=true')
      .then(({ data }) => {
        if (active) setEncounters(data.encounters ?? data);
      })
      .catch(() => {
        // The shared socket stream keeps the encounter list current.
      });

    return () => {
      active = false;
    };
  }, [setEncounters]);

  useEffect(() => {
    if (shockStatus !== 'rerouting' || !shockStartedAt || !shockedFacilityId) {
      return undefined;
    }

    const matchingRoutes = routeUpdates.filter(
      (update) =>
        update.previous_facility_id === shockedFacilityId &&
        new Date(update.rerouted_at).getTime() >= shockStartedAt - 1500
    );

    if (matchingRoutes.length === 0) return undefined;

    const expectedRoutes = shockResult?.rerouted_routes;
    if (
      typeof expectedRoutes === 'number' &&
      expectedRoutes > 0 &&
      matchingRoutes.length < expectedRoutes
    ) {
      return undefined;
    }

    // Keep the rerouting state visible for a short, readable interval even
    // when the Socket.IO update lands before the HTTP response.
    const remaining = Math.max(0, 1100 - (Date.now() - shockStartedAt));
    const timer = window.setTimeout(() => setShockStatus('done'), remaining);

    return () => window.clearTimeout(timer);
  }, [
    routeUpdates,
    shockStatus,
    shockStartedAt,
    shockedFacilityId,
    shockResult,
  ]);

  useEffect(() => {
    if (!pulsingFacilityId) return undefined;

    // The facility card holds a red border for two seconds after the shock.
    const timer = window.setTimeout(() => setPulsingFacilityId(''), 2000);

    return () => window.clearTimeout(timer);
  }, [pulsingFacilityId, pulseNonce]);

  useEffect(() => {
    if (shockStatus !== 'rerouting' || !shockStartedAt) return undefined;

    // Safety net when no route was affected or the socket update is missed.
    const timer = window.setTimeout(() => setShockStatus('done'), 8000);

    return () => window.clearTimeout(timer);
  }, [shockStatus, shockStartedAt]);

  const sortedFacilities = useMemo(() => {
    return [...facilities].sort((a, b) => {
      return (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4);
    });
  }, [facilities]);

  const activeEncounters = useMemo(
    () =>
      encounters.filter((encounter) =>
        ACTIVE_ENCOUNTER_STATUSES.includes(encounter.status)
      ),
    [encounters]
  );
  const activeQueue = useMemo(() => {
    const source =
      activeEncounters.length > 0
        ? activeEncounters
        : queue.filter((entry) =>
            ACTIVE_ENCOUNTER_STATUSES.includes(entry.status)
          );

    const latestByPatient = new Map();

    for (const entry of source) {
      const key = entry.patient_id ?? entry.id;
      if (!key) continue;

      const current = latestByPatient.get(key);
      const currentTime = current
        ? new Date(
            current.updated_at ?? current.created_at ?? current.received_at ?? 0
          ).getTime()
        : Number.NEGATIVE_INFINITY;
      const entryTime = new Date(
        entry.updated_at ?? entry.created_at ?? entry.received_at ?? 0
      ).getTime();

      if (!current || entryTime >= currentTime) {
        latestByPatient.set(key, entry);
      }
    }

    return Array.from(latestByPatient.values());
  }, [activeEncounters, queue]);

  // The command view follows the newest reroute when one exists, otherwise the
  // highest-acuity active encounter. This keeps the primary rail aligned with
  // the same case the map is tracking.
  const priorityEncounter = useMemo(() => {
    const rerouted = [...activeQueue]
      .filter(
        (encounter) =>
          encounter.status === 'ROUTING' && encounter.route_update?.rerouted_at
      )
      .sort(
        (a, b) =>
          new Date(b.route_update.rerouted_at).getTime() -
          new Date(a.route_update.rerouted_at).getTime()
      )[0];

    if (rerouted) return rerouted;

    return (
      [...activeQueue].sort((a, b) => {
        const acuityDelta =
          (ACUITY_ORDER[a.acuity] ?? 9) - (ACUITY_ORDER[b.acuity] ?? 9);
        if (acuityDelta !== 0) return acuityDelta;

        const aTime = a.created_at ?? a.received_at ?? 0;
        const bTime = b.created_at ?? b.received_at ?? 0;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      })[0] ?? null
    );
  }, [activeQueue]);

  const priorityFacilityId =
    priorityEncounter?.facility_id ??
    priorityEncounter?.selected_facility?.id ??
    DEMO_SHOCK_TARGET_ID;

  const preferredFacility =
    sortedFacilities.find(
      (facility) =>
        facility.id === priorityFacilityId && facility.status !== 'OFFLINE'
    ) ??
    sortedFacilities.find(
      (facility) =>
        facility.id === DEMO_SHOCK_TARGET_ID && facility.status !== 'OFFLINE'
    ) ??
    sortedFacilities.find((facility) => facility.status !== 'OFFLINE') ??
    sortedFacilities[0] ??
    null;
  const resolvedId = sortedFacilities.some((facility) => facility.id === selectedId)
    ? selectedId
    : preferredFacility?.id ?? '';
  const selectedFacility =
    sortedFacilities.find((facility) => facility.id === resolvedId) ?? null;

  const onlineFacilities = facilities.filter(
    (facility) => facility.status !== 'OFFLINE'
  );
  const networkCapacity =
    onlineFacilities.length > 0
      ? Math.round(
          onlineFacilities.reduce(
            (sum, facility) => sum + (Number(facility.capacity_pct) || 0),
            0
          ) / onlineFacilities.length
        )
      : 0;
  const criticalCount = activeQueue.filter(
    (entry) => entry.acuity === 'CRITICAL'
  ).length;
  const unreadNotificationCount = triageNotifications.filter(
    (notification) => !notification.read
  ).length;

  const capacityData = useMemo(
    () =>
      facilities.map((facility) => ({
        name: shortFacilityName(facility.name),
        capacity: Number(facility.capacity_pct) || 0,
        fill: getFacilityStatusMeta(facility.status).hex,
      })),
    [facilities]
  );

  const waitData = useMemo(
    () =>
      facilities.map((facility) => ({
        name: shortFacilityName(facility.name),
        wait: facility.status === 'OFFLINE' ? 0 : Number(facility.er_wait_min) || 0,
        fill: getFacilityStatusMeta(facility.status).hex,
      })),
    [facilities]
  );

  const ledger = useMemo(() => {
    const source =
      shockResult?.rerouted?.length > 0 ? shockResult.rerouted : routeUpdates;

    const filtered = source.filter((route) => {
      if (!shockStartedAt) return true;
      return new Date(route.rerouted_at).getTime() >= shockStartedAt - 1500;
    });

    const byPatient = new Map();
    filtered.forEach((route) => byPatient.set(route.patient_id, route));

    return Array.from(byPatient.values());
  }, [shockResult, routeUpdates, shockStartedAt]);

  const handleShock = async () => {
    if (!selectedFacility || selectedFacility.status === 'OFFLINE') return;
    if (shockStatus === 'rerouting') return;

    const startedAt = Date.now();
    setSelectedId(selectedFacility.id);
    setShockStartedAt(startedAt);
    setShockStatus('rerouting');
    setShockResult(null);
    setShockError('');
    setShockedFacilityId(selectedFacility.id);
    setPulsingFacilityId(selectedFacility.id);
    setPulseNonce((value) => value + 1);

    try {
      const [response] = await Promise.all([
        api.post('/facilities/simulate-shock', {
          facility_id: selectedFacility.id,
        }),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);

      if (response.data.facility) {
        updateFacility(response.data.facility);
      }

      setShockResult(response.data);
      loadAnalytics();

      const reroutedRoutes =
        response.data.rerouted_routes ?? response.data.rerouted?.length ?? 0;

      // With a live socket, completion waits for ROUTE_UPDATED. The fallback
      // covers zero affected routes and disconnected clients.
      if (reroutedRoutes === 0 || !useTriageStore.getState().socketConnected) {
        setShockStatus('done');
      }
    } catch (requestError) {
      setShockStatus('error');
      setShockError(
        getApiErrorMessage(requestError, 'The facility shock could not be simulated.')
      );
    }
  };

  const reroutedCount = shockResult?.rerouted_routes ?? ledger.length;
  const isOfflineTarget = selectedFacility?.status === 'OFFLINE';
  const isRerouting = shockStatus === 'rerouting';

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <PortalHeader
        roleLabel="Network administration"
        userName={adminName}
        homePath="/admin"
        rightActions={
          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            aria-label={
              unreadNotificationCount > 0
                ? `Open notifications, ${unreadNotificationCount} unread`
                : 'Open notifications'
            }
            className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface text-ink-secondary transition-colors hover:bg-surface-strong hover:text-ink"
          >
            <Bell aria-hidden="true" className="h-4 w-4" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-signal-danger px-1 text-[9px] font-bold leading-none text-white">
                {unreadNotificationCount > 99
                  ? '99+'
                  : unreadNotificationCount}
              </span>
            )}
          </button>
        }
      />

      <NotificationPanel
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onSelectPatient={openPatientEncounter}
        onOpenDetails={(notification) => {
          setNotificationsOpen(false);
          openPatientEncounter(notification?.patient_id);
        }}
      />
      <TriageNotificationPopup
        onSelectPatient={openPatientEncounter}
        onOpenDetails={(notification) =>
          openPatientEncounter(notification?.patient_id)
        }
      />

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1500px] flex-col lg:flex-row">
        <AdminSidebar activeView={activeView} onViewChange={changeView} />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1240px]">
            {activeView === 'command' && (
              <CommandView
                analytics={analytics}
                analyticsError={analyticsError}
                analyticsLoading={analyticsLoading}
                loadAnalytics={loadAnalytics}
                activeEncounters={activeEncounters}
                activeQueue={activeQueue}
                priorityEncounter={priorityEncounter}
                facilities={facilities}
                sortedFacilities={sortedFacilities}
                onlineFacilities={onlineFacilities}
                networkCapacity={networkCapacity}
                criticalCount={criticalCount}
                socketConnected={socketConnected}
                onViewChange={changeView}
              />
            )}

            {activeView === 'encounters' && (
              <EncountersView
                activeEncounters={activeEncounters}
                activeQueue={activeQueue}
                focusPatientId={searchParams.get('patient_id')}
              />
            )}

            {activeView === 'facilities' && (
              <FacilitiesView
                facilities={facilities}
                sortedFacilities={sortedFacilities}
                onlineFacilities={onlineFacilities}
                networkCapacity={networkCapacity}
                selectedFacility={selectedFacility}
                resolvedId={resolvedId}
                setSelectedId={setSelectedId}
                pulsingFacilityId={pulsingFacilityId}
                shockStatus={shockStatus}
                shockError={shockError}
                reroutedCount={reroutedCount}
                isOfflineTarget={isOfflineTarget}
                isRerouting={isRerouting}
                handleShock={handleShock}
                ledger={ledger}
                analytics={analytics}
                analyticsLoading={analyticsLoading}
                loadAnalytics={loadAnalytics}
              />
            )}

            {activeView === 'analytics' && (
              <AnalyticsView
                analytics={analytics}
                analyticsError={analyticsError}
                analyticsLoading={analyticsLoading}
                loadAnalytics={loadAnalytics}
                capacityData={capacityData}
                waitData={waitData}
                networkCapacity={networkCapacity}
                sortedFacilities={sortedFacilities}
              />
            )}

            {activeView === 'users' && <UsersView />}
          </div>
        </main>
      </div>
    </div>
  );
}
