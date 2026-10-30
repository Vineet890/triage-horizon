import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  HeartPulse,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  Pill,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Video,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../lib/api';
import socket from '../lib/socket';
import { getAcuityMeta, getCareTierLabel } from '../lib/clinical';
import { DEMO_PATIENTS, buildPatientProfile } from '../lib/demoPatients';
import {
  MEDICATION_PLAN,
  MOOD_HISTORY,
  MOOD_LEVELS,
  WEEKLY_ADHERENCE,
} from '../lib/patientWellness';
import useTriageStore, {
  ACTIVE_ENCOUNTER_STATUSES,
} from '../store/useTriageStore';
import { cn, formatRelativeTime, initials } from '../lib/utils';
import { BrandLockup, BrandMark } from '../components/Brand';
import ThemeToggle from '../components/ThemeToggle';
import AcuityBadge from '../components/AcuityBadge';
import AgentTrace from '../components/AgentTrace';
import ClinicalCard from '../components/ClinicalCard';
import EncounterRail from '../components/EncounterRail';
import PatientRouteStatus from '../components/PatientRouteStatus';
import PatientPrescriptionNotifications from '../components/PatientPrescriptionNotifications';
import ThinkingLog from '../components/ThinkingLog';
import VideoConsultation from '../components/VideoConsultation';

const THINKING_STEPS = [
  'Reading the symptom narrative',
  'Matching Manchester Triage protocol',
  'Checking facility capacity and travel time',
  'Confirming the safest destination',
];

const TABS = [
  {
    id: 'chat',
    label: 'Triage chat',
    shortLabel: 'Chat',
    description: 'Symptom intake',
    icon: MessageSquare,
  },
  {
    id: 'medications',
    label: 'Medicine adherence',
    shortLabel: 'Medicines',
    description: 'Daily plan',
    icon: Pill,
  },
  {
    id: 'mental-health',
    label: 'Mental health',
    shortLabel: 'Wellbeing',
    description: 'Mood & support',
    icon: HeartPulse,
  },
];

function todayLabel() {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
}

function todayIndex() {
  return (new Date().getDay() + 6) % 7;
}

const initialTakenState = Object.fromEntries(
  MEDICATION_PLAN.map((medication) => [medication.id, medication.defaultTaken])
);

