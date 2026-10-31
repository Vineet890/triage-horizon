import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock3, MapPin, Route, Stethoscope } from 'lucide-react';
import socket from '../lib/socket';
import { getCareTierLabel } from '../lib/clinical';
import { cn } from '../lib/utils';

const FLASH_MS = 1500;

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
      if (!encounter?.id || payload.encounter_id !== encounter.id) return;

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
  }, [patientId, encounter?.id]);

  useEffect(() => {
    setLiveRoute(null);
    setFlashing(false);
  }, [patientId, encounter?.id]);

  const activeRoute =
    [liveRoute, routeUpdate].find(
      (route) => route && route.encounter_id === encounter?.id
    ) ?? null;
  const rerouteFailed = activeRoute?.reroute_status === 'NO_ALTERNATIVE_AVAILABLE';
  const facility = rerouteFailed
    ? null
    : activeRoute?.selected_facility ?? destination ?? null;
  const facilityName = rerouteFailed
    ? 'Manual care coordination'
    : facility?.name ?? encounter?.facility_name ?? null;
  const resolvedEta = rerouteFailed ? null : facility?.eta_min ?? eta ?? null;
  const resolvedTier =
    activeRoute?.care_tier ?? careTier ?? encounter?.care_tier ?? null;
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
        'rounded-2xl border bg-surface p-6 shadow-xs transition-all duration-300',
        flashing
          ? 'border-amber-400 ring-4 ring-amber-400/20 bg-amber-50/20 dark:bg-amber-950/20'
          : 'border-border/80',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            <Route aria-hidden="true" className="h-4 w-4" />
            Live Clinical Route
          </p>
          <h2 className="mt-1 text-lg font-bold text-ink">
            Assigned Facility Destination
          </h2>
        </div>

        <AnimatePresence initial={false}>
          {rerouted && (
            <motion.span
              key="rerouted-badge"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
            >
              {rerouteFailed ? 'Manual Coordination' : 'Rerouted'}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-start gap-4 rounded-xl border border-border/80 bg-surface-muted/60 p-4">
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-all duration-300',
            flashing
              ? 'border-amber-400 bg-amber-100 text-amber-700 dark:bg-amber-900/60'
              : 'border-teal-500/30 bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400'
          )}
        >
          <MapPin aria-hidden="true" className="h-5 w-5" />
        </span>

        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={facilityName ?? 'unassigned'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'text-base font-bold leading-tight transition-colors duration-300',
                flashing ? 'text-amber-800 dark:text-amber-300' : 'text-ink'
              )}
            >
              {facilityName ?? 'Awaiting facility assignment'}
            </motion.p>
          </AnimatePresence>

          <p className="mt-1 text-xs text-ink-muted">
            {rerouteFailed
              ? 'Automatic routing limit reached. Clinical coordinators are manually dispatching your case.'
              : rerouted
                ? `${activeRoute.previous_facility_name ?? 'The previous facility'} → ${facilityName}. ${activeRoute.reason ?? 'Your route was updated by the network.'}`
                : 'Manchester Triage verified and dispatched to regional network.'}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border/80 pt-4">
        <div>
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <Clock3 aria-hidden="true" className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            Estimated Transit ETA
          </dt>
          <dd className="mt-1 font-mono text-base font-bold text-ink">
            {resolvedEta != null ? `${resolvedEta} min` : '—'}
          </dd>
        </div>

        <div>
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <Stethoscope aria-hidden="true" className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            Care Pathway
          </dt>
          <dd className="mt-1 text-sm font-bold text-ink">
            {resolvedTier ? getCareTierLabel(resolvedTier) : '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
