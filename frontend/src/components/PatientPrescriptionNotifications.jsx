import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Bell, Check, CheckCheck, Pill, X } from 'lucide-react';
import useTriageStore from '../store/useTriageStore';
import { formatDateTime } from '../lib/utils';

export default function PatientPrescriptionNotifications({ patientId }) {
  const [isOpen, setIsOpen] = useState(false);
  const notifications = useTriageStore(
    (state) => state.prescriptionNotifications
  );
  const markRead = useTriageStore(
    (state) => state.markPrescriptionNotificationRead
  );
  const markAllRead = useTriageStore(
    (state) => state.markAllPrescriptionNotificationsRead
  );
  const socketConnected = useTriageStore((state) => state.socketConnected);

  const patientNotifications = useMemo(
    () => notifications.filter((item) => item.patient_id === patientId),
    [notifications, patientId]
  );
  const unreadCount = patientNotifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={
          unreadCount
            ? `Open prescription notifications, ${unreadCount} unread`
            : 'Open prescription notifications'
        }
        aria-expanded={isOpen}
        className="relative inline-flex h-9 items-center gap-2 rounded-[6px] border border-border bg-surface px-3 text-sm font-medium text-ink-secondary transition-colors duration-200 hover:bg-surface-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/25"
      >
        <Bell aria-hidden="true" className="h-4 w-4" />
        <span className="hidden sm:inline">Notifications</span>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="grid min-h-4 min-w-4 place-items-center rounded-full bg-signal-danger px-1 text-[9px] font-bold leading-none text-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <div
              className="fixed inset-0 z-[100] overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Prescription message inbox"
            >
              <motion.button
                type="button"
                aria-label="Close prescription notifications"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 h-full w-full cursor-default bg-black/40"
              />

              <div className="fixed inset-y-0 right-0 flex max-w-full pl-8">
                <motion.section
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="flex h-full min-h-0 w-screen max-w-md flex-col border-l border-border bg-canvas text-ink shadow-2xl"
                >
                <header className="shrink-0 border-b border-border bg-surface px-5 py-3 sm:px-5 sm:py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-[6px] border border-brand-border bg-surface text-brand-strong">
                        <Bell aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <div>
                        <h2 className="text-base font-semibold">
                          Care team messages
                          {unreadCount > 0 && (
                            <span className="ml-2 rounded-full bg-signal-danger px-2 py-0.5 text-[10px] font-bold text-white">
                              {unreadCount}
                            </span>
                          )}
                        </h2>
                        <p className="text-xs text-ink-muted">
                          Prescription updates and instructions
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="inline-flex h-8 items-center gap-1 rounded-[4px] px-2 text-xs font-medium text-brand-strong hover:bg-surface-muted"
                        >
                          <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Mark all read</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        aria-label="Close notification panel"
                        className="grid h-8 w-8 place-items-center rounded-[4px] text-ink-muted hover:bg-surface-muted hover:text-ink"
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                    <span className="text-xs text-ink-muted">
                      {patientNotifications.length}{' '}
                      {patientNotifications.length === 1
                        ? 'prescription'
                        : 'prescriptions'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${
                        socketConnected
                          ? 'border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-ink)]'
                          : 'border-signal-amber-border bg-signal-amber-soft text-signal-amber-ink'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                          socketConnected ? 'bg-signal-success' : 'bg-signal-amber'
                        }`}
                      />
                      {socketConnected ? 'Live updates on' : 'Reconnecting'}
                    </span>
                  </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                  {patientNotifications.length === 0 ? (
                    <div className="flex min-h-48 flex-col items-center justify-center rounded-[6px] border border-dashed border-border-strong bg-surface px-6 py-8 text-center">
                      <span className="grid h-12 w-12 place-items-center rounded-full border border-brand-border bg-brand-soft text-brand-strong">
                        <Bell aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <p className="mt-3 text-base font-semibold text-ink">
                        No prescriptions yet
                      </p>
                      <p className="mt-1 max-w-xs text-sm leading-6 text-ink-muted">
                        When your doctor sends a prescription, it will appear
                        here with medication and dosage details.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {patientNotifications.map((notification) => {
                        const prescription = notification.prescription;

                        return (
                          <li
                            key={notification.id}
                            className={`rounded-[6px] border bg-surface p-4 transition-colors ${
                              notification.read
                                ? 'border-border'
                                : 'border-brand-border ring-1 ring-brand-border'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-ink)]">
                                <Pill aria-hidden="true" className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-ink">
                                      New prescription
                                    </p>
                                    <p className="mt-0.5 text-xs text-ink-muted">
                                      {prescription?.doctor_name
                                        ? `From ${prescription.doctor_name}`
                                        : 'From your care team'}
                                      {notification.sent_at
                                        ? ` · ${formatDateTime(notification.sent_at)}`
                                        : ''}
                                    </p>
                                  </div>
                                  {!notification.read && (
                                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-solid" />
                                  )}
                                </div>

                                <div className="mt-3 rounded-[6px] border border-border bg-surface-muted p-3">
                                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                                    Medication
                                  </p>
                                  <ul className="space-y-2">
                                    {(prescription?.medications ?? []).map(
                                      (medication, index) => (
                                        <li
                                          key={`${medication.name ?? 'medication'}-${index}`}
                                          className="flex items-start gap-2 text-sm text-ink"
                                        >
                                          <Pill
                                            aria-hidden="true"
                                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-strong"
                                          />
                                          <span className="min-w-0">
                                            <span className="font-semibold">
                                              {medication.name || 'Medication'}
                                            </span>
                                            {medication.dosage && (
                                              <span className="block text-ink-secondary">
                                                {medication.dosage}
                                              </span>
                                            )}
                                            {medication.schedule && (
                                              <span className="mt-0.5 block text-xs text-ink-muted">
                                                {medication.schedule}
                                              </span>
                                            )}
                                          </span>
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>

                                {prescription?.instructions && (
                                  <p className="mt-3 border-t border-border/70 pt-3 text-sm leading-5 text-ink-secondary">
                                    {prescription.instructions}
                                  </p>
                                )}

                                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
                                  <span className="font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                                    {notification.prescription_id}
                                  </span>
                                  {!notification.read && (
                                    <button
                                      type="button"
                                      onClick={() => markRead(notification.id)}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-strong hover:underline"
                                    >
                                      <Check aria-hidden="true" className="h-3.5 w-3.5" />
                                      Mark read
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                </motion.section>
              </div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
