import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

const MOCK_STEPS = [
  { tool: 'getPatientHistory', detail: 'Retrieved 3 conditions, 2 medications' },
  { tool: 'evaluateAdherenceRisk', detail: 'LOW risk · 86% 7-day adherence' },
  { tool: 'evaluateMentalHealthContext', detail: 'No mental-health flags' },
  { tool: 'matchProtocol', detail: 'RESP-002: Asthma Exacerbation Protocol' },
  { tool: 'checkFacilityAvailability', detail: 'Filtered 5 facilities · 4 available' },
  { tool: 'estimateEta', detail: 'Sector 19 Primary Care Clinic at 6 min' },
  { tool: 'DECISION', detail: 'Route to Sector 19 Primary Care Clinic', status: 'decision' },
].map((step, index) => ({
  ...step,
  timestamp: new Date(Date.now() - (7 - index) * 900).toISOString(),
  status: step.status ?? 'ok',
}));

function formatClock(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return '--:--:--';
  }

  return date.toLocaleTimeString('en-GB', { hour12: false });
}

function statusColor(status) {
  if (status === 'warning') return 'var(--amber)';
  if (status === 'decision') return 'var(--success)';
  return 'var(--brand)';
}

/**
 * JetBrains Mono agent log. Lines slide in at 200 ms intervals. The parent can
 * pass live AGENT_THINKING steps from the shared store; during an in-flight
 * triage a sequential mock keeps the panel alive.
 */
export default function AgentTrace({
  steps = [],
  title = 'Agent trace',
  className = '',
  active = false,
  emptyLabel = 'Awaiting agent trace…',
}) {
  const source = useMemo(() => {
    if (Array.isArray(steps) && steps.length > 0) return steps;
    if (active) return MOCK_STEPS;
    return [];
  }, [active, steps]);

  const [visible, setVisible] = useState(0);
  const logRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    setVisible(0);

    if (source.length === 0) return undefined;

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisible(index);

      if (index >= source.length) {
        window.clearInterval(timer);
      }
    }, 200);

    return () => window.clearInterval(timer);
  }, [source]);

  // Track whether the log overflows so the bottom edge fades instead of
  // slicing the next line in half.
  useEffect(() => {
    const node = logRef.current;
    if (!node) return undefined;

    const update = () => {
      setOverflowing(node.scrollHeight > node.clientHeight + 1);
      setAtBottom(
        node.scrollTop + node.clientHeight >= node.scrollHeight - 4
      );
    };

    const frame = window.requestAnimationFrame(update);
    node.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(frame);
      node.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [source, visible]);

  return (
    <section
      aria-label={title}
      className={cn(
        'relative overflow-hidden rounded-[6px] border border-border bg-surface-muted',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
          <Terminal aria-hidden="true" className="h-3.5 w-3.5" />
          {title}
        </span>
        <span className="font-mono text-[10px] text-ink-muted">
          {Math.min(visible, source.length)}/{source.length}
        </span>
      </div>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        className="max-h-[264px] overflow-auto overscroll-contain p-3 font-mono text-[11px] leading-6"
      >
        {source.slice(0, visible).map((step, index) => {
          const isDecision =
            step.status === 'decision' ||
            String(step.tool).toUpperCase() === 'DECISION';

          return (
            <motion.div
              key={`${step.tool}-${step.timestamp}-${index}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="min-w-0 break-words"
            >
              <span className="text-ink-muted">
                [{formatClock(step.timestamp)}]
              </span>{' '}
              <span
                className="font-semibold"
                style={{ color: statusColor(step.status) }}
              >
                {isDecision ? 'DECISION:' : 'TOOL:'}
              </span>{' '}
              {isDecision ? (
                <span className="font-semibold text-ink">{step.detail}</span>
              ) : (
                <>
                  <span className="font-semibold text-ink">{step.tool}</span>{' '}
                  <span className="text-ink-muted">-&gt;</span>{' '}
                  <span className="text-ink-secondary">
                    {step.detail}
                  </span>
                </>
              )}
            </motion.div>
          );
        })}

        {visible < source.length && (
          <span
            aria-hidden="true"
            className="mt-1 inline-block h-3 w-1.5 animate-pulse bg-[var(--brand)]"
          />
        )}

        {source.length === 0 && (
          <p className="text-ink-muted">{emptyLabel}</p>
        )}
      </div>

      {overflowing && !atBottom && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
          style={{
            backgroundImage:
              'linear-gradient(to top, rgb(var(--surface-muted)) 0%, rgb(var(--surface-muted)) 45%, transparent 100%)',
          }}
        />
      )}
    </section>
  );
}
