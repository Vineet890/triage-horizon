import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Droplets,
  FileText,
  HeartPulse,
  Loader2,
  PhoneCall,
  Pill,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Stethoscope,
  Thermometer,
  Video,
  Wind,
  X,
} from 'lucide-react';
import api, { getApiErrorMessage } from '../lib/api';
import socket from '../lib/socket';
import { ACUITY_ORDER, getAcuityMeta, getCareTierLabel } from '../lib/clinical';
import {
  PATIENT_DIRECTORY,
  patientVitals,
} from '../lib/demoPatients';
import useTriageStore, {
  ACTIVE_ENCOUNTER_STATUSES,
} from '../store/useTriageStore';
import {
  cn,
  formatDate,
  formatRelativeTime,
  formatTime,
  initials,
} from '../lib/utils';
import AcuityBadge from '../components/AcuityBadge';
import AgentTrace from '../components/AgentTrace';
import ClinicalCard from '../components/ClinicalCard';
import EncounterRail from '../components/EncounterRail';
import NotificationPanel from '../components/NotificationPanel';
import PortalHeader from '../components/PortalHeader';
import SymptomDetailModal from '../components/SymptomDetailModal';
import TriageNotificationPopup from '../components/TriageNotificationPopup';
import VideoConsultation from '../components/VideoConsultation';

const VITAL_ICONS = {
  'Blood pressure': Activity,
  'Heart rate': HeartPulse,
  'Respiratory rate': Wind,
  'Oxygen saturation': Droplets,
  Temperature: Thermometer,
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

function Vital({ label, value }) {
  const Icon = VITAL_ICONS[label] ?? Activity;

  return (
    <div className="rounded-[6px] border border-border bg-surface-muted p-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1.5 font-mono text-sm font-semibold text-ink">
        {value}
      </dd>
    </div>
  );
}

function Metric({ label, value, detail, tone = 'default' }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </p>
      <p
        className={cn(
          'th-tabular mt-1 font-mono text-xl font-semibold leading-none tracking-[-0.02em]',
          tone === 'critical' ? 'text-signal-danger-ink' : 'text-ink'
        )}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-1.5 text-[10px] leading-4 text-ink-muted">{detail}</p>
      )}
    </div>
  );
}

