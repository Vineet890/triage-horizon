import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  Droplets,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  HeartPulse,
  History,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  PhoneCall,
  Pill,
  Plus,
  Printer,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Thermometer,
  Trash2,
  User,
  Users,
  Video,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import api, { getApiErrorMessage } from '../lib/api';
import socket from '../lib/socket';
import { ACUITY_ORDER, getAcuityMeta, getCareTierLabel } from '../lib/clinical';
import {
  DEMO_PATIENTS,
  PATIENT_DIRECTORY,
  patientVitals,
} from '../lib/demoPatients';
import useTriageStore, {
  ACTIVE_ENCOUNTER_STATUSES,
} from '../store/useTriageStore';
import {
  cn,
  formatDate,
  formatRelativeTime,
  formatTime,
  initials,
} from '../lib/utils';
import AcuityBadge from '../components/AcuityBadge';
import AgentTrace from '../components/AgentTrace';
import ClinicalCard from '../components/ClinicalCard';
import EncounterRail from '../components/EncounterRail';
import PortalHeader from '../components/PortalHeader';
import VideoConsultation from '../components/VideoConsultation';

const VITAL_ICONS = {
  'Blood pressure': Activity,
  'Heart rate': HeartPulse,
  'Respiratory rate': Wind,
  'Oxygen saturation': Droplets,
  Temperature: Thermometer,
};

const STATUS_LABELS = {
  INTAKE: 'Intake',
  TRIAGED: 'Triaged',
  ROUTING: 'Routing',
  AWAITING_ACCEPTANCE: 'Awaiting acceptance',
  ACCEPTED: 'Accepted',
  EN_ROUTE: 'En route',
  CLOSED: 'Closed',
};

const PROTOCOL_PRESETS = {
  patient_001: {
    diagnosis: 'Acute Asthmatic Exacerbation & Bronchospasm',
    investigations: ['Peak Expiratory Flow (PEF)', 'Chest X-Ray (PA View)', 'Arterial Blood Gas (ABG)'],
    observations: 'Mild tachypnea, bilateral wheeze on auscultation, prolonged expiratory phase',
    rxList: [
      { name: 'Inhaler Salbutamol (Ventolin)', dosage: '2 puffs (200 mcg)', duration: 'PRN every 4–6 hrs', instructions: 'Inhale with spacer; rinse mouth' },
      { name: 'Inhaler Fluticasone Propionate', dosage: '1 puff (125 mcg)', duration: 'Ongoing BD', instructions: 'Morning and night maintenance' },
      { name: 'Tab Prednisolone 30mg', dosage: '1-0-0', duration: '5 days', instructions: 'Take with breakfast' },
    ],
    remarks: 'Keep measuring SpO2 twice daily. Avoid dusty environments and sudden temperature changes.',
    followUp: 'Friday May 03, 2026 5:00 PM',
  },
  patient_002: {
    diagnosis: 'Atrial Fibrillation with Rapid Ventricular Response (RVR) & Transient Neurological Deficit',
    investigations: ['12-Lead Electrocardiogram (ECG)', 'Serum Electrolytes & Renal Panel', 'Prothrombin Time / INR Target', 'CT Brain Non-Contrast'],
    observations: 'High Irregular Heart Rate (118 bpm), Blood Pressure 168/96 mmHg, unsteady gait, mild left pronator drift',
    rxList: [
      { name: 'Tab Warfarin Sodium 5mg', dosage: '0-0-1', duration: 'Ongoing', instructions: 'Take at 18:00 daily; maintain INR 2.0–3.0' },
      { name: 'Tab Amlodipine Besylate 5mg', dosage: '1-0-0', duration: 'Ongoing', instructions: 'Morning after food' },
      { name: 'Tab Metformin HCl 1000mg', dosage: '1-0-1', duration: 'Ongoing', instructions: 'Take with main meals' },
    ],
    remarks: 'Pre-notified Emergency Neurology bed. Monitor blood pressure and neurological signs hourly.',
    followUp: 'Immediate Admission & Follow-up in 48 hours',
  },
  patient_003: {
    diagnosis: 'Severe Gastroesophageal Reflux (GERD) with Somatization & Anxiety Dysphagia',
    investigations: ['Upper GI Endoscopy (EGD planned)', 'Complete Blood Count (CBC)', 'Barium Swallow if persistent'],
    observations: 'Epigastric tenderness without rebound, globus sensation, mild tachycardia during anxiety',
    rxList: [
      { name: 'Cap Pantoprazole Sodium 40mg', dosage: '1-0-0', duration: '14 days', instructions: '30 mins before morning breakfast' },
      { name: 'Antacid Oral Suspension 10ml', dosage: '1-1-1', duration: '7 days', instructions: 'After meals and at bedtime PRN' },
      { name: 'Tab Escitalopram 10mg', dosage: '0-0-1', duration: 'Ongoing', instructions: 'Take at bedtime for anxiety maintenance' },
    ],
    remarks: 'Elevate head of bed 6 inches. Avoid caffeine, citrus, and eating within 3 hours of sleep.',
    followUp: 'Wednesday May 08, 2026 11:00 AM',
  },
};

const PATIENT_LAB_REPORTS = {
  patient_001: [
    { category: 'Hematology', test: 'Hemoglobin', value: '14.2 g/dL', normal: '13.0 – 17.0 g/dL', status: 'NORMAL' },
    { category: 'Hematology', test: 'Total Leukocyte Count (WBC)', value: '7,400 /uL', normal: '4,000 – 11,000 /uL', status: 'NORMAL' },
    { category: 'Allergy & Immunology', test: 'Serum Total IgE', value: '280 IU/mL', normal: '< 100 IU/mL', status: 'HIGH' },
    { category: 'Hematology', test: 'Absolute Eosinophil Count', value: '540 /uL (6.2%)', normal: '40 – 440 /uL', status: 'HIGH' },
    { category: 'Pulmonary Function', test: 'Peak Expiratory Flow (PEF)', value: '380 L/min', normal: '550 L/min (Predicted)', status: 'LOW' },
    { category: 'Radiology', test: 'Chest Radiograph (PA View)', value: 'Bilateral hyperinflation, no consolidation or effusion', normal: 'Clear lungs', status: 'NORMAL' },
    { category: 'Biochemistry', test: 'Serum Potassium', value: '4.1 mEq/L', normal: '3.5 – 5.0 mEq/L', status: 'NORMAL' },
  ],
  patient_002: [
    { category: 'Coagulation Panel', test: 'Prothrombin Time (PT/INR)', value: '2.3 INR', normal: '2.0 – 3.0 (Target for AFib)', status: 'NORMAL' },
    { category: 'Cardiology', test: '12-Lead Electrocardiogram', value: 'Atrial Fibrillation with RVR (118 bpm), QRS normal', normal: 'Normal Sinus Rhythm', status: 'HIGH' },
    { category: 'Glycemic Profile', test: 'Fasting Plasma Glucose', value: '142 mg/dL', normal: '70 – 99 mg/dL', status: 'HIGH' },
    { category: 'Glycemic Profile', test: 'Glycated Hemoglobin (HbA1c)', value: '7.4 %', normal: '< 5.7 % (Normal), < 7.0 % Target', status: 'HIGH' },
    { category: 'Renal Function', test: 'Serum Creatinine', value: '1.1 mg/dL', normal: '0.7 – 1.3 mg/dL', status: 'NORMAL' },
    { category: 'Renal Function', test: 'Blood Urea Nitrogen (BUN)', value: '19 mg/dL', normal: '7 – 20 mg/dL', status: 'NORMAL' },
    { category: 'Lipid Profile', test: 'Total Cholesterol', value: '188 mg/dL', normal: '< 200 mg/dL', status: 'NORMAL' },
    { category: 'Neurology', test: 'Non-Contrast Brain CT', value: 'No acute intracranial hemorrhage; mild chronic ischemic changes', normal: 'Normal scan', status: 'NORMAL' },
  ],
  patient_003: [
    { category: 'Hematology', test: 'Complete Hemogram (Hb)', value: '12.8 g/dL', normal: '12.0 – 15.5 g/dL', status: 'NORMAL' },
    { category: 'Endocrinology', test: 'Thyroid Stimulating Hormone (TSH)', value: '2.1 mIU/L', normal: '0.4 – 4.0 mIU/L', status: 'NORMAL' },
    { category: 'Gastroenterology', test: 'Helicobacter Pylori Stool Antigen', value: 'Negative', normal: 'Negative', status: 'NORMAL' },
    { category: 'Biochemistry', test: 'Serum Amylase & Lipase', value: '62 U/L', normal: '30 – 110 U/L', status: 'NORMAL' },
    { category: 'Electrolytes', test: 'Serum Sodium & Potassium', value: '139 / 4.2 mEq/L', normal: '136-145 / 3.5-5.0 mEq/L', status: 'NORMAL' },
    { category: 'Liver Function', test: 'Serum Alanine Aminotransferase (ALT)', value: '24 U/L', normal: '7 – 35 U/L', status: 'NORMAL' },
  ],
};

const PATIENT_VISIT_HISTORY = {
  patient_001: [
    { date: '2026-01-18', facility: 'Metro Pulmonary Clinic', reason: 'Seasonal asthma review and spirometry assessment', physician: 'Dr. Sarah Jenkins', disposition: 'Inhaler step-up therapy prescribed' },
    { date: '2025-09-05', facility: 'Horizon Urgent Care', reason: 'Acute bronchospasm following viral upper respiratory infection', physician: 'Dr. Mira Sen', disposition: 'Nebulized salbutamol x 2, discharged stable' },
    { date: '2025-04-12', facility: 'City Allergy & Asthma Center', reason: 'Allergen skin prick testing (Positive: Dust mites & Pollen)', physician: 'Dr. K. Verma', disposition: 'Environmental avoidance counseling' },
  ],
  patient_002: [
    { date: '2026-02-14', facility: 'Horizon Multispecialty Hospital', reason: 'Routine Warfarin Anticoagulation INR clinic check', physician: 'Dr. Mira Sen', disposition: 'INR 2.3, maintained on 5mg daily' },
    { date: '2025-11-28', facility: 'St. Jude Cardiac Center', reason: 'Holter monitor follow-up & episodic palpitations', physician: 'Dr. R. Kapoor', disposition: 'Paroxysmal AFib documented, rate control continued' },
    { date: '2025-06-10', facility: 'Metro Diabetes & Endocrine Care', reason: 'Quarterly Type 2 Diabetes review and HbA1c check', physician: 'Dr. A. Singhal', disposition: 'HbA1c 7.4%, Metformin dose maintained' },
    { date: '2024-12-02', facility: 'Horizon Emergency Department', reason: 'Hypertensive urgency (BP 185/105 mmHg) with headache', physician: 'Dr. Mira Sen', disposition: 'Amlodipine titrated, discharged after stabilization' },
  ],
  patient_003: [
    { date: '2026-02-22', facility: 'Horizon Telehealth Center', reason: 'GERD symptom flare-up during acute work-related stress', physician: 'Dr. Mira Sen', disposition: 'Pantoprazole renewed, stress hygiene advised' },
    { date: '2025-10-14', facility: 'Central Gastro Care', reason: 'Barium swallow study for dysphagia evaluation', physician: 'Dr. P. Nair', disposition: 'Mild acid reflux noted, no mechanical stricture' },
    { date: '2025-03-08', facility: 'Mind Wellness Clinic', reason: 'Generalized anxiety disorder review and follow-up', physician: 'Dr. S. Roy', disposition: 'Escitalopram 10mg continued' },
  ],
};

