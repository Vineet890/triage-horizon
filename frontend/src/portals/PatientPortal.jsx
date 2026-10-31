import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Droplet,
  FileText,
  Flame,
  Heart,
  HeartPulse,
  Loader2,
  LogOut,
  MapPin,
  Mic,
  MicOff,
  MessageSquare,
  Paperclip,
  Pill,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  Thermometer,
  UserRound,
  Video,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link, useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../lib/api';
import socket from '../lib/socket';
import { getAcuityMeta, getCareTierLabel } from '../lib/clinical';
import { DEMO_PATIENTS, buildPatientProfile } from '../lib/demoPatients';
import {
  MEDICATION_PLAN,
  MOOD_HISTORY,
  MOOD_LEVELS,
} from '../lib/patientWellness';
import useTriageStore, {
  ACTIVE_ENCOUNTER_STATUSES,
} from '../store/useTriageStore';
import { cn, formatRelativeTime, initials } from '../lib/utils';
import { BrandLockup, BrandMark } from '../components/Brand';
import ThemeToggle from '../components/ThemeToggle';
import AcuityBadge from '../components/AcuityBadge';
import AgentTrace from '../components/AgentTrace';
import ClinicalCard from '../components/ClinicalCard';
import EncounterRail from '../components/EncounterRail';
import PatientRouteStatus from '../components/PatientRouteStatus';
import PatientPrescriptionNotifications from '../components/PatientPrescriptionNotifications';
import ThinkingLog from '../components/ThinkingLog';
import VideoConsultation from '../components/VideoConsultation';
import { downloadPrescriptionPdf } from '../lib/downloadPrescriptionPdf';
import { printPrescriptionElement } from '../lib/printPrescription';
import FloatingPillsDecoration from '../components/FloatingPillsDecoration';
import { downloadPrescriptionReceipt } from '../lib/prescriptionReceipt';

const THINKING_STEPS = [
  'Reading the symptom narrative',
  'Matching Manchester Triage protocol',
  'Checking facility capacity and travel time',
  'Confirming the safest destination',
];

const TABS = [
  {
    id: 'chat',
    label: 'Triage chat',
    shortLabel: 'Chat',
    description: 'Symptom intake',
    icon: MessageSquare,
  },
  {
    id: 'medications',
    label: 'Medicine adherence',
    shortLabel: 'Medicines',
    description: 'Daily plan',
    icon: Pill,
  },
  {
    id: 'mental-health',
    label: 'Mental health',
    shortLabel: 'Wellbeing',
    description: 'Mood & support',
    icon: HeartPulse,
  },
];

function todayLabel() {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
}

function medicationDoseKey(medicationId, time) {
  return `${medicationId}@${time}`;
}

function getDoseSlots(medications) {
  return medications.flatMap((medication) => {
    const times =
      medication.times?.length > 0
        ? medication.times
        : medication.as_needed
          ? ['PRN']
          : [];
    return times.filter(Boolean).map((time) => ({
      medication,
      time,
      key: medicationDoseKey(medication.id, time),
    }));
  });
}

function inferMedicationTimes(medication) {
  if (!Array.isArray(medication.times)) return [];

  return [...new Set(medication.times)]
    .filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    .sort();
}

function getLastSevenDays(timezone, events = [], scheduledDoseCount = 0) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    const day = new Intl.DateTimeFormat('en', {
      timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekday: 'short',
    }).format(date);
    const logged = events.filter((event) => event.date === dayKey).length;

    return {
      day,
      value:
        scheduledDoseCount > 0
          ? Math.min(100, Math.round((logged / scheduledDoseCount) * 100))
          : 0,
      isToday: index === 6,
    };
  });
}

