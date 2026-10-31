import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

const MOCK_STEPS = [
  { tool: 'getPatientHistory', detail: 'Retrieved 3 conditions, 2 active medications' },
  { tool: 'evaluateAdherenceRisk', detail: 'LOW risk · 86% 7-day adherence rate' },
  { tool: 'evaluateMentalHealthContext', detail: 'No acute psychological flags' },
  { tool: 'matchProtocol', detail: 'RESP-002: Acute Asthma Exacerbation' },
  { tool: 'checkFacilityAvailability', detail: 'Evaluated 5 facilities · 4 operational' },
  { tool: 'estimateEta', detail: 'Sector 19 Primary Care Clinic · 6 min transit' },
  { tool: 'DECISION', detail: 'Route to Sector 19 Primary Care Clinic', status: 'decision' },
].map((step, index) => ({
  ...step,
  timestamp: new Date(Date.now() - (7 - index) * 900).toISOString(),
  status: step.status ?? 'ok',
}));

const HUMAN_PROGRESS_STEPS = [
  { tool: 'readSymptoms' },
  { tool: 'reviewGuidelines' },
  { tool: 'reviewCareOptions' },
  { tool: 'prepareCarePlan' },
].map((step, index) => ({
  ...step,
  timestamp: new Date(Date.now() + index * 900).toISOString(),
  status: 'ok',
}));

function formatClock(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return '--:--:--';
  }

  return date.toLocaleTimeString('en-GB', { hour12: false });
}

function statusColor(status) {
  if (status === 'warning') return '#F59E0B';
  if (status === 'decision') return '#10B981';
  return '#14B8A6';
}

function humanizeStep(step) {
  const tool = String(step.tool ?? '').toLowerCase();
  const detail = String(step.detail ?? '');

  if (tool === 'readsymptoms') {
    return {
      label: 'Reviewing your symptoms',
      detail: 'Reading the information you shared for this visit.',
    };
  }

  if (tool === 'reviewguidelines') {
    return {
      label: 'Checking care guidelines',
      detail: 'Comparing the symptoms with clinical guidance.',
    };
  }

  if (tool === 'reviewcareoptions') {
    return {
      label: 'Checking nearby care options',
      detail: 'Looking for an appropriate care destination.',
    };
  }

  if (tool === 'preparecareplan') {
    return {
      label: 'Preparing a care recommendation',
      detail: 'Organizing the next steps for your care team.',
    };
  }

  if (tool === 'getpatienthistory') {
    const conditions = detail.match(/(\d+)\s+conditions?/i)?.[1];
    const medications = detail.match(/(\d+)\s+medications?/i)?.[1];
    return {
      label: 'Reviewed health history',
      detail:
        conditions !== undefined && medications !== undefined
          ? `${conditions} health condition${conditions === '1' ? '' : 's'} and ${medications} current medicine${medications === '1' ? '' : 's'} on file.`
          : 'Checked the health information available for this visit.',
    };
  }

  if (tool === 'evaluateadherencerisk') {
    const description = /high/i.test(detail)
      ? 'A possible gap in taking regular medicines was identified for the care team to review.'
      : /moderate/i.test(detail)
        ? 'Medicine-taking history may need follow-up during care.'
        : /no adherence data/i.test(detail)
          ? 'There is no medicine-taking history on file yet.'
          : 'No medicine-taking concern was identified from the information available.';
    return { label: 'Reviewed medicine-taking history', detail: description };
  }

  if (tool === 'evaluatementalhealthcontext') {
    return {
      label: 'Reviewed wellbeing information',
      detail: /no mental-health flags|no mental-health context/i.test(detail)
        ? 'No wellbeing concern affecting this care decision was found.'
        : 'Wellbeing information was considered when choosing the care pathway.',
    };
  }

  if (tool === 'live_ml_triage') {
    return step.status === 'warning'
      ? {
          label: 'Completed a backup symptom review',
          detail:
            'The usual automated review was unavailable, so the standard clinical guidance was used.',
        }
      : {
          label: 'Reviewed the symptom assessment',
          detail:
            'The suggested assessment was checked against the clinical guidance before choosing the care plan.',
        };
  }

  if (tool === 'matchprotocol') {
    return {
      label: 'Checked care guidance',
      detail:
        'Your reported symptoms were compared with the relevant clinical guidance.',
    };
  }

  if (tool === 'checkfacilityavailability') {
    const counts = detail.match(/Filtered\s+(\d+)\/(\d+)\s+facilities/i);
    return {
      label: 'Checked available care locations',
      detail: counts
        ? `${counts[1]} of ${counts[2]} nearby care locations were available.`
        : 'Nearby care locations were checked before choosing where to go.',
    };
  }

  if (tool === 'estimateeta') {
    const destination = detail.match(/^(.+?) at (\d+) min$/i);
    return {
      label: 'Checked travel time',
      detail: destination
        ? `Estimated travel time to ${destination[1]} is about ${destination[2]} minutes.`
        : 'A suitable destination could not be confirmed automatically.',
    };
  }

  if (step.status === 'decision' || tool === 'decision') {
    return {
      label: 'Care plan selected',
      detail: detail
        .replace(/^Route to /i, 'The recommended destination is ')
        .replace(/\s+\([A-Z]+-\d+\)/, '')
        .replace(
          /^The recommended destination is No destination available$/i,
          'A care team member needs to help arrange the next step.'
        )
        .replace(
          /^Manual care coordination required$/i,
          'A care team member needs to help arrange the next step.'
        ),
    };
  }

  return {
    label: 'Care team update',
    detail: 'The care team reviewed the information for this visit.',
  };
}