function getVitalStatus(label, value) {
  if (!value) return null;
  const str = String(value);

  if (label === 'Blood pressure') {
    const parts = str.split('/');
    const systolic = parseInt(parts[0], 10);
    if (systolic >= 160) return { text: 'Elevated', tone: 'danger' };
    if (systolic >= 130) return { text: 'Borderline', tone: 'warning' };
    return { text: 'Normal', tone: 'normal' };
  }
  if (label === 'Heart rate') {
    const hr = parseInt(str, 10);
    if (hr > 100) return { text: 'Tachycardia', tone: 'danger' };
    if (hr < 60) return { text: 'Bradycardia', tone: 'warning' };
    return { text: 'Normal', tone: 'normal' };
  }
  if (label === 'Oxygen saturation') {
    const o2 = parseInt(str, 10);
    if (o2 < 95) return { text: 'Low O₂', tone: 'danger' };
    return { text: 'Normal', tone: 'normal' };
  }
  if (label === 'Temperature') {
    const temp = parseFloat(str);
    if (temp >= 37.5) return { text: 'Fever', tone: 'danger' };
    return { text: 'Normal', tone: 'normal' };
  }
  if (label === 'Respiratory rate') {
    const rr = parseInt(str, 10);
    if (rr > 20) return { text: 'Elevated', tone: 'warning' };
    return { text: 'Normal', tone: 'normal' };
  }
  return { text: 'Normal', tone: 'normal' };
}

function Vital({ label, value }) {
  const Icon = VITAL_ICONS[label] ?? Activity;
  const status = getVitalStatus(label, value);

  return (
    <div className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 transition-all hover:border-teal-400 hover:bg-surface">
      <div className="flex items-center justify-between gap-1">
        <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
          <Icon aria-hidden="true" className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span>{label}</span>
        </dt>
        {status && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
              status.tone === 'danger' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
              status.tone === 'warning' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
              status.tone === 'normal' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            )}
          >
            {status.text}
          </span>
        )}
      </div>
      <dd className="mt-1.5 font-mono text-sm font-bold text-ink">
        {value}
      </dd>
    </div>
  );
}

function Metric({ label, value, detail, tone = 'default', icon: Icon }) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-surface p-4 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          {label}
        </p>
        {Icon && <Icon className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
      </div>
      <p
        className={cn(
          'mt-2 font-mono text-2xl font-extrabold tracking-tight',
          tone === 'critical' ? 'text-rose-600 dark:text-rose-400' : 'text-ink'
        )}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-1 text-xs text-ink-muted">{detail}</p>
      )}
    </div>
  );
}

/**
 * HIGH-CONTRAST, CRISP & FULLY EDITABLE CLINICAL PRESCRIPTION PAD
 * Elevated border & distinct shadow so it stands out prominently against the canvas.
 */