function HandoffPanel({
  selectedId,
  careTier,
  handoff,
  loading,
  error,
  destination,
  destinationEta,
  routeUpdate,
  encounter,
  traceSteps,
  accepting,
  acceptError,
  onAcceptEncounter,
  canPrescribe,
  currentDoctorId,
  medication,
  onMedicationChange,
  dosage,
  onDosageChange,
  instructions,
  onInstructionsChange,
  sending,
  prescriptionError,
  prescriptionId,
  onSendPrescription,
  onAcceptVideo,
  callStatus,
}) {
  const [routeFlashing, setRouteFlashing] = useState(false);
  const [liveRoute, setLiveRoute] = useState(null);
  const routeFlashTimer = useRef(null);
  const handoffPatientId = handoff?.id ?? null;
  const isTelehealth = careTier === 'telehealth';

  // The handoff card owns its own flash and destination swap so the card can
  // turn amber and show the new facility the instant ROUTE_UPDATED lands,
  // without waiting for the handoff record to be refetched.
  useEffect(() => {
    const handleRouteUpdated = (payload) => {
      if (!handoffPatientId || payload?.patient_id !== handoffPatientId) return;

      setLiveRoute(payload);
      setRouteFlashing(true);

      if (routeFlashTimer.current) window.clearTimeout(routeFlashTimer.current);
      routeFlashTimer.current = window.setTimeout(() => {
        setRouteFlashing(false);
        routeFlashTimer.current = null;
      }, 1500);
    };

    socket.on('ROUTE_UPDATED', handleRouteUpdated);

    return () => {
      socket.off('ROUTE_UPDATED', handleRouteUpdated);
      if (routeFlashTimer.current) {
        window.clearTimeout(routeFlashTimer.current);
        routeFlashTimer.current = null;
      }
    };
  }, [handoffPatientId]);

  useEffect(() => {
    setRouteFlashing(false);
    setLiveRoute(null);
  }, [handoffPatientId]);

  if (!selectedId) {
    return (
      <ClinicalCard>
        <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-[6px] border border-border bg-surface-muted text-ink-muted">
            <Stethoscope aria-hidden="true" className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink">
            Select a patient
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-ink-muted">
            Choose a row from the incoming queue to review the clinical handoff and
            issue an e-prescription.
          </p>
        </div>
      </ClinicalCard>
    );
  }

  if (loading) {
    return (
      <ClinicalCard>
        <div className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-ink-secondary">
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-brand-strong" />
          Loading handoff record…
        </div>
      </ClinicalCard>
    );
  }

  if (error) {
    return (
      <ClinicalCard>
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[6px] border border-signal-danger-border bg-signal-danger-soft px-3 py-3 text-sm text-signal-danger-ink"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      </ClinicalCard>
    );
  }

  if (!handoff) return null;

  // The handoff snapshot can lag behind the encounter store during a reroute,
  // so the socket payload is the freshest destination until the refetch lands.
  const activeRoute = liveRoute ?? routeUpdate ?? null;
  const rerouteFailed =
    liveRoute?.reroute_status === 'NO_ALTERNATIVE_AVAILABLE';
  const activeDestination = rerouteFailed
    ? null
    : liveRoute?.selected_facility ?? destination ?? null;
  const activeEta = rerouteFailed
    ? null
    : liveRoute?.selected_facility?.eta_min ??
      liveRoute?.new_eta ??
      destinationEta ??
      null;

  // Keep the encounter rail in step with the destination swap; otherwise the
  // rail header would still name the facility the patient was rerouted away
  // from until the handoff record is refetched.
  const railEncounter = liveRoute
    ? {
        ...encounter,
        status: 'ROUTING',
        facility_id: rerouteFailed
          ? null
          : liveRoute.new_facility_id ?? encounter?.facility_id,
        facility_name: rerouteFailed
          ? 'Manual care coordination'
          : liveRoute.new_facility_name ?? encounter?.facility_name,
        selected_facility: rerouteFailed
          ? null
          : liveRoute.selected_facility ?? encounter?.selected_facility,
        updated_at: liveRoute.rerouted_at ?? encounter?.updated_at,
      }
    : encounter;

  const acuity = getAcuityMeta(handoff.handoff?.acuity);
  const vitals = patientVitals(handoff.id);
  const status = encounter?.status ?? handoff.handoff?.status ?? 'TRIAGED';
  const riskModifiers = handoff.handoff?.risk_modifiers ?? [];
  const assignedDoctorId =
    encounter?.assigned_doctor_id ??
    handoff.handoff?.assigned_doctor_id ??
    null;
  const assignedDoctorName =
    encounter?.assigned_doctor_name ??
    handoff.handoff?.assigned_doctor_name ??
    null;
  const awaitingAcceptance =
    !assignedDoctorId &&
    ['TRIAGED', 'ROUTING', 'AWAITING_ACCEPTANCE'].includes(status);
  const acceptedByOther = Boolean(
    assignedDoctorId && assignedDoctorId !== currentDoctorId
  );
  const hasAdherenceRisk = riskModifiers.some(
    (modifier) => modifier.key === 'adherence'
  );
  const hasMentalHealthContext = riskModifiers.some(
    (modifier) => modifier.key === 'mental_health'
  );

  return (
    <motion.div
      key={handoff.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-[6px] border border-border bg-surface"
    >
      <div className="space-y-3 border-b border-border p-4">
        <EncounterRail encounter={railEncounter} compact />
        <AgentTrace
          steps={traceSteps}
          title="Agent trace"
          emptyLabel="No agent steps recorded for this encounter."
        />
      </div>

      <div className="border-b border-border p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
            Handoff record
          </p>
          <AcuityBadge acuity={handoff.handoff?.acuity} />
        </div>

        <div className="mt-3 flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[6px] border border-brand-border bg-brand-soft text-sm font-semibold text-brand-strong">
            {initials(handoff.name)}
          </span>
          <div className="min-w-0">
            <h2 className="break-words text-xl font-semibold tracking-tight text-ink">
              {handoff.name}
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              <span className="font-mono text-xs">{handoff.display_id}</span> ·{' '}
              {handoff.age} years · {handoff.gender}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Care tier
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {getCareTierLabel(careTier)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Protocol
            </dt>
            <dd className="mt-1 text-sm font-medium leading-5 text-ink">
              {handoff.handoff?.protocol_matched}
            </dd>
          </div>
        </dl>

        <motion.dl
          layout
          transition={{ layout: { duration: 0.35, ease: 'easeOut' } }}
          className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4"
        >
          <div className="min-w-0">
            <dt className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Destination
              <AnimatePresence initial={false}>
                {activeRoute && (
                  <motion.span
                    key={activeRoute.rerouted_at ?? 'route-updated'}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-[4px] border border-signal-amber-border bg-signal-amber-soft px-1.5 py-0.5 text-[10px] font-semibold text-signal-amber-ink"
                  >
                    {routeFlashing
                      ? 'Updated just now'
                      : activeRoute.rerouted_at
                        ? `Updated ${formatRelativeTime(
                            activeRoute.rerouted_at
                          ).toLowerCase()}`
                        : 'Updated'}
                  </motion.span>
                )}
              </AnimatePresence>
            </dt>
            <dd className="mt-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={activeDestination?.id ?? 'manual-coordination'}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className={cn(
                    'block text-sm font-semibold leading-5 transition-colors duration-300',
                    routeFlashing ? 'text-signal-amber-ink' : 'text-ink'
                  )}
                >
                  {activeDestination?.name ?? 'Manual care coordination'}
                </motion.span>
              </AnimatePresence>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              ETA
            </dt>
            <dd className="mt-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`${activeDestination?.id ?? 'manual'}-${activeEta ?? 'unknown'}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className="block font-mono text-sm font-semibold text-ink"
                >
                  {activeEta != null ? `${activeEta} min` : '—'}
                </motion.span>
              </AnimatePresence>
            </dd>
          </div>
        </motion.dl>
      </div>

      {(awaitingAcceptance || assignedDoctorId || acceptError) && (
        <section className="border-b border-border p-6">
          {awaitingAcceptance ? (
            <div className="rounded-[6px] border border-signal-amber-border bg-signal-amber-soft p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-signal-amber-border bg-surface text-signal-amber-ink">
                    <Clock3 aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-signal-amber-ink">
                      Awaiting clinician acceptance
                    </p>
                    <p className="mt-1 text-xs leading-5 text-signal-amber-ink">
                      Accept this encounter to claim the case and unlock the
                      e-prescription and receiving-bed handoff.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onAcceptEncounter}
                  disabled={accepting}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[6px] border px-3 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30',
                    accepting
                      ? 'border-border bg-surface-strong text-ink-muted'
                      : 'border-brand bg-brand-solid text-white hover:bg-brand-solid-hover'
                  )}
                >
                  {accepting ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  )}
                  {accepting ? 'Accepting…' : 'Accept case'}
                </button>
              </div>

              {acceptError && (
                <p
                  role="alert"
                  className="mt-3 border-t border-signal-amber-border pt-3 text-xs font-medium text-signal-danger-ink"
                >
                  {acceptError}
                </p>
              )}
            </div>
          ) : acceptedByOther ? (
            <div className="flex items-start gap-3 rounded-[6px] border border-signal-amber-border bg-signal-amber-soft px-4 py-3">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-signal-amber-ink"
              />
              <div>
                <p className="text-sm font-semibold text-signal-amber-ink">
                  Assigned to {assignedDoctorName || 'another clinician'}
                </p>
                <p className="mt-1 text-xs leading-5 text-signal-amber-ink">
                  This case is read-only for you. Prescribing is limited to the
                  accepting clinician.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-[6px] border border-signal-success-border bg-signal-success-soft px-4 py-3">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-signal-success-ink"
              />
              <div>
                <p className="text-sm font-semibold text-signal-success-ink">
                  {assignedDoctorId === currentDoctorId
                    ? 'Assigned to you'
                    : `Accepted by ${
                        assignedDoctorName || 'the attending clinician'
                      }`}
                </p>
                <p className="mt-1 text-xs leading-5 text-signal-success-ink">
                  Prescription and receiving-facility handoff are unlocked.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {riskModifiers.length > 0 && (
        <section className="border-b border-border p-6">
          <div className="rounded-[6px] border border-signal-amber-border bg-signal-amber-soft p-4">
            <div className="flex flex-wrap items-center gap-2">
              <AlertCircle
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-signal-amber-ink"
              />
              <h3 className="text-sm font-semibold text-signal-amber-ink">
                Risk modifiers
              </h3>
              <span className="rounded-[3px] border border-signal-amber bg-signal-amber-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-signal-amber-ink">
                Review before disposition
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {riskModifiers.map((modifier) => (
                <li
                  key={`${modifier.key}-${modifier.label}`}
                  className="rounded-[4px] border border-signal-amber-border bg-surface px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-signal-amber-ink">
                      {modifier.label}
                    </span>
                    <span
                      className={cn(
                        'rounded-[3px] border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        modifier.level === 'HIGH'
                          ? 'border-signal-danger-border bg-signal-danger-soft text-signal-danger-ink'
                          : 'border-signal-amber bg-signal-amber-soft text-signal-amber-ink'
                      )}
                    >
                      {modifier.level}
                    </span>
                    {modifier.source && (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-signal-amber-ink">
                        {modifier.source}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-signal-amber-ink">
                    {modifier.detail}
                  </p>
                </li>
              ))}
            </ul>

            {hasAdherenceRisk && (
              <p className="mt-3 border-t border-signal-amber-border pt-3 text-xs leading-5 text-signal-amber-ink">
                <span className="font-semibold">Adherence escalation:</span>{' '}
                missing or low adherence is treated as uncontrolled disease until
                verified. Confirm the medication history before finalising this
                plan.
              </p>
            )}
            {hasMentalHealthContext && (
              <p className="mt-2 text-xs leading-5 text-signal-amber-ink">
                <span className="font-semibold">Mental-health routing:</span>{' '}
                this context routes the patient to the least restrictive safe
                pathway. Confirm telehealth or mental-health-clinic follow-up
                before discharge.
              </p>
            )}
          </div>
        </section>
      )}

      <div className="divide-y divide-border">
        <section className="p-6">
          <div className="rounded-[6px] border border-brand-border bg-brand-soft p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-brand-border bg-surface text-brand-strong">
                <Video aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-brand-strong">
                  {isTelehealth ? 'Telehealth consultation' : 'Video consultation'}
                </h3>
                <p className="mt-1 text-xs leading-5 text-brand-strong">
                  {isTelehealth
                    ? 'This patient was routed to telehealth. Open the secure Jitsi room when you are ready to see them.'
                    : 'Start a secure video visit for this patient. The routed destination still applies for in-person care.'}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAcceptVideo}
                disabled={callStatus === 'connecting' || callStatus === 'active'}
                className={cn(
                  'inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border px-3 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30',
                  callStatus === 'connecting' || callStatus === 'active'
                    ? 'border-border bg-surface-strong text-ink-muted'
                    : 'border-brand bg-brand-solid text-white hover:bg-brand-solid-hover'
                )}
              >
                {callStatus === 'connecting' ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <PhoneCall aria-hidden="true" className="h-4 w-4" />
                )}
                {callStatus === 'active'
                  ? 'Video call in progress'
                  : callStatus === 'connecting'
                    ? 'Connecting…'
                    : 'Accept Video Call'}
              </button>
              <span className="font-mono text-[10px] text-brand-strong">
                TH-ROOM-{handoff.id}
              </span>
            </div>
          </div>
        </section>

        <section className="p-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <FileText aria-hidden="true" className="h-4 w-4 text-brand-strong" />
            Presenting complaint
          </h3>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            {handoff.handoff?.symptoms?.[0] ?? 'No presenting complaint recorded.'}
          </p>
        </section>

        {vitals && (
          <section className="p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">Vitals</h3>
              <span className="text-xs text-ink-muted">Synthetic demo values</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2.5">
              <Vital label="Blood pressure" value={vitals.blood_pressure} />
              <Vital label="Heart rate" value={vitals.heart_rate} />
              <Vital label="Respiratory rate" value={vitals.respiratory_rate} />
              <Vital label="Oxygen saturation" value={vitals.oxygen_saturation} />
              <Vital label="Temperature" value={vitals.temperature} />
            </dl>
          </section>
        )}

        <section className="p-6">
          <h3 className="text-sm font-semibold text-ink">Recommended actions</h3>
          <ol className="mt-3 space-y-2">
            {handoff.handoff?.recommended_actions?.map((action, index) => (
              <li key={action} className="flex gap-2.5 text-sm leading-6 text-ink-secondary">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-brand-border bg-brand-soft text-[10px] font-semibold text-brand-strong">
                  {index + 1}
                </span>
                {action}
              </li>
            ))}
          </ol>
        </section>

        <section className="p-6">
          <h3 className="text-sm font-semibold text-ink">History</h3>
          <dl className="mt-3 space-y-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Conditions
              </dt>
              <dd className="mt-1 text-sm leading-6 text-ink">
                {handoff.conditions?.length > 0
                  ? handoff.conditions.join(', ')
                  : 'None recorded'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Medications
              </dt>
              <dd className="mt-1 text-sm leading-6 text-ink">
                {handoff.medications?.length > 0
                  ? handoff.medications.join('; ')
                  : 'None recorded'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Allergies
              </dt>
              <dd className="mt-1 text-sm font-medium leading-6 text-signal-danger-ink">
                {handoff.allergies?.length > 0
                  ? handoff.allergies.join(', ')
                  : 'None recorded'}
              </dd>
            </div>
          </dl>

          {handoff.previous_visits?.length > 0 && (
            <>
              <ul className="mt-4 divide-y divide-border rounded-[6px] border border-border sm:hidden">
                {handoff.previous_visits.map((visit) => (
                  <li
                    key={`${visit.date}-${visit.facility}`}
                    className="px-3 py-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-xs font-medium text-ink">
                        {visit.facility}
                      </p>
                      <p className="shrink-0 font-mono text-[10px] text-ink-muted">
                        {formatDate(visit.date)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-secondary">
                      {visit.reason}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-4 hidden overflow-x-auto rounded-[6px] border border-border sm:block">
              <table className="w-full min-w-[380px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-surface-muted">
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Date
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Facility
                    </th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {handoff.previous_visits.map((visit) => (
                    <tr
                      key={`${visit.date}-${visit.facility}`}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-secondary">
                        {formatDate(visit.date)}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink">
                        {visit.facility}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-secondary">
                        {visit.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>

        {handoff.handoff?.special_flags?.length > 0 && (
          <section className="p-6">
            <h3 className="text-sm font-semibold text-ink">Clinical flags</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {handoff.handoff.special_flags.map((flag) => (
                <li
                  key={flag}
                  className="rounded-[4px] border border-signal-amber-border bg-signal-amber-soft px-2 py-1 text-xs font-medium text-signal-amber-ink"
                >
                  {flag.replaceAll('_', ' ')}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="p-6">
          <div className="flex items-start gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border border-brand-border bg-brand-soft text-brand-strong">
              <Pill aria-hidden="true" className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">E-prescription</h3>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                Issue a prescription for {handoff.name}. It is broadcast to the
                patient portal.
              </p>
            </div>
          </div>

          {!canPrescribe && (
            <p className="mt-3 rounded-[4px] border border-signal-amber-border bg-signal-amber-soft px-3 py-2 text-xs leading-5 text-signal-amber-ink">
              {acceptedByOther
                ? `This case is assigned to ${assignedDoctorName || 'another clinician'}. Prescribing is disabled.`
                : 'Accept the encounter before issuing a prescription.'}
            </p>
          )}

          <form onSubmit={onSendPrescription} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="medication"
                  className="block text-xs font-medium text-ink-secondary"
                >
                  Medication name
                </label>
                <input
                  id="medication"
                  name="medication"
                  type="text"
                  required
                  disabled={!canPrescribe}
                  value={medication}
                  onChange={(event) => onMedicationChange(event.target.value)}
                  placeholder="e.g. Salbutamol inhaler"
                  className="mt-1.5 h-10 w-full rounded-[6px] border border-border-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted transition-all duration-200 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div>
                <label
                  htmlFor="dosage"
                  className="block text-xs font-medium text-ink-secondary"
                >
                  Dosage
                </label>
                <input
                  id="dosage"
                  name="dosage"
                  type="text"
                  required
                  disabled={!canPrescribe}
                  value={dosage}
                  onChange={(event) => onDosageChange(event.target.value)}
                  placeholder="e.g. 2 puffs PRN"
                  className="mt-1.5 h-10 w-full rounded-[6px] border border-border-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted transition-all duration-200 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="instructions"
                className="block text-xs font-medium text-ink-secondary"
              >
                Instructions
              </label>
              <textarea
                id="instructions"
                name="instructions"
                rows={2}
                disabled={!canPrescribe}
                value={instructions}
                onChange={(event) => onInstructionsChange(event.target.value)}
                placeholder="Additional directions for the patient"
                className="mt-1.5 w-full resize-y rounded-[6px] border border-border-strong bg-surface p-2.5 text-sm leading-6 text-ink placeholder:text-ink-muted transition-all duration-200 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div aria-live="polite">
              {prescriptionId && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-signal-success-ink">
                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                  Prescription{' '}
                  <span className="font-mono text-ink">{prescriptionId}</span>{' '}
                  sent.
                </p>
              )}
              {prescriptionError && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-signal-danger-ink">
                  <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
                  {prescriptionError}
                </p>
              )}
              {!prescriptionId && !prescriptionError && (
                <p className="text-xs text-ink-muted">
                  Recorded against the selected patient.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={sending || !canPrescribe}
              className={cn(
                'inline-flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20',
                sending || !canPrescribe
                  ? 'border-border bg-surface-strong text-ink-muted'
                  : 'border-brand bg-brand-solid text-white hover:bg-brand-solid-hover'
              )}
            >
              {sending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Send aria-hidden="true" className="h-4 w-4" />
              )}
              {sending ? 'Sending…' : 'Send prescription'}
            </button>
          </form>
        </section>

        <div className="flex items-start gap-2 p-6 text-xs leading-5 text-ink-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Acuity category{' '}
          <span className="font-semibold text-ink">{acuity.code}</span>. Vitals
          are synthetic and provided for interface demonstration only.
        </div>
      </div>
    </motion.div>
  );
}

export default function DoctorPortal() {
  const queue = useTriageStore((state) => state.queue);
  const encounters = useTriageStore((state) => state.encounters);
  const facilities = useTriageStore((state) => state.facilities);
  const addTriageEvent = useTriageStore((state) => state.addTriageEvent);
  const setEncounters = useTriageStore((state) => state.setEncounters);
  const upsertEncounter = useTriageStore((state) => state.upsertEncounter);
  const triageNotifications = useTriageStore(
    (state) => state.triageNotifications
  );
  const addTriageNotification = useTriageStore(
    (state) => state.addTriageNotification
  );
  const agentTrace = useTriageStore((state) => state.agentTrace);
  const agentTraceEncounterId = useTriageStore(
    (state) => state.agentTraceEncounterId
  );
  const socketConnected = useTriageStore((state) => state.socketConnected);
  const auth = useTriageStore((state) => state.auth);
  const doctorName = auth?.name || 'Dr. Mira Sen';
  const doctorSpecialty = auth?.specialty || 'Emergency Medicine';

  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [selectedModalNotification, setSelectedModalNotification] = useState(null);

  const unreadNotificationsCount = useMemo(
    () => triageNotifications.filter((n) => !n.read).length,
    [triageNotifications]
  );

  const [selectedId, setSelectedId] = useState('');

  const handleSelectPatientFromNotification = (patientId) => {
    if (!patientId) return;
    setSelectedId(patientId);
  };

  const handleOpenSymptomModal = (notification) => {
    setSelectedModalNotification(notification);
  };
  const [newIds, setNewIds] = useState(() => new Set());
  const highlightTimers = useRef(new Map());
  const [handoff, setHandoff] = useState(null);
  const [loadingHandoff, setLoadingHandoff] = useState(false);
  const [handoffError, setHandoffError] = useState('');
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [queueError, setQueueError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  const [medication, setMedication] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [sending, setSending] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState('');
  const [prescriptionId, setPrescriptionId] = useState('');

  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [callError, setCallError] = useState('');
  const [callEnding, setCallEnding] = useState(false);
  const activeRoomRef = useRef('');
  const incomingRoomRef = useRef('');

  useEffect(() => {
    activeRoomRef.current = activeCall?.room_id ?? '';
    incomingRoomRef.current = incomingCall?.room_id ?? '';
  }, [activeCall, incomingCall]);

  const activeEncounters = useMemo(
    () =>
      encounters.filter((encounter) =>
        ACTIVE_ENCOUNTER_STATUSES.includes(encounter.status)
      ),
    [encounters]
  );

  // The shared encounter list is the source of truth after a refresh. The
  // socket queue is still merged in for its arrival timestamp and highlight.
  // Only the newest encounter per patient is shown, so a superseded case cannot
  // produce a duplicate row or React key.
  const queueRows = useMemo(() => {
    const source =
      activeEncounters.length > 0
        ? activeEncounters
        : queue.filter(
            (entry) =>
              !entry.status || ACTIVE_ENCOUNTER_STATUSES.includes(entry.status)
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

    return Array.from(latestByPatient.values()).map((encounter) => {
      const liveEntry = queue.find(
        (entry) => entry.patient_id === encounter.patient_id
      );

      return {
        ...liveEntry,
        ...encounter,
        received_at:
          encounter.created_at ??
          liveEntry?.received_at ??
          encounter.updated_at,
      };
    });
  }, [activeEncounters, queue]);

  const sortedQueue = useMemo(() => {
    return [...queueRows].sort((a, b) => {
      const acuityDelta =
        (ACUITY_ORDER[a.acuity] ?? 9) - (ACUITY_ORDER[b.acuity] ?? 9);
      if (acuityDelta !== 0) return acuityDelta;

      return new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
    });
  }, [queueRows]);

  const criticalCount = sortedQueue.filter(
    (entry) => entry.acuity === 'CRITICAL'
  ).length;
  const selectedEntry =
    sortedQueue.find((entry) => entry.patient_id === selectedId) ?? null;
  const currentHandoff = handoff?.id === selectedId ? handoff : null;
  // Prefer the live shared encounter over the handoff snapshot. Socket updates
  // (acceptance by another clinician, reroute, prescription) land in the store
  // first; the snapshot is only a fallback when the case has left the queue.
  const selectedEncounter =
    selectedEntry ?? currentHandoff?.handoff?.encounter ?? null;
  const selectedCareTier = selectedEncounter?.care_tier ?? null;
  const destination = selectedEncounter?.selected_facility ?? null;
  const destinationEta =
    destination?.eta_min ??
    facilities.find((facility) => facility.id === destination?.id)?.eta_min ??
    null;
  const canPrescribe = Boolean(
    selectedEncounter &&
      selectedEncounter.assigned_doctor_id === auth?.userId &&
      ['ACCEPTED', 'EN_ROUTE'].includes(selectedEncounter.status)
  );
  const traceSteps = useMemo(() => {
    if (!selectedEncounter) return [];

    if (
      agentTrace.length > 0 &&
      agentTraceEncounterId === selectedEncounter.id
    ) {
      return agentTrace;
    }

    return selectedEncounter.agent_trace ?? [];
  }, [agentTrace, agentTraceEncounterId, selectedEncounter]);

  useEffect(() => {
    let active = true;

    api
      .get('/encounters?active=true')
      .then(({ data }) => {
        if (active) setEncounters(data.encounters ?? data);
      })
      .catch(() => {
        // The socket stream and the local queue remain the fallback.
      });

    return () => {
      active = false;
    };
  }, [setEncounters]);

  useEffect(() => {
    const timers = highlightTimers.current;

    const handleTriageComplete = (payload) => {
      if (!payload?.patient_id) return;

      addTriageNotification(payload);

      setNewIds((previous) => new Set(previous).add(payload.patient_id));

      const existing = timers.get(payload.patient_id);
      if (existing) window.clearTimeout(existing);

      const timer = window.setTimeout(() => {
        setNewIds((previous) => {
          const next = new Set(previous);
          next.delete(payload.patient_id);
          return next;
        });
        timers.delete(payload.patient_id);
      }, 3200);

      timers.set(payload.patient_id, timer);
    };

    socket.on('TRIAGE_COMPLETE', handleTriageComplete);

    return () => {
      socket.off('TRIAGE_COMPLETE', handleTriageComplete);
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, [addTriageNotification]);

  useEffect(() => {
    const handleCallInitiated = (payload) => {
      if (!payload?.room_id) return;

      if (activeRoomRef.current) {
        setCallError(
          'A consultation is already in progress. End it before accepting another call.'
        );
        return;
      }

      setIncomingCall(payload);
      setCallError('');

      if (payload.patient_id) {
        setSelectedId(payload.patient_id);
      }

      setCallStatus('incoming');
    };

    const handleCallEnded = (payload) => {
      if (!payload?.room_id) return;

      if (activeRoomRef.current === payload.room_id) {
        setCallStatus('ended');
        setCallEnding(false);
        return;
      }

      if (incomingRoomRef.current === payload.room_id) {
        setIncomingCall(null);
        setCallStatus('idle');
        setCallError('The patient left the waiting room before the call was accepted.');
      }
    };

    socket.on('VIDEO_CALL_INITIATED', handleCallInitiated);
    socket.on('VIDEO_CALL_ENDED', handleCallEnded);

    return () => {
      socket.off('VIDEO_CALL_INITIATED', handleCallInitiated);
      socket.off('VIDEO_CALL_ENDED', handleCallEnded);
    };
  }, []);

  useEffect(() => {
    if (!selectedId && sortedQueue.length > 0) {
      setSelectedId(sortedQueue[0].patient_id);
    }
  }, [selectedId, sortedQueue]);

  useEffect(() => {
    if (!selectedId) {
      setHandoff(null);
      return undefined;
    }

    let active = true;
    setLoadingHandoff(true);
    setHandoffError('');
    setPrescriptionId('');
    setPrescriptionError('');
    setAcceptError('');

    api
      .get(`/handoff/${selectedId}`)
      .then(({ data }) => {
        if (active) setHandoff(data);
      })
      .catch((requestError) => {
        if (active) {
          setHandoff(null);
          setHandoffError(
            getApiErrorMessage(requestError, 'Unable to load the handoff record.')
          );
        }
      })
      .finally(() => {
        if (active) setLoadingHandoff(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  const handleLoadDemoQueue = async () => {
    if (loadingDemo) return;

    setLoadingDemo(true);
    setQueueError('');

    try {
      const { data } = await api.post('/triage/demo-seed');
      const seeded = data.encounters ?? [];

      seeded.forEach((encounter) => {
        addTriageEvent(encounter);
        addTriageNotification(encounter);
      });

      const critical = seeded.find(
        (encounter) => encounter.acuity === 'CRITICAL'
      );
      if (critical) setSelectedId(critical.patient_id);
    } catch (requestError) {
      setQueueError(
        getApiErrorMessage(requestError, 'Unable to load the demo triage queue.')
      );
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleAcceptEncounter = async () => {
    const encounterId = selectedEncounter?.id;

    if (!encounterId || accepting) return;

    setAccepting(true);
    setAcceptError('');

    try {
      const { data } = await api.post(`/encounters/${encounterId}/accept`, {});
      const updated = data.encounter;

      upsertEncounter(updated);
      setHandoff((previous) =>
        previous
          ? {
              ...previous,
              handoff: {
                ...previous.handoff,
                encounter: updated,
                encounter_id: updated.id,
                status: updated.status,
                assigned_doctor_id: updated.assigned_doctor_id,
                assigned_doctor_name: updated.assigned_doctor_name,
                timeline: updated.timeline,
                agent_trace: updated.agent_trace,
                agent_rationale: updated.agent_rationale,
              },
            }
          : previous
      );
    } catch (requestError) {
      setAcceptError(
        getApiErrorMessage(requestError, 'The encounter could not be accepted.')
      );
    } finally {
      setAccepting(false);
    }
  };

  const handleSendPrescription = async (event) => {
    event.preventDefault();

    const encounterId = selectedEncounter?.id;

    if (!selectedId || sending) return;

    if (!encounterId || !canPrescribe) {
      setPrescriptionError(
        'Accept the encounter before issuing a prescription.'
      );
      return;
    }

    setSending(true);
    setPrescriptionError('');
    setPrescriptionId('');

    try {
      const { data } = await api.post(
        `/encounters/${encounterId}/prescribe`,
        {
          medications: [{ name: medication.trim(), dosage: dosage.trim() }],
          instructions: instructions.trim(),
        }
      );

      upsertEncounter(data.encounter);
      setHandoff((previous) =>
        previous
          ? {
              ...previous,
              handoff: {
                ...previous.handoff,
                encounter: data.encounter,
                encounter_id: data.encounter.id,
                status: data.encounter.status,
                prescription: data.prescription,
                timeline: data.encounter.timeline,
              },
            }
          : previous
      );

      setPrescriptionId(data.prescription_id);
      setMedication('');
      setDosage('');
      setInstructions('');
    } catch (requestError) {
      setPrescriptionError(
        getApiErrorMessage(requestError, 'The prescription could not be sent.')
      );
    } finally {
      setSending(false);
    }
  };

  const handleAcceptVideo = async (call = null) => {
    if (callStatus === 'connecting' || callStatus === 'active') return;

    const incomingForSelected =
      call && call.room_id
        ? call
        : incomingCall && (!selectedId || incomingCall.patient_id === selectedId)
          ? incomingCall
          : null;

    const roomId =
      incomingForSelected?.room_id ??
      (selectedId ? `TH-ROOM-${selectedId}` : incomingCall?.room_id ?? '');

    if (!roomId) return;

    const patientId =
      incomingForSelected?.patient_id ?? selectedId ?? incomingCall?.patient_id ?? '';
    const patientName =
      incomingForSelected?.patient_name ??
      handoff?.name ??
      PATIENT_DIRECTORY[patientId]?.name ??
      patientId;

    setCallStatus('connecting');
    setCallError('');

    try {
      await api.post('/video/accept', {
        room_id: roomId,
        doctor_name: doctorName,
        specialty: doctorSpecialty,
      });

      activeRoomRef.current = roomId;
      incomingRoomRef.current = '';

      setActiveCall({
        room_id: roomId,
        patient_id: patientId,
        patient_name: patientName,
        started_at: Date.now(),
      });
      setIncomingCall(null);
      setCallStatus('active');
    } catch (requestError) {
      setCallError(
        getApiErrorMessage(requestError, 'Unable to accept the video consultation.')
      );
      setCallStatus(incomingCall ? 'incoming' : 'idle');
    }
  };

  const handleEndCall = async () => {
    if (!activeCall || callEnding) return;

    setCallEnding(true);
    setCallError('');

    const duration = activeCall.started_at
      ? Math.max(0, Math.round((Date.now() - activeCall.started_at) / 1000))
      : 0;

    try {
      await api.post('/video/end', {
        room_id: activeCall.room_id,
        duration_sec: duration,
        prescription_sent: Boolean(prescriptionId),
      });
    } catch (requestError) {
      setCallError(
        getApiErrorMessage(
          requestError,
          'The call ended locally but the network did not confirm it.'
        )
      );
    } finally {
      setCallStatus('ended');
      setCallEnding(false);
    }
  };

  const handleDeclineCall = async () => {
    if (!incomingCall) return;

    const roomId = incomingCall.room_id;

    incomingRoomRef.current = '';
    setIncomingCall(null);
    setCallStatus('idle');
    setCallError('');

    try {
      await api.post('/video/end', {
        room_id: roomId,
        duration_sec: 0,
        prescription_sent: false,
      });
    } catch {
      // The local banner is already dismissed.
    }
  };

  const handleCloseCall = () => {
    activeRoomRef.current = '';
    incomingRoomRef.current = '';
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus('idle');
    setCallError('');
    setCallEnding(false);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <PortalHeader
        roleLabel="Physician command"
        userName={doctorName}
        homePath="/doctor"
      >
        <button
          type="button"
          onClick={() => setNotificationPanelOpen((prev) => !prev)}
          aria-label={`Triage notifications${unreadNotificationsCount > 0 ? `, ${unreadNotificationsCount} unread` : ''}`}
          aria-expanded={notificationPanelOpen}
          className="relative inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] border border-forest-border bg-white/5 px-2.5 text-sm font-medium text-forest-ink transition-colors duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand/30 sm:px-3"
        >
          <Bell
            aria-hidden="true"
            className={cn(
              'h-4 w-4',
              unreadNotificationsCount > 0 && 'text-forest-accent animate-pulse'
            )}
          />
          <span className="hidden sm:inline">Alerts</span>
          {unreadNotificationsCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-signal-danger px-1.5 text-[10px] font-bold text-white shadow-xs">
              {unreadNotificationsCount}
            </span>
          )}
        </button>
      </PortalHeader>

      <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
              Clinical command
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Physician triage queue
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-secondary sm:text-base">
              Patients are ordered by Manchester acuity. Select a row to review the
              full handoff record and issue a prescription.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-border bg-border sm:grid-cols-4">
            <Metric label="In queue" value={sortedQueue.length} detail="Live cases" />
            <Metric
              label="Critical"
              value={criticalCount}
              detail="Immediate priority"
              tone="critical"
            />
            <button
              type="button"
              onClick={() => setNotificationPanelOpen(true)}
              className="bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand/30 group"
            >
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted flex items-center justify-between">
                <span>Triage Alerts</span>
                {unreadNotificationsCount > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-signal-danger animate-ping" />
                )}
              </p>
              <p
                className={cn(
                  'th-tabular mt-1 font-mono text-xl font-semibold leading-none tracking-[-0.02em] flex items-center gap-1.5',
                  unreadNotificationsCount > 0 ? 'text-signal-high-ink' : 'text-ink'
                )}
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationsCount}
                <span className="text-xs font-normal text-ink-muted">unread</span>
              </p>
              <p className="mt-1.5 text-[10px] leading-4 text-brand-strong group-hover:underline">
                Open panel →
              </p>
            </button>
            <div className="bg-surface px-4 py-3">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Feed
              </p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-xl font-semibold leading-none tracking-[-0.02em] text-ink">
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-[2px]',
                    socketConnected ? 'bg-signal-success' : 'bg-signal-amber'
                  )}
                />
                {socketConnected ? 'Live' : 'Off'}
              </p>
              <p className="mt-1.5 text-[10px] leading-4 text-ink-muted">
                Socket.IO
              </p>
            </div>
          </div>
        </div>

        {activeCall && (callStatus === 'active' || callStatus === 'ended') && (
          <div className="mt-6">
            <VideoConsultation
              roomId={activeCall.room_id}
              status={callStatus === 'ended' ? 'ended' : 'active'}
              displayName={doctorName}
              participant={activeCall.patient_name}
              startedAt={activeCall.started_at}
              error={callError}
              ending={callEnding}
              title={
                selectedCareTier === 'telehealth'
                  ? 'Telehealth consultation'
                  : 'Video consultation'
              }
              onEnd={handleEndCall}
              onClose={handleCloseCall}
            />
          </div>
        )}

        {incomingCall && callStatus === 'incoming' && (
          <div className="sticky top-16 z-20 mt-5 flex flex-col gap-3 rounded-[6px] border border-brand-border bg-brand-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-brand-border bg-surface text-brand-strong">
                <PhoneCall aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-strong">
                  Incoming video consultation
                </p>
                <p className="mt-1 text-sm leading-6 text-brand-strong">
                  <span className="font-semibold">
                    {incomingCall.patient_name ??
                      PATIENT_DIRECTORY[incomingCall.patient_id]?.name ??
                      'Patient'}
                  </span>{' '}
                  is waiting in the secure room{' '}
                  <span className="font-mono">{incomingCall.room_id}</span>.
                </p>
                {callError && (
                  <p
                    role="alert"
                    className="mt-1 text-[13px] font-medium text-signal-danger-ink"
                  >
                    {callError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDeclineCall}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                Decline
              </button>
              <button
                type="button"
                onClick={() => handleAcceptVideo(incomingCall)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-brand bg-brand-solid px-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-solid-hover focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <PhoneCall aria-hidden="true" className="h-4 w-4" />
                Accept Video Call
              </button>
            </div>
          </div>
        )}

        {callError && !activeCall && !incomingCall && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-[6px] border border-signal-danger-border bg-signal-danger-soft px-3 py-3 text-sm text-signal-danger-ink"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {callError}
          </div>
        )}

        {queueError && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-[6px] border border-signal-danger-border bg-signal-danger-soft px-3 py-3 text-sm text-signal-danger-ink"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {queueError}
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(380px,2fr)]">
          <ClinicalCard className="min-w-0 overflow-hidden p-0 xl:self-start">
            <div className="flex flex-col gap-3 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-ink">
                    Incoming queue
                  </h2>
                  <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-brand-border bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-strong">
                    <Radio aria-hidden="true" className="h-3 w-3" />
                    Live
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  Sorted by acuity · CRITICAL first · {sortedQueue.length} active
                </p>
              </div>

              <button
                type="button"
                onClick={handleLoadDemoQueue}
                disabled={loadingDemo}
                className="inline-flex h-9 w-fit items-center gap-2 rounded-[6px] border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-all duration-200 hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                {loadingDemo ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                )}
                {loadingDemo ? 'Loading…' : 'Load demo queue'}
              </button>
            </div>

            {sortedQueue.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-[6px] border border-border bg-surface-muted text-ink-muted">
                  <ClipboardList aria-hidden="true" className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">
                  Queue is clear
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-ink-muted">
                  Completed patient assessments arrive here automatically. Load the
                  three synthetic cases to populate the queue.
                </p>
                <button
                  type="button"
                  onClick={handleLoadDemoQueue}
                  disabled={loadingDemo}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-[6px] border border-brand bg-brand-solid px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-solid-hover focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  {loadingDemo && (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  )}
                  Load demo queue
                </button>
              </div>
            ) : (
              <>
                {/* Phones get a full-width case list; the table's four
                    columns never need a horizontal scroll. */}
                <ul className="divide-y divide-border md:hidden">
                  {sortedQueue.map((entry) => {
                    const patient = PATIENT_DIRECTORY[entry.patient_id];
                    const isSelected = selectedId === entry.patient_id;
                    const isNew = newIds.has(entry.patient_id);

                    return (
                      <li key={entry.patient_id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(entry.patient_id)}
                          aria-pressed={isSelected}
                          className={cn(
                            'flex w-full flex-col gap-2.5 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/30',
                            isSelected && 'bg-brand-soft',
                            isNew && 'bg-signal-success-soft'
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <AcuityBadge acuity={entry.acuity} />
                            <span className="font-mono text-[10px] text-ink-muted">
                              {formatRelativeTime(entry.received_at)}
                            </span>
                          </span>

                          <span className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                'grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border text-[10px] font-semibold',
                                isSelected
                                  ? 'border-brand-border bg-surface text-brand-strong'
                                  : 'border-border bg-surface-muted text-ink-secondary'
                              )}
                            >
                              {initials(patient?.name ?? entry.patient_id)}
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-ink">
                                  {patient?.name ?? entry.patient_id}
                                </span>
                                {isNew && (
                                  <span className="shrink-0 rounded-[3px] border border-brand-border bg-brand-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-strong">
                                    New
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block font-mono text-[10px] text-ink-muted">
                                {patient?.display_id ?? entry.patient_id}
                              </span>
                            </span>
                          </span>

                          <span className="line-clamp-2 text-xs leading-5 text-ink-secondary">
                            {entry.symptom ?? 'Symptom narrative recorded'}
                          </span>

                          <span className="flex items-center justify-between gap-2 text-[10px] text-ink-muted">
                            <span className="truncate">
                              {getCareTierLabel(entry.care_tier)} ·{' '}
                              {STATUS_LABELS[entry.status] ?? entry.status ?? 'Triaged'}
                            </span>
                            <span className="shrink-0 font-mono">
                              {formatTime(entry.received_at)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="hidden max-h-[calc(100vh-260px)] overflow-auto md:block">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-surface-muted">
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Acuity
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Patient ID
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Symptom
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQueue.map((entry) => {
                      const patient = PATIENT_DIRECTORY[entry.patient_id];
                      const isSelected = selectedId === entry.patient_id;
                      const isNew = newIds.has(entry.patient_id);

                      return (
                        <motion.tr
                          key={entry.patient_id}
                          layout="position"
                          initial={isNew ? { opacity: 0, x: -24 } : false}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.28, ease: 'easeOut' }}
                          role="button"
                          tabIndex={0}
                          aria-selected={isSelected}
                          onClick={() => setSelectedId(entry.patient_id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedId(entry.patient_id);
                            }
                          }}
                          className={cn(
                            'cursor-pointer border-b border-border transition-colors duration-200 last:border-b-0 hover:bg-surface-muted',
                            isSelected && 'bg-brand-soft',
                            isNew && 'bg-signal-success-soft'
                          )}
                        >
                          <td className="px-4 py-3.5">
                            <AcuityBadge acuity={entry.acuity} />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  'grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border text-[10px] font-semibold',
                                  isSelected
                                    ? 'border-brand-border bg-surface text-brand-strong'
                                    : 'border-border bg-surface-muted text-ink-secondary'
                                )}
                              >
                                {initials(patient?.name ?? entry.patient_id)}
                              </span>
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink">
                                  {patient?.name ?? entry.patient_id}
                                  {isNew && (
                                    <span className="shrink-0 rounded-[3px] border border-brand-border bg-brand-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-strong">
                                      New
                                    </span>
                                  )}
                                </p>
                                <p className="mt-0.5 font-mono text-xs text-ink-muted">
                                  {patient?.display_id ?? entry.patient_id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-[320px] px-4 py-3.5">
                            <p className="truncate text-sm text-ink-secondary">
                              {entry.symptom ?? 'Symptom narrative recorded'}
                            </p>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              {getCareTierLabel(entry.care_tier)} ·{' '}
                              {STATUS_LABELS[entry.status] ?? entry.status ?? 'Triaged'}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <p className="font-mono text-xs text-ink-secondary">
                              {formatTime(entry.received_at)}
                            </p>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              {formatRelativeTime(entry.received_at)}
                            </p>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}

            <div className="flex flex-col gap-2 border-t border-border bg-surface-muted px-6 py-3 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-[1px] bg-brand-solid"
                />
                New triage events slide in and highlight briefly.
              </span>
              <span className="flex items-center gap-1.5">
                <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                Updated in real time
              </span>
            </div>
          </ClinicalCard>

          <div className="min-w-0 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
            <HandoffPanel
              selectedId={selectedId}
              careTier={selectedEncounter?.care_tier ?? selectedEntry?.care_tier}
              handoff={handoff}
              loading={loadingHandoff}
              error={handoffError}
              destination={destination}
              destinationEta={destinationEta}
              routeUpdate={selectedEncounter?.route_update ?? null}
              encounter={selectedEncounter}
              traceSteps={traceSteps}
              accepting={accepting}
              acceptError={acceptError}
              onAcceptEncounter={handleAcceptEncounter}
              canPrescribe={canPrescribe}
              currentDoctorId={auth?.userId}
              medication={medication}
              onMedicationChange={setMedication}
              dosage={dosage}
              onDosageChange={setDosage}
              instructions={instructions}
              onInstructionsChange={setInstructions}
              sending={sending}
              prescriptionError={prescriptionError}
              prescriptionId={prescriptionId}
              onSendPrescription={handleSendPrescription}
              onAcceptVideo={() => handleAcceptVideo()}
              callStatus={callStatus}
            />
          </div>
        </div>
      </main>

      {/* Live Triage Pop-up Toast */}
      <TriageNotificationPopup
        onSelectPatient={handleSelectPatientFromNotification}
        onOpenDetails={handleOpenSymptomModal}
      />

      {/* Triage Notifications Flyout Panel */}
      <NotificationPanel
        isOpen={notificationPanelOpen}
        onClose={() => setNotificationPanelOpen(false)}
        onSelectPatient={handleSelectPatientFromNotification}
        onOpenDetails={handleOpenSymptomModal}
      />

      {/* Detailed Exact Symptom Pop-up Modal */}
      <SymptomDetailModal
        isOpen={Boolean(selectedModalNotification)}
        notification={selectedModalNotification}
        onClose={() => setSelectedModalNotification(null)}
        onSelectPatient={handleSelectPatientFromNotification}
      />
    </div>
  );
}