/**
 * Shows triage progress in plain language or as a technical trace.
 */
export default function AgentTrace({
  steps = [],
  title = 'Autonomous Agent Trace',
  className = '',
  active = false,
  emptyLabel = 'Awaiting agent execution trace…',
  humanReadable = false,
}) {
  const source = useMemo(() => {
    if (Array.isArray(steps) && steps.length > 0) return steps;
    if (active) {
      return humanReadable ? HUMAN_PROGRESS_STEPS : MOCK_STEPS;
    }
    return [];
  }, [active, humanReadable, steps]);

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
        'relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-md',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/60 px-4 py-3">
        <span className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-300">
          {humanReadable ? (
            <Activity aria-hidden="true" className="h-4 w-4 text-teal-400" />
          ) : (
            <Terminal aria-hidden="true" className="h-4 w-4 text-teal-400" />
          )}
          {title}
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-teal-400">
          <Activity aria-hidden="true" className="h-3 w-3" />
          {humanReadable
            ? `${Math.min(visible, source.length)} of ${source.length} updates`
            : `${Math.min(visible, source.length)}/${source.length} steps`}
        </span>
      </div>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        className={cn(
          'max-h-[264px] overflow-auto overscroll-contain p-4',
          humanReadable
            ? 'space-y-3 text-sm leading-5'
            : 'font-mono text-xs leading-relaxed text-slate-300'
        )}
      >
        {source.slice(0, visible).map((step, index) => {
          if (humanReadable) {
            const readable = humanizeStep(step);
            return (
              <motion.div
                key={`${step.tool}-${step.timestamp}-${index}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex items-start gap-2.5"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: statusColor(step.status) }}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-100">{readable.label}</p>
                  <p className="mt-0.5 text-slate-300">{readable.detail}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {formatClock(step.timestamp)}
                  </p>
                </div>
              </motion.div>
            );
          }

          const isDecision =
            step.status === 'decision' ||
            String(step.tool).toUpperCase() === 'DECISION';

          return (
            <motion.div
              key={`${step.tool}-${step.timestamp}-${index}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="min-w-0 break-words py-0.5"
            >
              <span className="text-slate-500">
                [{formatClock(step.timestamp)}]
              </span>{' '}
              <span
                className="font-bold"
                style={{ color: statusColor(step.status) }}
              >
                {isDecision ? 'DECISION:' : 'TOOL:'}
              </span>{' '}
              {isDecision ? (
                <span className="font-bold text-white">{step.detail}</span>
              ) : (
                <>
                  <span className="font-semibold text-slate-200">{step.tool}</span>{' '}
                  <span className="text-slate-500">-&gt;</span>{' '}
                  <span className="text-slate-400">
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
            className="mt-1 inline-block h-3.5 w-2 animate-pulse bg-teal-400"
          />
        )}

        {source.length === 0 && (
          <p className="text-slate-500">{emptyLabel}</p>
        )}
      </div>

      {overflowing && !atBottom && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
          style={{
            backgroundImage:
              'linear-gradient(to top, rgb(2 6 23) 0%, rgb(2 6 23) 45%, transparent 100%)',
          }}
        />
      )}
    </section>
  );
}
