import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import useTriageStore from '../store/useTriageStore';
import { patientName } from '../lib/demoPatients';

export default function RouteToast() {
  const auth = useTriageStore((state) => state.auth);
  const routeToast = useTriageStore((state) => state.routeToast);
  const dismissRouteToast = useTriageStore((state) => state.dismissRouteToast);

  useEffect(() => {
    if (!routeToast) return undefined;

    const timer = window.setTimeout(() => dismissRouteToast(), 6500);

    return () => window.clearTimeout(timer);
  }, [routeToast, dismissRouteToast]);

  if (!auth) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed right-4 top-20 z-[60] w-[calc(100vw-2rem)] max-w-sm sm:right-6"
    >
      <AnimatePresence initial={false}>
        {routeToast && (
          <motion.div
            key={routeToast.id}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="pointer-events-auto overflow-hidden rounded-[6px] border border-border border-l-[3px] border-l-signal-amber-border bg-surface"
            role="status"
          >
            <div className="flex items-start gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-signal-amber-border bg-signal-amber-soft text-signal-amber-ink">
                <AlertTriangle aria-hidden="true" className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Route updated</p>
                <p className="mt-1 text-sm leading-5 text-ink-secondary">
                  <span className="font-medium text-ink">
                    {patientName(routeToast.patient_id)}
                  </span>{' '}
                  rerouted
                  {routeToast.previous_facility_name
                    ? ` from ${routeToast.previous_facility_name} to `
                    : ' to '}
                  <span className="font-medium text-ink">
                    {routeToast.facility_name}
                  </span>
                  {routeToast.reason ? `: ${routeToast.reason}` : '.'}
                </p>
                <p className="mt-1.5 font-mono text-xs text-ink-muted">
                  LIVE NETWORK UPDATE · {routeToast.patient_id.toUpperCase()}
                </p>
              </div>

              <button
                type="button"
                onClick={dismissRouteToast}
                aria-label="Dismiss route update"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-[4px] text-ink-muted transition-colors duration-200 hover:bg-surface-strong hover:text-ink"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
