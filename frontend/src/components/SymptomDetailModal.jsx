import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  HeartPulse,
  Quote,
  ShieldAlert,
  Stethoscope,
  X,
} from 'lucide-react';
import AcuityBadge from './AcuityBadge';
import { getCareTierLabel } from '../lib/clinical';
import { patientVitals, PATIENT_DIRECTORY } from '../lib/demoPatients';
import { formatDate, formatTime, initials } from '../lib/utils';

export default function SymptomDetailModal({
  notification,
  isOpen,
  onClose,
  onSelectPatient,
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !notification) return null;

  const patientId = notification.patient_id;
  const patient = PATIENT_DIRECTORY[patientId] ?? null;
  const vitals = patientVitals(patientId);

  const handleCopy = async () => {
    if (!notification.symptom) return;
    try {
      await navigator.clipboard.writeText(notification.symptom);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSelect = () => {
    if (onSelectPatient && patientId) {
      onSelectPatient(patientId);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="triage-modal-title"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[8px] border border-border bg-surface shadow-2xl flex flex-col z-10"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-border bg-surface-muted px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-brand-border bg-surface text-brand-strong">
                <Stethoscope aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    id="triage-modal-title"
                    className="text-base font-semibold text-ink"
                  >
                    Triage Intake Assessment
                  </h2>
                  <span className="font-mono text-xs text-ink-muted">
                    {notification.encounter_id
                      ? `ENC-${String(notification.encounter_id).slice(-6).toUpperCase()}`
                      : 'LIVE'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted flex items-center gap-1.5">
                  <Clock3 className="h-3 w-3" />
                  Received {formatDate(notification.timestamp)} at{' '}
                  {formatTime(notification.timestamp)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="grid h-8 w-8 place-items-center rounded-[4px] text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Patient Header Card */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-border bg-surface p-3.5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-border bg-surface-muted text-xs font-bold text-ink">
                  {initials(notification.patient_name || patientId)}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    {notification.patient_name || patient?.name || patientId}
                  </h3>
                  <p className="font-mono text-xs text-ink-muted">
                    {patient?.display_id ?? patientId}
                    {patient?.age ? ` · ${patient.age} yrs · ${patient.gender}` : ''}
                    {patient?.blood_type ? ` · Blood: ${patient.blood_type}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <AcuityBadge acuity={notification.acuity} size="md" />
                <span className="rounded-[4px] border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-secondary">
                  {getCareTierLabel(notification.care_tier)}
                </span>
              </div>
            </div>

            {/* EXACT TRIAGE SYMPTOM MESSAGE - PRIMARY FOCUS */}
            <div className="relative overflow-hidden rounded-[8px] border-2 border-brand-border bg-gradient-to-br from-brand-soft/80 to-brand-soft/30 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 border-b border-brand-border/60 pb-2.5">
                <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-brand-strong">
                  <Quote aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-strong" />
                  Exact Patient Triage Symptom Message
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-[4px] border border-brand-border bg-surface px-2 py-1 font-mono text-[11px] font-medium text-brand-strong transition-colors hover:bg-brand-soft"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-signal-success" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <blockquote className="mt-3 text-base sm:text-lg font-medium leading-relaxed text-ink italic">
                "{notification.symptom}"
              </blockquote>

              <p className="mt-3 font-mono text-[10px] text-ink-muted">
                Intake source: Direct patient symptom submission · Manchester Triage Algorithm
              </p>
            </div>

            {/* Protocol & Clinical Context */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[6px] border border-border bg-surface p-3.5">
                <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  <FileText className="h-3.5 w-3.5 text-brand-strong" />
                  Protocol Matched
                </p>
                <p className="mt-1.5 text-sm font-semibold text-ink">
                  {notification.protocol_matched || 'Manchester General Protocol'}
                </p>
                {notification.agent_rationale && (
                  <p className="mt-2 text-xs leading-5 text-ink-secondary">
                    {notification.agent_rationale}
                  </p>
                )}
              </div>

              <div className="rounded-[6px] border border-border bg-surface p-3.5">
                <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  <Building2 className="h-3.5 w-3.5 text-brand-strong" />
                  Routing Recommendation
                </p>
                <p className="mt-1.5 text-sm font-semibold text-ink">
                  {notification.facility_name ||
                    notification.selected_facility?.name ||
                    'Immediate Clinical Review Required'}
                </p>
                {notification.selected_facility?.reason && (
                  <p className="mt-2 text-xs leading-5 text-ink-secondary">
                    {notification.selected_facility.reason}
                  </p>
                )}
              </div>
            </div>

            {/* Vitals Snapshot if Available */}
            {vitals && (
              <div className="rounded-[6px] border border-border bg-surface p-3.5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                  <HeartPulse className="h-3.5 w-3.5 text-brand-strong" />
                  Reported Baseline Vitals
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Object.entries(vitals).map(([key, value]) => (
                    <div key={key} className="rounded-[4px] border border-border bg-surface-muted p-2">
                      <dt className="text-[10px] uppercase font-mono text-ink-muted">
                        {key.replace(/_/g, ' ')}
                      </dt>
                      <dd className="mt-0.5 font-mono text-xs font-semibold text-ink">
                        {value}
                      </dd>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Modifiers / Flags if any */}
            {((notification.special_flags && notification.special_flags.length > 0) ||
              (notification.risk_modifiers && notification.risk_modifiers.length > 0)) && (
              <div className="rounded-[6px] border border-signal-amber-border bg-signal-amber-soft p-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-signal-amber-ink flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Clinical Risk Modifiers & Alerts
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    ...(notification.special_flags ?? []),
                    ...(notification.risk_modifiers ?? []),
                  ].map((flag, idx) => (
                    <span
                      key={idx}
                      className="rounded-[3px] border border-signal-amber-border bg-surface px-2 py-0.5 font-mono text-[10px] font-medium text-signal-amber-ink"
                    >
                      {String(flag).replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-muted px-6 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center rounded-[6px] border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
            >
              Dismiss
            </button>

            <button
              type="button"
              onClick={handleSelect}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-brand bg-brand-solid px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-solid-hover focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Review Patient in Queue
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
