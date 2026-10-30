import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Check,
  CheckCheck,
  Clock3,
  ExternalLink,
  Inbox,
  Quote,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import useTriageStore from '../store/useTriageStore';
import AcuityBadge from './AcuityBadge';
import { getCareTierLabel } from '../lib/clinical';
import { cn, formatRelativeTime, initials } from '../lib/utils';
import { PATIENT_DIRECTORY } from '../lib/demoPatients';

export default function NotificationPanel({
  isOpen,
  onClose,
  onSelectPatient,
  onOpenDetails,
}) {
  const notifications = useTriageStore((state) => state.triageNotifications);
  const markNotificationRead = useTriageStore((state) => state.markNotificationRead);
  const markAllNotificationsRead = useTriageStore(
    (state) => state.markAllNotificationsRead
  );
  const clearNotifications = useTriageStore((state) => state.clearNotifications);
  const soundEnabled = useTriageStore((state) => state.notificationSoundEnabled);
  const toggleSound = useTriageStore((state) => state.toggleNotificationSound);

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread' | 'critical'

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const criticalCount = useMemo(
    () =>
      notifications.filter(
        (item) => item.acuity === 'CRITICAL' || item.acuity === 'HIGH'
      ).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((item) => !item.read);
    }
    if (activeTab === 'critical') {
      return notifications.filter(
        (item) => item.acuity === 'CRITICAL' || item.acuity === 'HIGH'
      );
    }
    return notifications;
  }, [notifications, activeTab]);

  if (!isOpen) return null;

  const handleReviewPatient = (patientId, notificationId) => {
    markNotificationRead(notificationId);
    if (onSelectPatient && patientId) {
      onSelectPatient(patientId);
    }
    onClose();
  };

  const handleOpenDetails = (notification) => {
    markNotificationRead(notification.id);
    if (onOpenDetails) {
      onOpenDetails(notification);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Triage Notifications Panel"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="w-screen max-w-md border-l border-border bg-surface text-ink shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="border-b border-border bg-surface-muted px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-[6px] border border-border bg-surface text-brand-strong">
                  <Bell aria-hidden="true" className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                    Triage Notifications
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-signal-danger px-2 py-0.5 text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Live patient symptom submissions & alerts
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Sound toggle */}
                <button
                  type="button"
                  onClick={toggleSound}
                  title={soundEnabled ? 'Mute audio alerts' : 'Enable audio alerts'}
                  className="grid h-8 w-8 place-items-center rounded-[4px] text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink"
                >
                  {soundEnabled ? (
                    <Volume2 aria-hidden="true" className="h-4 w-4 text-brand-strong" />
                  ) : (
                    <VolumeX aria-hidden="true" className="h-4 w-4 text-ink-muted" />
                  )}
                </button>

                {/* Close panel */}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close notification panel"
                  className="grid h-8 w-8 place-items-center rounded-[4px] text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Quick Action Toolbar */}
            <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5 text-xs text-ink-muted">
              <span className="font-mono text-[11px]">
                {notifications.length} total event{notifications.length === 1 ? '' : 's'}
              </span>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="flex items-center gap-1 font-medium text-brand-strong hover:underline"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}

                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearNotifications}
                    className="flex items-center gap-1 text-ink-muted hover:text-signal-danger-ink"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="mt-3 flex rounded-[6px] border border-border bg-surface p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  'flex-1 rounded-[4px] py-1.5 font-medium transition-colors text-center',
                  activeTab === 'all'
                    ? 'bg-brand-soft text-brand-strong font-semibold'
                    : 'text-ink-secondary hover:text-ink'
                )}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={cn(
                  'flex-1 rounded-[4px] py-1.5 font-medium transition-colors text-center',
                  activeTab === 'unread'
                    ? 'bg-brand-soft text-brand-strong font-semibold'
                    : 'text-ink-secondary hover:text-ink'
                )}
              >
                Unread ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('critical')}
                className={cn(
                  'flex-1 rounded-[4px] py-1.5 font-medium transition-colors text-center',
                  activeTab === 'critical'
                    ? 'bg-brand-soft text-brand-strong font-semibold'
                    : 'text-ink-secondary hover:text-ink'
                )}
              >
                Critical ({criticalCount})
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredNotifications.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center px-4">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-border bg-surface-muted text-ink-muted">
                  <Inbox aria-hidden="true" className="h-6 w-6" />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink">
                  {activeTab === 'unread'
                    ? 'No unread notifications'
                    : activeTab === 'critical'
                      ? 'No critical priority triage'
                      : 'No notifications yet'}
                </p>
                <p className="mt-1.5 max-w-xs text-xs text-ink-muted leading-relaxed">
                  When patients submit their symptom intake, live triage pop-up alerts
                  and exact symptom text will appear here automatically.
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredNotifications.map((notification) => {
                  const isUnread = !notification.read;
                  const isCritical = notification.acuity === 'CRITICAL';
                  const isHigh = notification.acuity === 'HIGH';
                  const patientId = notification.patient_id;
                  const patient = PATIENT_DIRECTORY[patientId];

                  return (
                    <motion.div
                      key={notification.id}
                      layout="position"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        'relative rounded-[6px] border p-3.5 transition-all text-left shadow-xs',
                        isUnread
                          ? isCritical
                            ? 'border-signal-danger-border bg-signal-danger-soft/40'
                            : isHigh
                              ? 'border-signal-high-border bg-signal-high-soft/40'
                              : 'border-brand-border bg-brand-soft/30'
                          : 'border-border bg-surface hover:bg-surface-muted/50'
                      )}
                    >
                      {/* Top Row: Acuity, Unread indicator, Timestamp */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <span
                              className="h-2 w-2 rounded-full bg-brand-solid shrink-0"
                              title="Unread alert"
                            />
                          )}
                          <AcuityBadge acuity={notification.acuity} size="sm" />
                          <span className="rounded-[3px] border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary">
                            {getCareTierLabel(notification.care_tier)}
                          </span>
                        </div>

                        <span className="flex items-center gap-1 font-mono text-[10px] text-ink-muted">
                          <Clock3 className="h-3 w-3" />
                          {formatRelativeTime(notification.timestamp)}
                        </span>
                      </div>

                      {/* Patient Name & Display ID */}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-[4px] border border-border bg-surface-muted text-[10px] font-bold text-ink">
                            {initials(notification.patient_name || patientId)}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-ink leading-tight">
                              {notification.patient_name || patient?.name || patientId}
                            </p>
                            <p className="font-mono text-[10px] text-ink-muted">
                              {patient?.display_id ?? patientId}
                            </p>
                          </div>
                        </div>

                        {notification.facility_name && (
                          <span className="max-w-[150px] truncate font-mono text-[10px] text-ink-muted">
                            📍 {notification.facility_name}
                          </span>
                        )}
                      </div>

                      {/* EXACT TRIAGE SYMPTOM MESSAGE CALLOUT */}
                      <div className="mt-2.5 rounded-[6px] border border-border bg-surface p-2.5">
                        <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-strong">
                          <Quote className="h-3 w-3 shrink-0" />
                          Exact Triage Symptom Message
                        </div>
                        <p className="mt-1 text-xs font-medium italic text-ink leading-relaxed">
                          "{notification.symptom}"
                        </p>
                      </div>

                      {/* Protocol Matched */}
                      {notification.protocol_matched && (
                        <p className="mt-2 truncate font-mono text-[10px] text-ink-secondary">
                          <span className="text-ink-muted">Protocol:</span>{' '}
                          {notification.protocol_matched}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(notification)}
                            className="inline-flex items-center gap-1 rounded-[4px] border border-border bg-surface px-2 py-1 text-xs font-medium text-ink transition-colors hover:bg-surface-muted"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Pop-up Details
                          </button>

                          <button
                            type="button"
                            onClick={() => markNotificationRead(notification.id)}
                            className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-xs text-ink-muted hover:text-ink transition-colors"
                          >
                            {isUnread ? (
                              <>
                                <Check className="h-3 w-3" />
                                Mark read
                              </>
                            ) : (
                              'Read'
                            )}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleReviewPatient(patientId, notification.id)
                          }
                          className="inline-flex items-center justify-center gap-1 rounded-[4px] border border-brand bg-brand-solid px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-solid-hover focus:outline-none focus:ring-2 focus:ring-brand/30"
                        >
                          Review Patient
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {/* Footer note */}
          <div className="border-t border-border bg-surface-muted px-4 py-2.5 text-center text-[11px] text-ink-muted">
            Notifications synchronize with live Socket.IO clinical events
          </div>
        </motion.div>
      </div>
    </div>
  );
}