function ProfileField({ label, value, mono = false, danger = false }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 text-sm font-medium leading-6',
          mono && 'font-mono',
          danger ? 'text-signal-danger-ink' : 'text-ink'
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function RejectedFacility({ facility, index }) {
  return (
    <li className="flex gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-border bg-surface-muted text-xs font-semibold text-ink-muted">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{facility.name}</p>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">{facility.reason}</p>
      </div>
    </li>
  );
}

function PatientSidebar({ patient, activeTab, onTabChange, onSignOut, socketConnected }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-forest-border bg-forest text-forest-ink lg:flex">
      <div className="flex h-16 shrink-0 items-center border-b border-forest-border px-5">
        <BrandLockup to="/patient" light />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="rounded-[6px] border border-forest-border bg-white/[0.04] p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-forest-border bg-forest-active text-xs font-semibold text-forest-accent">
              {initials(patient.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-forest-ink">
                {patient.name}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-forest-faint">
                {patient.display_id}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 border-t border-forest-border pt-3 text-[11px] font-medium text-forest-muted">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-forest-accent" />
            Verified clinical record
          </div>
        </div>

        <p className="mt-6 px-2 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-forest-faint">
          Care workspace
        </p>

        <nav className="mt-2 space-y-1" aria-label="Patient workspace">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex w-full items-center gap-3 rounded-[6px] border px-3 py-2.5 text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-forest-accent/30',
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
                  <span className="block text-sm font-medium">{tab.label}</span>
                  <span
                    className={cn(
                      'mt-0.5 block text-xs',
                      isActive ? 'text-forest-muted' : 'text-forest-faint'
                    )}
                  >
                    {tab.description}
                  </span>
                </span>
                {isActive && (
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-forest-accent"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 border-t border-forest-border p-4">
        <div className="flex items-center gap-2 px-1 text-[11px] font-medium text-forest-muted">
          <span
            aria-hidden="true"
            className={cn(
              'h-1.5 w-1.5 rounded-[1px]',
              socketConnected ? 'bg-signal-success' : 'bg-signal-amber'
            )}
          />
          {socketConnected ? 'Live clinical updates' : 'Reconnecting to network'}
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[6px] border border-forest-border bg-white/5 text-sm font-medium text-forest-ink transition-colors duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-forest-accent/30"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function PatientTopbar({
  patient,
  activeTab,
  onTabChange,
  onSignOut,
  socketConnected,
}) {
  const tab = TABS.find((item) => item.id === activeTab) ?? TABS[0];

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark className="h-8 w-8 lg:hidden" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{tab.label}</p>
            <p className="mt-0.5 hidden font-mono text-[9px] uppercase tracking-[0.1em] text-ink-muted sm:block">
              Patient workspace · {todayLabel()}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 text-[11px] font-medium text-ink-muted md:flex">
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 w-1.5 rounded-[1px]',
                socketConnected ? 'bg-signal-success' : 'bg-signal-amber'
              )}
            />
            {socketConnected ? 'Live' : 'Reconnecting'}
          </span>

          <PatientPrescriptionNotifications patientId={patient.id} />

          <ThemeToggle />

          <div className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
            <span className="grid h-8 w-8 place-items-center rounded-[6px] border border-brand-border bg-brand-soft text-[11px] font-semibold text-brand-strong">
              {initials(patient.name)}
            </span>
            <div className="hidden md:block">
              <p className="text-xs font-semibold leading-tight text-ink">
                {patient.name}
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-ink-muted">
                {patient.display_id}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="grid h-9 w-9 place-items-center rounded-[6px] border border-border text-ink-secondary transition-colors duration-200 hover:bg-surface-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/25 sm:hidden"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav
        aria-label="Patient workspace sections"
        className="flex gap-1 overflow-x-auto border-t border-border px-2 py-2 lg:hidden"
      >
        {TABS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-[6px] border px-3 py-2 text-sm font-medium transition-colors duration-200',
                isActive
                  ? 'border-brand-border bg-brand-soft text-brand-strong'
                  : 'border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink'
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {item.shortLabel}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function RecordCard({ patient }) {
  return (
    <ClinicalCard>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
            Patient record
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">Your health record</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-signal-success-border bg-signal-success-soft px-2 py-1 text-xs font-semibold text-signal-success-ink">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
          Verified
        </span>
      </div>

      <div className="mt-5 flex items-center gap-3 border-b border-border pb-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[6px] border border-brand-border bg-brand-soft text-sm font-semibold text-brand-strong">
          {initials(patient.name)}
        </span>
        <div>
          <p className="text-base font-semibold text-ink">{patient.name}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            <span className="font-mono">{patient.display_id}</span>
            {patient.age ? ` · ${patient.age} years` : ''}
            {patient.gender ? ` · ${patient.gender}` : ''}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4">
        <ProfileField label="Blood group" value={patient.blood_type} />
        <ProfileField
          label="Allergies"
          value={
            patient.allergies.length > 0 ? patient.allergies.join(', ') : 'None recorded'
          }
          danger={patient.allergies.length > 0}
        />
        <div className="col-span-2">
          <ProfileField label="Conditions" value={patient.conditions.join(', ')} />
        </div>
        <div className="col-span-2">
          <ProfileField
            label="Current medication"
            value={patient.medications.join('; ')}
          />
        </div>
      </dl>

      <p className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-ink-muted">
        <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
        This record is shared securely with your care team.
      </p>
    </ClinicalCard>
  );
}

const ENCOUNTER_STATUS_LABELS = {
  INTAKE: 'Intake',
  TRIAGED: 'Triaged',
  ROUTING: 'Routing',
  AWAITING_ACCEPTANCE: 'Awaiting clinician acceptance',
  ACCEPTED: 'Accepted by clinician',
  EN_ROUTE: 'En route to facility',
  CLOSED: 'Encounter closed',
};

function CareStatusCard({ encounter }) {
  if (!encounter) return null;

  const prescription = encounter.prescription;
  const clinician = encounter.assigned_doctor_name;

  return (
    <ClinicalCard>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
            Care status
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">
            {ENCOUNTER_STATUS_LABELS[encounter.status] ?? encounter.status}
          </h2>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-brand-border bg-brand-soft px-2 py-1 font-mono text-[10px] font-semibold text-brand-strong">
          {encounter.id}
        </span>
      </div>

      <dl className="mt-4 space-y-3 border-t border-border pt-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Destination
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-ink">
            {encounter.facility_name ?? 'Care coordination team'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Clinician
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-ink">
            {clinician ?? 'Awaiting acceptance'}
          </dd>
        </div>
      </dl>

      {prescription && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-signal-success-ink">
            <Pill aria-hidden="true" className="h-3.5 w-3.5" />
            New prescription
          </p>
          <ul className="mt-2 space-y-2">
            {(prescription.medications ?? []).map((medication, index) => (
              <li key={`${medication.name}-${index}`} className="text-sm text-ink">
                <span className="font-medium">{medication.name}</span>
                {medication.dosage ? (
                  <span className="text-ink-secondary"> · {medication.dosage}</span>
                ) : null}
                {medication.schedule ? (
                  <span className="block text-xs text-ink-muted">
                    {medication.schedule}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {prescription.instructions && (
            <p className="mt-2 text-xs leading-5 text-ink-secondary">
              {prescription.instructions}
            </p>
          )}
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
            {prescription.prescription_id}
            {prescription.doctor_name ? ` · ${prescription.doctor_name}` : ''}
            {prescription.sent_at ? ` · ${formatRelativeTime(prescription.sent_at)}` : ''}
          </p>
        </div>
      )}
    </ClinicalCard>
  );
}

function CareTeamCard() {
  return (
    <ClinicalCard>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
        Care team
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[6px] border border-border bg-surface-muted text-xs font-semibold text-ink-secondary">
          MS
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Dr. Mira Sen</p>
          <p className="text-xs text-ink-muted">Triage physician · On shift</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-signal-success-ink">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-[1px] bg-signal-success" />
        Reviewing the live queue
      </div>
      <p className="mt-4 border-t border-border pt-4 text-sm leading-6 text-ink-secondary">
        Every routing decision is reviewed by a licensed clinician before care is
        confirmed.
      </p>
    </ClinicalCard>
  );
}

function RoutingResult({
  result,
  patientName,
  acuityMeta,
  selectedFacility,
  facilityEta,
  facilityDistance,
  routeUpdate,
  declinedFacilities,
  submittedAt,
  onReset,
  videoRoom,
  videoStatus,
  videoDoctor,
  videoStartedAt,
  videoError,
  videoEnding,
  onJoinVideo,
  onEndVideo,
  onDismissVideo,
}) {
  const isTelehealth = result.care_tier === 'telehealth';

  return (
    <ClinicalCard className="overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
            Decision ready
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
            Routing decision
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">{result.protocol_matched}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-muted">
            {formatRelativeTime(submittedAt ?? result.timestamp)}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-all duration-200 hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            New assessment
          </button>
        </div>
      </div>

      <div className="grid gap-6 border-b border-border p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Acuity
          </p>
          <div className="mt-2">
            <AcuityBadge acuity={result.acuity} size="lg" />
          </div>
          <p className="mt-2 text-sm text-ink-secondary">
            Manchester category {acuityMeta.code}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Care tier
          </p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {getCareTierLabel(result.care_tier)}
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            Clinical route for this acuity level
          </p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {routeUpdate && (
          <motion.div
            key={routeUpdate.rerouted_at ?? 'route-update'}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-3 border-b border-signal-high-border bg-signal-high-soft p-6"
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-signal-high-ink"
            />
            <div>
              <p className="text-sm font-semibold text-signal-high-ink">
                Your destination was updated
              </p>
              <p className="mt-1 text-sm leading-6 text-signal-high-ink">
                {routeUpdate.reason} The new facility is shown below.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Selected facility
        </p>
        <motion.div
          layout
          transition={{ layout: { duration: 0.35, ease: 'easeOut' } }}
          className="mt-3 rounded-[6px] border border-border bg-surface-muted p-5"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selectedFacility?.id ?? 'care-coordination'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-brand-border bg-brand-soft text-brand-strong">
                  <MapPin aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-ink">
                    {selectedFacility?.name ?? 'Care coordination team'}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">
                    {selectedFacility?.reason}
                  </p>
                </div>
              </div>

              {(facilityEta != null || facilityDistance != null) && (
                <dl className="flex shrink-0 gap-6 border-t border-border pt-3 sm:border-t-0 sm:pt-0">
                  {facilityEta != null && (
                    <div>
                      <dt className="text-xs text-ink-muted">Drive</dt>
                      <dd className="mt-1 text-sm font-semibold text-ink">
                        {facilityEta} min
                      </dd>
                    </div>
                  )}
                  {facilityDistance != null && (
                    <div>
                      <dt className="text-xs text-ink-muted">Distance</dt>
                      <dd className="mt-1 text-sm font-semibold text-ink">
                        {facilityDistance} km
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <div className="mt-6 border-t border-border pt-6">
          {!videoRoom ? (
            <div className="rounded-[6px] border border-brand-border bg-brand-soft p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-brand-border bg-surface text-brand-strong">
                    <Video aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-brand-strong">
                      {isTelehealth ? 'Telehealth consultation' : 'Video consultation'}
                    </h3>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-brand-strong">
                      {isTelehealth
                        ? 'This route is eligible for a secure video visit. Join the room and a clinician will meet you there.'
                        : 'Start a secure video visit at any time. A clinician will meet you in the room; keep following your routed destination for in-person care.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onJoinVideo}
                  disabled={videoStatus === 'connecting'}
                  className={cn(
                    'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[6px] border px-4 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30',
                    videoStatus === 'connecting'
                      ? 'cursor-wait border-brand bg-brand-solid text-white opacity-80'
                      : 'border-brand bg-brand-solid text-white hover:bg-brand-solid-hover'
                  )}
                >
                  {videoStatus === 'connecting' ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Video aria-hidden="true" className="h-4 w-4" />
                  )}
                  {videoStatus === 'connecting'
                    ? 'Opening room…'
                    : 'Join Video Consultation'}
                </button>
              </div>

              {videoError && (
                <p
                  role="alert"
                  className="mt-3 border-t border-brand-border pt-3 text-[13px] font-medium text-signal-danger-ink"
                >
                  {videoError}
                </p>
              )}
            </div>
          ) : (
            <VideoConsultation
              roomId={videoRoom}
              status={videoStatus}
              displayName={patientName}
              participant={
                videoDoctor?.name
                  ? `${videoDoctor.name}${
                      videoDoctor.specialty ? ` · ${videoDoctor.specialty}` : ''
                    }`
                  : 'Clinician'
              }
              startedAt={videoStartedAt}
              error={videoError}
              ending={videoEnding}
              title={isTelehealth ? 'Telehealth consultation' : 'Video consultation'}
              onEnd={onEndVideo}
              onClose={onDismissVideo}
            />
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">Clinical flags</h3>
            {result.special_flags?.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {result.special_flags.map((flag) => (
                  <li
                    key={flag}
                    className="flex items-center gap-2 text-sm text-ink-secondary"
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-[1px] bg-signal-amber"
                    />
                    {flag.replaceAll('_', ' ')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">
                No additional clinical flags.
              </p>
            )}

            <p className="mt-5 rounded-[6px] border border-border bg-surface-muted p-3 text-xs leading-5 text-ink-secondary">
              Decision support only. A licensed clinician retains final routing
              authority.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink">
              Facilities considered and declined
            </h3>
            <ul className="mt-3">
              {declinedFacilities.map((facility, index) => (
                <RejectedFacility
                  key={facility.id}
                  facility={facility}
                  index={index}
                />
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-xs text-ink-muted">
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          This decision has been added to the physician triage queue.
        </div>
      </div>
    </ClinicalCard>
  );
}

function TriageTab({
  patient,
  encounter,
  traceSteps,
  symptom,
  setSymptom,
  canSubmit,
  analyzing,
  thinkingSteps,
  error,
  onSubmit,
  onReset,
  result,
  acuityMeta,
  selectedFacility,
  facilityEta,
  facilityDistance,
  routeUpdate,
  declinedFacilities,
  submittedAt,
  videoRoom,
  videoStatus,
  videoDoctor,
  videoStartedAt,
  videoError,
  videoEnding,
  onJoinVideo,
  onEndVideo,
  onDismissVideo,
}) {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
            Patient intake
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Hello, {patient.name.split(' ')[0]}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary sm:text-base">
            Tell us what you are experiencing. The triage engine checks your clinical
            record, live facility capacity and travel time before recommending a
            destination.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-[6px] border border-border bg-surface px-3 py-2 text-xs text-ink-muted">
          <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
          {todayLabel()}
        </div>
      </div>

      {encounter && <EncounterRail encounter={encounter} className="mt-6" />}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <ClinicalCard>
            <form onSubmit={onSubmit}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink">
                    How are you feeling today?
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">
                    Include when the symptoms started, how severe they are and anything
                    that makes them worse.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSymptom(patient.sample)}
                  className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-[6px] border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-all duration-200 hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <ClipboardList aria-hidden="true" className="h-4 w-4" />
                  Insert example
                </button>
              </div>

              <label htmlFor="symptoms" className="sr-only">
                Symptoms
              </label>
              <textarea
                id="symptoms"
                name="symptoms"
                value={symptom}
                onChange={(event) => setSymptom(event.target.value)}
                rows={6}
                maxLength={1200}
                placeholder="Describe your symptoms in your own words…"
                className="mt-4 w-full resize-y rounded-[6px] border border-border-strong bg-surface p-3 text-base leading-7 text-ink placeholder:text-ink-muted transition-all duration-200 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-ink-muted">
                  {symptom.length} / 1200 characters · minimum 10
                </p>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    'inline-flex h-11 items-center justify-center gap-2 rounded-[6px] border px-5 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20',
                    canSubmit
                      ? 'border-brand bg-brand-solid text-white hover:bg-brand-solid-hover'
                      : 'border-border bg-surface-strong text-ink-muted'
                  )}
                >
                  {analyzing ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Stethoscope aria-hidden="true" className="h-4 w-4" />
                  )}
                  {analyzing ? 'Submitting…' : 'Submit for triage'}
                </button>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-[6px] border border-signal-danger-border bg-signal-danger-soft px-3 py-3 text-sm text-signal-danger-ink"
                >
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  {error}
                </div>
              )}
            </form>
          </ClinicalCard>

          <AnimatePresence>
            {analyzing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ClinicalCard>
                  <ThinkingLog steps={thinkingSteps} active />
                </ClinicalCard>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {result && !analyzing && (
              <motion.section
                key={result.patient_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                aria-live="polite"
              >
                <RoutingResult
                  result={result}
                  patientName={patient.name}
                  acuityMeta={acuityMeta}
                  selectedFacility={selectedFacility}
                  facilityEta={facilityEta}
                  facilityDistance={facilityDistance}
                  routeUpdate={routeUpdate}
                  declinedFacilities={declinedFacilities}
                  submittedAt={submittedAt}
                  onReset={onReset}
                  videoRoom={videoRoom}
                  videoStatus={videoStatus}
                  videoDoctor={videoDoctor}
                  videoStartedAt={videoStartedAt}
                  videoError={videoError}
                  videoEnding={videoEnding}
                  onJoinVideo={onJoinVideo}
                  onEndVideo={onEndVideo}
                  onDismissVideo={onDismissVideo}
                />
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-6">
          <PatientRouteStatus
            patientId={patient.id}
            encounter={encounter}
            destination={selectedFacility}
            eta={facilityEta}
            careTier={encounter?.care_tier ?? result?.care_tier}
            routeUpdate={routeUpdate}
          />
          <AgentTrace
            steps={traceSteps}
            active={analyzing}
            emptyLabel="No agent activity for this encounter yet."
          />
          <CareStatusCard encounter={encounter} />
          <RecordCard patient={patient} />
          <CareTeamCard />
        </div>
      </div>
    </div>
  );
}

function MedicationTab({
  medicationPlan,
  takenMeds,
  onToggleMedication,
  onLogAll,
  adherenceData,
  takenCount,
  weeklyAverage,
}) {
  const allTaken = takenCount === medicationPlan.length;
  const prescribedCount = medicationPlan.filter(
    (medication) => medication.prescription_id
  ).length;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
            Medication adherence
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Your medication plan
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary sm:text-base">
            Check off each dose as you take it. Your care team uses this record to
            review adherence and adjust your plan.
          </p>
        </div>
        <button
          type="button"
          onClick={onLogAll}
          disabled={allTaken}
          className={cn(
            'inline-flex h-10 w-fit items-center gap-2 rounded-[6px] border px-4 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20',
            allTaken
              ? 'border-border bg-surface-strong text-ink-muted'
              : 'border-brand bg-brand-solid text-white hover:bg-brand-solid-hover'
          )}
        >
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          {allTaken ? 'All doses logged' : 'Log all as taken'}
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Today's doses",
            value: `${takenCount}/${medicationPlan.length}`,
            detail: allTaken ? 'Complete for today' : 'Keep going',
          },
          {
            label: 'Weekly adherence',
            value: `${weeklyAverage}%`,
            detail: 'Last 7 days',
          },
          {
            label: 'Current streak',
            value: '12 days',
            detail: 'No missed controller doses',
          },
          {
            label: 'Next dose',
            value: '20:00',
            detail: 'Budesonide / Formoterol',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[6px] border border-border bg-surface p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-ink-muted">{stat.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ClinicalCard className="overflow-hidden p-0">
            <div className="flex flex-col gap-2 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  Today&apos;s schedule
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {medicationPlan.length} prescribed items · {todayLabel()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {prescribedCount > 0 && (
                  <span className="inline-flex w-fit items-center gap-2 rounded-[4px] border border-signal-success-border bg-signal-success-soft px-2.5 py-1 text-xs font-semibold text-signal-success-ink">
                    <Pill aria-hidden="true" className="h-3.5 w-3.5" />
                    {prescribedCount} new prescription
                    {prescribedCount === 1 ? '' : 's'}
                  </span>
                )}
                <span className="inline-flex w-fit items-center gap-2 rounded-[4px] border border-brand-border bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-strong">
                  <Pill aria-hidden="true" className="h-3.5 w-3.5" />
                  Asthma plan
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left">
                <thead className="sticky top-0 bg-surface-muted">
                  <tr className="border-b border-border">
                    <th className="w-16 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Taken
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Medication
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Dose
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Schedule
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {medicationPlan.map((medication) => {
                    const taken = Boolean(takenMeds[medication.id]);

                    return (
                      <tr
                        key={medication.id}
                        className={cn(
                          'border-b border-border transition-colors duration-200 last:border-b-0 hover:bg-surface-muted',
                          taken && 'bg-brand-soft/40'
                        )}
                      >
                        <td className="px-4 py-4">
                          <label className="inline-flex cursor-pointer items-center">
                            <input
                              type="checkbox"
                              checked={taken}
                              onChange={() => onToggleMedication(medication.id)}
                              aria-label={`Mark ${medication.name} as taken`}
                              className="peer sr-only"
                            />
                            <span
                              className={cn(
                                'grid h-5 w-5 place-items-center rounded-[4px] border transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30 peer-focus-visible:ring-offset-2',
                                taken
                                  ? 'border-brand bg-brand-solid text-white'
                                  : 'border-border-strong bg-surface text-transparent hover:border-brand'
                              )}
                            >
                              <Check aria-hidden="true" className="h-3.5 w-3.5" />
                            </span>
                          </label>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-ink">
                            {medication.name}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {medication.category}
                          </p>
                          {medication.prescription_id && (
                            <span className="mt-1.5 inline-flex items-center gap-1 rounded-[3px] border border-signal-success-border bg-signal-success-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-success-ink">
                              <Pill aria-hidden="true" className="h-2.5 w-2.5" />
                              New prescription
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-ink-secondary">
                          {medication.dose}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-ink-secondary">{medication.schedule}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {medication.note}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-ink-secondary">
                          {medication.time}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-border bg-surface-muted px-6 py-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-brand-strong" />
                {takenCount} of {medicationPlan.length} doses logged today
              </span>
              <span>Changes are saved to your adherence record.</span>
            </div>
          </ClinicalCard>

          <ClinicalCard className="p-0">
            <div className="flex flex-col gap-2 border-b border-border p-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  Weekly adherence %
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Percentage of scheduled doses logged on time.
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tracking-tight text-ink">
                  {weeklyAverage}%
                </p>
                <p className="text-xs text-ink-muted">7-day average</p>
              </div>
            </div>
            <div className="h-[260px] w-full p-4 sm:p-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={adherenceData}
                  margin={{ top: 12, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--chart-grid)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgb(var(--surface-strong))' }}
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
                    formatter={(value) => [`${value}%`, 'Adherence']}
                  />
                  <Bar dataKey="value" name="Adherence" barSize={30} radius={[3, 3, 0, 0]}>
                    {adherenceData.map((entry) => (
                      <Cell
                        key={entry.day}
                        fill={entry.isToday ? 'var(--brand-solid)' : 'var(--brand-border)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ClinicalCard>
        </div>

        <div className="space-y-6">
          <ClinicalCard>
            <h2 className="text-lg font-semibold text-ink">Refill status</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Estimated supply based on your current plan.
            </p>
            <div className="mt-5 space-y-4">
              {[
                { name: 'Budesonide / Formoterol', detail: '18 days remaining', pct: 72 },
                { name: 'Albuterol', detail: '12 doses remaining', pct: 40 },
                { name: 'Montelukast', detail: '24 days remaining', pct: 86 },
              ].map((item) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-ink-secondary">{item.name}</span>
                    <span className="text-ink-muted">{item.detail}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[2px] bg-surface-strong">
                    <div
                      className="h-full rounded-[2px] bg-brand-solid"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[6px] border border-border-strong bg-surface text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface-muted"
            >
              Request a refill
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </ClinicalCard>

          <ClinicalCard>
            <div className="flex items-center gap-2">
              <BookOpen aria-hidden="true" className="h-4 w-4 text-brand-strong" />
              <h2 className="text-sm font-semibold text-ink">Adherence tips</h2>
            </div>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-ink-secondary">
              <li className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-1 shrink-0 rounded-[1px] bg-brand-solid"
                />
                Pair your controller inhaler with brushing your teeth.
              </li>
              <li className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-1 shrink-0 rounded-[1px] bg-brand-solid"
                />
                Log reliever use even on days you feel well.
              </li>
              <li className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-1 shrink-0 rounded-[1px] bg-brand-solid"
                />
                Keep a spare inhaler at home and one at work.
              </li>
            </ul>
          </ClinicalCard>
        </div>
      </div>
    </div>
  );
}

function MentalHealthTab({
  mood,
  onMoodChange,
  journal,
  onJournalChange,
  saved,
  onSave,
  onPrompt,
}) {
  const moodMeta = MOOD_LEVELS.find((level) => level.value === mood) ?? MOOD_LEVELS[6];

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
            Mental health check-in
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            How are you, really?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary sm:text-base">
            A private space to check in with yourself. Your entries are shared only
            with your care team.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-[6px] border border-border bg-surface px-3 py-2 text-xs text-ink-muted">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-brand-strong" />
          Private to your care team
        </span>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <ClinicalCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  Mood tracker
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Slide from 1 to 10 to describe how you feel right now.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-[6px] border border-border bg-surface-muted px-4 py-3">
                <span className="text-3xl" aria-hidden="true">
                  {moodMeta.emoji}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {moodMeta.label}
                  </p>
                  <p className="font-mono text-xs text-ink-muted">{mood} / 10</p>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={mood}
                onChange={(event) => onMoodChange(Number(event.target.value))}
                aria-label="Mood from 1 to 10"
                className="h-2 w-full cursor-pointer appearance-none rounded-[2px] bg-surface-strong accent-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-muted">
                <span>1 · VERY LOW</span>
                <span>10 · EXCELLENT</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {MOOD_LEVELS.map((level) => {
                const isSelected = level.value === mood;

                return (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => onMoodChange(level.value)}
                    aria-label={`Mood ${level.value}: ${level.label}`}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-[6px] border px-1 py-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20',
                      isSelected
                        ? 'border-brand bg-brand-soft'
                        : 'border-transparent hover:border-border hover:bg-surface-muted'
                    )}
                  >
                    <span className="text-xl" aria-hidden="true">
                      {level.emoji}
                    </span>
                    <span
                      className={cn(
                        'font-mono text-[10px]',
                        isSelected ? 'font-semibold text-brand-strong' : 'text-ink-muted'
                      )}
                    >
                      {level.value}
                    </span>
                  </button>
                );
              })}
            </div>
          </ClinicalCard>

          <ClinicalCard>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  Journal entry
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  What is on your mind today? There is no right way to do this.
                </p>
              </div>
              <span className="font-mono text-xs text-ink-muted">
                {journal.length} / 1000
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                'What helped today?',
                'What felt difficult?',
                'One thing I am grateful for',
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onPrompt(prompt)}
                  className="inline-flex h-8 items-center rounded-[4px] border border-border bg-surface-muted px-2.5 text-xs font-medium text-ink-secondary transition-colors duration-200 hover:border-border-strong hover:bg-surface"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <label htmlFor="journal" className="sr-only">
              Journal entry
            </label>
            <textarea
              id="journal"
              value={journal}
              onChange={(event) => onJournalChange(event.target.value)}
              rows={6}
              maxLength={1000}
              placeholder="Write freely. Your care team can review this entry before your next appointment."
              className="mt-4 w-full resize-y rounded-[6px] border border-border-strong bg-surface p-3 text-base leading-7 text-ink placeholder:text-ink-muted transition-all duration-200 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs text-ink-muted">
                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-brand-strong" />
                Saved privately to your clinical record.
              </p>
              <button
                type="button"
                onClick={onSave}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-brand bg-brand-solid px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-solid-hover focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Save check-in
              </button>
            </div>

            <AnimatePresence>
              {saved && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 flex items-center gap-2 rounded-[6px] border border-signal-success-border bg-signal-success-soft px-3 py-2.5 text-sm text-signal-success-ink"
                  role="status"
                >
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  Check-in saved. Your care team has been notified.
                </motion.div>
              )}
            </AnimatePresence>
          </ClinicalCard>

        </div>

        <div className="space-y-6">
          <ClinicalCard>
            <h2 className="text-sm font-semibold text-ink">Recent check-ins</h2>
            <ul className="mt-4 space-y-4">
              {MOOD_HISTORY.map((entry) => {
                const meta =
                  MOOD_LEVELS.find((level) => level.value === entry.mood) ??
                  MOOD_LEVELS[4];

                return (
                  <li
                    key={entry.date}
                    className="border-b border-border pb-4 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span className="text-lg" aria-hidden="true">
                          {meta.emoji}
                        </span>
                        <span className="text-xs font-medium text-ink-secondary">
                          {meta.label}
                        </span>
                      </span>
                      <span className="font-mono text-xs text-ink-muted">
                        {entry.date}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink-secondary">{entry.note}</p>
                  </li>
                );
              })}
            </ul>
          </ClinicalCard>

          <CareTeamCard />

          <div className="rounded-[6px] border border-signal-amber-border bg-signal-amber-soft p-5">
            <div className="flex items-center gap-2 text-signal-amber-ink">
              <HeartPulse aria-hidden="true" className="h-4 w-4" />
              <p className="text-sm font-semibold">You are not alone</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-signal-amber-ink">
              If you are having thoughts of self-harm, please call one of the
              resources above or go to your nearest emergency department.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PatientPortal() {
  const navigate = useNavigate();
  const facilities = useTriageStore((state) => state.facilities);
  const currentPatient = useTriageStore((state) => state.currentPatient);
  const triageResult = useTriageStore((state) => state.triageResult);
  const setCurrentPatient = useTriageStore((state) => state.setCurrentPatient);
  const setTriageResult = useTriageStore((state) => state.setTriageResult);
  const clearTriage = useTriageStore((state) => state.clearTriage);
  const socketConnected = useTriageStore((state) => state.socketConnected);
  const auth = useTriageStore((state) => state.auth);
  const encounters = useTriageStore((state) => state.encounters);
  const activeEncounterId = useTriageStore((state) => state.activeEncounterId);
  const agentTrace = useTriageStore((state) => state.agentTrace);
  const agentTraceEncounterId = useTriageStore(
    (state) => state.agentTraceEncounterId
  );
  const prescriptions = useTriageStore((state) => state.prescriptions);
  const setActiveEncounter = useTriageStore((state) => state.setActiveEncounter);
  const setAgentTrace = useTriageStore((state) => state.setAgentTrace);

  const [activeTab, setActiveTab] = useState('chat');
  const [symptom, setSymptom] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState([]);
  const [error, setError] = useState('');
  const [submittedAt, setSubmittedAt] = useState(null);
  const [isRerouting, setIsRerouting] = useState(false);
  const [rerouteNotice, setRerouteNotice] = useState(null);
  const [displayedFacility, setDisplayedFacility] = useState(null);
  const [revealedRoute, setRevealedRoute] = useState(null);
  const [takenMeds, setTakenMeds] = useState(initialTakenState);
  const [dismissedEncounterId, setDismissedEncounterId] = useState(null);
  const [mood, setMood] = useState(7);
  const [journal, setJournal] = useState('');
  const [checkInSaved, setCheckInSaved] = useState(false);
  const [videoRoom, setVideoRoom] = useState('');
  const [videoStatus, setVideoStatus] = useState('idle');
  const [videoDoctor, setVideoDoctor] = useState(null);
  const [videoStartedAt, setVideoStartedAt] = useState(null);
  const [videoError, setVideoError] = useState('');
  const [videoEnding, setVideoEnding] = useState(false);
  const stepTimer = useRef(null);
  const rerouteTimer = useRef(null);
  const reroutingRef = useRef(false);
  const savedTimer = useRef(null);

  // Direct session loads (page refresh) have no in-memory patient, so restore
  // the record that matches the authenticated user. Registered accounts get a
  // minimal profile derived from their own identity rather than patient_001.
  const sessionPatient = useMemo(() => buildPatientProfile(auth), [auth]);
  const patient = currentPatient ?? sessionPatient ?? DEMO_PATIENTS[0];
  const canSubmit = symptom.trim().length >= 10 && !analyzing;

  const patientEncounter = useMemo(() => {
    const owned = encounters.filter(
      (encounter) => encounter.patient_id === patient.id
    );

    return (
      owned.find((encounter) =>
        ACTIVE_ENCOUNTER_STATUSES.includes(encounter.status)
      ) ??
      owned[0] ??
      null
    );
  }, [encounters, patient.id]);

  // "New assessment" dismisses the previous case locally without deleting it
  // from the shared encounter record.
  const visibleEncounter =
    patientEncounter?.id === dismissedEncounterId ? null : patientEncounter;

  // Derived once so the video handler does not depend on the memoized result
  // object that is declared later in the component.
  const videoAcuity = triageResult?.acuity ?? visibleEncounter?.acuity ?? null;

  const traceSteps = useMemo(() => {
    if (
      agentTrace.length > 0 &&
      (!agentTraceEncounterId ||
        !visibleEncounter ||
        agentTraceEncounterId === visibleEncounter.id)
    ) {
      return agentTrace;
    }

    return visibleEncounter?.agent_trace ?? [];
  }, [agentTrace, agentTraceEncounterId, visibleEncounter]);

  const medicationPlan = useMemo(() => {
    const seen = new Set(
      MEDICATION_PLAN.map((medication) => medication.name.toLowerCase())
    );

    const prescribed = prescriptions.flatMap((prescription) =>
      (prescription.medications ?? []).flatMap((medication, index) => {
        const key = String(medication.name ?? '').toLowerCase();

        if (!key || seen.has(key)) return [];
        seen.add(key);

        return [
          {
            id: `rx-${prescription.prescription_id}-${index}`,
            name: medication.name,
            dose: medication.dosage || 'As directed',
            schedule: medication.schedule || 'As directed',
            time: 'New',
            category: prescription.doctor_name
              ? `Prescribed by ${prescription.doctor_name}`
              : 'New prescription',
            note:
              prescription.instructions ||
              medication.note ||
              'Added from your latest consultation.',
            defaultTaken: false,
            prescription_id: prescription.prescription_id,
          },
        ];
      })
    );

    return [...prescribed, ...MEDICATION_PLAN];
  }, [prescriptions]);

  useEffect(() => {
    if (visibleEncounter?.id && visibleEncounter.id !== activeEncounterId) {
      setActiveEncounter(visibleEncounter.id);
    }
  }, [activeEncounterId, setActiveEncounter, visibleEncounter?.id]);

  const resetVideo = () => {
    setVideoRoom('');
    setVideoStatus('idle');
    setVideoDoctor(null);
    setVideoStartedAt(null);
    setVideoError('');
    setVideoEnding(false);
  };

  useEffect(() => {
    if (!currentPatient) {
      setCurrentPatient(sessionPatient ?? DEMO_PATIENTS[0]);
    }
  }, [currentPatient, sessionPatient, setCurrentPatient]);

  useEffect(() => {
    return () => {
      if (stepTimer.current) window.clearInterval(stepTimer.current);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleRouteUpdated = (payload) => {
      if (!payload || payload.patient_id !== patient.id) return;

      if (rerouteTimer.current) window.clearTimeout(rerouteTimer.current);

      reroutingRef.current = true;
      setIsRerouting(true);
      setRerouteNotice({
        facilityName:
          payload.selected_facility?.name ?? 'the nearest available facility',
        reason:
          payload.reason ?? 'Your previous facility is no longer available.',
      });

      rerouteTimer.current = window.setTimeout(() => {
        reroutingRef.current = false;
        setIsRerouting(false);
        setDisplayedFacility(payload.selected_facility ?? null);
        setRevealedRoute(payload);
        setRerouteNotice(null);
        rerouteTimer.current = null;
      }, 2000);
    };

    socket.on('ROUTE_UPDATED', handleRouteUpdated);

    return () => {
      socket.off('ROUTE_UPDATED', handleRouteUpdated);
      if (rerouteTimer.current) {
        window.clearTimeout(rerouteTimer.current);
        rerouteTimer.current = null;
      }
      reroutingRef.current = false;
    };
  }, [patient.id]);

  useEffect(() => {
    if (reroutingRef.current) return;

    if (!triageResult) {
      setDisplayedFacility(null);
      setRevealedRoute(null);
      return;
    }

    setDisplayedFacility(triageResult.selected_facility ?? null);
    setRevealedRoute(triageResult.route_update ?? null);
  }, [triageResult]);

  useEffect(() => {
    if (!videoRoom) return undefined;

    const handleCallAccepted = (payload) => {
      if (!payload || payload.room_id !== videoRoom) return;

      setVideoDoctor({
        name: payload.doctor_name ?? 'Clinician',
        specialty: payload.specialty ?? '',
      });
      setVideoStatus('active');
      setVideoError('');
    };

    const handleCallEnded = (payload) => {
      if (!payload || payload.room_id !== videoRoom) return;

      setVideoStatus('ended');
      setVideoEnding(false);
    };

    socket.on('VIDEO_CALL_ACCEPTED', handleCallAccepted);
    socket.on('VIDEO_CALL_ENDED', handleCallEnded);

    return () => {
      socket.off('VIDEO_CALL_ACCEPTED', handleCallAccepted);
      socket.off('VIDEO_CALL_ENDED', handleCallEnded);
    };
  }, [videoRoom]);

  const startThinkingSequence = () => {
    setThinkingSteps([]);
    let index = 0;

    if (stepTimer.current) window.clearInterval(stepTimer.current);

    stepTimer.current = window.setInterval(() => {
      index += 1;
      setThinkingSteps(THINKING_STEPS.slice(0, index));

      if (index >= THINKING_STEPS.length && stepTimer.current) {
        window.clearInterval(stepTimer.current);
      }
    }, 300);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    const previousResult = triageResult;
    const previousDismissedId = dismissedEncounterId;
    const previousSubmittedAt = submittedAt;

    resetVideo();

    if (rerouteTimer.current) {
      window.clearTimeout(rerouteTimer.current);
      rerouteTimer.current = null;
    }
    reroutingRef.current = false;
    setIsRerouting(false);
    setRerouteNotice(null);
    setDisplayedFacility(null);
    setRevealedRoute(null);
    setDismissedEncounterId(patientEncounter?.id ?? null);
    setAnalyzing(true);
    setError('');
    setTriageResult(null);
    setSubmittedAt(Date.now());
    startThinkingSequence();

    try {
      const [response] = await Promise.all([
        api.post('/triage/submit', {
          symptom_text: symptom.trim(),
        }),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);

      setTriageResult(response.data);
      setDismissedEncounterId(null);
      setAgentTrace(
        response.data.agent_trace ?? [],
        response.data.encounter_id ?? null
      );
    } catch (requestError) {
      // A failed submission must not erase the previous decision.
      setTriageResult(previousResult);
      setDismissedEncounterId(previousDismissedId);
      setSubmittedAt(previousSubmittedAt);
      setError(
        getApiErrorMessage(
          requestError,
          'The triage engine could not complete this request.'
        )
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    resetVideo();

    if (rerouteTimer.current) {
      window.clearTimeout(rerouteTimer.current);
      rerouteTimer.current = null;
    }
    reroutingRef.current = false;
    setIsRerouting(false);
    setRerouteNotice(null);
    setDisplayedFacility(null);
    setRevealedRoute(null);
    setSymptom('');
    setError('');
    setThinkingSteps([]);
    setSubmittedAt(null);
    setDismissedEncounterId(patientEncounter?.id ?? null);
    clearTriage();
  };

  const handleJoinVideo = async () => {
    if (videoStatus === 'connecting') return;

    setVideoStatus('connecting');
    setVideoError('');

    try {
      const { data } = await api.post('/video/create-room', {
        patient_id: patient.id,
        patient_name: patient.name,
        acuity: videoAcuity,
      });

      setVideoRoom(data.room_id ?? `TH-ROOM-${patient.id}`);
      setVideoStartedAt(Date.now());
      setVideoDoctor(null);
      setVideoStatus('waiting');
    } catch (requestError) {
      setVideoError(
        getApiErrorMessage(requestError, 'Unable to open the video consultation.')
      );
      setVideoStatus('idle');
    }
  };

  const handleEndVideo = async () => {
    if (!videoRoom || videoEnding) return;

    setVideoEnding(true);
    setVideoError('');

    const duration = videoStartedAt
      ? Math.max(0, Math.round((Date.now() - videoStartedAt) / 1000))
      : 0;

    try {
      await api.post('/video/end', {
        room_id: videoRoom,
        duration_sec: duration,
        prescription_sent: false,
      });
    } catch (requestError) {
      setVideoError(
        getApiErrorMessage(requestError, 'The call ended locally but the network did not confirm it.')
      );
    } finally {
      setVideoStatus('ended');
      setVideoEnding(false);
    }
  };

  const handleDismissVideo = () => {
    resetVideo();
  };

  const handleSignOut = () => {
    navigate('/logout', { replace: true });
  };

  const handleToggleMedication = (medicationId) => {
    setTakenMeds((previous) => ({
      ...previous,
      [medicationId]: !previous[medicationId],
    }));
  };

  const handleLogAll = () => {
    setTakenMeds(
      Object.fromEntries(medicationPlan.map((medication) => [medication.id, true]))
    );
  };

  const handleSaveCheckIn = () => {
    setCheckInSaved(true);

    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => {
      setCheckInSaved(false);
      savedTimer.current = null;
    }, 4000);
  };

  const handlePrompt = (prompt) => {
    setJournal((previous) => {
      const prefix = previous.trim() ? `${previous.trim()}\n\n` : '';
      return `${prefix}${prompt} `;
    });
  };

  const result = useMemo(() => {
    if (triageResult) return triageResult;
    if (!visibleEncounter) return null;

    return {
      patient_id: visibleEncounter.patient_id,
      encounter_id: visibleEncounter.id,
      status: visibleEncounter.status,
      acuity: visibleEncounter.acuity,
      care_tier: visibleEncounter.care_tier,
      protocol_matched: visibleEncounter.protocol_matched,
      selected_facility:
        visibleEncounter.route_update?.selected_facility !== undefined
          ? visibleEncounter.route_update.selected_facility
          : visibleEncounter.selected_facility ??
            visibleEncounter.facility_snapshot ??
            null,
      rejected_facilities: visibleEncounter.rejected_facilities ?? [],
      special_flags: visibleEncounter.special_flags ?? [],
      risk_modifiers: visibleEncounter.risk_modifiers ?? [],
      agent_rationale: visibleEncounter.agent_rationale ?? [],
      agent_trace: visibleEncounter.agent_trace ?? [],
      timeline: visibleEncounter.timeline ?? [],
      assigned_doctor_id: visibleEncounter.assigned_doctor_id ?? null,
      assigned_doctor_name: visibleEncounter.assigned_doctor_name ?? null,
      prescription: visibleEncounter.prescription ?? null,
      route_update: visibleEncounter.route_update ?? null,
      timestamp: visibleEncounter.created_at,
    };
  }, [triageResult, visibleEncounter]);
  const acuityMeta = result ? getAcuityMeta(result.acuity) : null;
  const routeUpdate = revealedRoute ?? result?.route_update ?? null;
  const selectedFacility = routeUpdate
    ? routeUpdate.selected_facility ?? null
    : displayedFacility ?? result?.selected_facility ?? null;
  const liveFacility = facilities.find(
    (facility) => facility.id === selectedFacility?.id
  );
  const facilityEta = selectedFacility?.eta_min ?? liveFacility?.eta_min ?? null;
  const facilityDistance =
    selectedFacility?.distance_km ?? liveFacility?.distance_km ?? null;
  const declinedFacilities = (result?.rejected_facilities ?? [])
    .filter((facility) => facility.id !== selectedFacility?.id)
    .filter(
      (facility, index, list) =>
        list.findIndex((entry) => entry.id === facility.id) === index
    );

  const takenCount = medicationPlan.filter(
    (medication) => takenMeds[medication.id]
  ).length;
  const todayAdherence = Math.round((takenCount / medicationPlan.length) * 100);
  const adherenceData = WEEKLY_ADHERENCE.map((entry, index) => ({
    ...entry,
    value: index === todayIndex() ? todayAdherence : entry.value,
    isToday: index === todayIndex(),
  }));
  const weeklyAverage = Math.round(
    adherenceData.reduce((sum, entry) => sum + entry.value, 0) /
      adherenceData.length
  );

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <PatientSidebar
        patient={patient}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSignOut={handleSignOut}
        socketConnected={socketConnected}
      />

      <div className="lg:pl-64">
        <PatientTopbar
          patient={patient}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSignOut={handleSignOut}
          socketConnected={socketConnected}
        />

        <AnimatePresence>
          {isRerouting && rerouteNotice && (
            <motion.div
              key="reroute-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              role="status"
              aria-live="assertive"
              className="sticky top-16 z-10 border-b border-signal-amber-border bg-signal-amber-soft"
            >
              <div className="mx-auto flex w-full max-w-[1200px] items-start gap-3 px-4 py-3 sm:px-6 lg:px-8">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-signal-amber-ink"
                />
                <div>
                  <p className="text-sm font-semibold text-signal-amber-ink">
                    Facility unavailable. Rerouting to{' '}
                    <span className="font-bold">{rerouteNotice.facilityName}</span>…
                  </p>
                  <p className="mt-1 text-xs leading-5 text-signal-amber-ink">
                    {rerouteNotice.reason}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {activeTab === 'chat' && (
            <TriageTab
              patient={patient}
              encounter={visibleEncounter}
              traceSteps={traceSteps}
              symptom={symptom}
              setSymptom={setSymptom}
              canSubmit={canSubmit}
              analyzing={analyzing}
              thinkingSteps={thinkingSteps}
              error={error}
              onSubmit={handleSubmit}
              onReset={handleReset}
              result={result}
              acuityMeta={acuityMeta}
              selectedFacility={selectedFacility}
              facilityEta={facilityEta}
              facilityDistance={facilityDistance}
              routeUpdate={routeUpdate}
              declinedFacilities={declinedFacilities}
              submittedAt={submittedAt}
              videoRoom={videoRoom}
              videoStatus={videoStatus}
              videoDoctor={videoDoctor}
              videoStartedAt={videoStartedAt}
              videoError={videoError}
              videoEnding={videoEnding}
              onJoinVideo={handleJoinVideo}
              onEndVideo={handleEndVideo}
              onDismissVideo={handleDismissVideo}
            />
          )}

          {activeTab === 'medications' && (
            <MedicationTab
              medicationPlan={medicationPlan}
              takenMeds={takenMeds}
              onToggleMedication={handleToggleMedication}
              onLogAll={handleLogAll}
              adherenceData={adherenceData}
              takenCount={takenCount}
              weeklyAverage={weeklyAverage}
            />
          )}

          {activeTab === 'mental-health' && (
            <MentalHealthTab
              mood={mood}
              onMoodChange={setMood}
              journal={journal}
              onJournalChange={setJournal}
              saved={checkInSaved}
              onSave={handleSaveCheckIn}
              onPrompt={handlePrompt}
            />
          )}
        </main>
      </div>
    </div>
  );
}
