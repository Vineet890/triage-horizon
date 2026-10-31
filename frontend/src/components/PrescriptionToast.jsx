import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pill, X, FileText, Download } from 'lucide-react';
import useTriageStore from '../store/useTriageStore';
import { downloadPrescriptionPdf } from '../lib/downloadPrescriptionPdf';

export default function PrescriptionToast() {
  const auth = useTriageStore((state) => state.auth);
  const prescriptionToast = useTriageStore((state) => state.prescriptionToast);
  const dismissPrescriptionToast = useTriageStore(
    (state) => state.dismissPrescriptionToast
  );
  const openPrescriptionPdfModal = useTriageStore(
    (state) => state.openPrescriptionPdfModal
  );

  useEffect(() => {
    if (!prescriptionToast) return undefined;

    const timer = window.setTimeout(
      () => dismissPrescriptionToast(),
      7000
    );

    return () => window.clearTimeout(timer);
  }, [prescriptionToast, dismissPrescriptionToast]);

  if (auth?.role !== 'PATIENT') return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] w-[calc(100vw-2rem)] max-w-sm sm:bottom-6 sm:right-6"
    >
      <AnimatePresence initial={false}>
        {prescriptionToast && (
          <motion.div
            key={prescriptionToast.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="pointer-events-auto overflow-hidden rounded-[6px] border border-[var(--success-border)] bg-surface"
          >
            <div className="flex items-start gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] border border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-ink)]">
                <Pill aria-hidden="true" className="h-4 w-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {prescriptionToast.title}
                </p>
                <p className="mt-1 text-sm leading-5 text-ink-secondary">
                  {prescriptionToast.message}
                </p>
                <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
                  {prescriptionToast.prescription_id?.replace(/^RX-/i, 'TH-PR-')}
                  {prescriptionToast.medication_count
                    ? ` · ${prescriptionToast.medication_count} medication${
                        prescriptionToast.medication_count === 1 ? '' : 's'
                      }`
                    : ''}
                  {prescriptionToast.doctor_name
                    ? ` · ${prescriptionToast.doctor_name}`
                    : ''}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      openPrescriptionPdfModal(
                        prescriptionToast.prescription || prescriptionToast
                      );
                      dismissPrescriptionToast();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-teal-700 active:scale-95"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>View Official PDF Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      downloadPrescriptionPdf(
                        prescriptionToast.prescription || prescriptionToast
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--success-border)] bg-[var(--success-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--success-ink)] transition-all hover:bg-emerald-100 dark:hover:bg-emerald-950/50 active:scale-95"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={dismissPrescriptionToast}
                aria-label="Dismiss prescription notification"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-[4px] text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
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
