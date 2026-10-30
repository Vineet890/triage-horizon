import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, PhoneOff, ShieldCheck, Video } from 'lucide-react';
import { cn } from '../lib/utils';

const STATUS_META = {
  waiting: {
    label: 'Waiting for clinician',
    dot: 'bg-signal-amber',
    badge: 'border-signal-amber-border bg-signal-amber-soft text-signal-amber-ink',
  },
  active: {
    label: 'Live consultation',
    dot: 'bg-signal-success',
    badge: 'border-signal-success-border bg-signal-success-soft text-signal-success-ink',
  },
  ended: {
    label: 'Consultation ended',
    dot: 'bg-ink-muted',
    badge: 'border-border bg-surface-muted text-ink-muted',
  },
};

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const JITSI_DOMAIN =
  import.meta.env.VITE_JITSI_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '') ||
  'jitsi.riot.im';

let jitsiApiScriptPromise;

function loadJitsiApi() {
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve(window.JitsiMeetExternalAPI);
  }

  if (!jitsiApiScriptPromise) {
    jitsiApiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://${JITSI_DOMAIN}/external_api.js`;
      script.async = true;
      script.onload = () => {
        if (window.JitsiMeetExternalAPI) {
          resolve(window.JitsiMeetExternalAPI);
        } else {
          jitsiApiScriptPromise = null;
          reject(new Error('Jitsi Meet API did not load.'));
        }
      };
      script.onerror = () => {
        jitsiApiScriptPromise = null;
        reject(new Error('Could not load the Jitsi Meet API.'));
      };
      document.head.appendChild(script);
    });
  }

  return jitsiApiScriptPromise;
}

/**
 * Builds the Jitsi room URL with the local participant's display name baked in.
 * Without this Jitsi shows its own pre-join screen asking for a username, which
 * looks like the app is asking for credentials.
 *
 * The domain is configurable because meet.jit.si now requires the first
 * participant to log in as a moderator, which breaks anonymous demo rooms.
 */
function buildRoomUrl(roomId, displayName) {
  const params = [];

  if (displayName) {
    // Jitsi expects the display name as a JSON string in the hash.
    params.push(
      `userInfo.displayName=${encodeURIComponent(JSON.stringify(displayName))}`
    );
  }

  params.push(
    'config.prejoinPageEnabled=false',
    'config.prejoinConfig.enabled=false',
    'config.enableWelcomePage=false',
    'config.disableDeepLinking=true'
  );

  return `https://${JITSI_DOMAIN}/${encodeURIComponent(roomId)}#${params.join('&')}`;
}

export default function VideoConsultation({
  roomId,
  status = 'waiting',
  participant = '',
  displayName = '',
  startedAt = null,
  error = '',
  ending = false,
  title = 'Secure video consultation',
  onEnd,
  onClose,
}) {
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0
  );
  const [embedError, setEmbedError] = useState({ roomId: '', message: '' });
  const roomContainerRef = useRef(null);

  useEffect(() => {
    if (!startedAt || status === 'ended') return undefined;

    const update = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };

    update();
    const timer = window.setInterval(update, 1000);

    return () => window.clearInterval(timer);
  }, [startedAt, status]);

  useEffect(() => {
    if (status === 'ended' || !roomId || !roomContainerRef.current) {
      return undefined;
    }

    let cancelled = false;
    let jitsiApi;

    loadJitsiApi()
      .then((JitsiMeetExternalAPI) => {
        if (cancelled || !roomContainerRef.current) return;

        jitsiApi = new JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: roomId,
          parentNode: roomContainerRef.current,
          width: '100%',
          height: '100%',
          userInfo: displayName ? { displayName } : {},
          configOverwrite: {
            prejoinPageEnabled: false,
            prejoinConfig: { enabled: false },
            enableWelcomePage: false,
            disableDeepLinking: true,
          },
        });

        const iframe = jitsiApi.getIFrame();
        iframe.setAttribute(
          'allow',
          `camera https://${JITSI_DOMAIN}; microphone https://${JITSI_DOMAIN}; autoplay https://${JITSI_DOMAIN}; fullscreen https://${JITSI_DOMAIN}; display-capture https://${JITSI_DOMAIN}`
        );

        jitsiApi.addListener('errorOccurred', () => {
          setEmbedError({
            roomId,
            message: 'The video room reported an error. Rejoin the call and check camera and microphone access.',
          });
        });
      })
      .catch((error) => {
        if (cancelled) return;

        console.error('[video] Failed to initialize the embedded Jitsi room:', error);
        setEmbedError({
          roomId,
          message: 'The embedded video room could not be loaded. Try opening the room in a new tab.',
        });
      });

    return () => {
      cancelled = true;
      jitsiApi?.dispose();
      jitsiApi = null;
    };
  }, [displayName, roomId, status]);

  const meta = STATUS_META[status] ?? STATUS_META.waiting;
  const isEnded = status === 'ended';
  const visibleError = error || (embedError.roomId === roomId ? embedError.message : '');

  return (
    <section className="overflow-hidden rounded-[6px] border border-border bg-surface">
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-brand-border bg-brand-soft text-brand-strong">
            <Video aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
              <span className="font-mono">{roomId}</span>
              {participant && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{participant}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {startedAt && !isEnded && (
            <span className="font-mono text-xs font-medium text-ink-secondary">
              {formatDuration(elapsed)}
            </span>
          )}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
              meta.badge
            )}
          >
            <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-[1px]', meta.dot)} />
            {meta.label}
          </span>
        </div>
      </div>

      {isEnded ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-[6px] border border-border bg-surface-muted text-ink-muted">
            <PhoneOff aria-hidden="true" className="h-6 w-6" />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-ink">
            Consultation ended
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">
            {participant
              ? `The video visit with ${participant} has ended.`
              : 'The video visit has ended.'}{' '}
            {startedAt ? `Duration ${formatDuration(elapsed)}.` : ''}
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="mt-5 inline-flex h-9 items-center justify-center rounded-[6px] border border-border-strong bg-surface px-4 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              Close consultation
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            ref={roomContainerRef}
            role="region"
            aria-label={`Jitsi video consultation ${roomId}`}
            style={{
              width: '100%',
              height: '500px',
              border: '1px solid rgb(var(--border))',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          />

          <div className="flex flex-col gap-3 border-t border-border bg-surface-muted px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs leading-5 text-ink-muted">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-brand-strong" />
              Jitsi Meet room · Camera and microphone access is requested by the browser.
            </p>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <a
                href={buildRoomUrl(roomId, displayName)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
                Open room in new tab
              </a>

              {onEnd && (
                <button
                  type="button"
                  onClick={onEnd}
                  disabled={ending}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[6px] border px-3 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20',
                    ending
                      ? 'border-border bg-surface-strong text-ink-muted'
                      : 'border-signal-danger-border bg-surface text-signal-danger-ink hover:bg-signal-danger-soft'
                  )}
                >
                  {ending ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <PhoneOff aria-hidden="true" className="h-4 w-4" />
                  )}
                  {ending ? 'Ending…' : 'End call'}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {visibleError && (
        <p
          role="alert"
          className="border-t border-signal-danger-border bg-signal-danger-soft px-5 py-3 text-[13px] font-medium text-signal-danger-ink"
        >
          {visibleError}
        </p>
      )}
    </section>
  );
}