function ClinicalPrescriptionSlip({
  selectedPatient,
  handoff,
  encounter,
  canPrescribe,
  accepting,
  acceptError,
  onAcceptEncounter,
  rxList,
  onUpdateRx,
  onAddRx,
  onRemoveRx,
  remarks,
  onRemarksChange,
  followUp,
  onFollowUpChange,
  sending,
  prescriptionError,
  prescriptionId,
  onSendPrescription,
  currentDoctorName,
  currentDoctorId,
  onLoadPreset,
}) {
  const patientId = selectedPatient?.patient_id ?? handoff?.id;
  const patientName = handoff?.name ?? selectedPatient?.name ?? 'Selected Patient';
  const displayId = handoff?.display_id ?? selectedPatient?.display_id ?? patientId;
  const gender = handoff?.gender || selectedPatient?.gender || 'Patient';
  const age = handoff?.age || selectedPatient?.age;

  const assignedDoctorId = encounter?.assigned_doctor_id ?? handoff?.handoff?.assigned_doctor_id;
  const status = encounter?.status ?? handoff?.handoff?.status ?? 'TRIAGED';
  const awaitingAcceptance =
    assignedDoctorId === currentDoctorId &&
    ['TRIAGED', 'ROUTING', 'AWAITING_ACCEPTANCE'].includes(status);

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/70 dark:shadow-black/50 transition-all">
      {/* Top Clinical Color Stripe */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#3D6B56] via-[#7CA982] to-[#A3C9B4]" />

      {/* Slip Header with Distinct Background Tint */}
      <div className="border-b-2 border-slate-200 dark:border-slate-800 bg-[#F4F9F6] dark:bg-slate-800/80 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Clinic Branding */}
          <div className="flex items-center gap-3.5">
            <img
              src="/logo.png"
              alt="Triage Horizon"
              className="h-11 w-11 object-contain rounded-xl border border-[#A3C9B4]/60 bg-white p-0.5 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Triage Horizon Clinical Network
                </h3>
                <span className="rounded-md border border-[#7CA982]/40 bg-[#EFF7F2] px-2 py-0.5 font-mono text-[10px] font-bold text-[#3D6B56] dark:bg-[#1E362B] dark:text-[#A3C9B4]">
                  PRESCRIPTION DISPATCH
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Emergency & Specialist Care Unit · License: TH-MD-77363
              </p>
            </div>
          </div>

          {/* Doctor Info */}
          <div className="text-right sm:block">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              {currentDoctorName || 'Dr. Mira Sen'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">M.D. (Emergency Medicine)</p>
            <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">Reg. No: A-77363</p>
          </div>
        </div>

        {/* Patient Bar */}
        {patientId && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 dark:border-slate-700 pt-3 text-xs">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <span className="text-slate-500 dark:text-slate-400 font-semibold">Patient:</span>
              <strong className="text-sm font-extrabold text-teal-700 dark:text-teal-300">{patientName}</strong>
              <span className="text-slate-400">·</span>
              <span className="font-medium">{gender}{age ? `, ${age} yrs` : ''}</span>
              <span className="text-slate-400">·</span>
              <span className="font-mono font-bold text-slate-500 dark:text-slate-400">{displayId}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-slate-500 dark:text-slate-400 font-semibold">Encounter Date:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {new Date().toLocaleDateString('en-GB')}
              </span>
              <AcuityBadge acuity={encounter?.acuity ?? handoff?.handoff?.acuity} />
            </div>
          </div>
        )}
      </div>

      {!patientId ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-900/50">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400">
            <Stethoscope className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
            No patient selected for prescribing
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            Select any patient row in the incoming queue above to prepare and sign their e-prescription.
          </p>
        </div>
      ) : (
        <div className="p-6 bg-white dark:bg-slate-900">
          {awaitingAcceptance && (
            <div className="mb-5 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-amber-950 dark:text-amber-200">
                  This case is assigned to you
                </p>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                  Accept the encounter to confirm care and notify the patient.
                </p>
                {acceptError && (
                  <p role="alert" className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                    {acceptError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onAcceptEncounter}
                disabled={accepting}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-solid px-4 text-sm font-bold text-white transition-colors hover:bg-brand-solid-hover disabled:cursor-wait disabled:opacity-60"
              >
                {accepting ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                )}
                {accepting ? 'Accepting case…' : 'Accept case'}
              </button>
            </div>
          )}
          {canPrescribe && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
              You accepted this case. The patient has been notified.
            </div>
          )}

          {/* Top Prescribing Toolbar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 border border-teal-200 text-teal-800 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-300">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                  Prescribed Medications
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  All fields are directly editable. Type or use quick-fill chips below.
                </p>
              </div>
            </div>

            {onLoadPreset && (
              <button
                type="button"
                onClick={onLoadPreset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-50 dark:bg-teal-950/40 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 shadow-xs hover:bg-teal-600 hover:text-white transition-all"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Reset Clinical Protocol
              </button>
            )}
          </div>

          {/* Form */}
          <form onSubmit={onSendPrescription} className="space-y-4">
            {/* Medicine Rows */}
            <div className="space-y-3">
              {rxList.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5 shadow-2xs hover:border-teal-400/80 transition-all"
                >
                  <div className="grid gap-3 sm:grid-cols-12 items-start">
                    {/* Medicine Name */}
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Medicine Name & Strength
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Tab Warfarin Sodium 5mg"
                        value={item.name}
                        onChange={(e) => onUpdateRx(index, 'name', e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-2xs"
                      />
                    </div>

                    {/* Dosage */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Dosage
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1-0-1"
                        value={item.dosage}
                        onChange={(e) => onUpdateRx(index, 'dosage', e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-2xs"
                      />
                      <div className="mt-1 flex flex-wrap gap-1">
                        {['1-0-1', '1-1-1', '1-0-0', '0-0-1'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => onUpdateRx(index, 'dosage', preset)}
                            className="rounded px-1 py-0.2 text-[9px] font-mono text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 transition-colors"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Duration
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 5 days"
                        value={item.duration}
                        onChange={(e) => onUpdateRx(index, 'duration', e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-2xs"
                      />
                      <div className="mt-1 flex flex-wrap gap-1">
                        {['3d', '5d', '7d', 'Ongoing'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => onUpdateRx(index, 'duration', preset === 'Ongoing' ? 'Ongoing' : `${preset.replace('d', '')} days`)}
                            className="rounded px-1 py-0.2 text-[9px] text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 transition-colors"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="sm:col-span-12 mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            Dose reminder times
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                            Enter the prescribed times in 24-hour format. They are not inferred from dosage text.
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={Boolean(item.as_needed)}
                            onChange={(event) => {
                              onUpdateRx(index, 'as_needed', event.target.checked);
                              if (event.target.checked) {
                                onUpdateRx(index, 'times', []);
                              }
                            }}
                            className="h-3.5 w-3.5 accent-teal-600"
                          />
                          As needed (no scheduled reminder)
                        </label>
                      </div>
                      {!item.as_needed && (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          {(item.times ?? []).map((time, timeIndex) => (
                            <label
                              key={`${index}-${timeIndex}`}
                              className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                            >
                              Time {timeIndex + 1}
                              <input
                                type="time"
                                required
                                value={time}
                                onChange={(event) => {
                                  const times = [...(item.times ?? [])];
                                  times[timeIndex] = event.target.value;
                                  onUpdateRx(index, 'times', times);
                                }}
                                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                              />
                              <button
                                type="button"
                                aria-label={`Remove reminder time ${timeIndex + 1}`}
                                onClick={() =>
                                  onUpdateRx(
                                    index,
                                    'times',
                                    (item.times ?? []).filter(
                                      (_, currentIndex) => currentIndex !== timeIndex
                                    )
                                  )
                                }
                                className="rounded px-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </label>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateRx(index, 'times', [...(item.times ?? []), ''])
                            }
                            className="h-8 rounded-lg border border-dashed border-teal-500/50 px-2.5 text-[10px] font-bold text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
                          >
                            Add reminder time
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Instructions */}
                    <div className="sm:col-span-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Instructions
                        </label>
                        {rxList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onRemoveRx(index)}
                            className="text-slate-400 hover:text-rose-600 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. After Meal"
                        value={item.instructions}
                        onChange={(e) => onUpdateRx(index, 'instructions', e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-2xs"
                      />
                      <div className="mt-1 flex flex-wrap gap-1">
                        {['After Meal', 'Before Food', 'Bedtime'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => onUpdateRx(index, 'instructions', preset)}
                            className="rounded px-1 py-0.2 text-[9px] text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 transition-colors"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add row button */}
            <div>
              <button
                type="button"
                onClick={onAddRx}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition-all"
              >
                <Plus className="h-4 w-4" />
                Add Another Medicine
              </button>
            </div>

            {/* Remarks & Next Follow-up fields */}
            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3.5">
                <label className="block text-xs font-bold text-slate-900 dark:text-white">
                  Remarks / Patient Instructions:
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => onRemarksChange(e.target.value)}
                  placeholder="e.g. Keep measuring body Temp. twice a day. Rest and hydration."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs leading-5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3.5">
                <label className="block text-xs font-bold text-slate-900 dark:text-white">
                  Next follow-up date & time:
                </label>
                <input
                  type="text"
                  value={followUp}
                  onChange={(e) => onFollowUpChange(e.target.value)}
                  placeholder="e.g. Friday May 03, 2026 5:00 PM"
                  className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                <p className="mt-2 text-right text-[11px] text-slate-500 italic">
                  Digital Authorised Signature: <strong className="text-slate-800 dark:text-slate-200">{currentDoctorName || 'Dr. Mira Sen'}</strong>
                </p>
              </div>
            </div>

            {/* Success & Error alerts */}
            {prescriptionId && (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-xs font-bold text-emerald-800 dark:text-emerald-200 shadow-xs">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Prescription <span className="font-mono underline">{prescriptionId}</span> officially verified and dispatched to patient.
                </span>
              </div>
            )}

            {prescriptionError && (
              <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs font-medium text-rose-800 dark:text-rose-200">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{prescriptionError}</span>
              </div>
            )}

            {/* Bottom action row */}
            <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">
                Clicking dispatch will broadcast the signed prescription directly to the patient's mobile portal.
              </p>

              <button
                type="submit"
                disabled={sending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 px-5 text-xs font-extrabold text-white shadow-md shadow-teal-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? 'Signing & Dispatching…' : 'Send Prescription to Patient'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * 3-PAGE COMPREHENSIVE CLINICAL HEALTH DOSSIER & PDF EXPORT
 * Page 1: Emergency Triage & Admission Chart
 * Page 2: Longitudinal Medical History & Comprehensive Diagnostic Lab Reports
 * Page 3: Official Physician Prescription Sheet (Rx Pad)
 */
function FullscreenReportModal({
  patient,
  handoff,
  vitals,
  encounter,
  onClose,
  currentDoctorName,
  rxList,
  remarks,
  followUp,
  prescriptionId,
}) {
  const [activePage, setActivePage] = useState('all'); // '1', '2', '3', or 'all'
  if (!patient && !handoff) return null;

  const data = handoff ?? patient;
  const patientId = data.id || data.patient_id;
  const acuity = getAcuityMeta(data.handoff?.acuity ?? encounter?.acuity);
  const preset = PROTOCOL_PRESETS[patientId] || {};
  const labReports = PATIENT_LAB_REPORTS[patientId] || PATIENT_LAB_REPORTS.patient_002;
  const visitHistory = PATIENT_VISIT_HISTORY[patientId] || PATIENT_VISIT_HISTORY.patient_002;

  const complaint = data.handoff?.symptoms?.[0] ?? data.sample ?? 'Full Body Pain, Weakness Feeling';
  const observations = preset.observations || 'High Body Temperature, Elevated pulse, general fatigue';
  const investigations = preset.investigations || ['CBC Count', 'Creatinine', 'Basic Metabolic Panel'];
  const diagnosis = preset.diagnosis || data.handoff?.protocol_matched || 'Clinical Evaluation Protocol';

  const effectiveRx = rxList && rxList.length > 0 && rxList[0].name
    ? rxList
    : preset.rxList || [
        { name: 'Tab Warfarin Sodium 5mg', dosage: '0-0-1', duration: 'Ongoing', instructions: 'Take at 18:00 daily' },
        { name: 'Tab Amlodipine Besylate 5mg', dosage: '1-0-0', duration: 'Ongoing', instructions: 'Morning after food' },
        { name: 'Tab Metformin HCl 1000mg', dosage: '1-0-1', duration: 'Ongoing', instructions: 'Take with main meals' },
      ];

  const effectiveRemarks = remarks || preset.remarks || 'Keep measuring body Temp. twice a day.';
  const effectiveFollowUp = followUp || preset.followUp || 'Friday May 03, 2026 5:00 PM';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md p-3 sm:p-6 flex flex-col items-center print:p-0 print:bg-white print:overflow-visible">
      {/* Top Floating Control Bar */}
      <div className="sticky top-0 z-50 mb-6 flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 px-5 py-3 shadow-2xl backdrop-blur-md print:hidden">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-500/20 text-teal-400 font-bold">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Patient Clinical Health Dossier
              <span className="rounded-md bg-teal-500/20 px-1.5 py-0.5 font-mono text-[10px] text-teal-400">
                3-PAGE EHR
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {data.name} · {data.display_id || patientId}
            </p>
          </div>
        </div>

        {/* Page Switcher Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-800 p-1 border border-slate-700">
          <button
            type="button"
            onClick={() => setActivePage('1')}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
              activePage === '1' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            )}
          >
            Page 1: Triage
          </button>
          <button
            type="button"
            onClick={() => setActivePage('2')}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
              activePage === '2' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            )}
          >
            Page 2: History & Labs
          </button>
          <button
            type="button"
            onClick={() => setActivePage('3')}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
              activePage === '3' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            )}
          >
            Page 3: Prescription Sheet
          </button>
          <button
            type="button"
            onClick={() => setActivePage('all')}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
              activePage === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            )}
          >
            View All (3 Pages)
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActivePage('all');
              setTimeout(() => window.print(), 100);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition-all"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save 3-Page PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* DOCUMENT CONTAINER */}
      <div className="w-full max-w-4xl space-y-8 print:space-y-0">
        {/* ========================================================= */}
        {/* PAGE 1: EMERGENCY TRIAGE & ADMISSION RECORD */}
        {/* ========================================================= */}
        {(activePage === 'all' || activePage === '1') && (
          <div className="w-full bg-white text-slate-900 rounded-3xl p-8 sm:p-12 shadow-2xl border border-slate-300 font-sans print:rounded-none print:shadow-none print:border-none print:p-8 print:m-0 print:break-after-page">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b-2 border-slate-200">
              <div className="flex items-center gap-4">
                <img
                  src="/logo.png"
                  alt="Triage Horizon"
                  className="h-14 w-14 object-contain rounded-xl border border-[#A3C9B4]/60 bg-white p-0.5 shadow-md"
                />
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    Triage Horizon Clinical Network
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    Department of Emergency Medicine & Clinical Triage · Level 1 Trauma Center
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-md bg-rose-50 border border-rose-300 px-2.5 py-1 text-xs font-extrabold text-rose-700">
                  PAGE 1 OF 3
                </span>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  REF: ADM-{patientId}-{Date.now().toString().slice(-4)}
                </p>
              </div>
            </div>

            {/* Red Accent Line */}
            <div className="h-1 w-full bg-rose-600 my-4" />

            {/* Patient Demographics */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-6">
              <div>
                <p className="text-slate-500 font-semibold uppercase text-[10px]">Patient Name</p>
                <p className="font-extrabold text-slate-950 text-sm mt-0.5">{data.name}</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold uppercase text-[10px]">Age / Gender</p>
                <p className="font-bold text-slate-900 mt-0.5">{data.age ? `${data.age} yrs` : 'Adult'} · {data.gender}</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold uppercase text-[10px]">Patient ID / MRN</p>
                <p className="font-mono font-bold text-teal-700 mt-0.5">{data.display_id || patientId}</p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold uppercase text-[10px]">Blood Group</p>
                <p className="font-mono font-bold text-rose-600 mt-0.5">{data.blood_type || 'B+'}</p>
              </div>
            </div>

            {/* Triage Acuity Assessment */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  Manchester Triage Framework Priority
                </span>
                <h3 className="text-lg font-black text-rose-900 mt-0.5">
                  Category: {acuity.code} · {acuity.label}
                </h3>
                <p className="text-xs text-rose-800 mt-0.5">
                  Immediate specialist bedside handoff required. Pathway: <strong className="underline">{getCareTierLabel(encounter?.care_tier ?? data.handoff?.care_tier)}</strong>
                </p>
              </div>
              <AcuityBadge acuity={data.handoff?.acuity ?? encounter?.acuity} />
            </div>

            {/* Chief Complaint */}
            <div className="mb-6">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-1.5 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-teal-600" />
                Presenting Complaint & Clinical Narrative
              </h4>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs leading-6 text-slate-800 font-medium">
                "{complaint}"
              </div>
            </div>

            {/* Physiological Vitals Grid */}
            {vitals && (
              <div className="mb-6">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-2 flex items-center gap-1.5">
                  <HeartPulse className="h-4 w-4 text-rose-600" />
                  Physiological Vitals & Biometrics at Admission
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] text-slate-500 font-bold block">BLOOD PRESSURE</span>
                    <strong className="text-sm font-mono text-slate-900">{vitals.blood_pressure}</strong>
                    <span className="text-[9px] text-rose-600 font-bold block mt-0.5">Stage 2 HTN</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] text-slate-500 font-bold block">HEART RATE</span>
                    <strong className="text-sm font-mono text-slate-900">{vitals.heart_rate}</strong>
                    <span className="text-[9px] text-rose-600 font-bold block mt-0.5">Irregular (AFib)</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] text-slate-500 font-bold block">RESPIRATORY RATE</span>
                    <strong className="text-sm font-mono text-slate-900">{vitals.respiratory_rate}</strong>
                    <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">Normal</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] text-slate-500 font-bold block">OXYGEN SAT (SpO2)</span>
                    <strong className="text-sm font-mono text-slate-900">{vitals.oxygen_saturation}</strong>
                    <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">Room air</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] text-slate-500 font-bold block">TEMPERATURE</span>
                    <strong className="text-sm font-mono text-slate-900">{vitals.temperature}</strong>
                    <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">Afebrile</span>
                  </div>
                </div>
              </div>
            )}

            {/* Protocol & Directives */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 mb-8">
              <p className="font-bold text-slate-900">
                Matched Clinical Protocol: <span className="font-mono text-teal-700">{data.handoff?.protocol_matched || 'NEURO-CARDIAC RAPID DISPOSITION'}</span>
              </p>
              <p className="text-slate-600 mt-1">
                Immediate Directives: Pre-notify receiving emergency department, confirm anticoagulation reversal protocol, establish continuous 12-lead telemetry monitoring, evaluate NIH stroke scale.
              </p>
            </div>

            {/* Footer of Page 1 */}
            <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
              <span>Horizon Clinical Health System · Electronic Health Record Dossier</span>
              <span className="font-bold">Page 1 of 3 (Emergency Triage & Admission Summary)</span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PAGE 2: LONGITUDINAL HISTORY & DIAGNOSTIC LAB REPORTS */}
        {/* ========================================================= */}
        {(activePage === 'all' || activePage === '2') && (
          <div className="w-full bg-white text-slate-900 rounded-3xl p-8 sm:p-12 shadow-2xl border border-slate-300 font-sans print:rounded-none print:shadow-none print:border-none print:p-8 print:m-0 print:break-after-page">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b-2 border-slate-200">
              <div className="flex items-center gap-4">
                <img
                  src="/logo.png"
                  alt="Triage Horizon"
                  className="h-14 w-14 object-contain rounded-xl border border-[#A3C9B4]/60 bg-white p-0.5 shadow-md"
                />
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    Patient Longitudinal Medical History & Laboratory Diagnostics
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    Central Pathological Laboratory & Previous Hospital Encounter Record
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-md bg-[#EFF7F2] border border-[#7CA982]/40 px-2.5 py-1 text-xs font-extrabold text-[#3D6B56]">
                  PAGE 2 OF 3
                </span>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  PATIENT: {data.display_id || patientId}
                </p>
              </div>
            </div>

            {/* Sage Green Accent Line */}
            <div className="h-1 w-full bg-[#3D6B56] my-4" />

            {/* Chronic Medical Conditions & Allergies Bar */}
            <div className="grid sm:grid-cols-2 gap-4 mb-6 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] mb-2 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-teal-600" />
                  Active Chronic Diagnoses
                </h4>
                <ul className="space-y-1 font-semibold text-slate-800">
                  {data.conditions?.map((c) => (
                    <li key={c} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <h4 className="font-bold text-rose-800 uppercase text-[11px] mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  Known Drug Allergies & Warnings
                </h4>
                {data.allergies?.length > 0 ? (
                  <div className="space-y-1">
                    {data.allergies.map((a) => (
                      <span key={a} className="inline-block rounded-md bg-rose-600 text-white font-bold text-xs px-2.5 py-1 mr-2">
                        ALLERGY: {a}
                      </span>
                    ))}
                    <p className="text-[11px] text-rose-700 mt-1">
                      Severe hypersensitivity reported. Strictly avoid cross-reactive drug classes.
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500 italic">No Known Drug Allergies (NKDA) reported.</p>
                )}
              </div>
            </div>

            {/* Comprehensive Diagnostic Lab Report Table */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4 text-teal-600" />
                  General Health Lab Report & Diagnostic Telemetry
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">Certified NABL Accredited Telemetry</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="border-b border-slate-200 bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Investigation Panel</th>
                      <th className="py-2.5 px-3">Observed Value</th>
                      <th className="py-2.5 px-3">Reference Interval</th>
                      <th className="py-2.5 px-3">Status Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {labReports.map((lab, idx) => (
                      <tr key={idx} className={cn('hover:bg-slate-50/70', lab.status !== 'NORMAL' && 'bg-amber-50/30')}>
                        <td className="py-2.5 px-3">
                          <strong className="text-slate-900 block">{lab.test}</strong>
                          <span className="text-[10px] text-slate-500">{lab.category}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {lab.value}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                          {lab.normal}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
                              lab.status === 'NORMAL' && 'bg-emerald-100 text-emerald-800',
                              lab.status === 'HIGH' && 'bg-rose-100 text-rose-800 font-extrabold',
                              lab.status === 'LOW' && 'bg-amber-100 text-amber-800 font-extrabold'
                            )}
                          >
                            {lab.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Previous Hospital Encounters Table */}
            <div className="mb-6">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-2 flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-teal-600" />
                Previous Hospital Encounters & Admission Timeline
              </h4>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="border-b border-slate-200 bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Facility</th>
                      <th className="py-2.5 px-3">Reason for Encounter</th>
                      <th className="py-2.5 px-3">Attending Physician</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visitHistory.map((v, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {formatDate(v.date)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {v.facility}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {v.reason}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                          {v.physician}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer of Page 2 */}
            <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
              <span>Horizon Clinical Health System · Electronic Health Record Dossier</span>
              <span className="font-bold">Page 2 of 3 (Longitudinal Medical History & Lab Reports)</span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PAGE 3: OFFICIAL PHYSICIAN PRESCRIPTION SHEET (Rx Pad) */}
        {/* ========================================================= */}
        {(activePage === 'all' || activePage === '3') && (
          <div className="w-full bg-white text-slate-900 rounded-3xl p-8 sm:p-12 shadow-2xl border border-slate-300 font-sans print:rounded-none print:shadow-none print:border-none print:p-8 print:m-0">
            {/* Clinic Header - Exact replica of Image 2 */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-4">
              <div className="flex items-center gap-4">
                {/* Official Triage Horizon Logo */}
                <div className="flex flex-col items-center">
                  <img
                    src="/logo.png"
                    alt="Triage Horizon"
                    className="h-16 w-16 object-contain rounded-xl border border-[#A3C9B4]/60 bg-white p-0.5 shadow-sm"
                  />
                  <span className="mt-1 font-bold tracking-widest text-[8.5px] uppercase text-[#3D6B56]">
                    TRIAGE HORIZON
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Triage Horizon Clinical Network
                  </h1>
                  <p className="text-xs text-slate-500">
                    Anand Society, Central Boulevard, West Zone · Mumbai 400086 · Ph: 08097700800
                  </p>
                  <p className="text-[11px] text-[#3D6B56] font-semibold">
                    YOUR HEALTH JOURNEY. ONE PLACE.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-md bg-[#EFF7F2] border border-[#7CA982]/40 px-2.5 py-1 text-xs font-extrabold text-[#3D6B56]">
                  PAGE 3 OF 3
                </span>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  PRESCRIPTION SLIP
                </p>
              </div>
            </div>

            {/* Red Dividing Line */}
            <div className="h-0.5 w-full bg-rose-500 my-3" />

            {/* Patient Demographics & Doctor Registration */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 py-2 text-xs">
              <div>
                <p className="font-semibold text-slate-900">
                  Patient: <strong className="text-base text-slate-950 font-bold">{data.name}</strong>
                </p>
                <p className="text-slate-600">
                  {data.gender || 'Patient'}, {data.age ? `${data.age} years` : 'Adult'}
                </p>
                <p className="font-mono text-slate-600">
                  ID: {data.display_id || patientId} · Ph: {data.phone || '8097700800'}
                </p>
                <p className="text-slate-600">
                  Date: <span className="font-mono font-semibold">{new Date().toLocaleDateString('en-GB')}</span>
                </p>
              </div>

              <div className="sm:text-right">
                <p className="font-bold text-slate-900 text-sm">
                  {currentDoctorName || 'Dr. Mira Sen'}
                </p>
                <p className="text-slate-600">M.D. (Emergency Medicine)</p>
                <p className="font-mono text-slate-600">Registration No.: A-77363</p>
                <p className="mt-1">
                  <span className="inline-block rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 font-bold uppercase text-[10px] text-rose-700">
                    Acuity: {acuity.code}
                  </span>
                </p>
              </div>
            </div>

            <div className="my-3 border-t border-slate-200" />

            {/* Medical Complaint & Observations */}
            <div className="space-y-3 text-xs leading-5">
              <p>
                <strong className="text-slate-900 font-bold">Complaint:</strong>{' '}
                <span className="text-slate-700">{complaint}</span>
              </p>

              <p>
                <strong className="text-slate-900 font-bold">Observations:</strong>{' '}
                <span className="text-slate-700">{observations}</span>
              </p>

              <div>
                <strong className="text-slate-900 font-bold">Investigations Suggested:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-700 pl-2">
                  {investigations.map((inv) => (
                    <li key={inv}>{inv}</li>
                  ))}
                </ul>
              </div>

              <p className="pt-1">
                <strong className="text-slate-900 font-bold">Diagnosis:</strong>{' '}
                <span className="font-semibold text-slate-900">{diagnosis}</span>
              </p>
            </div>

            {/* Prescription Table */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-xs font-black uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200/70 rounded-md px-2.5 py-1">
                  Prescribed Medications
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 font-bold">
                      <th className="py-2 pr-4">Medicine</th>
                      <th className="py-2 px-3">Dosage</th>
                      <th className="py-2 px-3">Duration</th>
                      <th className="py-2 px-3">Measure</th>
                      <th className="py-2 pl-3">Instructions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {effectiveRx.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 pr-4 font-bold text-slate-900">
                          {item.name}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {item.dosage}
                        </td>
                        <td className="py-3 px-3">
                          {item.duration || '5 days'}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          Tablet / Cap
                        </td>
                        <td className="py-3 pl-3 text-slate-700 font-semibold">
                          {item.instructions || 'After Meal'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Remarks & Next Follow-Up */}
            <div className="mt-8 space-y-2 text-xs border-t border-slate-200 pt-4">
              <p>
                <strong className="font-bold text-slate-900">Remarks:</strong>{' '}
                <span className="text-slate-700">{effectiveRemarks}</span>
              </p>
              <p>
                <strong className="font-bold text-slate-900">Next follow-up date:</strong>{' '}
                <span className="text-slate-700 font-medium">{effectiveFollowUp}</span>
              </p>
            </div>

            {/* Signature Area */}
            <div className="mt-10 flex justify-end">
              <div className="text-center w-56">
                <div className="border-b border-slate-400 pb-1 font-serif italic text-base text-slate-800 font-bold">
                  {currentDoctorName || 'Dr. Mira Sen'}
                </div>
                <p className="mt-1 text-[11px] text-slate-600">Authorised Signature</p>
              </div>
            </div>

            {/* Red Bottom Dividing Line */}
            <div className="h-0.5 w-full bg-rose-500 mt-6 mb-2" />

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-400 italic">
              This is a computer generated document
              {prescriptionId && (
                <span className="font-mono text-slate-500 not-italic block mt-0.5">
                  Ref: {prescriptionId?.replace(/^RX-/i, 'TH-PR-')} · Validated by Horizon Clinical Decision Protocol
                </span>
              )}
            </div>

            <div className="pt-3 flex justify-between items-center text-[10px] text-slate-400">
              <span>Horizon Clinical Health System · Electronic Health Record Dossier</span>
              <span className="font-bold">Page 3 of 3 (Official Physician Prescription Sheet)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Right Column: Comprehensive Patient Record & Clinical Handoff Panel
 */
function HandoffPanel({
  selectedId,
  careTier,
  handoff,
  loading,
  error,
  destination,
  destinationEta,
  routeUpdate,
  encounter,
  traceSteps,
  onOpenFullReport,
  onAcceptVideo,
  callStatus,
}) {
  const [routeFlashing, setRouteFlashing] = useState(false);
  const [liveRoute, setLiveRoute] = useState(null);
  const routeFlashTimer = useRef(null);
  const handoffPatientId = handoff?.id ?? null;
  const handoffEncounterId = encounter?.id ?? null;
  const isTelehealth = careTier === 'telehealth';

  useEffect(() => {
    const handleRouteUpdated = (payload) => {
      if (
        !handoffPatientId ||
        payload?.patient_id !== handoffPatientId ||
        !handoffEncounterId ||
        payload?.encounter_id !== handoffEncounterId
      ) {
        return;
      }

      setLiveRoute(payload);
      setRouteFlashing(true);

      if (routeFlashTimer.current) window.clearTimeout(routeFlashTimer.current);
      routeFlashTimer.current = window.setTimeout(() => {
        setRouteFlashing(false);
        routeFlashTimer.current = null;
      }, 1500);
    };

    socket.on('ROUTE_UPDATED', handleRouteUpdated);

    return () => {
      socket.off('ROUTE_UPDATED', handleRouteUpdated);
      if (routeFlashTimer.current) {
        window.clearTimeout(routeFlashTimer.current);
        routeFlashTimer.current = null;
      }
    };
  }, [handoffPatientId, handoffEncounterId]);

  useEffect(() => {
    setRouteFlashing(false);
    setLiveRoute(null);
  }, [handoffPatientId, handoffEncounterId]);

  if (!selectedId) {
    return (
      <ClinicalCard>
        <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-surface-muted text-ink-muted">
            <Stethoscope aria-hidden="true" className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink">
            Select a patient
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-ink-muted">
            Choose a patient from the queue to review their complete clinical history, physiological vitals, and handoff report.
          </p>
        </div>
      </ClinicalCard>
    );
  }

  if (loading) {
    return (
      <ClinicalCard>
        <div className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-ink-secondary">
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-brand-strong" />
          Loading patient medical report & vitals…
        </div>
      </ClinicalCard>
    );
  }

  if (error) {
    return (
      <ClinicalCard>
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-signal-danger-border bg-signal-danger-soft px-3 py-3 text-sm text-signal-danger-ink"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      </ClinicalCard>
    );
  }

  if (!handoff) return null;

  const activeRoute = liveRoute ?? routeUpdate ?? null;
  const rerouteFailed = liveRoute?.reroute_status === 'NO_ALTERNATIVE_AVAILABLE';
  const activeDestination = rerouteFailed
    ? null
    : liveRoute?.selected_facility ?? destination ?? null;
  const activeEta = rerouteFailed
    ? null
    : liveRoute?.selected_facility?.eta_min ??
      liveRoute?.new_eta ??
      destinationEta ??
      null;

  const railEncounter = liveRoute
    ? {
        ...encounter,
        status: 'ROUTING',
        facility_id: rerouteFailed
          ? null
          : liveRoute.new_facility_id ?? encounter?.facility_id,
        facility_name: rerouteFailed
          ? 'Manual care coordination'
          : liveRoute.new_facility_name ?? encounter?.facility_name,
        selected_facility: rerouteFailed
          ? null
          : liveRoute.selected_facility ?? encounter?.selected_facility,
        updated_at: liveRoute.rerouted_at ?? encounter?.updated_at,
      }
    : encounter;

  const vitals = patientVitals(handoff.id) ?? handoff.vitals;

  return (
    <motion.div
      key={handoff.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-surface shadow-md"
    >
      {/* Encounter Rail & Agent Trace Bar */}
      <div className="space-y-3 border-b border-border p-4">
        <EncounterRail encounter={railEncounter} compact />
        <AgentTrace
          steps={traceSteps}
          title="Care review"
          emptyLabel="No agent steps recorded for this encounter."
          humanReadable
        />
      </div>

      {/* Patient Profile Header */}
      <div className="border-b border-border p-6 bg-surface-muted/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-brand-strong">
              Patient Clinical Record
            </span>
            <span className="rounded-md border border-brand-border bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-strong">
              ACTIVE
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenFullReport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-50 dark:bg-teal-950/40 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 shadow-xs transition-all hover:bg-teal-600 hover:text-white"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              View 3-Page Dossier
            </button>
            <AcuityBadge acuity={handoff.handoff?.acuity} />
          </div>
        </div>

        <div className="mt-4 flex min-w-0 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-brand-border bg-brand-soft text-sm font-bold text-brand-strong">
              {initials(handoff.name)}
            </span>
            <div className="min-w-0">
              <h2 className="break-words text-xl font-bold tracking-tight text-ink">
                {handoff.name}
              </h2>
              <p className="mt-0.5 text-xs text-ink-secondary">
                <span className="font-mono font-semibold text-ink">{handoff.display_id}</span> ·{' '}
                {handoff.age ? `${handoff.age} years` : 'Age N/A'} · {handoff.gender} · Blood Type:{' '}
                <span className="font-mono font-semibold text-brand-strong">{handoff.blood_type || 'O+'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Care tier & Protocol */}
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Care tier
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {getCareTierLabel(careTier)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Triage Protocol
            </dt>
            <dd className="mt-1 text-xs font-medium leading-5 text-ink">
              {handoff.handoff?.protocol_matched || 'Clinical Evaluation'}
            </dd>
          </div>
        </dl>

        {/* Destination & ETA */}
        <motion.dl
          layout
          transition={{ layout: { duration: 0.35, ease: 'easeOut' } }}
          className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3"
        >
          <div className="min-w-0">
            <dt className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Facility Destination
              <AnimatePresence initial={false}>
                {activeRoute && (
                  <motion.span
                    key={activeRoute.rerouted_at ?? 'route-updated'}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-md border border-signal-amber-border bg-signal-amber-soft px-1.5 py-0.5 text-[9px] font-semibold text-signal-amber-ink"
                  >
                    {routeFlashing ? 'Rerouted' : 'Updated'}
                  </motion.span>
                )}
              </AnimatePresence>
            </dt>
            <dd className="mt-1">
              <span className="block text-sm font-semibold leading-5 text-ink">
                {activeDestination?.name ?? 'Manual care coordination'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Estimated Transit ETA
            </dt>
            <dd className="mt-1">
              <span className="block font-mono text-sm font-bold text-ink">
                {activeEta != null ? `${activeEta} min` : '—'}
              </span>
            </dd>
          </div>
        </motion.dl>
      </div>

      <div className="divide-y divide-border">
        {/* Physiological Vitals */}
        {vitals && (
          <section className="p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink">
                <HeartPulse aria-hidden="true" className="h-4 w-4 text-rose-500" />
                Vitals & Physiological Metrics
              </h3>
              <span className="font-mono text-[10px] text-ink-muted">Demo telemetry</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Vital label="Blood pressure" value={vitals.blood_pressure} />
              <Vital label="Heart rate" value={vitals.heart_rate} />
              <Vital label="Respiratory rate" value={vitals.respiratory_rate} />
              <Vital label="Oxygen saturation" value={vitals.oxygen_saturation} />
              <Vital label="Temperature" value={vitals.temperature} />
            </dl>
          </section>
        )}

        {/* Chief Presenting Complaint */}
        <section className="p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink">
            <Activity aria-hidden="true" className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            Presenting Complaint & Symptoms
          </h3>
          <div className="mt-2.5 rounded-xl border border-border bg-surface-muted/30 p-3.5 text-sm leading-6 text-ink-secondary">
            {handoff.handoff?.symptoms?.[0] ?? 'No presenting complaint recorded.'}
          </div>
        </section>

        {/* Medical History */}
        <section className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink">
              <History aria-hidden="true" className="h-4 w-4 text-brand-strong" />
              Patient Medical History & Profile
            </h3>
            <button
              type="button"
              onClick={onOpenFullReport}
              className="text-xs font-semibold text-brand-strong hover:underline"
            >
              Full 3-Page Report ↗
            </button>
          </div>

          <dl className="mt-3.5 space-y-3.5">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Chronic Medical Conditions
              </dt>
              <dd className="mt-1 text-sm font-medium leading-6 text-ink">
                {handoff.conditions?.length > 0
                  ? handoff.conditions.join(', ')
                  : 'None recorded'}
              </dd>
            </div>

            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Current Active Medications
              </dt>
              <dd className="mt-1 text-sm leading-6 text-ink">
                {handoff.medications?.length > 0
                  ? handoff.medications.join('; ')
                  : 'None recorded'}
              </dd>
            </div>

            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                Known Drug Allergies
              </dt>
              <dd className="mt-1">
                {handoff.allergies?.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-signal-danger-border bg-signal-danger-soft px-2.5 py-1 text-xs font-bold text-signal-danger-ink">
                    <AlertTriangle className="h-3 w-3" />
                    {handoff.allergies.join(', ')}
                  </span>
                ) : (
                  <span className="text-xs text-ink-muted">No known allergies (NKDA)</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        {/* Video Consultation */}
        <section className="p-6">
          <div className="rounded-xl border border-brand-border bg-brand-soft p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-border bg-surface text-brand-strong">
                <Video aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-brand-strong">
                  {isTelehealth ? 'Telehealth Consultation' : 'Video Consultation'}
                </h3>
                <p className="mt-1 text-xs leading-5 text-brand-strong">
                  {isTelehealth
                    ? 'This patient is triaged to telehealth. Launch secure consultation room when ready.'
                    : 'Start a direct secure video visit with this patient if needed.'}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAcceptVideo}
                disabled={callStatus === 'connecting' || callStatus === 'active'}
                className={cn(
                  'inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold shadow-xs transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30',
                  callStatus === 'connecting' || callStatus === 'active'
                    ? 'border-border bg-surface-strong text-ink-muted'
                    : 'border-brand bg-brand-solid text-white hover:bg-brand-solid-hover'
                )}
              >
                {callStatus === 'connecting' ? (
                  <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PhoneCall aria-hidden="true" className="h-3.5 w-3.5" />
                )}
                {callStatus === 'active'
                  ? 'Video call active'
                  : callStatus === 'connecting'
                    ? 'Connecting…'
                    : 'Start Video Consultation'}
              </button>
              <span className="font-mono text-[10px] text-brand-strong">
                TH-ROOM-{handoff.id}
              </span>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

export default function DoctorPortal() {
  const queue = useTriageStore((state) => state.queue);
  const encounters = useTriageStore((state) => state.encounters);
  const facilities = useTriageStore((state) => state.facilities);
  const setEncounters = useTriageStore((state) => state.setEncounters);
  const upsertEncounter = useTriageStore((state) => state.upsertEncounter);
  const agentTrace = useTriageStore((state) => state.agentTrace);
  const agentTraceEncounterId = useTriageStore(
    (state) => state.agentTraceEncounterId
  );
  const socketConnected = useTriageStore((state) => state.socketConnected);
  const auth = useTriageStore((state) => state.auth);
  const doctorName = auth?.name || 'Dr. Mira Sen';
  const doctorSpecialty = auth?.specialty || 'Emergency Medicine';

  const [selectedId, setSelectedId] = useState('');
  const [newIds, setNewIds] = useState(() => new Set());
  const highlightTimers = useRef(new Map());
  const [handoff, setHandoff] = useState(null);
  const [loadingHandoff, setLoadingHandoff] = useState(false);
  const [handoffError, setHandoffError] = useState('');
  const [queueError, setQueueError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  // Rx table prescription list - ALWAYS EDITABLE
  const [rxList, setRxList] = useState([
    { name: '', dosage: '', duration: '', instructions: '', times: [], as_needed: false },
  ]);
  const [remarks, setRemarks] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [sending, setSending] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState('');
  const [prescriptionId, setPrescriptionId] = useState('');

  // Full Screen Popup Modal state
  const [showReportModal, setShowReportModal] = useState(false);

  // Video call states
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [callError, setCallError] = useState('');
  const [callEnding, setCallEnding] = useState(false);
  const activeRoomRef = useRef('');
  const incomingRoomRef = useRef('');

  useEffect(() => {
    activeRoomRef.current = activeCall?.room_id ?? '';
    incomingRoomRef.current = incomingCall?.room_id ?? '';
  }, [activeCall, incomingCall]);

  const activeEncounters = useMemo(
    () =>
      encounters.filter((encounter) =>
        ACTIVE_ENCOUNTER_STATUSES.includes(encounter.status)
      ),
    [encounters]
  );

  const queueRows = useMemo(() => {
    const source =
      activeEncounters.length > 0
        ? activeEncounters
        : queue.filter(
            (entry) =>
              !entry.status || ACTIVE_ENCOUNTER_STATUSES.includes(entry.status)
          );

    const latestByPatient = new Map();

    for (const entry of source) {
      const key = entry.patient_id ?? entry.id;
      if (!key) continue;

      const current = latestByPatient.get(key);
      const currentTime = current
        ? new Date(
            current.updated_at ?? current.created_at ?? current.received_at ?? 0
          ).getTime()
        : Number.NEGATIVE_INFINITY;
      const entryTime = new Date(
        entry.updated_at ?? entry.created_at ?? entry.received_at ?? 0
      ).getTime();

      if (!current || entryTime >= currentTime) {
        latestByPatient.set(key, entry);
      }
    }

    return Array.from(latestByPatient.values())
      .filter(
        (encounter) =>
          Boolean(auth?.userId) &&
          encounter.assigned_doctor_id === auth.userId
      )
      .map((encounter) => {
        const liveEntry = queue.find(
          (entry) => entry.patient_id === encounter.patient_id
        );

        return {
          ...liveEntry,
          ...encounter,
          received_at:
            encounter.created_at ??
            liveEntry?.received_at ??
            encounter.updated_at,
        };
      });
  }, [activeEncounters, auth?.userId, queue]);

  const sortedQueue = useMemo(() => {
    return [...queueRows].sort((a, b) => {
      const acuityDelta =
        (ACUITY_ORDER[a.acuity] ?? 9) - (ACUITY_ORDER[b.acuity] ?? 9);
      if (acuityDelta !== 0) return acuityDelta;

      return new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
    });
  }, [queueRows]);

  const criticalCount = sortedQueue.filter(
    (entry) => entry.acuity === 'CRITICAL'
  ).length;
  const selectedEntry =
    sortedQueue.find((entry) => entry.patient_id === selectedId) ?? null;
  const currentHandoff = handoff?.id === selectedId ? handoff : null;
  const selectedEncounter =
    selectedEntry ?? currentHandoff?.handoff?.encounter ?? null;
  const selectedCareTier = selectedEncounter?.care_tier ?? null;
  const destination = selectedEncounter?.selected_facility ?? null;
  const destinationEta =
    destination?.eta_min ??
    facilities.find((facility) => facility.id === destination?.id)?.eta_min ??
    null;
  const canPrescribe = Boolean(
    selectedEncounter &&
      selectedEncounter.assigned_doctor_id === auth?.userId &&
      ['ACCEPTED', 'EN_ROUTE'].includes(selectedEncounter.status)
  );

  const traceSteps = useMemo(() => {
    if (!selectedEncounter) return [];

    if (
      agentTrace.length > 0 &&
      agentTraceEncounterId === selectedEncounter.id
    ) {
      return agentTrace;
    }

    return selectedEncounter.agent_trace ?? [];
  }, [agentTrace, agentTraceEncounterId, selectedEncounter]);

  const [syncingQueue, setSyncingQueue] = useState(false);

  const syncEncounters = async () => {
    setSyncingQueue(true);
    try {
      const { data } = await api.get('/encounters?active=true');
      setEncounters(data.encounters ?? data);
    } catch {
      // Socket fallback
    } finally {
      setSyncingQueue(false);
    }
  };

  useEffect(() => {
    let active = true;

    api
      .get('/encounters?active=true')
      .then(({ data }) => {
        if (active) setEncounters(data.encounters ?? data);
      })
      .catch(() => {});

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        api
          .get('/encounters?active=true')
          .then(({ data }) => {
            if (active) setEncounters(data.encounters ?? data);
          })
          .catch(() => {});
      }
    };

    const intervalId = window.setInterval(refreshWhenVisible, 15_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('pageshow', refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('pageshow', refreshWhenVisible);
    };
  }, [setEncounters]);

  useEffect(() => {
    const timers = highlightTimers.current;

    const handleTriageComplete = (payload) => {
      if (!payload?.patient_id) return;

      setNewIds((previous) => new Set(previous).add(payload.patient_id));

      const existing = timers.get(payload.patient_id);
      if (existing) window.clearTimeout(existing);

      const timer = window.setTimeout(() => {
        setNewIds((previous) => {
          const next = new Set(previous);
          next.delete(payload.patient_id);
          return next;
        });
        timers.delete(payload.patient_id);
      }, 3200);

      timers.set(payload.patient_id, timer);
    };

    socket.on('TRIAGE_COMPLETE', handleTriageComplete);

    return () => {
      socket.off('TRIAGE_COMPLETE', handleTriageComplete);
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const handleCallInitiated = (payload) => {
      if (!payload?.room_id) return;

      if (activeRoomRef.current) {
        setCallError(
          'A consultation is already in progress. End it before accepting another call.'
        );
        return;
      }

      setIncomingCall(payload);
      setCallError('');

      if (payload.patient_id) {
        setSelectedId(payload.patient_id);
      }

      setCallStatus('incoming');
    };

    const handleCallEnded = (payload) => {
      if (!payload?.room_id) return;

      if (activeRoomRef.current === payload.room_id) {
        setCallStatus('ended');
        setCallEnding(false);
        return;
      }

      if (incomingRoomRef.current === payload.room_id) {
        setIncomingCall(null);
        setCallStatus('idle');
        setCallError('The patient left the waiting room before the call was accepted.');
      }
    };

    socket.on('VIDEO_CALL_INITIATED', handleCallInitiated);
    socket.on('VIDEO_CALL_ENDED', handleCallEnded);

    return () => {
      socket.off('VIDEO_CALL_INITIATED', handleCallInitiated);
      socket.off('VIDEO_CALL_ENDED', handleCallEnded);
    };
  }, []);

  useEffect(() => {
    if (
      selectedId &&
      !sortedQueue.some((entry) => entry.patient_id === selectedId)
    ) {
      setSelectedId(sortedQueue[0]?.patient_id ?? '');
      return;
    }

    if (!selectedId && sortedQueue.length > 0) {
      setSelectedId(sortedQueue[0].patient_id);
    }
  }, [selectedId, sortedQueue]);

  useEffect(() => {
    if (!selectedId) {
      setHandoff(null);
      return undefined;
    }

    let active = true;
    setLoadingHandoff(true);
    setHandoffError('');
    setPrescriptionId('');
    setPrescriptionError('');
    setAcceptError('');

    // Pre-populate Rx list from template for realistic demo experience
    const preset = PROTOCOL_PRESETS[selectedId];
    if (preset) {
      setRxList(preset.rxList.map((m) => ({ ...m })));
      setRemarks(preset.remarks);
      setFollowUp(preset.followUp);
    } else {
      setRxList([
        {
          name: '',
          dosage: '',
          duration: '',
          instructions: '',
          times: [],
          as_needed: false,
        },
      ]);
      setRemarks('');
      setFollowUp('After 3 days / SOS if symptoms worsen');
    }

    api
      .get(`/handoff/${selectedId}`)
      .then(({ data }) => {
        if (active) setHandoff(data);
      })
      .catch((requestError) => {
        if (active) {
          setHandoff(null);
          setHandoffError(
            getApiErrorMessage(requestError, 'Unable to load the handoff record.')
          );
        }
      })
      .finally(() => {
        if (active) setLoadingHandoff(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return undefined;
    let active = true;

    const refreshHandoff = () => {
      if (document.visibilityState !== 'visible') return;

      api
        .get(`/handoff/${selectedId}`)
        .then(({ data }) => {
          if (active) {
            setHandoff(data);
            setHandoffError('');
          }
        })
        .catch((requestError) => {
          if (!active) return;
          setHandoffError(
            getApiErrorMessage(
              requestError,
              'Unable to refresh the handoff record.'
            )
          );
        });
    };
    const refreshTimer = window.setInterval(refreshHandoff, 30_000);

    document.addEventListener('visibilitychange', refreshHandoff);
    window.addEventListener('focus', refreshHandoff);
    window.addEventListener('pageshow', refreshHandoff);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', refreshHandoff);
      window.removeEventListener('focus', refreshHandoff);
      window.removeEventListener('pageshow', refreshHandoff);
      window.clearInterval(refreshTimer);
    };
  }, [selectedId]);

  const handleAcceptEncounter = async () => {
    const encounterId = selectedEncounter?.id;

    if (!encounterId || accepting) return;

    setAccepting(true);
    setAcceptError('');

    try {
      const { data } = await api.post(`/encounters/${encounterId}/accept`, {});
      const updated = data.encounter;

      upsertEncounter(updated);
      setHandoff((previous) =>
        previous
          ? {
              ...previous,
              handoff: {
                ...previous.handoff,
                encounter: updated,
                encounter_id: updated.id,
                status: updated.status,
                assigned_doctor_id: updated.assigned_doctor_id,
                assigned_doctor_name: updated.assigned_doctor_name,
                timeline: updated.timeline,
                agent_trace: updated.agent_trace,
                agent_rationale: updated.agent_rationale,
              },
            }
          : previous
      );
    } catch (requestError) {
      setAcceptError(
        getApiErrorMessage(requestError, 'The encounter could not be accepted.')
      );
    } finally {
      setAccepting(false);
    }
  };

  const handleUpdateRx = (index, field, value) => {
    setRxList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddRx = () => {
    setRxList((prev) => [
      ...prev,
      {
        name: '',
        dosage: '',
        duration: '',
        instructions: '',
        times: [],
        as_needed: false,
      },
    ]);
  };

  const handleRemoveRx = (index) => {
    setRxList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLoadPreset = () => {
    const preset = PROTOCOL_PRESETS[selectedId];
    if (preset) {
      setRxList(preset.rxList.map((m) => ({ ...m })));
      setRemarks(preset.remarks);
      setFollowUp(preset.followUp);
    }
  };

  const handleSendPrescription = async (event) => {
    event.preventDefault();

    const encounterId = selectedEncounter?.id;

    if (!selectedId || sending) return;

    if (!encounterId) {
      setPrescriptionError('Please select an active encounter from the queue.');
      return;
    }

    const validMeds = rxList.filter((m) => m.name && m.name.trim().length > 0);
    if (validMeds.length === 0) {
      setPrescriptionError('Please enter at least one medication name.');
      return;
    }

    const medicationWithoutReminderTime = validMeds.find(
      (medication) =>
        !medication.as_needed &&
        (!Array.isArray(medication.times) ||
          medication.times.length === 0 ||
          new Set(medication.times).size !== medication.times.length ||
          medication.times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))
    );
    if (medicationWithoutReminderTime) {
      setPrescriptionError(
        `Enter the prescribed 24-hour reminder time(s) for ${medicationWithoutReminderTime.name}, or mark it as needed.`
      );
      return;
    }

    if (!canPrescribe) {
      setPrescriptionError('Accept this assigned case before sending a prescription.');
      return;
    }

    setSending(true);
    setPrescriptionError('');
    setPrescriptionId('');

    try {
      const { data } = await api.post(
        `/encounters/${encounterId}/prescribe`,
        {
          medications: validMeds.map((item) => ({
            name: item.name.trim(),
            dosage: item.dosage.trim(),
            schedule: item.dosage.trim(),
            doses_per_day: item.as_needed ? 1 : item.times.length,
            times: item.as_needed ? [] : item.times,
            as_needed: Boolean(item.as_needed),
            duration: item.duration ? item.duration.trim() : '7 days',
            instructions: item.instructions ? item.instructions.trim() : 'Take as directed',
            note: item.instructions.trim(),
          })),
          instructions: remarks.trim()
            ? `${remarks.trim()}${followUp ? ` | Follow-up: ${followUp}` : ''}`
            : (followUp ? `Follow-up: ${followUp}` : 'Take medications as directed on schedule.'),
        }
      );

      upsertEncounter(data.encounter);
      setHandoff((previous) =>
        previous
          ? {
              ...previous,
              handoff: {
                ...previous.handoff,
                encounter: data.encounter,
                encounter_id: data.encounter.id,
                status: data.encounter.status,
                prescription: data.prescription,
                timeline: data.encounter.timeline,
              },
            }
          : previous
      );

      setPrescriptionId(data.prescription_id);
    } catch (requestError) {
      setPrescriptionError(
        getApiErrorMessage(requestError, 'The prescription could not be sent.')
      );
    } finally {
      setSending(false);
    }
  };

  const handleAcceptVideo = async (call = null) => {
    if (callStatus === 'connecting' || callStatus === 'active') return;

    const incomingForSelected =
      call && call.room_id
        ? call
        : incomingCall && (!selectedId || incomingCall.patient_id === selectedId)
          ? incomingCall
          : null;

    const roomId =
      incomingForSelected?.room_id ??
      (selectedId ? `TH-ROOM-${selectedId}` : incomingCall?.room_id ?? '');

    if (!roomId) return;

    const patientId =
      incomingForSelected?.patient_id ?? selectedId ?? incomingCall?.patient_id ?? '';
    const patientName =
      incomingForSelected?.patient_name ??
      handoff?.name ??
      PATIENT_DIRECTORY[patientId]?.name ??
      patientId;

    setCallStatus('connecting');
    setCallError('');

    try {
      await api.post('/video/accept', {
        room_id: roomId,
        doctor_name: doctorName,
        specialty: doctorSpecialty,
      });

      activeRoomRef.current = roomId;
      incomingRoomRef.current = '';

      setActiveCall({
        room_id: roomId,
        patient_id: patientId,
        patient_name: patientName,
        started_at: Date.now(),
      });
      setIncomingCall(null);
      setCallStatus('active');
    } catch (requestError) {
      setCallError(
        getApiErrorMessage(requestError, 'Unable to accept the video consultation.')
      );
      setCallStatus(incomingCall ? 'incoming' : 'idle');
    }
  };

  const handleEndCall = async () => {
    if (!activeCall || callEnding) return;

    setCallEnding(true);
    setCallError('');

    const duration = activeCall.started_at
      ? Math.max(0, Math.round((Date.now() - activeCall.started_at) / 1000))
      : 0;

    try {
      await api.post('/video/end', {
        room_id: activeCall.room_id,
        duration_sec: duration,
        prescription_sent: Boolean(prescriptionId),
      });
    } catch (requestError) {
      setCallError(
        getApiErrorMessage(
          requestError,
          'The call ended locally but the network did not confirm it.'
        )
      );
    } finally {
      setCallStatus('ended');
      setCallEnding(false);
    }
  };

  const handleDeclineCall = async () => {
    if (!incomingCall) return;

    const roomId = incomingCall.room_id;

    incomingRoomRef.current = '';
    setIncomingCall(null);
    setCallStatus('idle');
    setCallError('');

    try {
      await api.post('/video/end', {
        room_id: roomId,
        duration_sec: 0,
        prescription_sent: false,
      });
    } catch {
      // Ignored
    }
  };

  const handleCloseCall = () => {
    activeRoomRef.current = '';
    incomingRoomRef.current = '';
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus('idle');
    setCallError('');
    setCallEnding(false);
  };

  const selectedPatientObj =
    PATIENT_DIRECTORY[selectedId] ??
    sortedQueue.find((e) => e.patient_id === selectedId) ??
    null;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <PortalHeader
        roleLabel="Physician command"
        userName={doctorName}
        homePath="/doctor"
      />

      <main className="mx-auto w-full max-w-[1550px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Top Header & Metrics */}
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
              Clinical Command
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Physician Triage & Prescribing Queue
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-secondary">
              Patients ordered by Manchester acuity. Select a patient row to review details or click <span className="font-semibold text-brand-strong">"View Report"</span> to inspect their full 3-page EHR dossier.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Metric label="In Queue" value={sortedQueue.length} detail="Live encounters" icon={Users} />
            <Metric
              label="Immediate Priority"
              value={criticalCount}
              detail="Critical acuity"
              tone="critical"
              icon={AlertCircle}
            />
            <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  Feed Status
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={syncEncounters}
                    disabled={syncingQueue}
                    title="Refresh patient queue"
                    aria-label="Refresh patient queue"
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-brand-strong hover:bg-brand-soft transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={cn('h-3 w-3', syncingQueue && 'animate-spin')} />
                    <span>{syncingQueue ? 'Syncing...' : 'Refresh'}</span>
                  </button>
                  <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
                </div>
              </div>
              <p className="mt-2 flex items-center gap-2 font-mono text-2xl font-extrabold text-ink">
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    socketConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500'
                  )}
                />
                {socketConnected ? 'ONLINE' : 'SYNCING'}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Socket.IO Telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Video Consultation In-Progress */}
        {activeCall && (callStatus === 'active' || callStatus === 'ended') && (
          <div className="mt-6">
            <VideoConsultation
              roomId={activeCall.room_id}
              status={callStatus === 'ended' ? 'ended' : 'active'}
              displayName={doctorName}
              participant={activeCall.patient_name}
              startedAt={activeCall.started_at}
              error={callError}
              ending={callEnding}
              title={
                selectedCareTier === 'telehealth'
                  ? 'Telehealth consultation'
                  : 'Video consultation'
              }
              onEnd={handleEndCall}
              onClose={handleCloseCall}
            />
          </div>
        )}

        {/* Incoming Consultation Alert */}
        {incomingCall && callStatus === 'incoming' && (
          <div className="sticky top-16 z-20 mt-5 flex flex-col gap-3 rounded-2xl border border-brand-border bg-brand-soft p-4 sm:flex-row sm:items-center sm:justify-between shadow-lg">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-border bg-surface text-brand-strong">
                <PhoneCall aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-strong">
                  Incoming video consultation
                </p>
                <p className="mt-1 text-sm leading-6 text-brand-strong">
                  <span className="font-semibold">
                    {incomingCall.patient_name ??
                      PATIENT_DIRECTORY[incomingCall.patient_id]?.name ??
                      'Patient'}
                  </span>{' '}
                  is waiting in secure room{' '}
                  <span className="font-mono">{incomingCall.room_id}</span>.
                </p>
                {callError && (
                  <p role="alert" className="mt-1 text-xs font-medium text-signal-danger-ink">
                    {callError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDeclineCall}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                Decline
              </button>
              <button
                type="button"
                onClick={() => handleAcceptVideo(incomingCall)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-brand bg-brand-solid px-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-brand-solid-hover"
              >
                <PhoneCall aria-hidden="true" className="h-4 w-4" />
                Accept Video Call
              </button>
            </div>
          </div>
        )}

        {callError && !activeCall && !incomingCall && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-xl border border-signal-danger-border bg-signal-danger-soft px-3 py-3 text-sm text-signal-danger-ink"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {callError}
          </div>
        )}

        {queueError && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-xl border border-signal-danger-border bg-signal-danger-soft px-3 py-3 text-sm text-signal-danger-ink"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {queueError}
          </div>
        )}

        {/* WORKSPACE GRID:
            LEFT: Queue Table + High-contrast Rx Pad below
            RIGHT: Full Patient Clinical Record & Handoff
        */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(420px,2fr)]">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-6 min-w-0">
            {/* 1. Incoming Queue Table */}
            <ClinicalCard className="min-w-0 overflow-hidden p-0">
              <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between bg-surface-muted/30">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-ink">
                      Incoming Clinical Queue
                    </h2>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-strong">
                      <Radio aria-hidden="true" className="h-3 w-3" />
                      Live Feed
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    Sorted by Manchester acuity · {sortedQueue.length} active triage cases
                  </p>
                </div>

              </div>

              {sortedQueue.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-surface-muted text-ink-muted">
                    <ClipboardList aria-hidden="true" className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink">
                    Queue is currently clear
                  </h3>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-ink-muted">
                    Cases appear here only after an administrator assigns them to you.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden max-h-[360px] overflow-auto md:block">
                    <table className="w-full min-w-[640px] border-collapse text-left">
                      <thead className="sticky top-0 z-10 bg-surface-muted/90 backdrop-blur-xs">
                        <tr className="border-b border-border">
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Acuity
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Patient
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Symptom & Pathway
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Arrival
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted text-right">
                            Full Chart
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedQueue.map((entry) => {
                          const patient = PATIENT_DIRECTORY[entry.patient_id];
                          const isSelected = selectedId === entry.patient_id;
                          const isNew = newIds.has(entry.patient_id);

                          return (
                            <motion.tr
                              key={entry.patient_id}
                              layout="position"
                              initial={isNew ? { opacity: 0, x: -20 } : false}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, ease: 'easeOut' }}
                              role="button"
                              tabIndex={0}
                              aria-selected={isSelected}
                              onClick={() => setSelectedId(entry.patient_id)}
                              className={cn(
                                'cursor-pointer border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-surface-muted/60',
                                isSelected && 'bg-brand-soft/60 font-medium',
                                isNew && 'bg-signal-success-soft'
                              )}
                            >
                              <td className="px-4 py-3.5">
                                <AcuityBadge acuity={entry.acuity} />
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className={cn(
                                      'grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-[10px] font-bold',
                                      isSelected
                                        ? 'border-brand-border bg-surface text-brand-strong'
                                        : 'border-border bg-surface-muted text-ink-secondary'
                                    )}
                                  >
                                    {initials(patient?.name ?? entry.patient_id)}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-ink">
                                      {patient?.name ?? entry.patient_id}
                                    </p>
                                    <p className="mt-0.5 font-mono text-xs text-ink-muted">
                                      {patient?.display_id ?? entry.patient_id}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="max-w-[280px] px-4 py-3.5">
                                <p className="truncate text-sm text-ink">
                                  {entry.symptom ?? 'Symptom narrative recorded'}
                                </p>
                                <p className="mt-0.5 text-xs text-ink-muted">
                                  {getCareTierLabel(entry.care_tier)} ·{' '}
                                  {STATUS_LABELS[entry.status] ?? entry.status ?? 'Triaged'}
                                </p>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3.5">
                                <p className="font-mono text-xs text-ink">
                                  {formatTime(entry.received_at)}
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-muted">
                                  {formatRelativeTime(entry.received_at)}
                                </p>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3.5 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedId(entry.patient_id);
                                    setShowReportModal(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-50 dark:bg-teal-950/40 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-600 hover:text-white transition-all shadow-2xs"
                                >
                                  <FileSpreadsheet className="h-3.5 w-3.5" />
                                  <span>View Report</span>
                                </button>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile list */}
                  <ul className="divide-y divide-border md:hidden">
                    {sortedQueue.map((entry) => {
                      const patient = PATIENT_DIRECTORY[entry.patient_id];
                      const isSelected = selectedId === entry.patient_id;

                      return (
                        <li key={entry.patient_id}>
                          <div
                            onClick={() => setSelectedId(entry.patient_id)}
                            className={cn(
                              'flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors cursor-pointer',
                              isSelected && 'bg-brand-soft/70 border-l-4 border-l-brand-solid'
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <AcuityBadge acuity={entry.acuity} />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedId(entry.patient_id);
                                  setShowReportModal(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-brand-border bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-strong"
                              >
                                View Report ↗
                              </button>
                            </div>

                            <div className="flex items-center gap-2.5">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-[10px] font-semibold bg-surface">
                                {initials(patient?.name ?? entry.patient_id)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-ink">
                                  {patient?.name ?? entry.patient_id}
                                </p>
                                <p className="font-mono text-[10px] text-ink-muted">
                                  {patient?.display_id ?? entry.patient_id}
                                </p>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              <div className="flex flex-col gap-2 border-t border-border bg-surface-muted/50 px-5 py-2.5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-solid" />
                  Review an assigned case, accept it, then prepare a prescription.
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                  Realtime Queue
                </span>
              </div>
            </ClinicalCard>

            {/* 2. HIGH CONTRAST, CRISP & EDITABLE E-PRESCRIPTION PAD */}
            <ClinicalPrescriptionSlip
              selectedPatient={selectedPatientObj}
              handoff={handoff}
              encounter={selectedEncounter}
              canPrescribe={canPrescribe}
              accepting={accepting}
              acceptError={acceptError}
              onAcceptEncounter={handleAcceptEncounter}
              rxList={rxList}
              onUpdateRx={handleUpdateRx}
              onAddRx={handleAddRx}
              onRemoveRx={handleRemoveRx}
              remarks={remarks}
              onRemarksChange={setRemarks}
              followUp={followUp}
              onFollowUpChange={setFollowUp}
              sending={sending}
              prescriptionError={prescriptionError}
              prescriptionId={prescriptionId}
              onSendPrescription={handleSendPrescription}
              currentDoctorName={doctorName}
              currentDoctorId={auth?.userId}
              onLoadPreset={handleLoadPreset}
            />
          </div>

          {/* RIGHT COLUMN: Full Patient Clinical Record & Handoff Panel */}
          <div className="min-w-0 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
            <HandoffPanel
              selectedId={selectedId}
              careTier={selectedEncounter?.care_tier ?? selectedEntry?.care_tier}
              handoff={handoff}
              loading={loadingHandoff}
              error={handoffError}
              destination={destination}
              destinationEta={destinationEta}
              routeUpdate={selectedEncounter?.route_update ?? null}
              encounter={selectedEncounter}
              traceSteps={traceSteps}
              onOpenFullReport={() => setShowReportModal(true)}
              onAcceptVideo={() => handleAcceptVideo()}
              callStatus={callStatus}
            />
          </div>
        </div>
      </main>

      {/* 3-PAGE COMPREHENSIVE CLINICAL HEALTH DOSSIER & PDF EXPORT */}
      <AnimatePresence>
        {showReportModal && (
          <FullscreenReportModal
            patient={selectedPatientObj}
            handoff={handoff}
            vitals={patientVitals(selectedId) ?? handoff?.vitals}
            encounter={selectedEncounter}
            currentDoctorName={doctorName}
            rxList={rxList}
            remarks={remarks}
            followUp={followUp}
            prescriptionId={prescriptionId}
            onClose={() => setShowReportModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
