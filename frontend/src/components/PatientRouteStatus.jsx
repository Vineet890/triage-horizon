import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock3, MapPin, Route, Stethoscope } from 'lucide-react';
import socket from '../lib/socket';
import { getCareTierLabel } from '../lib/clinical';
import { cn } from '../lib/utils';

const FLASH_MS = 1500;

/**
 * Lightweight, light-themed route card for the patient portal. It intentionally
 * avoids a second map: the patient only needs the destination, ETA and tier.
 *
 * The card listens to the same ROUTE_UPDATED event the admin map consumes, so a
 * Simulate Shock reroute lands here as an amber flash, an animated destination
 * swap and a persistent REROUTED badge.
 */
export default function PatientRouteStatus({
  patientId,
  encounter,
  destination,
  eta,
  careTier,
  routeUpdate,
  className,
}) {
  const [liveRoute, setLiveRoute] = useState(null);
  const [flashing, setFlashing] = useState(false);
  const flashTimer = useRef(null);

  useEffect(() => {
    const handleRouteUpdated = (payload) => {
      if (!payload?.patient_id || payload.patient_id !== patientId) return;

      setLiveRoute(payload);
      setFlashing(true);

      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => {
        setFlashing(false);
        flashTimer.current = null;
      }, FLASH_MS);
    };

    socket.on('ROUTE_UPDATED', handleRouteUpdated);

    return () => {
      socket.off('ROUTE_UPDATED', handleRouteUpdated);
      if (flashTimer.current) {
        window.clearTimeout(flashTimer.current);
        flashTimer.current = null;
      }
    };
  }, [patientId]);

  // A new patient or a new encounter must not inherit the previous route card.
  useEffect(() => {
    setLiveRoute(null);
    setFlashing(false);
  }, [patientId, encounter?.id]);

  const activeRoute = liveRoute ?? routeUpdate ?? null;
  const rerouteFailed = activeRoute?.reroute_status === 'NO_ALTERNATIVE_AVAILABLE';
  const facility = rerouteFailed
    ? null
    : liveRoute?.selected_facility ?? destination ?? null;
  const facilityName = rerouteFailed
    ? 'Manual care coordination'
    : facility?.name ?? encounter?.facility_name ?? null;
  const resolvedEta = rerouteFailed ? null : facility?.eta_min ?? eta ?? null;
  const resolvedTier = liveRoute?.care_tier ?? careTier ?? encounter?.care_tier ?? null;
  const rerouted = Boolean(
    activeRoute?.previous_facility_id ||
      activeRoute?.reroute_status === 'REROUTED'
  );

  if (!encounter && !facilityName) return null;

  return (
    <section
      aria-label="Live route status"
      aria-live="polite"
      className={cn(
        'rounded-[6px] border bg-surface p-5 transition-colors duration-300',
        flashing ? 'border-signal-amber-border' : 'border-border',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
            <Route aria-hidden="true" className="h-3.5 w-3.5" />
            Live route
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">
            Current destination
          </h2>
        </div>

        <AnimatePresence initial={false}>
          {rerouted && (
            <motion.span
              key="rerouted-badge"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 rounded-[4px] border border-signal-amber-border bg-signal-amber-soft px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-signal-amber-ink"
            >
              {rerouteFailed ? 'Manual coordination' : 'Rerouted'}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-[6px] border border-border bg-surface-muted p-3">
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border bg-surface transition-colors duration-300',
            flashing
              ? 'border-signal-amber-border text-signal-amber-ink'
              : 'border-brand-border text-brand-strong'
          )}
        >
          <MapPin aria-hidden="true" className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={facilityName ?? 'unassigned'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className={cn(
                'text-sm font-semibold leading-5 transition-colors duration-300',
                flashing ? 'text-signal-amber-ink' : 'text-ink'
              )}
            >
              {facilityName ?? 'Awaiting facility assignment'}
            </motion.p>
          </AnimatePresence>

          <p className="mt-0.5 text-xs leading-5 text-ink-muted">
            {rerouteFailed
              ? 'No alternative facility is available automatically. Your care team will coordinate the next step with you.'
              : rerouted
                ? 'Your care team reassigned you automatically after a facility update.'
                : 'Confirmed by the routing agent and reviewed by your clinician.'}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
            Estimated time of arrival
          </dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-ink">
            {resolvedEta != null ? `${resolvedEta} min` : '—'}
          </dd>
        </div>

        <div>
          <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Stethoscope aria-hidden="true" className="h-3.5 w-3.5" />
            Care tier
          </dt>
          <dd className="mt-1 text-sm font-semibold text-ink">
            {resolvedTier ? getCareTierLabel(resolvedTier) : '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