function getTodayInTimezone(timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getLocalDateTime(timezone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function decodePushKey(key) {
  const normalized = key.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function ProfileField({ label, value, mono = false, danger = false }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 text-sm font-medium leading-6',
          mono && 'font-mono',
          danger ? 'text-signal-danger-ink' : 'text-ink'
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function RejectedFacility({ facility, index }) {
  return (
    <li className="flex gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted text-xs font-semibold text-ink-muted">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{facility.name}</p>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">{facility.reason}</p>
      </div>
    </li>
  );
}

function PatientSidebar({ patient, activeTab, onTabChange, onSignOut, socketConnected }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#1C3326] bg-[#0F1D16] text-[#E8F3ED] lg:flex">
      <div className="flex h-16 shrink-0 items-center border-b border-[#1C3326] px-5">
        <BrandLockup to="/patient" light />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {/* User Profile Card from mockup */}
        <div className="rounded-2xl border border-[#233D2F] bg-[#16291F] p-4 text-white shadow-xs">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#203D2E] border border-[#2D5541] font-bold text-sm text-[#A3C9B4]">
              {initials(patient.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {patient.name}
              </p>
              <p className="mt-0.5 font-mono text-xs text-[#729382]">
                {patient.display_id}
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-2 border-t border-[#233D2F] pt-3 text-[11px] font-medium text-[#8EAFA0]">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-[#82AF96]" />
            <span>Verified clinical record</span>
          </div>
        </div>

        {/* Section Header */}
        <p className="mt-6 px-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#557766]">
          CARE WORKSPACE
        </p>

        {/* Nav Tabs */}
        <nav className="mt-2 space-y-1.5" aria-label="Patient workspace">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 focus:outline-none',
                  isActive
                    ? 'border-[#2D5541] bg-[#203D2E] text-white shadow-xs'
                    : 'border-transparent text-[#B0C7BC] hover:bg-white/[0.04] hover:text-white'
                )}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-[#4E9B78]"
                  />
                )}
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isActive ? 'text-[#82AF96]' : 'text-[#6A8B7A]'
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight">{tab.label}</span>
                  <span
                    className={cn(
                      'mt-0.5 block text-xs',
                      isActive ? 'text-[#82AF96]' : 'text-[#6A8B7A]'
                    )}
                  >
                    {tab.description}
                  </span>
                </span>
                {isActive && (
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-[#82AF96]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Feature Promo Card from mockup */}
        <div className="mt-6 rounded-2xl border border-[#233D2F] bg-[#16291F] p-5 text-white shadow-xs">
          <p className="text-sm font-extrabold leading-snug text-white">
            Your health, organised and simplified.
          </p>
          <button
            type="button"
            onClick={() => onTabChange && onTabChange('records')}
            className="mt-3.5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#13221A] shadow-xs hover:bg-slate-100 transition"
          >
            <span>Explore all features</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom Area from mockup */}
      <div className="shrink-0 p-4 space-y-3 border-t border-[#1C3326]">
        <div className="flex items-center gap-2 px-1 text-xs font-medium text-[#729382]">
          <span
            aria-hidden="true"
            className={cn(
              'h-2 w-2 rounded-xs',
              socketConnected ? 'bg-[#10B981]' : 'bg-amber-400'
            )}
          />
          <span>{socketConnected ? 'Live clinical updates' : 'Reconnecting to network'}</span>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#233D2F] bg-[#16291F] text-sm font-semibold text-white transition hover:bg-[#203D2E] hover:border-[#2D5541] focus:outline-none"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

function PatientTopbar({ patient, activeTab, onTabChange, onSignOut, socketConnected }) {
  const tab = TABS.find((item) => item.id === activeTab) ?? TABS[0];

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark className="h-8 w-8 lg:hidden" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{tab.label}</p>
            <p className="mt-0.5 hidden font-mono text-[9px] uppercase tracking-[0.1em] text-ink-muted sm:block">
              Patient workspace · {todayLabel()}
            </p>
          </div>

          {/* Quick Role Switcher */}
          <nav aria-label="Portal Switcher" className="hidden lg:flex items-center gap-1 rounded-full border border-border bg-surface-muted/80 p-1 ml-4">
            <span className="rounded-full bg-[#3D6B56] px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
              Patient
            </span>
            <Link
              to="/doctor"
              className="rounded-full px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted transition-colors hover:text-ink hover:bg-surface"
            >
              Doctor
            </Link>
            <Link
              to="/admin"
              className="rounded-full px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted transition-colors hover:text-ink hover:bg-surface"
            >
              Admin
            </Link>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Search bar from mockup */}
          <div className="relative hidden md:flex items-center">
            <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-ink-muted" />
            <input
              type="text"
              placeholder="Search anything..."
              className="h-8 w-44 lg:w-56 rounded-full border border-border bg-surface-muted/60 pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
            />
          </div>

          <PatientPrescriptionNotifications patientId={patient.id} />

          <ThemeToggle />

          <div className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-brand-border bg-brand-soft text-[11px] font-semibold text-brand-strong">
              {initials(patient.name)}
            </span>
            <div className="hidden md:block">
              <p className="text-xs font-semibold leading-tight text-ink">
                {patient.name}
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-ink-muted">
                {patient.display_id}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-ink-secondary transition-colors duration-200 hover:bg-surface-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/25 sm:hidden"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav
        aria-label="Patient workspace sections"
        className="flex gap-1 overflow-x-auto border-t border-border px-2 py-2 lg:hidden"
      >
        {TABS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-200',
                isActive
                  ? 'border-brand-border bg-brand-soft text-brand-strong'
                  : 'border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink'
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {item.shortLabel}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function RecordCard({ patient }) {
  return (
    <ClinicalCard className="relative overflow-hidden border-teal-500/30 shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            Verified Clinical Dossier
          </span>
          <h2 className="mt-0.5 text-base font-bold text-ink">EHR Profile</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          <ShieldCheck aria-hidden="true" className="h-3 w-3" />
          Verified
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3.5 rounded-2xl bg-surface-muted/60 p-3.5 border border-border/60">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-600 font-bold text-sm text-white shadow-xs">
          {initials(patient.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-ink">{patient.name}</p>
          <p className="mt-0.5 font-mono text-xs text-ink-muted">
            <span>{patient.display_id}</span>
            {patient.age ? ` · ${patient.age}y` : ''}
            {patient.gender ? ` · ${patient.gender}` : ''}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/60 bg-surface p-2.5">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Blood Type</dt>
          <dd className="mt-0.5 font-mono text-sm font-bold text-ink">{patient.blood_type || 'Unknown'}</dd>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface p-2.5">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Allergies</dt>
          <dd className={cn("mt-0.5 text-xs font-semibold truncate", patient.allergies.length > 0 ? "text-rose-600" : "text-ink")}>
            {patient.allergies.length > 0 ? patient.allergies.join(', ') : 'None'}
          </dd>
        </div>
        <div className="col-span-2 rounded-xl border border-border/60 bg-surface p-2.5">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Known Conditions</dt>
          <dd className="mt-0.5 text-xs font-medium text-ink">
            {patient.conditions.join(', ') || 'None recorded'}
          </dd>
        </div>
        <div className="col-span-2 rounded-xl border border-border/60 bg-surface p-2.5">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Current Regimen</dt>
          <dd className="mt-0.5 text-xs font-medium text-ink">
            {patient.medications.join('; ') || 'No active medications'}
          </dd>
        </div>
      </dl>

      <p className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3 text-[11px] text-ink-muted">
        <UserRound aria-hidden="true" className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
        Synced with regional physician roster
      </p>
    </ClinicalCard>
  );
}

const ENCOUNTER_STATUS_LABELS = {
  INTAKE: 'Intake',
  TRIAGED: 'Triaged',
  ROUTING: 'Routing',
  AWAITING_ACCEPTANCE: 'Awaiting clinician acceptance',
  ACCEPTED: 'Accepted by clinician',
  EN_ROUTE: 'En route to facility',
  CLOSED: 'Encounter closed',
};

function CareStatusCard({ encounter }) {
  const openPrescriptionPdfModal = useTriageStore(
    (state) => state.openPrescriptionPdfModal
  );
  const prescriptions = useTriageStore((state) => state.prescriptions);

  if (!encounter) return null;

  const prescription =
    encounter.prescription ||
    prescriptions.find(
      (p) =>
        p.encounter_id === encounter.id ||
        (encounter.patient_id && p.patient_id === encounter.patient_id)
    ) ||
    null;
  const clinician = encounter.assigned_doctor_name;

  return (
    <ClinicalCard>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
            Care status
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">
            {ENCOUNTER_STATUS_LABELS[encounter.status] ?? encounter.status}
          </h2>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-border bg-brand-soft px-2 py-1 font-mono text-[10px] font-semibold text-brand-strong">
          {encounter.id}
        </span>
      </div>

      <dl className="mt-4 space-y-3 border-t border-border pt-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Destination
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-ink">
            {encounter.facility_name ?? 'Care coordination team'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Clinician
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-ink">
            {clinician ?? 'Awaiting acceptance'}
          </dd>
        </div>
      </dl>

      {prescription && (
        <div className="mt-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/60 p-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100/90 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              <Pill aria-hidden="true" className="h-3.5 w-3.5" />
              Verified E-Prescription
            </span>
            <span className="font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {prescription.prescription_id?.replace(/^RX-/i, 'TH-PR-')}
            </span>
          </div>

          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Prescribed by:{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {prescription.doctor_name || clinician || 'Dr. Mira Sen'}
              </span>{' '}
              <span className="text-[11px] font-mono text-slate-500">
                · Reg: A-77363
              </span>
            </p>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-emerald-200/60 bg-white/80 dark:border-emerald-900/40 dark:bg-slate-900/70">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-emerald-100 bg-emerald-100/50 dark:border-emerald-900/50 dark:bg-emerald-950/40">
                <tr>
                  <th className="px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300">Medicine</th>
                  <th className="px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300">Dose</th>
                  <th className="px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300">Timing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {(prescription.medications ?? []).map((medication, index) => (
                  <tr key={`${medication.name}-${index}`} className="hover:bg-emerald-50/30">
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">
                      {medication.name}
                    </td>
                    <td className="px-3 py-2 font-mono text-teal-800 dark:text-teal-400">
                      {medication.dosage || medication.schedule || '1-0-1'}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      {medication.note || medication.instructions || 'As advised'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {prescription.instructions && (
            <p className="mt-2.5 rounded-lg bg-white/70 p-2 text-xs leading-5 text-slate-700 shadow-2xs dark:bg-slate-900/60 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-white">Doctor Instructions:</strong>{' '}
              {prescription.instructions}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => openPrescriptionPdfModal(prescription)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-teal-500 active:scale-95"
            >
              <FileText className="h-4 w-4" />
              <span>View Official Prescription (PDF Format)</span>
            </button>
            <button
              type="button"
              onClick={() => downloadPrescriptionPdf(prescription, patient)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D5A42] px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-[#234834] active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span>Download Prescription (PDF)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                openPrescriptionPdfModal(prescription);
                setTimeout(() => printPrescriptionElement('official-prescription-page'), 300);
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>
      )}
    </ClinicalCard>
  );
}

function CareTeamCard() {
  return (
    <ClinicalCard>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
        Care team
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface-muted text-xs font-semibold text-ink-secondary">
          MS
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Dr. Mira Sen</p>
          <p className="text-xs text-ink-muted">Triage physician · On shift</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-signal-success-ink">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-[1px] bg-signal-success" />
        Reviewing the live queue
      </div>
      <p className="mt-4 border-t border-border pt-4 text-sm leading-6 text-ink-secondary">
        Every routing decision is reviewed by a licensed clinician before care is
        confirmed.
      </p>
    </ClinicalCard>
  );
}

function RoutingResult({
  result,
  patientName,
  acuityMeta,
  selectedFacility,
  facilityEta,
  facilityDistance,
  routeUpdate,
  declinedFacilities,
  submittedAt,
  onReset,
  videoRoom,
  videoStatus,
  videoDoctor,
  videoStartedAt,
  videoError,
  videoEnding,
  onJoinVideo,
  onEndVideo,
  onDismissVideo,
}) {
  const isTelehealth = result.care_tier === 'telehealth';

  return (
    <ClinicalCard className="overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
            Decision ready
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
            Routing decision
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">{result.protocol_matched}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-muted">
            {formatRelativeTime(submittedAt ?? result.timestamp)}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-all duration-200 hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            New assessment
          </button>
        </div>
      </div>

      <div className="grid gap-6 border-b border-border p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Acuity
          </p>
          <div className="mt-2">
            <AcuityBadge acuity={result.acuity} size="lg" />
          </div>
          <p className="mt-2 text-sm text-ink-secondary">
            Manchester category {acuityMeta.code}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Care tier
          </p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {getCareTierLabel(result.care_tier)}
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            Clinical route for this acuity level
          </p>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {routeUpdate && (
          <motion.div
            key={routeUpdate.rerouted_at ?? 'route-update'}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-3 border-b border-signal-high-border bg-signal-high-soft p-6"
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-signal-high-ink"
            />
            <div>
              <p className="text-sm font-semibold text-signal-high-ink">
                Your destination was updated
              </p>
              <p className="mt-1 text-sm leading-6 text-signal-high-ink">
                {routeUpdate.reason} The new facility is shown below.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Selected facility
        </p>
        <motion.div
          layout
          transition={{ layout: { duration: 0.35, ease: 'easeOut' } }}
          className="mt-3 rounded-xl border border-border bg-surface-muted p-5"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selectedFacility?.id ?? 'care-coordination'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-border bg-brand-soft text-brand-strong">
                  <MapPin aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-ink">
                    {selectedFacility?.name ?? 'Care coordination team'}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary">
                    {selectedFacility?.reason}
                  </p>
                </div>
              </div>

              {(facilityEta != null || facilityDistance != null) && (
                <dl className="flex shrink-0 gap-6 border-t border-border pt-3 sm:border-t-0 sm:pt-0">
                  {facilityEta != null && (
                    <div>
                      <dt className="text-xs text-ink-muted">Drive</dt>
                      <dd className="mt-1 text-sm font-semibold text-ink">
                        {facilityEta} min
                      </dd>
                    </div>
                  )}
                  {facilityDistance != null && (
                    <div>
                      <dt className="text-xs text-ink-muted">Distance</dt>
                      <dd className="mt-1 text-sm font-semibold text-ink">
                        {facilityDistance} km
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <div className="mt-6 border-t border-border pt-6">
          {!videoRoom ? (
            <div className="rounded-xl border border-brand-border bg-brand-soft p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-border bg-surface text-brand-strong">
                    <Video aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-brand-strong">
                      {isTelehealth ? 'Telehealth consultation' : 'Video consultation'}
                    </h3>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-brand-strong">
                      {isTelehealth
                        ? 'This route is eligible for a secure video visit. Join the room and a clinician will meet you there.'
                        : 'Start a secure video visit at any time. A clinician will meet you in the room; keep following your routed destination for in-person care.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onJoinVideo}
                  disabled={videoStatus === 'connecting'}
                  className={cn(
                    'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30',
                    videoStatus === 'connecting'
                      ? 'cursor-wait border-brand bg-brand-solid text-white opacity-80'
                      : 'border-brand bg-brand-solid text-white hover:bg-brand-solid-hover'
                  )}
                >
                  {videoStatus === 'connecting' ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Video aria-hidden="true" className="h-4 w-4" />
                  )}
                  {videoStatus === 'connecting'
                    ? 'Opening room…'
                    : 'Join Video Consultation'}
                </button>
              </div>

              {videoError && (
                <p
                  role="alert"
                  className="mt-3 border-t border-brand-border pt-3 text-[13px] font-medium text-signal-danger-ink"
                >
                  {videoError}
                </p>
              )}
            </div>
          ) : (
            <VideoConsultation
              roomId={videoRoom}
              status={videoStatus}
              displayName={patientName}
              participant={
                videoDoctor?.name
                  ? `${videoDoctor.name}${
                      videoDoctor.specialty ? ` · ${videoDoctor.specialty}` : ''
                    }`
                  : 'Clinician'
              }
              startedAt={videoStartedAt}
              error={videoError}
              ending={videoEnding}
              title={isTelehealth ? 'Telehealth consultation' : 'Video consultation'}
              onEnd={onEndVideo}
              onClose={onDismissVideo}
            />
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">Clinical flags</h3>
            {result.special_flags?.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {result.special_flags.map((flag) => (
                  <li
                    key={flag}
                    className="flex items-center gap-2 text-sm text-ink-secondary"
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-[1px] bg-signal-amber"
                    />
                    {flag.replaceAll('_', ' ')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">
                No additional clinical flags.
              </p>
            )}

            <p className="mt-5 rounded-xl border border-border bg-surface-muted p-3 text-xs leading-5 text-ink-secondary">
              Decision support only. A licensed clinician retains final routing
              authority.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink">
              Facilities considered and declined
            </h3>
            <ul className="mt-3">
              {declinedFacilities.map((facility, index) => (
                <RejectedFacility
                  key={facility.id}
                  facility={facility}
                  index={index}
                />
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-xs text-ink-muted">
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          This decision has been added to the physician triage queue.
        </div>
      </div>
    </ClinicalCard>
  );
}

function TodaySnapshotCard({ patient }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold text-ink">Today's Snapshot</h3>
        </div>
        <span className="font-mono text-xs font-semibold text-ink-muted">
          Fri, 30 Oct 2026
        </span>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-border/80 bg-surface-muted/60 p-3">
          <div className="flex items-center gap-1.5 text-rose-500">
            <Droplet className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Blood Type</span>
          </div>
          <p className="mt-1 text-base font-bold text-ink">{patient.blood_type || 'O+'}</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface-muted/60 p-3">
          <div className="flex items-center gap-1.5 text-rose-500">
            <Heart className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Known Conditions</span>
          </div>
          <p className="mt-1 text-xs font-bold text-ink line-clamp-2">{patient.conditions[0] || 'Mild persistent asthma'}</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface-muted/60 p-3">
          <div className="flex items-center gap-1.5 text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Allergies</span>
          </div>
          <p className="mt-1 text-xs font-bold text-rose-600 truncate">{patient.allergies[0] || 'Penicillin'}</p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface-muted/60 p-3">
          <div className="flex items-center gap-1.5 text-purple-500">
            <Pill className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Current Medication</span>
          </div>
          <p className="mt-1 text-xs font-bold text-ink line-clamp-2">Albuterol 100 mcg inhaler (as needed)</p>
        </div>
      </div>
    </div>
  );
}

function AITriageStatusCard({ encounter, analyzing, result }) {
  const steps = [
    { key: 'intake', label: 'INTAKE' },
    { key: 'analysis', label: 'ANALYSIS' },
    { key: 'triage', label: 'TRIAGE' },
    { key: 'routing', label: 'ROUTING' },
    { key: 'complete', label: 'COMPLETE' },
  ];

  let currentStep = 0;
  if (result || encounter?.status === 'ASSIGNED' || encounter?.status === 'TRIAGED') {
    currentStep = 4;
  } else if (encounter?.status === 'IN_TRANSIT' || encounter?.status === 'DISPATCHED') {
    currentStep = 3;
  } else if (analyzing) {
    currentStep = 1;
  } else if (encounter) {
    currentStep = 2;
  }

  const stepCountText = currentStep > 0 ? `${currentStep + 1}/5 steps` : '5/5 steps';

  return (
    <div className="rounded-3xl border border-[#233B2E] bg-[#152720] p-5 text-white shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#233B2E] pb-3.5">
        <div className="flex items-center gap-2.5">
          <Activity className="h-5 w-5 text-[#81AF96]" />
          <h3 className="text-sm font-bold text-white tracking-wide">AI Triage Status</h3>
        </div>
        <span className="font-mono text-xs font-semibold text-[#81AF96] tracking-wider">
          {stepCountText}
        </span>
      </div>

      {/* Stepper with exact circles and labels from mockup */}
      <div className="mt-5 px-1">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-4 right-4 top-4 -translate-y-1/2 h-[2px] bg-[#233B2E] z-0" />
          {steps.map((step, idx) => {
            const isDone = idx <= currentStep || (!encounter && !analyzing && !result); // Default to completed state as shown in mockup
            const isCurrent = idx === currentStep && analyzing;

            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full font-bold text-xs transition-all shadow-xs',
                    isDone
                      ? 'bg-[#81AF96] text-[#152720]'
                      : isCurrent
                      ? 'border-2 border-white bg-[#152720] text-white animate-pulse'
                      : 'border-2 border-[#233B2E] bg-[#152720] text-[#6E8F7F]'
                  )}
                >
                  {isDone ? '✓' : idx + 1}
                </div>
                <span className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A9E8B]">
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status message */}
      <p className="mt-4 font-mono text-xs leading-relaxed text-[#9DC2AE] border-t border-[#233B2E] pt-3.5">
        {analyzing
          ? 'Autonomous Manchester Protocol inference in progress...'
          : result
          ? 'Autonomous routing complete · Assigned facility confirmed'
          : encounter
          ? `Current state: ${encounter.status}`
          : 'Autonomous routing complete · Assigned facility confirmed'}
      </p>
    </div>
  );
}

function EHRProfileCard({ patient, onTabChange }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#3D6B56]" />
          <h3 className="text-sm font-bold text-ink">EHR Profile</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <ShieldCheck className="h-3 w-3 text-emerald-600" />
          Verified
        </span>
      </div>

      {/* Patient row */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#3D6B56] text-white font-bold text-sm shadow-xs">
          {initials(patient.name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">{patient.name}</p>
          <p className="font-mono text-xs text-ink-muted">
            {patient.display_id} · {patient.age || '24'}y · {patient.gender || 'Male'}
          </p>
        </div>
      </div>

      {/* 2x2 vitals grid */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-border/60 pt-3 text-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Blood Type</span>
          <p className="font-bold text-ink mt-0.5">{patient.blood_type || 'O+'}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Allergies</span>
          <p className="font-bold text-rose-600 mt-0.5 truncate">{patient.allergies[0] || 'Penicillin'}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Known Conditions</span>
          <p className="font-bold text-ink mt-0.5 line-clamp-1">{patient.conditions[0] || 'Mild persistent asthma'}</p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Current Medication</span>
          <p className="font-bold text-ink mt-0.5 line-clamp-1">Albuterol 100 mcg inhaler</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onTabChange && onTabChange('records')}
        className="mt-4 flex w-full items-center justify-between border-t border-border/60 pt-3 text-xs font-bold text-[#3D6B56] hover:text-[#2D5A43] transition"
      >
        <span>View full medical profile</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TriageTab({
  patient,
  encounter,
  traceSteps,
  symptom,
  setSymptom,
  isListening,
  interimTranscript,
  speechSupported,
  speechError,
  onToggleSpeech,
  canSubmit,
  analyzing,
  thinkingSteps,
  error,
  onSubmit,
  onReset,
  result,
  acuityMeta,
  selectedFacility,
  facilityEta,
  facilityDistance,
  routeUpdate,
  declinedFacilities,
  submittedAt,
  videoRoom,
  videoStatus,
  videoDoctor,
  videoStartedAt,
  videoError,
  videoEnding,
  onJoinVideo,
  onEndVideo,
  onDismissVideo,
  onTabChange,
  medicationPlan,
  takenMeds,
}) {
  const openPrescriptionPdfModal = useTriageStore(
    (state) => state.openPrescriptionPdfModal
  );
  const prescriptions = useTriageStore((state) => state.prescriptions);
  const activeRx =
    encounter?.prescription ||
    prescriptions.find(
      (p) =>
        (encounter?.id && p.encounter_id === encounter.id) ||
        (encounter?.patient_id && p.patient_id === encounter.patient_id) ||
        p.patient_id === patient.id
    ) ||
    null;
  const nextScheduledDose = medicationPlan
    .flatMap((medication) =>
      (medication.times ?? []).map((time) => ({
        medication,
        time,
        key: medicationDoseKey(medication.id, time),
      }))
    )
    .filter(({ key }) => !takenMeds[key])
    .sort((left, right) => left.time.localeCompare(right.time))[0];

  return (
    <div className="space-y-6">
      {/* Top Row: Welcome & Intake Banner on Left + Today's Snapshot Card on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px] gap-6 items-stretch">
        {/* Patient Welcome & Friendly Intake Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-[#CDE4D6] bg-gradient-to-r from-[#EBF5EE] via-[#E7F2EA] to-[#DFEEE4] p-6 sm:p-7 text-[#172820] shadow-xs dark:border-[#2B4738] dark:from-[#192C22] dark:via-[#1E3529] dark:to-[#17271F] dark:text-[#E8F3ED]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            {/* Left Column: Heading, Paragraph, and 3 Pills */}
            <div className="min-w-0 flex-1 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#BFDEC7] bg-[#D7EADE] px-3.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#2D5A42] dark:border-[#385E4B] dark:bg-[#274335] dark:text-[#A8D3BA]">
                  <Sparkles className="h-3.5 w-3.5 text-[#3D6B56] dark:text-[#7CA982]" />
                  <span>AI Clinical Intake & Dynamic Dispatch</span>
                </div>

                <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#172820] dark:text-white">
                  Hello, {patient.name.split(' ')[0]}
                </h1>

                <p className="mt-2 text-sm leading-relaxed text-[#355243] dark:text-[#BED5C8] max-w-lg">
                  Tell us how you're feeling today. Our AI analyses your symptoms, suggests next steps, and connects you with the right care — all in one place.
                </p>
              </div>

              {/* 3 Feature Pills */}
              <div className="mt-5 flex flex-wrap items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#BFDEC7] bg-[#D6EADE] text-[#25523A] shadow-xs dark:border-[#385E4B] dark:bg-[#254234] dark:text-[#8EC2A4]">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#172820] dark:text-white leading-tight">Get an initial assessment</p>
                    <p className="text-[10px] text-[#4F7360] dark:text-[#9BB8A7]">AI-powered triage</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#BFDEC7] bg-[#D6EADE] text-[#25523A] shadow-xs dark:border-[#385E4B] dark:bg-[#254234] dark:text-[#8EC2A4]">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#172820] dark:text-white leading-tight">Personalised next steps</p>
                    <p className="text-[10px] text-[#4F7360] dark:text-[#9BB8A7]">Based on your profile</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#BFDEC7] bg-[#D6EADE] text-[#25523A] shadow-xs dark:border-[#385E4B] dark:bg-[#254234] dark:text-[#8EC2A4]">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#172820] dark:text-white leading-tight">Faster access to care</p>
                    <p className="text-[10px] text-[#4F7360] dark:text-[#9BB8A7]">Connect with specialist</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Clean Doctor Illustration with ZERO words and ZERO overlap */}
            <div className="hidden md:flex shrink-0 items-center justify-end select-none pointer-events-none">
              <img
                src="/patient-banner-doctor-transparent.png"
                alt=""
                aria-hidden="true"
                className="h-auto w-auto max-h-[190px] lg:max-h-[210px] xl:max-h-[230px] max-w-[240px] lg:max-w-[280px] object-contain"
                style={{ imageRendering: '-webkit-optimize-contrast' }}
                loading="eager"
              />
            </div>
          </div>
        </div>

        {/* Today's Snapshot Card */}
        <TodaySnapshotCard patient={patient} />
      </div>

      {encounter && <EncounterRail encounter={encounter} className="mt-6" />}

      {/* Official Doctor Prescription Banner */}
      {activeRx && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-5 sm:p-6 shadow-md dark:border-emerald-500/30 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  New Doctor Prescription Received
                </span>
                <span className="font-mono text-xs font-bold text-slate-500">
                  Ref: {activeRx.prescription_id?.replace(/^RX-/i, 'TH-PR-')}
                </span>
              </div>
              <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                Prescription issued by {activeRx.doctor_name || encounter?.assigned_doctor_name || 'Dr. Mira Sen'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                {(activeRx.medications ?? []).length} medications prescribed · Includes clinical directions and follow-up plan
              </p>
            </div>
          </div>

          <div className="flex flex-wrap shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => openPrescriptionPdfModal(activeRx)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-teal-500 active:scale-95"
            >
              <FileText className="h-4 w-4" />
              <span>View Official Prescription (PDF Format)</span>
            </button>
            <button
              type="button"
              onClick={() => downloadPrescriptionPdf(activeRx, patient)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D5A42] px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-[#234834] active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                openPrescriptionPdfModal(activeRx);
                setTimeout(() => printPrescriptionElement('official-prescription-page'), 300);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 active:scale-95"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Slip</span>
            </button>
          </div>
        </div>
      )}

      {/* Middle Row: Clinical Symptom Assessment Form on Left + AI Triage Status & EHR Profile on Right */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-6">
          <ClinicalCard className="rounded-3xl p-6 shadow-xs border-border">
            <form onSubmit={onSubmit}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/60 pb-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 border border-teal-200 text-[#3D6B56] dark:bg-teal-950/40 dark:border-teal-900/50">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-ink">
                      Clinical Symptom Assessment
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Describe your symptoms in detail. Our AI will analyse and suggest possible causes, severity and next steps.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSymptom(patient.sample)}
                  className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-xl border border-teal-500/30 bg-teal-50/80 px-3.5 text-xs font-bold text-teal-700 shadow-2xs transition-all hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300"
                >
                  <ClipboardList aria-hidden="true" className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  Insert Patient Sample
                </button>
              </div>

              {/* Quick Symptom Presets with icons and NO emojis */}
              <div className="mt-4">
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-2.5">
                  Quick symptom presets
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Asthma Exacerbation', icon: Flame, text: 'Persistent wheezing and shortness of breath for 3 hours. Reliever inhaler used twice with only partial relief. Peak flow feeling reduced.' },
                    { label: 'Chest Discomfort', icon: Heart, text: 'Substernal chest pressure radiating toward the left shoulder for 25 minutes, with diaphoresis and mild nausea.' },
                    { label: 'High Fever & Cough', icon: Thermometer, text: 'Fever of 102.8 F for 2 days, accompanied by productive yellowish cough, chills, and fatigue.' },
                    { label: 'Throbbing Migraine', icon: Zap, text: 'Severe unilateral pulsing headache for 8 hours with acute light sensitivity and nausea.' },
                    { label: 'Stomach Pain', icon: Activity, text: 'Acute crampy epigastric abdominal pain for 4 hours with nausea and inability to tolerate oral fluids.' },
                    { label: 'Skin Rash', icon: ShieldCheck, text: 'Spreading erythematous rash on trunk and forearms with intense pruritus after new antibiotic dose.' },
                    { label: 'Breathlessness', icon: Wind, text: 'Sudden onset shortness of breath on exertion with mild lightheadedness, no chest pain.' },
                    { label: 'Fatigue', icon: Clock, text: 'Profound generalized fatigue and malaise for 5 days with low grade temperature and body aches.' },
                  ].map((preset) => {
                    const PresetIcon = preset.icon;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setSymptom(preset.text)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-all hover:border-[#3D6B56] hover:bg-[#EFF7F2] hover:text-[#2D5A43] dark:hover:bg-teal-950/50 dark:hover:text-teal-200"
                      >
                        <PresetIcon className="h-3.5 w-3.5 text-[#3D6B56]" />
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative mt-4">
                <label htmlFor="symptoms" className="sr-only">
                  Symptoms
                </label>
                <textarea
                  id="symptoms"
                  name="symptoms"
                  value={symptom}
                  onChange={(event) => setSymptom(event.target.value)}
                  rows={5}
                  maxLength={1200}
                  placeholder="Describe what you are feeling in detail (e.g. onset, pain severity, duration, medications taken)..."
                  className="w-full resize-y rounded-2xl border border-border bg-surface p-4 pr-16 text-sm leading-relaxed text-ink placeholder:text-ink-muted shadow-2xs transition-all focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                />
                <button
                  type="button"
                  onClick={onToggleSpeech}
                  disabled={!speechSupported || analyzing}
                  aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                  aria-pressed={isListening}
                  title={
                    speechSupported
                      ? isListening
                        ? 'Stop voice input'
                        : 'Speak your symptoms'
                      : 'Voice input is not supported in this browser'
                  }
                  className={cn(
                    'absolute right-3 top-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/30',
                    isListening
                      ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                      : 'border-border bg-surface-muted text-ink-secondary hover:border-teal-500 hover:text-teal-700',
                    (!speechSupported || analyzing) && 'cursor-not-allowed opacity-50'
                  )}
                >
                  {isListening ? (
                    <MicOff aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <Mic aria-hidden="true" className="h-4 w-4" />
                  )}
                  <span className="sr-only sm:not-sr-only">
                    {isListening ? 'Stop' : 'Speak'}
                  </span>
                </button>
              </div>
              <div className="mt-2 min-h-5 text-xs" aria-live="polite">
                {isListening && (
                  <p className="text-teal-700 dark:text-teal-300">
                    Listening… Speak clearly; your recognized words will be added to the symptom box.
                    {interimTranscript && (
                      <span className="ml-1 text-ink-muted">
                        Hearing: {interimTranscript}
                      </span>
                    )}
                  </p>
                )}
                {!speechSupported && (
                  <p className="text-ink-muted">
                    Voice input is unavailable in this browser. Try a current Chrome or Edge browser.
                  </p>
                )}
                {speechError && (
                  <p role="alert" className="text-signal-danger-ink">
                    {speechError}
                  </p>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/60 pt-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    title="Attach records"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink-muted hover:text-ink hover:bg-surface-muted transition"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <p className="font-mono text-xs text-ink-muted">
                    {symptom.length} / 1200 characters <span className="text-slate-400">(min. 10)</span>
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-teal-500/20',
                    canSubmit
                      ? 'bg-[#3D6B56] text-white shadow-md hover:bg-[#315745]'
                      : 'border border-border bg-surface-strong text-ink-muted cursor-not-allowed opacity-60'
                  )}
                >
                  {analyzing ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Sparkles aria-hidden="true" className="h-4 w-4 text-white" />
                  )}
                  {analyzing ? 'Evaluating Clinical Protocol…' : 'Run Manchester Triage Assessment'}
                  {!analyzing && <ArrowRight className="h-4 w-4 text-white" />}
                </button>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-xl border border-signal-danger-border bg-signal-danger-soft px-3 py-3 text-sm text-signal-danger-ink"
                >
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  {error}
                </div>
              )}
            </form>
          </ClinicalCard>

          <AnimatePresence>
            {analyzing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ClinicalCard>
                  <ThinkingLog steps={thinkingSteps} active />
                </ClinicalCard>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {result && !analyzing && (
              <motion.section
                key={result.patient_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                aria-live="polite"
              >
                <RoutingResult
                  result={result}
                  patientName={patient.name}
                  acuityMeta={acuityMeta}
                  selectedFacility={selectedFacility}
                  facilityEta={facilityEta}
                  facilityDistance={facilityDistance}
                  routeUpdate={routeUpdate}
                  declinedFacilities={declinedFacilities}
                  submittedAt={submittedAt}
                  onReset={onReset}
                  videoRoom={videoRoom}
                  videoStatus={videoStatus}
                  videoDoctor={videoDoctor}
                  videoStartedAt={videoStartedAt}
                  videoError={videoError}
                  videoEnding={videoEnding}
                  onJoinVideo={onJoinVideo}
                  onEndVideo={onEndVideo}
                  onDismissVideo={onDismissVideo}
                />
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Right column: EHR Profile Card */}
        <div className="space-y-6">
          <EHRProfileCard patient={patient} onTabChange={onTabChange} />

          {encounter && (
            <>
              <PatientRouteStatus
                patientId={patient.id}
                encounter={encounter}
                destination={selectedFacility}
                eta={facilityEta}
                careTier={encounter?.care_tier ?? result?.care_tier}
                routeUpdate={routeUpdate}
              />
              <AgentTrace
                steps={traceSteps}
                title="Your care review"
                active={analyzing}
                emptyLabel="No agent activity for this encounter yet."
                humanReadable
              />
            </>
          )}
        </div>
      </div>

      {/* Bottom Row: 3 Feature Cards (Upcoming Appointments, Medication Reminder, Recent Vitals) */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Upcoming Appointments */}
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#3D6B56]" />
              <h3 className="text-sm font-bold text-ink">Upcoming Appointments</h3>
            </div>
            <button
              type="button"
              onClick={() => onTabChange && onTabChange('appointments')}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#3D6B56] hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border/80 bg-surface-muted/40 p-3.5">
            <div className="flex flex-col items-center justify-center rounded-xl bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-center dark:bg-rose-950/40 dark:border-rose-900/50">
              <span className="font-mono text-[9px] font-extrabold uppercase text-rose-600 dark:text-rose-400">NOV</span>
              <span className="text-base font-extrabold text-rose-700 dark:text-rose-300 leading-none">05</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-ink truncate">Pulmonologist Consultation</p>
                <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.2 font-mono text-[9px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  Upcoming
                </span>
              </div>
              <p className="text-xs text-ink-secondary mt-0.5">Dr. Rhea Sharma</p>
              <p className="text-[11px] text-ink-muted mt-0.5">2:30 PM · City Care Hospital</p>
            </div>
          </div>
        </div>

        {/* Card 2: Medication Reminder */}
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-[#3D6B56]" />
              <h3 className="text-sm font-bold text-ink">Medication Reminder</h3>
            </div>
            <button
              type="button"
              onClick={() => onTabChange && onTabChange('medications')}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#3D6B56] hover:underline"
            >
              See all <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface-muted/40 p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 border border-teal-200 text-teal-700 dark:bg-teal-950/40 dark:border-teal-900/50">
                <Pill className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink truncate">
                  {nextScheduledDose?.medication.name ??
                    (medicationPlan.length
                      ? 'No scheduled dose today'
                      : 'No medicines in your plan')}
                </p>
                <p className="text-[11px] text-ink-muted">
                  {nextScheduledDose
                    ? `${nextScheduledDose.medication.dose || 'Prescribed dose'} · Scheduled at ${nextScheduledDose.time}`
                    : medicationPlan.length
                      ? 'Reminder times are set by your care team.'
                      : 'Your care team can add prescribed medicines here.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Recent Vitals (at home) */}
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-[#3D6B56]" />
              <h3 className="text-sm font-bold text-ink">Recent Vitals <span className="font-normal text-ink-muted">(at home)</span></h3>
            </div>
            <button
              type="button"
              onClick={() => onTabChange && onTabChange('vitals')}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#3D6B56] hover:underline"
            >
              Add new <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            <div className="rounded-xl border border-border/80 bg-surface-muted/40 p-2.5 text-center">
              <p className="text-[10px] font-bold uppercase text-ink-muted">BP</p>
              <p className="mt-1 text-xs font-extrabold text-ink">118/76</p>
              <p className="text-[9px] text-ink-muted">mmHg</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-surface-muted/40 p-2.5 text-center">
              <p className="text-[10px] font-bold uppercase text-ink-muted">HR</p>
              <p className="mt-1 text-xs font-extrabold text-ink">72</p>
              <p className="text-[9px] text-ink-muted">bpm</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-surface-muted/40 p-2.5 text-center">
              <p className="text-[10px] font-bold uppercase text-ink-muted">SpO2</p>
              <p className="mt-1 text-xs font-extrabold text-ink">98</p>
              <p className="text-[9px] text-ink-muted">%</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-surface-muted/40 p-2.5 text-center">
              <p className="text-[10px] font-bold uppercase text-ink-muted">Temp</p>
              <p className="mt-1 text-xs font-extrabold text-ink">36.6</p>
              <p className="text-[9px] text-ink-muted">°C</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MedicationTab({
  medicationPlan,
  takenMeds,
  onToggleMedication,
  onLogAll,
  adherenceData,
  takenCount,
  weeklyAverage,
  pushStatus,
  medicationError,
  onEnableReminders,
  pendingDoseKeys,
  storedMedicationPlan,
  onDownloadReceipt,
}) {
  const [scheduleFilter, setScheduleFilter] = useState('ALL');
  const doseSlots = getDoseSlots(medicationPlan);
  const scheduledDoseSlots = doseSlots.filter(({ time }) => time !== 'PRN');
  const nextDose =
    scheduledDoseSlots.find(({ key }) => !takenMeds[key]) ?? null;
  const openPrescriptionPdfModal = useTriageStore(
    (state) => state.openPrescriptionPdfModal
  );
  const prescriptions = useTriageStore((state) => state.prescriptions);
  const latestPrescription = prescriptions.length > 0 ? prescriptions[0] : null;
  const recentDoseEvents = [...(storedMedicationPlan?.dose_events ?? [])]
    .sort(
      (a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
    )
    .slice(0, 6);

  const allTaken =
    scheduledDoseSlots.length > 0 &&
    takenCount === scheduledDoseSlots.length;
  const prescribedCount = medicationPlan.filter(
    (medication) => medication.prescription_id
  ).length;

  const filteredMeds = (() => {
    if (scheduleFilter === 'PENDING') {
      return doseSlots.filter(({ key }) => !takenMeds[key]);
    }
    if (scheduleFilter === 'TAKEN') {
      return doseSlots.filter(({ key }) => Boolean(takenMeds[key]));
    }
    return doseSlots;
  })();

  return (
    <div>
      {/* Interactive Hero Banner with Floating Colorful Capsules & Tablets */}
      <div className="relative overflow-hidden rounded-3xl border border-[#CDE4D6] bg-gradient-to-r from-[#F0F8F4] via-[#E8F4EC] to-[#DFEEE4] p-6 sm:p-8 dark:border-[#2B4738] dark:from-[#15261E] dark:via-[#192E24] dark:to-[#14231B] shadow-xs">
        {/* Floating Colorful Capsules & Tablets Animation Layer */}
        <FloatingPillsDecoration />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100/90 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              <Pill aria-hidden="true" className="h-3.5 w-3.5" />
              Medication adherence & tracking
            </span>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl dark:text-white">
              Your medication plan
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-secondary dark:text-slate-300 sm:text-base">
              Check off each dose as you take it. Your care team uses this record to
              review adherence, track symptoms, and adjust your treatment in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 relative z-10">
            {latestPrescription && (
              <button
                type="button"
                onClick={() => openPrescriptionPdfModal(latestPrescription)}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-teal-600 px-5 text-sm font-bold text-white shadow-md transition-all hover:bg-teal-500 active:scale-95"
              >
                <FileText className="h-4 w-4" />
                <span>Official Prescription (PDF)</span>
              </button>
            )}
            <button
              type="button"
              onClick={onDownloadReceipt}
              disabled={medicationPlan.length === 0}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-700/20 bg-white/80 px-4 text-sm font-bold text-emerald-900 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/70 dark:text-emerald-200"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Medication receipt
            </button>
            <button
              type="button"
              onClick={onLogAll}
              disabled={allTaken || scheduledDoseSlots.length === 0}
              className={cn(
                'inline-flex h-11 w-fit items-center gap-2 rounded-xl border px-5 text-sm font-bold shadow-xs transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20 active:scale-95',
                allTaken
                  ? 'border-border bg-surface-strong text-ink-muted'
                  : 'border-brand bg-brand-solid text-white hover:bg-brand-solid-hover'
              )}
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              {scheduledDoseSlots.length === 0
                ? 'No scheduled doses'
                : allTaken
                  ? 'All doses logged'
                  : 'Log all as taken'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-brand-border bg-brand-soft p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Bell
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-strong"
          />
          <div>
            <p className="text-sm font-semibold text-ink">
              Reminder and care-team sync
            </p>
            <p className="mt-1 text-xs leading-5 text-ink-secondary">
              A reminder appears here when a prescribed dose is due while this
              portal is open. Enable browser reminders for alerts when it is closed.
              Reminder times use your saved local time zone.
            </p>
            {pushStatus === 'unavailable' && (
              <p className="mt-1 text-xs text-signal-amber-ink">
                Push reminders need VAPID keys configured on the backend.
              </p>
            )}
            {medicationError && (
              <p role="alert" className="mt-1 text-xs text-signal-danger-ink">
                {medicationError}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onEnableReminders}
          disabled={
            pushStatus === 'loading' ||
            pushStatus === 'enabled' ||
            pushStatus === 'unavailable' ||
            pushStatus === 'enabling'
          }
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-brand bg-surface px-3 text-xs font-semibold text-brand-strong transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Bell aria-hidden="true" className="h-3.5 w-3.5" />
          {pushStatus === 'loading'
            ? 'Loading…'
            : pushStatus === 'enabled'
              ? 'Reminders enabled'
              : pushStatus === 'enabling'
                ? 'Enabling…'
                : pushStatus === 'unavailable'
                  ? 'Not configured'
                  : pushStatus === 'denied'
                    ? 'Permission denied'
                    : 'Enable reminders'}
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Today's doses",
            value: `${takenCount}/${scheduledDoseSlots.length}`,
            detail: allTaken ? 'Complete for today' : 'Keep going',
            icon: Pill,
          },
          {
            label: 'Weekly adherence',
            value: `${weeklyAverage}%`,
            detail: 'Last 7 days',
            icon: Activity,
          },
          {
            label: 'Dose logs',
            value: String(storedMedicationPlan?.dose_events?.length ?? 0),
            detail: 'Saved to your care plan',
            icon: Flame,
          },
          {
            label: 'Next dose',
            value: nextDose?.time ?? '—',
            detail: nextDose?.medication.name ?? 'No scheduled dose pending',
            icon: Clock,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700/60"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                {stat.label}
              </p>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand-strong dark:bg-brand-soft/20 group-hover:scale-110 transition-transform">
                <stat.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-medium text-ink-muted">{stat.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {/* Elegant Medication Schedule Card */}
          <ClinicalCard className="overflow-hidden p-0 rounded-3xl border border-border shadow-xs">
            {/* Top Toolbar with Adherence Progress Bar */}
            <div className="flex flex-col gap-4 border-b border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-teal-500/15 text-teal-700 dark:text-teal-300">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-bold text-ink">
                    Today&apos;s schedule
                  </h2>
                  <span className="rounded-full bg-surface-strong px-2.5 py-0.5 font-mono text-[11px] font-bold text-ink-muted">
                    {todayLabel()}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">
                  {takenCount} of {medicationPlan.length} doses logged · {allTaken ? 'All done for today!' : `${medicationPlan.length - takenCount} remaining`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Visual Adherence Bar */}
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-muted px-3 py-1.5">
                  <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider">Progress</span>
                  <div className="h-2 w-24 sm:w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${(takenCount / medicationPlan.length) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {scheduledDoseSlots.length
                      ? Math.round((takenCount / scheduledDoseSlots.length) * 100)
                      : 0}%
                  </span>
                </div>

                {prescribedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => openPrescriptionPdfModal(latestPrescription)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-signal-success-border bg-signal-success-soft px-3 py-1.5 text-xs font-bold text-signal-success-ink transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                  >
                    <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                    <span>{prescribedCount} new prescription{prescribedCount === 1 ? '' : 's'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-border bg-surface-muted/50 px-6 py-2.5">
              {[
                { id: 'ALL', label: `All Doses (${doseSlots.length})` },
                { id: 'PENDING', label: `Pending (${doseSlots.length - takenCount})` },
                { id: 'TAKEN', label: `Completed (${takenCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScheduleFilter(tab.id)}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
                    scheduleFilter === tab.id
                      ? 'bg-brand-solid text-white shadow-xs'
                      : 'text-ink-muted hover:bg-surface-strong hover:text-ink'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Rich Elegant Schedule Item Tiles */}
            <div className="p-4 sm:p-6 space-y-3">
              {filteredMeds.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/60" />
                  <p className="mt-3 text-sm font-bold text-ink">No medications in this view</p>
                  <p className="mt-1 text-xs text-ink-muted">All doses for this filter have been logged.</p>
                </div>
              ) : (
                filteredMeds.map(({ medication, time, key }) => {
                  const taken = Boolean(takenMeds[key]);
                  const pending = pendingDoseKeys.has(key);
                  const isInhaler =
                    medication.name.toLowerCase().includes('inhaler') ||
                    medication.dose?.toLowerCase().includes('puff');
                  const isOral =
                    medication.name.toLowerCase().includes('tab') ||
                    medication.category?.toLowerCase().includes('oral') ||
                    medication.name.toLowerCase().includes('montelukast');

                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={pending || taken ? -1 : 0}
                      aria-pressed={taken}
                      aria-disabled={pending || taken}
                      onKeyDown={(event) => {
                        if (
                          !pending &&
                          !taken &&
                          (event.key === 'Enter' || event.key === ' ')
                        ) {
                          event.preventDefault();
                          onToggleMedication(medication, time);
                        }
                      }}
                      onClick={() => {
                        if (!pending && !taken) onToggleMedication(medication, time);
                      }}
                      className={cn(
                        'group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 sm:p-5 transition-all duration-200',
                        taken
                          ? 'border-emerald-300/80 bg-gradient-to-r from-emerald-50/70 via-teal-50/30 to-white dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-slate-900/40 shadow-2xs'
                          : 'border-border bg-surface hover:border-emerald-300 hover:shadow-md dark:hover:border-emerald-700/60',
                        (pending || taken) && 'cursor-not-allowed opacity-75'
                      )}
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        {/* Interactive Checkbox Ring */}
                        <div
                          className={cn(
                            'grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-all duration-200 mt-0.5',
                            taken
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-md ring-4 ring-emerald-500/15'
                              : 'border-border-strong bg-surface text-transparent group-hover:border-emerald-500 group-hover:bg-emerald-50/50 dark:group-hover:bg-emerald-950/30'
                          )}
                        >
                          <Check aria-hidden="true" className="h-5 w-5 stroke-[2.5]" />
                        </div>

                        {/* Icon Avatar */}
                        <div
                          className={cn(
                            'grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-sm font-bold',
                            isInhaler
                              ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-300'
                              : isOral
                              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                              : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                          )}
                        >
                          {isInhaler ? (
                            <Wind className="h-5 w-5" />
                          ) : isOral ? (
                            <Pill className="h-5 w-5" />
                          ) : (
                            <Sun className="h-5 w-5" />
                          )}
                        </div>

                        {/* Info details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3
                              className={cn(
                                'text-sm sm:text-base font-extrabold text-ink transition-colors',
                                taken && 'text-slate-700 dark:text-slate-300'
                              )}
                            >
                              {medication.name}
                            </h3>
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 dark:bg-teal-950/50 dark:border-teal-800 dark:text-teal-300">
                              {medication.dose}
                            </span>
                            {medication.prescription_id && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-signal-success-border bg-signal-success-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-signal-success-ink">
                                <Sparkles className="h-3 w-3" />
                                Prescribed
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                            <span className="font-semibold text-ink-secondary">
                              {medication.schedule}
                            </span>
                            {medication.category && (
                              <>
                                <span>·</span>
                                <span>{medication.category}</span>
                              </>
                            )}
                          </div>

                          {medication.note && (
                            <p className="mt-1.5 text-xs text-ink-muted flex items-center gap-1.5">
                              <span className="font-semibold text-brand-strong">Directions:</span>{' '}
                              {medication.note}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Side: Time & Status Action Pill */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t border-border sm:border-t-0">
                        <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted px-2.5 py-1 font-mono text-xs font-bold text-ink-secondary">
                          <Clock className="h-3.5 w-3.5 text-brand-strong" />
                          <span>{time === 'PRN' ? 'As needed' : time}</span>
                        </div>

                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
                            taken
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300'
                              : 'bg-surface-strong text-ink hover:bg-emerald-600 hover:text-white border border-border'
                          )}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>
                            {pending ? 'Saving…' : taken ? 'Dose Logged' : 'Mark Taken'}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Summary */}
            <div className="flex flex-col gap-2 border-t border-border bg-surface-muted px-6 py-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600" />
                {takenCount} of {scheduledDoseSlots.length} scheduled doses logged today
                {' '}({scheduledDoseSlots.length
                  ? Math.round((takenCount / scheduledDoseSlots.length) * 100)
                  : 0}% adherence)
              </span>
              <span className="font-medium text-slate-500">
                {storedMedicationPlan?.dose_events?.length
                  ? `${storedMedicationPlan.dose_events.length} dose logs synced with your care team`
                  : 'Dose history is saved to your care plan'}
              </span>
            </div>
          </ClinicalCard>

          <ClinicalCard>
            <div className="flex items-center gap-2">
              <Clock aria-hidden="true" className="h-4 w-4 text-brand-strong" />
              <h2 className="text-sm font-semibold text-ink">Recent dose activity</h2>
            </div>
            {recentDoseEvents.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                Your logged doses will appear here.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {recentDoseEvents.map((entry, index) => {
                  const medication = medicationPlan.find(
                    (item) => item.id === entry.medication_id
                  );
                  return (
                    <li
                      key={`${entry.medication_id}-${entry.scheduled_time}-${entry.taken_at}-${index}`}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {medication?.name ?? 'Medication'}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-muted">
                          {entry.scheduled_time === 'PRN'
                            ? 'As needed'
                            : `Scheduled ${entry.scheduled_time}`}
                        </span>
                      </span>
                      <time
                        dateTime={entry.taken_at}
                        className="shrink-0 text-xs text-ink-muted"
                      >
                        {formatRelativeTime(entry.taken_at)}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
          </ClinicalCard>

          <ClinicalCard className="p-0 overflow-hidden border border-border shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border bg-gradient-to-r from-surface via-surface to-surface-muted/40 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-indigo-600 text-white shadow-sm">
                    <Activity className="h-4 w-4" />
                  </span>
                  <h2 className="text-lg font-bold text-ink">
                    Weekly adherence %
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-purple-500/15 px-2.5 py-0.5 text-[11px] font-bold text-teal-800 border border-teal-500/25 dark:text-teal-200">
                    <Sparkles className="h-3 w-3 text-teal-500" />
                    7-Day Spectrum
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  Percentage of scheduled doses logged on time across the week.
                </p>
              </div>
              <div className="flex items-baseline gap-2.5 rounded-2xl bg-surface border border-border px-4 py-2 sm:text-right shadow-xs">
                <div>
                  <p className="text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-600 via-teal-500 to-indigo-600 bg-clip-text text-transparent">
                    {weeklyAverage}%
                  </p>
                  <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">7-day average</p>
                </div>
              </div>
            </div>

            <div className="h-[280px] w-full p-4 sm:p-6 bg-gradient-to-b from-surface to-surface-muted/20">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={adherenceData}
                  margin={{ top: 16, right: 12, bottom: 8, left: -10 }}
                >
                  <defs>
                    <linearGradient id="adhere-grad-Mon" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="adhere-grad-Tue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="adhere-grad-Wed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                      <stop offset="100%" stopColor="#047857" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="adhere-grad-Thu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="adhere-grad-Fri" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity={1} />
                      <stop offset="100%" stopColor="#be185d" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="adhere-grad-Sat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                      <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="adhere-grad-Sun" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                      <stop offset="100%" stopColor="#c2410c" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" opacity={0.6} />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: 'var(--chart-axis)', fontSize: 13, fontWeight: 600 }}
                    axisLine={{ stroke: 'var(--chart-grid)' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tick={{ fill: 'var(--chart-axis)', fontSize: 12, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.12)', radius: 8 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      const dayColorMap = {
                        Mon: { bg: '#06b6d4', label: 'Monday' },
                        Tue: { bg: '#3b82f6', label: 'Tuesday' },
                        Wed: { bg: '#10b981', label: 'Wednesday' },
                        Thu: { bg: '#f59e0b', label: 'Thursday' },
                        Fri: { bg: '#ec4899', label: 'Friday' },
                        Sat: { bg: '#8b5cf6', label: 'Saturday' },
                        Sun: { bg: '#f97316', label: 'Sunday' },
                      };
                      const meta = dayColorMap[data.day] || { bg: '#10b981', label: data.day };
                      return (
                        <div className="rounded-xl border border-border bg-surface p-3 shadow-xl backdrop-blur-md">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.bg }} />
                            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                              {meta.label} {data.isToday ? '(Today)' : ''}
                            </span>
                          </div>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl font-black text-ink">{data.value}%</span>
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {data.value >= 80 ? 'Optimal Adherence' : data.value >= 50 ? 'On Track' : 'Missed Doses'}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    name="Adherence"
                    barSize={34}
                    radius={[10, 10, 4, 4]}
                    background={{ fill: 'rgba(148, 163, 184, 0.08)', radius: [10, 10, 4, 4] }}
                  >
                    {adherenceData.map((entry) => (
                      <Cell
                        key={entry.day}
                        fill={`url(#adhere-grad-${entry.day})`}
                        stroke={entry.isToday ? '#ffffff' : 'transparent'}
                        strokeWidth={entry.isToday ? 2.5 : 0}
                        style={{
                          filter: entry.isToday ? 'drop-shadow(0 6px 12px rgba(16, 185, 129, 0.35))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))',
                        }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Colorful Daily Pill Breakdown Strip */}
            <div className="grid grid-cols-7 gap-1 border-t border-border bg-surface-muted/30 p-2.5 sm:gap-2 sm:p-4">
              {adherenceData.map((entry) => {
                const colorMap = {
                  Mon: { dot: 'bg-teal-500', border: 'border-teal-500/30' },
                  Tue: { dot: 'bg-blue-500', border: 'border-blue-500/30' },
                  Wed: { dot: 'bg-emerald-500', border: 'border-emerald-500/30' },
                  Thu: { dot: 'bg-amber-500', border: 'border-amber-500/30' },
                  Fri: { dot: 'bg-pink-500', border: 'border-pink-500/30' },
                  Sat: { dot: 'bg-purple-500', border: 'border-purple-500/30' },
                  Sun: { dot: 'bg-orange-500', border: 'border-orange-500/30' },
                };
                const c = colorMap[entry.day] || { dot: 'bg-emerald-500', border: 'border-emerald-500/30' };
                return (
                  <div
                    key={entry.day}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-xl p-1.5 sm:p-2 text-center transition-all',
                      entry.isToday
                        ? 'bg-surface shadow-md ring-2 ring-emerald-500 border border-emerald-400/40 scale-105'
                        : 'hover:bg-surface/60'
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span className={cn('h-2 w-2 rounded-full', c.dot)} />
                      <span className="text-[11px] font-bold text-ink">{entry.day}</span>
                    </div>
                    <span className="mt-1 font-mono text-xs font-black text-ink-secondary">
                      {entry.value}%
                    </span>
                    {entry.isToday && (
                      <span className="mt-0.5 rounded-full bg-emerald-500/20 px-1 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Today
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </ClinicalCard>
        </div>

        <div className="space-y-6">
          <ClinicalCard>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xs">
                <Clock className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold text-ink">Refill status</h2>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Estimated supply based on your current plan.
            </p>
            <div className="mt-5 space-y-4">
              {[
                { name: 'Budesonide / Formoterol', detail: '18 days remaining', pct: 72, gradient: 'from-cyan-500 to-teal-500' },
                { name: 'Albuterol', detail: '12 doses remaining', pct: 40, gradient: 'from-amber-500 to-orange-500' },
                { name: 'Montelukast', detail: '24 days remaining', pct: 86, gradient: 'from-purple-500 to-pink-500' },
              ].map((item) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-ink-secondary">{item.name}</span>
                    <span className="font-medium text-ink-muted">{item.detail}</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-strong">
                    <div
                      className={cn('h-full rounded-full bg-gradient-to-r shadow-xs', item.gradient)}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface text-sm font-medium text-ink transition-colors duration-200 hover:bg-surface-muted"
            >
              Request a refill
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </ClinicalCard>

          <ClinicalCard>
            <div className="flex items-center gap-2">
              <BookOpen aria-hidden="true" className="h-4 w-4 text-brand-strong" />
              <h2 className="text-sm font-semibold text-ink">Adherence tips</h2>
            </div>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-ink-secondary">
              <li className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-1 shrink-0 rounded-[1px] bg-brand-solid"
                />
                Pair your controller inhaler with brushing your teeth.
              </li>
              <li className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-1 shrink-0 rounded-[1px] bg-brand-solid"
                />
                Log reliever use even on days you feel well.
              </li>
              <li className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-1 shrink-0 rounded-[1px] bg-brand-solid"
                />
                Keep a spare inhaler at home and one at work.
              </li>
            </ul>
          </ClinicalCard>
        </div>
      </div>
    </div>
  );
}

function MentalHealthTab({
  mood,
  onMoodChange,
  journal,
  onJournalChange,
  saved,
  onSave,
  onPrompt,
}) {
  const moodMeta = MOOD_LEVELS.find((level) => level.value === mood) ?? MOOD_LEVELS[6];

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
            Mental health check-in
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            How are you, really?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-secondary sm:text-base">
            A private space to check in with yourself. Your entries are shared only
            with your care team.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-ink-muted">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-brand-strong" />
          Private to your care team
        </span>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <ClinicalCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  Mood tracker
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Slide from 1 to 10 to describe how you feel right now.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted px-4 py-3">
                <span className="text-3xl" aria-hidden="true">
                  {moodMeta.emoji}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {moodMeta.label}
                  </p>
                  <p className="font-mono text-xs text-ink-muted">{mood} / 10</p>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={mood}
                onChange={(event) => onMoodChange(Number(event.target.value))}
                aria-label="Mood from 1 to 10"
                className="h-2 w-full cursor-pointer appearance-none rounded-[2px] bg-surface-strong accent-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-muted">
                <span>1 · VERY LOW</span>
                <span>10 · EXCELLENT</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {MOOD_LEVELS.map((level) => {
                const isSelected = level.value === mood;

                return (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => onMoodChange(level.value)}
                    aria-label={`Mood ${level.value}: ${level.label}`}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20',
                      isSelected
                        ? 'border-brand bg-brand-soft'
                        : 'border-transparent hover:border-border hover:bg-surface-muted'
                    )}
                  >
                    <span className="text-xl" aria-hidden="true">
                      {level.emoji}
                    </span>
                    <span
                      className={cn(
                        'font-mono text-[10px]',
                        isSelected ? 'font-semibold text-brand-strong' : 'text-ink-muted'
                      )}
                    >
                      {level.value}
                    </span>
                  </button>
                );
              })}
            </div>
          </ClinicalCard>

          <ClinicalCard>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  Journal entry
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  What is on your mind today? There is no right way to do this.
                </p>
              </div>
              <span className="font-mono text-xs text-ink-muted">
                {journal.length} / 1000
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                'What helped today?',
                'What felt difficult?',
                'One thing I am grateful for',
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onPrompt(prompt)}
                  className="inline-flex h-8 items-center rounded-lg border border-border bg-surface-muted px-2.5 text-xs font-medium text-ink-secondary transition-colors duration-200 hover:border-border-strong hover:bg-surface"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <label htmlFor="journal" className="sr-only">
              Journal entry
            </label>
            <textarea
              id="journal"
              value={journal}
              onChange={(event) => onJournalChange(event.target.value)}
              rows={6}
              maxLength={1000}
              placeholder="Write freely. Your care team can review this entry before your next appointment."
              className="mt-4 w-full resize-y rounded-xl border border-border-strong bg-surface p-3 text-base leading-7 text-ink placeholder:text-ink-muted transition-all duration-200 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs text-ink-muted">
                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-brand-strong" />
                Saved privately to your clinical record.
              </p>
              <button
                type="button"
                onClick={onSave}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-brand bg-brand-solid px-4 text-sm font-semibold text-white transition-all duration-200 hover:bg-brand-solid-hover focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Save check-in
              </button>
            </div>

            <AnimatePresence>
              {saved && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4 flex items-center gap-2 rounded-xl border border-signal-success-border bg-signal-success-soft px-3 py-2.5 text-sm text-signal-success-ink"
                  role="status"
                >
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  Check-in saved. Your care team has been notified.
                </motion.div>
              )}
            </AnimatePresence>
          </ClinicalCard>

        </div>

        <div className="space-y-6">
          <ClinicalCard>
            <h2 className="text-sm font-semibold text-ink">Recent check-ins</h2>
            <ul className="mt-4 space-y-4">
              {MOOD_HISTORY.map((entry) => {
                const meta =
                  MOOD_LEVELS.find((level) => level.value === entry.mood) ??
                  MOOD_LEVELS[4];

                return (
                  <li
                    key={entry.date}
                    className="border-b border-border pb-4 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span className="text-lg" aria-hidden="true">
                          {meta.emoji}
                        </span>
                        <span className="text-xs font-medium text-ink-secondary">
                          {meta.label}
                        </span>
                      </span>
                      <span className="font-mono text-xs text-ink-muted">
                        {entry.date}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink-secondary">{entry.note}</p>
                  </li>
                );
              })}
            </ul>
          </ClinicalCard>

          <CareTeamCard />

          <div className="rounded-xl border border-signal-amber-border bg-signal-amber-soft p-5">
            <div className="flex items-center gap-2 text-signal-amber-ink">
              <HeartPulse aria-hidden="true" className="h-4 w-4" />
              <p className="text-sm font-semibold">You are not alone</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-signal-amber-ink">
              If you are having thoughts of self-harm, please call one of the
              resources above or go to your nearest emergency department.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PatientPortal() {
  const navigate = useNavigate();
  const facilities = useTriageStore((state) => state.facilities);
  const currentPatient = useTriageStore((state) => state.currentPatient);
  const triageResult = useTriageStore((state) => state.triageResult);
  const setCurrentPatient = useTriageStore((state) => state.setCurrentPatient);
  const setTriageResult = useTriageStore((state) => state.setTriageResult);
  const clearTriage = useTriageStore((state) => state.clearTriage);
  const socketConnected = useTriageStore((state) => state.socketConnected);
  const auth = useTriageStore((state) => state.auth);
  const encounters = useTriageStore((state) => state.encounters);
  const activeEncounterId = useTriageStore((state) => state.activeEncounterId);
  const agentTrace = useTriageStore((state) => state.agentTrace);
  const agentTraceEncounterId = useTriageStore(
    (state) => state.agentTraceEncounterId
  );
  const prescriptions = useTriageStore((state) => state.prescriptions);
  const setActiveEncounter = useTriageStore((state) => state.setActiveEncounter);
  const setAgentTrace = useTriageStore((state) => state.setAgentTrace);

  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    return requestedTab === 'medications' ? requestedTab : 'chat';
  });
  const [symptom, setSymptom] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState('');
  const speechSupported = Boolean(
    typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
  );
  const speechRecognition = useRef(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState([]);
  const [error, setError] = useState('');
  const [submittedAt, setSubmittedAt] = useState(null);
  const [isRerouting, setIsRerouting] = useState(false);
  const [rerouteNotice, setRerouteNotice] = useState(null);
  const [displayedFacility, setDisplayedFacility] = useState(null);
  const [revealedRoute, setRevealedRoute] = useState(null);
  const [takenMeds, setTakenMeds] = useState({});
  const [dueDoseReminders, setDueDoseReminders] = useState([]);
  const remindedDoseKeys = useRef(new Set());
  const [storedMedicationPlan, setStoredMedicationPlan] = useState(null);
  const [medicationPlanUserId, setMedicationPlanUserId] = useState(null);
  const [medicationError, setMedicationError] = useState('');
  const [pendingDoseKeys, setPendingDoseKeys] = useState(() => new Set());
  const [pushPublicKey, setPushPublicKey] = useState('');
  const [pushStatus, setPushStatus] = useState('loading');
  const [dismissedEncounterId, setDismissedEncounterId] = useState(null);
  const [mood, setMood] = useState(7);
  const [journal, setJournal] = useState('');
  const [checkInSaved, setCheckInSaved] = useState(false);
  const [videoRoom, setVideoRoom] = useState('');
  const [videoStatus, setVideoStatus] = useState('idle');
  const [videoDoctor, setVideoDoctor] = useState(null);
  const [videoStartedAt, setVideoStartedAt] = useState(null);
  const [videoError, setVideoError] = useState('');
  const [videoEnding, setVideoEnding] = useState(false);
  const [doctorAssignmentNotice, setDoctorAssignmentNotice] = useState(null);
  const acceptedEncounterNotifications = useRef(new Set());
  const stepTimer = useRef(null);
  const rerouteTimer = useRef(null);
  const reroutingRef = useRef(false);
  const savedTimer = useRef(null);

  useEffect(() => {
    return () => {
      const recognition = speechRecognition.current;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
      speechRecognition.current = null;
    };
  }, []);

  const handleToggleSpeech = () => {
    if (isListening) {
      speechRecognition.current?.stop();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Voice input is not supported by this browser.');
      return;
    }

    setSpeechError('');
    setInterimTranscript('');

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript ?? '';
        if (event.results[index].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      setInterimTranscript(interimText.trim());
      if (finalText.trim()) {
        setSymptom((current) => {
          const prefix = current.trimEnd();
          const separator = prefix && !/\s$/.test(current) ? ' ' : '';
          return `${prefix}${separator}${finalText.trim()}`.slice(0, 1200);
        });
      }
    };
    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'Microphone access was denied. Allow microphone access in your browser and try again.',
        'service-not-allowed': 'The browser speech-recognition service is unavailable.',
        'audio-capture': 'No microphone was detected. Connect or enable a microphone and try again.',
        'no-speech': 'No speech was detected. Try speaking a little louder.',
        network: 'Speech recognition needs a network connection. Check your connection and try again.',
      };
      setSpeechError(
        messages[event.error] || 'Voice input stopped unexpectedly. Please try again.'
      );
      setIsListening(false);
      setInterimTranscript('');
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      speechRecognition.current = null;
    };

    speechRecognition.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (startError) {
      speechRecognition.current = null;
      setIsListening(false);
      setSpeechError(
        startError instanceof Error
          ? `Could not start voice input: ${startError.message}`
          : 'Could not start voice input. Please try again.'
      );
    }
  };

  // Direct session loads (page refresh) have no in-memory patient, so restore
  // the record that matches the authenticated user. Registered accounts get a
  // minimal profile derived from their own identity rather than patient_001.
  const sessionPatient = useMemo(() => buildPatientProfile(auth), [auth]);
  const patient = currentPatient ?? sessionPatient ?? DEMO_PATIENTS[0];
  const canSubmit =
    symptom.trim().length >= 10 && !analyzing && !isListening;

  const patientEncounter = useMemo(() => {
    const owned = encounters.filter(
      (encounter) => encounter.patient_id === patient.id
    );

    return (
      owned.find((encounter) =>
        ACTIVE_ENCOUNTER_STATUSES.includes(encounter.status)
      ) ??
      owned[0] ??
      null
    );
  }, [encounters, patient.id]);

  // "New assessment" dismisses the previous case locally without deleting it
  // from the shared encounter record.
  const visibleEncounter =
    patientEncounter?.id === dismissedEncounterId ? null : patientEncounter;

  // Derived once so the video handler does not depend on the memoized result
  // object that is declared later in the component.
  const videoAcuity = triageResult?.acuity ?? visibleEncounter?.acuity ?? null;

  const traceSteps = useMemo(() => {
    if (
      agentTrace.length > 0 &&
      (!agentTraceEncounterId ||
        !visibleEncounter ||
        agentTraceEncounterId === visibleEncounter.id)
    ) {
      return agentTrace;
    }

    return visibleEncounter?.agent_trace ?? [];
  }, [agentTrace, agentTraceEncounterId, visibleEncounter]);

  const localMedicationPlan = useMemo(() => {
    const seen = new Set(
      MEDICATION_PLAN.map((medication) => medication.name.toLowerCase())
    );

    const prescribed = prescriptions.flatMap((prescription) =>
      (prescription.medications ?? []).flatMap((medication, index) => {
        const key = String(medication.name ?? '').toLowerCase();

        if (!key || seen.has(key)) return [];
        seen.add(key);

        const times = inferMedicationTimes(medication);
        const asNeeded = Boolean(medication.as_needed);
        return [
          {
            id: `rx-${prescription.prescription_id}-${index}`,
            name: medication.name,
            dose: medication.dosage || 'As directed',
            schedule: medication.schedule || 'As directed',
            times,
            time: times.length
              ? times.join(' · ')
              : asNeeded
                ? 'As needed'
                : 'Reminder times not set',
            doses_per_day: medication.doses_per_day || 1,
            as_needed: asNeeded,
            category: prescription.doctor_name
              ? `Prescribed by ${prescription.doctor_name}`
              : 'New prescription',
            note:
              prescription.instructions ||
              medication.note ||
              'Added from your latest consultation.',
            defaultTaken: false,
            prescription_id: prescription.prescription_id,
            doctor_name: prescription.doctor_name ?? '',
          },
        ];
      })
    );

    return [...prescribed, ...MEDICATION_PLAN];
  }, [prescriptions]);
  const patientMedicationPlan =
    medicationPlanUserId === auth?.userId ? storedMedicationPlan : null;
  const medicationPlan = useMemo(() => {
    const stored = (patientMedicationPlan?.medications ?? []).map((medication) => {
      const times = inferMedicationTimes(medication);
      return {
        ...medication,
        dose: medication.dosage || medication.dose || 'As directed',
        schedule: medication.schedule || 'As directed',
        times,
        time: times.length
          ? times.join(' · ')
          : medication.as_needed
            ? 'As needed'
            : 'Reminder times not set',
        doses_per_day: medication.doses_per_day || times.length || 1,
        as_needed: Boolean(medication.as_needed),
        category: medication.category || 'Medication plan',
        doctor_name: medication.doctor_name ?? '',
      };
    });
    const storedNames = new Set(
      stored.map((medication) => medication.name.toLowerCase())
    );
    const additional = localMedicationPlan.filter(
      (medication) => !storedNames.has(medication.name.toLowerCase())
    );

    return [...stored, ...additional];
  }, [localMedicationPlan, patientMedicationPlan]);

  useEffect(() => {
    if (auth?.role !== 'PATIENT' || !auth?.userId) return undefined;
    let active = true;

    api
      .get('/medications/plan')
      .then(({ data }) => {
        if (!active) return;
        const plan = data.plan ?? null;
        setStoredMedicationPlan(plan);
        setMedicationPlanUserId(auth.userId);
        setPushPublicKey(data.push_public_key ?? '');
        setMedicationError('');
        setPushStatus(data.push_public_key ? 'ready' : 'unavailable');

        const today = getTodayInTimezone(plan?.timezone);
        setTakenMeds(
          Object.fromEntries(
            (plan?.dose_events ?? [])
              .filter((entry) => entry.date === today)
              .map((entry) => [
                medicationDoseKey(entry.medication_id, entry.scheduled_time),
                true,
              ])
          )
        );
      })
      .catch((requestError) => {
        if (!active) return;
        setMedicationError(
          getApiErrorMessage(
            requestError,
            'Your medication plan could not be loaded.'
          )
        );
        setPushStatus('error');
      });

    return () => {
      active = false;
    };
  }, [auth?.role, auth?.userId]);

  useEffect(() => {
    if (
      medicationPlanUserId !== auth?.userId ||
      auth?.role !== 'PATIENT' ||
      !auth?.userId
    ) {
      return;
    }

    api
      .put('/medications/plan', {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        medications: medicationPlan.map((medication) => ({
          id: medication.id,
          name: medication.name,
          dosage: medication.dose ?? '',
          schedule: medication.schedule ?? '',
          doses_per_day:
            medication.doses_per_day || medication.times?.length || 1,
          times: medication.times ?? [],
          note: medication.note ?? '',
          category: medication.category ?? '',
          prescription_id: medication.prescription_id ?? null,
          doctor_name: medication.doctor_name ?? '',
          as_needed: Boolean(medication.as_needed),
        })),
      })
      .catch((requestError) => {
        setMedicationError(
          getApiErrorMessage(
            requestError,
            'Your medication schedule could not be saved.'
          )
        );
      });
  }, [auth?.role, auth?.userId, medicationPlan, medicationPlanUserId]);

  useEffect(() => {
    if (auth?.role !== 'PATIENT' || !auth?.userId) return undefined;
    let active = true;

    const showDoctorAcceptance = ({
      patient_id: patientId,
      encounter_id: encounterId,
      doctor_name: doctorName,
    }) => {
      if (
        patientId !== auth.userId ||
        !encounterId ||
        acceptedEncounterNotifications.current.has(encounterId)
      ) {
        return;
      }

      acceptedEncounterNotifications.current.add(encounterId);
      setDoctorAssignmentNotice({
        encounterId,
        doctorName: doctorName || 'Your doctor',
      });
    };

    const handleEncounterUpdated = (payload) => {
      const encounter = payload?.encounter ?? payload;
      if (encounter?.patient_id !== auth.userId) return;

      api
        .get('/medications/plan')
        .then(({ data }) => {
          if (!active) return;
          const plan = data.plan ?? null;
          setStoredMedicationPlan(plan);
          setMedicationPlanUserId(auth.userId);
          setPushPublicKey(data.push_public_key ?? '');
          const today = getTodayInTimezone(plan?.timezone);
          setTakenMeds(
            Object.fromEntries(
              (plan?.dose_events ?? [])
                .filter((entry) => entry.date === today)
                .map((entry) => [
                  medicationDoseKey(entry.medication_id, entry.scheduled_time),
                  true,
                ])
            )
          );
        })
        .catch((requestError) => {
          if (!active) return;
          setMedicationError(
            getApiErrorMessage(
              requestError,
              'Your updated medication plan could not be loaded.'
            )
          );
        });
    };

    const handleDoctorAccepted = (payload) => {
      showDoctorAcceptance(payload ?? {});
    };

    socket.on('ENCOUNTER_UPDATED', handleEncounterUpdated);
    socket.on('DOCTOR_ACCEPTED', handleDoctorAccepted);
    return () => {
      active = false;
      socket.off('ENCOUNTER_UPDATED', handleEncounterUpdated);
      socket.off('DOCTOR_ACCEPTED', handleDoctorAccepted);
    };
  }, [auth?.role, auth?.userId]);

  useEffect(() => {
    if (visibleEncounter?.id && visibleEncounter.id !== activeEncounterId) {
      setActiveEncounter(visibleEncounter.id);
    }
  }, [activeEncounterId, setActiveEncounter, visibleEncounter?.id]);

  const resetVideo = () => {
    setVideoRoom('');
    setVideoStatus('idle');
    setVideoDoctor(null);
    setVideoStartedAt(null);
    setVideoError('');
    setVideoEnding(false);
  };

  useEffect(() => {
    if (!currentPatient) {
      setCurrentPatient(sessionPatient ?? DEMO_PATIENTS[0]);
    }
  }, [currentPatient, sessionPatient, setCurrentPatient]);

  useEffect(() => {
    return () => {
      if (stepTimer.current) window.clearInterval(stepTimer.current);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleRouteUpdated = (payload) => {
      if (
        !payload ||
        payload.patient_id !== patient.id ||
        !visibleEncounter?.id ||
        payload.encounter_id !== visibleEncounter.id
      ) {
        return;
      }

      if (rerouteTimer.current) window.clearTimeout(rerouteTimer.current);

      reroutingRef.current = true;
      setIsRerouting(true);
      setRerouteNotice({
        facilityName:
          payload.selected_facility?.name ?? 'the nearest available facility',
        reason:
          payload.reason ?? 'Your previous facility is no longer available.',
      });

      rerouteTimer.current = window.setTimeout(() => {
        reroutingRef.current = false;
        setIsRerouting(false);
        setDisplayedFacility(payload.selected_facility ?? null);
        setRevealedRoute(payload);
        setRerouteNotice(null);
        rerouteTimer.current = null;
      }, 2000);
    };

    socket.on('ROUTE_UPDATED', handleRouteUpdated);

    return () => {
      socket.off('ROUTE_UPDATED', handleRouteUpdated);
      if (rerouteTimer.current) {
        window.clearTimeout(rerouteTimer.current);
        rerouteTimer.current = null;
      }
      reroutingRef.current = false;
    };
  }, [patient.id, visibleEncounter?.id]);

  useEffect(() => {
    if (reroutingRef.current) return;

    if (!triageResult) {
      setDisplayedFacility(null);
      setRevealedRoute(null);
      return;
    }

    setDisplayedFacility(triageResult.selected_facility ?? null);
    setRevealedRoute(triageResult.route_update ?? null);
  }, [triageResult]);

  useEffect(() => {
    if (!videoRoom) return undefined;

    const handleCallAccepted = (payload) => {
      if (!payload || payload.room_id !== videoRoom) return;

      setVideoDoctor({
        name: payload.doctor_name ?? 'Clinician',
        specialty: payload.specialty ?? '',
      });
      setVideoStatus('active');
      setVideoError('');
    };

    const handleCallEnded = (payload) => {
      if (!payload || payload.room_id !== videoRoom) return;

      setVideoStatus('ended');
      setVideoEnding(false);
    };

    socket.on('VIDEO_CALL_ACCEPTED', handleCallAccepted);
    socket.on('VIDEO_CALL_ENDED', handleCallEnded);

    return () => {
      socket.off('VIDEO_CALL_ACCEPTED', handleCallAccepted);
      socket.off('VIDEO_CALL_ENDED', handleCallEnded);
    };
  }, [videoRoom]);

  const startThinkingSequence = () => {
    setThinkingSteps([]);
    let index = 0;

    if (stepTimer.current) window.clearInterval(stepTimer.current);

    stepTimer.current = window.setInterval(() => {
      index += 1;
      setThinkingSteps(THINKING_STEPS.slice(0, index));

      if (index >= THINKING_STEPS.length && stepTimer.current) {
        window.clearInterval(stepTimer.current);
      }
    }, 300);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    const previousResult = triageResult;
    const previousDismissedId = dismissedEncounterId;
    const previousSubmittedAt = submittedAt;

    resetVideo();

    if (rerouteTimer.current) {
      window.clearTimeout(rerouteTimer.current);
      rerouteTimer.current = null;
    }
    reroutingRef.current = false;
    setIsRerouting(false);
    setRerouteNotice(null);
    setDisplayedFacility(null);
    setRevealedRoute(null);
    setDismissedEncounterId(patientEncounter?.id ?? null);
    setAnalyzing(true);
    setError('');
    setTriageResult(null);
    setSubmittedAt(Date.now());
    startThinkingSequence();

    try {
      const [response] = await Promise.all([
        api.post('/triage/submit', {
          symptom_text: symptom.trim(),
        }),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);

      setTriageResult(response.data);
      setDismissedEncounterId(null);
      setAgentTrace(
        response.data.agent_trace ?? [],
        response.data.encounter_id ?? null
      );
    } catch (requestError) {
      // A failed submission must not erase the previous decision.
      setTriageResult(previousResult);
      setDismissedEncounterId(previousDismissedId);
      setSubmittedAt(previousSubmittedAt);
      setError(
        getApiErrorMessage(
          requestError,
          'The triage engine could not complete this request.'
        )
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    if (speechRecognition.current) {
      speechRecognition.current.stop();
      speechRecognition.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
    setSpeechError('');
    resetVideo();

    if (rerouteTimer.current) {
      window.clearTimeout(rerouteTimer.current);
      rerouteTimer.current = null;
    }
    reroutingRef.current = false;
    setIsRerouting(false);
    setRerouteNotice(null);
    setDisplayedFacility(null);
    setRevealedRoute(null);
    setSymptom('');
    setError('');
    setThinkingSteps([]);
    setSubmittedAt(null);
    setDismissedEncounterId(patientEncounter?.id ?? null);
    clearTriage();
  };

  const handleJoinVideo = async () => {
    if (videoStatus === 'connecting') return;

    setVideoStatus('connecting');
    setVideoError('');

    try {
      const { data } = await api.post('/video/create-room', {
        patient_id: patient.id,
        patient_name: patient.name,
        acuity: videoAcuity,
      });

      setVideoRoom(data.room_id ?? `TH-ROOM-${patient.id}`);
      setVideoStartedAt(Date.now());
      setVideoDoctor(null);
      setVideoStatus('waiting');
    } catch (requestError) {
      setVideoError(
        getApiErrorMessage(requestError, 'Unable to open the video consultation.')
      );
      setVideoStatus('idle');
    }
  };

  const handleEndVideo = async () => {
    if (!videoRoom || videoEnding) return;

    setVideoEnding(true);
    setVideoError('');

    const duration = videoStartedAt
      ? Math.max(0, Math.round((Date.now() - videoStartedAt) / 1000))
      : 0;

    try {
      await api.post('/video/end', {
        room_id: videoRoom,
        duration_sec: duration,
        prescription_sent: false,
      });
    } catch (requestError) {
      setVideoError(
        getApiErrorMessage(requestError, 'The call ended locally but the network did not confirm it.')
      );
    } finally {
      setVideoStatus('ended');
      setVideoEnding(false);
    }
  };

  const handleDismissVideo = () => {
    resetVideo();
  };

  const handleSignOut = () => {
    navigate('/logout', { replace: true });
  };

  const handleToggleMedication = async (medication, scheduledTime) => {
    const key = medicationDoseKey(medication.id, scheduledTime);
    if (
      medicationPlanUserId !== auth?.userId ||
      pendingDoseKeys.has(key) ||
      takenMeds[key]
    ) {
      return false;
    }

    setMedicationError('');
    setPendingDoseKeys((previous) => new Set(previous).add(key));
    try {
      const { data } = await api.post('/medications/dose', {
        medication_id: medication.id,
        scheduled_time: scheduledTime,
      });
      setStoredMedicationPlan(data.plan ?? null);
      if (scheduledTime !== 'PRN') {
        setTakenMeds((previous) => ({ ...previous, [key]: true }));
      }
      return true;
    } catch (requestError) {
      setMedicationError(
        getApiErrorMessage(
          requestError,
          `Unable to record ${medication.name} as taken.`
        )
      );
      return false;
    } finally {
      setPendingDoseKeys((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
    }
  };

  const handleLogAll = async () => {
    const remaining = getDoseSlots(medicationPlan).filter(
      ({ time, key }) => time !== 'PRN' && !takenMeds[key]
    );
    for (const { medication, time } of remaining) {
      await handleToggleMedication(medication, time);
    }
  };

  const handleEnableReminders = async () => {
    if (medicationPlanUserId !== auth?.userId || !pushPublicKey) {
      setPushStatus('unavailable');
      setMedicationError(
        'The backend does not have Web Push VAPID keys configured yet.'
      );
      return;
    }
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setPushStatus('error');
      setMedicationError(
        'This browser does not support background push reminders.'
      );
      return;
    }

    setPushStatus('enabling');
    setMedicationError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('denied');
        return;
      }

      const registration = await navigator.serviceWorker.register(
        '/medication-service-worker.js'
      );
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodePushKey(pushPublicKey),
        }));

      await api.post('/medications/push-subscription', {
        subscription: subscription.toJSON(),
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      setPushStatus('enabled');
    } catch (requestError) {
      setPushStatus('error');
      setMedicationError(
        getApiErrorMessage(
          requestError,
          'Browser reminders could not be enabled.'
        )
      );
    }
  };

  const handleDownloadReceipt = () => {
    try {
      downloadPrescriptionReceipt({
        medications: medicationPlan.map((medication) => ({
          ...medication,
          doctor_name:
            medication.doctor_name ||
            prescriptions.find(
              (prescription) =>
                prescription.prescription_id === medication.prescription_id
            )?.doctor_name ||
            '',
        })),
        patientName: patient.name,
      });
      setMedicationError('');
    } catch (requestError) {
      setMedicationError(
        requestError instanceof Error
          ? requestError.message
          : 'The medication receipt could not be downloaded.'
      );
    }
  };

  const handleSaveCheckIn = () => {
    setCheckInSaved(true);

    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => {
      setCheckInSaved(false);
      savedTimer.current = null;
    }, 4000);
  };

  const handlePrompt = (prompt) => {
    setJournal((previous) => {
      const prefix = previous.trim() ? `${previous.trim()}\n\n` : '';
      return `${prefix}${prompt} `;
    });
  };

  const result = useMemo(() => {
    if (triageResult) return triageResult;
    if (!visibleEncounter) return null;

    return {
      patient_id: visibleEncounter.patient_id,
      encounter_id: visibleEncounter.id,
      status: visibleEncounter.status,
      acuity: visibleEncounter.acuity,
      care_tier: visibleEncounter.care_tier,
      protocol_matched: visibleEncounter.protocol_matched,
      selected_facility:
        visibleEncounter.route_update?.selected_facility !== undefined
          ? visibleEncounter.route_update.selected_facility
          : visibleEncounter.selected_facility ??
            visibleEncounter.facility_snapshot ??
            null,
      rejected_facilities: visibleEncounter.rejected_facilities ?? [],
      special_flags: visibleEncounter.special_flags ?? [],
      risk_modifiers: visibleEncounter.risk_modifiers ?? [],
      agent_rationale: visibleEncounter.agent_rationale ?? [],
      agent_trace: visibleEncounter.agent_trace ?? [],
      timeline: visibleEncounter.timeline ?? [],
      assigned_doctor_id: visibleEncounter.assigned_doctor_id ?? null,
      assigned_doctor_name: visibleEncounter.assigned_doctor_name ?? null,
      prescription: visibleEncounter.prescription ?? null,
      route_update: visibleEncounter.route_update ?? null,
      timestamp: visibleEncounter.created_at,
    };
  }, [triageResult, visibleEncounter]);
  const acuityMeta = result ? getAcuityMeta(result.acuity) : null;
  const routeUpdate =
    [revealedRoute, result?.route_update].find(
      (route) => route && route.encounter_id === visibleEncounter?.id
    ) ?? null;
  const selectedFacility = routeUpdate
    ? routeUpdate.selected_facility ?? null
    : displayedFacility ?? result?.selected_facility ?? null;
  const liveFacility = facilities.find(
    (facility) => facility.id === selectedFacility?.id
  );
  const facilityEta = selectedFacility?.eta_min ?? liveFacility?.eta_min ?? null;
  const facilityDistance =
    selectedFacility?.distance_km ?? liveFacility?.distance_km ?? null;
  const declinedFacilities = (result?.rejected_facilities ?? [])
    .filter((facility) => facility.id !== selectedFacility?.id)
    .filter(
      (facility, index, list) =>
        list.findIndex((entry) => entry.id === facility.id) === index
    );

  const doseSlots = getDoseSlots(medicationPlan);
  const scheduledDoseSlots = doseSlots.filter(({ time }) => time !== 'PRN');
  const takenCount = scheduledDoseSlots.filter(({ key }) => takenMeds[key]).length;
  const adherenceData = getLastSevenDays(
    patientMedicationPlan?.timezone,
    patientMedicationPlan?.dose_events ?? [],
    scheduledDoseSlots.length
  );
  const weeklyAverage = Math.round(
    adherenceData.reduce((sum, entry) => sum + entry.value, 0) /
      adherenceData.length
  );

  useEffect(() => {
    if (
      auth?.role !== 'PATIENT' ||
      medicationPlanUserId !== auth?.userId ||
      !patientMedicationPlan
    ) {
      return undefined;
    }

    const checkScheduledDoses = () => {
      const { date, time } = getLocalDateTime(
        patientMedicationPlan.timezone
      );
      const dueNow = medicationPlan.flatMap((medication) => {
        if (medication.as_needed) return [];

        return (medication.times ?? [])
          .filter((scheduledTime) => scheduledTime === time)
          .filter(
            (scheduledTime) =>
              !takenMeds[medicationDoseKey(medication.id, scheduledTime)] &&
              !(patientMedicationPlan.dose_events ?? []).some(
                (event) =>
                  event.date === date &&
                  event.medication_id === medication.id &&
                  event.scheduled_time === scheduledTime
              )
          )
          .map((scheduledTime) => ({
            patientId: auth.userId,
            date,
            medication,
            time: scheduledTime,
            key: `${auth.userId}:${date}:${medicationDoseKey(
              medication.id,
              scheduledTime
            )}`,
          }));
      });
      const newReminders = dueNow.filter((reminder) => {
        if (remindedDoseKeys.current.has(reminder.key)) return false;
        remindedDoseKeys.current.add(reminder.key);
        return true;
      });

      if (newReminders.length > 0) {
        setDueDoseReminders((previous) => {
          const existingKeys = new Set(previous.map((reminder) => reminder.key));
          return [
            ...previous,
            ...newReminders.filter(
              (reminder) => !existingKeys.has(reminder.key)
            ),
          ];
        });
      }
    };

    const initialCheck = window.setTimeout(checkScheduledDoses, 0);
    const timer = window.setInterval(checkScheduledDoses, 15000);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(timer);
    };
  }, [
    auth?.role,
    auth?.userId,
    medicationPlan,
    medicationPlanUserId,
    patientMedicationPlan,
    takenMeds,
  ]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {doctorAssignmentNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-20 z-[70] w-[calc(100vw-2rem)] max-w-md rounded-xl border border-emerald-300 bg-white p-4 shadow-xl dark:border-emerald-800 dark:bg-slate-900 sm:right-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">
                Your doctor has accepted your case
              </p>
              <p className="mt-1 text-sm text-ink-secondary">
                {doctorAssignmentNotice.doctorName} is now assigned to your care.
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss doctor assignment notification"
              onClick={() => setDoctorAssignmentNotice(null)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {dueDoseReminders
        .filter((reminder) => reminder.patientId === auth?.userId)
        .map((reminder) => (
        <div
          key={reminder.key}
          role="alert"
          aria-live="assertive"
          className="fixed right-4 top-32 z-[70] w-[calc(100vw-2rem)] max-w-md rounded-xl border border-amber-300 bg-white p-4 shadow-xl dark:border-amber-800 dark:bg-slate-900 sm:right-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <Bell aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">Medication dose due now</p>
              <p className="mt-1 text-sm text-ink-secondary">
                {reminder.medication.name}
                {reminder.medication.dose
                  ? ` · ${reminder.medication.dose}`
                  : ''}
                {' '}· Scheduled for {reminder.time}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const recorded = await handleToggleMedication(
                      reminder.medication,
                      reminder.time
                    );
                    if (recorded) {
                      setDueDoseReminders((previous) =>
                        previous.filter((item) => item.key !== reminder.key)
                      );
                    }
                  }}
                  className="rounded-lg bg-brand-solid px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-solid-hover"
                >
                  Mark as taken
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('medications')}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-muted"
                >
                  Open medication plan
                </button>
              </div>
            </div>
            <button
              type="button"
              aria-label={`Dismiss reminder for ${reminder.medication.name}`}
              onClick={() =>
                setDueDoseReminders((previous) =>
                  previous.filter((item) => item.key !== reminder.key)
                )
              }
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
        ))}
      <PatientSidebar
        patient={patient}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSignOut={handleSignOut}
        socketConnected={socketConnected}
      />

      <div className="lg:pl-64">
        <PatientTopbar
          patient={patient}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSignOut={handleSignOut}
          socketConnected={socketConnected}
        />

        <AnimatePresence>
          {isRerouting && rerouteNotice && (
            <motion.div
              key="reroute-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              role="status"
              aria-live="assertive"
              className="sticky top-16 z-10 border-b border-signal-amber-border bg-signal-amber-soft"
            >
              <div className="mx-auto flex w-full max-w-[1200px] items-start gap-3 px-4 py-3 sm:px-6 lg:px-8">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-signal-amber-ink"
                />
                <div>
                  <p className="text-sm font-semibold text-signal-amber-ink">
                    Facility unavailable. Rerouting to{' '}
                    <span className="font-bold">{rerouteNotice.facilityName}</span>…
                  </p>
                  <p className="mt-1 text-xs leading-5 text-signal-amber-ink">
                    {rerouteNotice.reason}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {activeTab === 'chat' && (
            <TriageTab
              patient={patient}
              encounter={visibleEncounter}
              traceSteps={traceSteps}
              symptom={symptom}
              setSymptom={setSymptom}
              isListening={isListening}
              interimTranscript={interimTranscript}
              speechSupported={speechSupported}
              speechError={speechError}
              onToggleSpeech={handleToggleSpeech}
              canSubmit={canSubmit}
              analyzing={analyzing}
              thinkingSteps={thinkingSteps}
              error={error}
              onSubmit={handleSubmit}
              onReset={handleReset}
              result={result}
              acuityMeta={acuityMeta}
              selectedFacility={selectedFacility}
              facilityEta={facilityEta}
              facilityDistance={facilityDistance}
              routeUpdate={routeUpdate}
              declinedFacilities={declinedFacilities}
              submittedAt={submittedAt}
              videoRoom={videoRoom}
              videoStatus={videoStatus}
              videoDoctor={videoDoctor}
              videoStartedAt={videoStartedAt}
              videoError={videoError}
              videoEnding={videoEnding}
              onJoinVideo={handleJoinVideo}
              onEndVideo={handleEndVideo}
              onDismissVideo={handleDismissVideo}
              onTabChange={setActiveTab}
              medicationPlan={medicationPlan}
              takenMeds={takenMeds}
            />
          )}

          {activeTab === 'medications' && (
            <MedicationTab
              medicationPlan={medicationPlan}
              takenMeds={takenMeds}
              onToggleMedication={handleToggleMedication}
              onLogAll={handleLogAll}
              adherenceData={adherenceData}
              takenCount={takenCount}
              weeklyAverage={weeklyAverage}
              pushStatus={
                medicationPlanUserId === auth?.userId ? pushStatus : 'loading'
              }
              medicationError={medicationError}
              onEnableReminders={handleEnableReminders}
              onDownloadReceipt={handleDownloadReceipt}
              pendingDoseKeys={pendingDoseKeys}
              storedMedicationPlan={patientMedicationPlan}
            />
          )}

          {activeTab === 'mental-health' && (
            <MentalHealthTab
              mood={mood}
              onMoodChange={setMood}
              journal={journal}
              onJournalChange={setJournal}
              saved={checkInSaved}
              onSave={handleSaveCheckIn}
              onPrompt={handlePrompt}
            />
          )}
        </main>
      </div>
    </div>
  );
}
