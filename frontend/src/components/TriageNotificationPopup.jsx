import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Quote,
  X,
} from 'lucide-react';
import useTriageStore from '../store/useTriageStore';
import AcuityBadge from './AcuityBadge';
import { getCareTierLabel } from '../lib/clinical';
import { cn, formatTime } from '../lib/utils';

export default function TriageNotificationPopup({
  onSelectPatient,
  onOpenDetails,
}) {
  const triageToast = useTriageStore((state) => state.triageToast);
  const dismissTriageToast = useTriageStore((state) => state.dismissTriageToast);

  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const toastDurationMs = 12000; // 12 seconds
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const remainingTimeRef = useRef(toastDurationMs);

  useEffect(() => {
    if (!triageToast) {
      setProgress(100);
      remainingTimeRef.current = toastDurationMs;
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    remainingTimeRef.current = toastDurationMs;
    startTimeRef.current = Date.now();
    setProgress(100);

    const updateInterval = 100;
    intervalRef.current = setInterval(() => {
      if (!isHovered) {
        remainingTimeRef.current -= updateInterval;
        const pct = Math.max(0, (remainingTimeRef.current / toastDurationMs) * 100);
        setProgress(pct);

        if (remainingTimeRef.current <= 0) {
          clearInterval(intervalRef.current);
          dismissTriageToast();
        }
      }
    }, updateInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [triageToast, dismissTriageToast, isHovered]);

  if (!triageToast) return null;

  const isCritical = triageToast.acuity === 'CRITICAL';
  const isHigh = triageToast.acuity === 'HIGH';

  const handleReview = () => {
    if (onSelectPatient && triageToast.patient_id) {
      onSelectPatient(triageToast.patient_id);
    }
    dismissTriageToast();
  };

  const handleDetails = () => {
    if (onOpenDetails) {
      onOpenDetails(triageToast);
    }
    dismissTriageToast();
  };

  return (
    <div
      aria-live="assertive"
      aria-atomic="true"
      className="pointer-events-none fixed right-4 top-20 z-[70] w-[calc(100vw-2rem)] max-w-md sm:right-6"
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={triageToast.id || triageToast.patient_id}
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'pointer-events-auto overflow-hidden rounded-[8px] border shadow-xl bg-surface',
            isCritical
              ? 'border-signal-danger-border ring-2 ring-signal-danger/20'
              : isHigh
                ? 'border-signal-high-border ring-2 ring-signal-high/20'
                : 'border-brand-border'
          )}
          role="alert"
        >
          {/* Top Progress countdown line */}
          <div className="h-1 w-full bg-surface-muted overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-100 ease-linear',
                isCritical
                  ? 'bg-signal-danger'
                  : isHigh
                    ? 'bg-signal-high'
                    : 'bg-brand'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-4 sm:p-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'grid h-8 w-8 place-items-center rounded-[6px] border text-xs font-bold',
                    isCritical
                      ? 'border-signal-danger-border bg-signal-danger-soft text-signal-danger-ink'
                      : isHigh
                        ? 'border-signal-high-border bg-signal-high-soft text-signal-high-ink'
                        : 'border-brand-border bg-brand-soft text-brand-strong'
                  )}
                >
                  <AlertCircle aria-hidden="true" className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-ink">
                      {isCritical
                        ? '🚨 Critical Triage Alert'
                        : isHigh
                          ? '⚡ High Priority Triage'
                          : 'New Triage Intake'}
                    </p>
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    {formatTime(triageToast.timestamp)} · Manchester Protocol
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <AcuityBadge acuity={triageToast.acuity} size="sm" />
                <button
                  type="button"
                  onClick={dismissTriageToast}
                  aria-label="Dismiss triage alert"
                  className="grid h-7 w-7 place-items-center rounded-[4px] text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Patient Identity */}
            <div className="mt-3 flex items-center justify-between gap-2 border-b border-border pb-2.5">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {triageToast.patient_name}
                </p>
                <p className="font-mono text-xs text-ink-muted">
                  ID: {triageToast.patient_id.toUpperCase()}
                </p>
              </div>
              <span className="rounded-[4px] border border-border bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                {getCareTierLabel(triageToast.care_tier)}
              </span>
            </div>

            {/* EXACT TRIAGE SYMPTOM MESSAGE POP-UP CARD */}
            <div className="mt-3 rounded-[6px] border border-brand-border bg-brand-soft/70 p-3">
              <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-strong">
                <Quote aria-hidden="true" className="h-3 w-3 shrink-0" />
                Exact Triage Symptom Message
              </div>
              <p className="mt-1 text-sm font-medium italic leading-relaxed text-ink">
                "{triageToast.symptom}"
              </p>
            </div>

            {/* Protocol and facility info */}
            {triageToast.facility_name && (
              <p className="mt-2.5 truncate font-mono text-[11px] text-ink-secondary">
                <span className="text-ink-muted">Assigned:</span>{' '}
                <span className="font-semibold text-ink">
                  {triageToast.facility_name}
                </span>
              </p>
            )}

            {/* Action buttons */}
            <div className="mt-4 flex items-center justify-end gap-2 pt-1 border-t border-border">
              <button
                type="button"
                onClick={handleDetails}
                className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-border-strong bg-surface px-2.5 text-xs font-medium text-ink transition-colors hover:bg-surface-muted"
              >
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                Details
              </button>

              <button
                type="button"
                onClick={handleReview}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-[4px] px-3 text-xs font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30',
                  isCritical
                    ? 'bg-signal-danger hover:bg-signal-danger-ink'
                    : 'bg-brand-solid hover:bg-brand-solid-hover'
                )}
              >
                Review Patient
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
