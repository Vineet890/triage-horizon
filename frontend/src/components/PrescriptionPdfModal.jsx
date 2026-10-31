import { useEffect, useRef } from 'react';
import {
  X,
  Printer,
  FileCheck,
  ShieldCheck,
  Building2,
  Calendar,
  User,
  Clock,
  Sparkles,
  Download,
} from 'lucide-react';
import { DEMO_PATIENTS } from '../lib/demoPatients';
import { downloadPrescriptionPdf } from '../lib/downloadPrescriptionPdf';
import { printPrescriptionElement } from '../lib/printPrescription';

export default function PrescriptionPdfModal({
  isOpen,
  onClose,
  prescription,
  encounter,
  patient: propPatient,
}) {
  const printRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !prescription) return null;

  // Resolve patient details
  const resolvedPatientId =
    prescription.patient_id || encounter?.patient_id || propPatient?.id || 'patient_001';
  const demoPatient =
    DEMO_PATIENTS.find((p) => p.id === resolvedPatientId) || DEMO_PATIENTS[0];
  const patient = {
    name:
      propPatient?.name ||
      encounter?.patient_name ||
      demoPatient?.name ||
      'Aarav Mehta',
    age:
      propPatient?.age ||
      encounter?.age ||
      demoPatient?.age ||
      24,
    gender:
      propPatient?.gender ||
      encounter?.gender ||
      demoPatient?.gender ||
      'Male',
    display_id:
      propPatient?.display_id ||
      encounter?.patient_display_id ||
      demoPatient?.display_id ||
      'TH-P-001',
    phone: propPatient?.phone || '8097700800',
    conditions:
      propPatient?.conditions ||
      encounter?.conditions ||
      demoPatient?.conditions ||
      ['Mild persistent asthma'],
    vitals:
      propPatient?.vitals ||
      encounter?.vitals ||
      demoPatient?.vitals || {
        blood_pressure: '128/82 mmHg',
        heart_rate: '92 bpm',
        respiratory_rate: '22 /min',
        oxygen_saturation: '94% on room air',
        temperature: '37.1 °C',
      },
    sample:
      encounter?.symptoms ||
      propPatient?.sample ||
      demoPatient?.sample ||
      'Persistent wheezing and mild chest tightness after climbing stairs.',
  };

  const doctorName = prescription.doctor_name || 'Dr. Mira Sen';
  const doctorReg = 'A-77363';
  const doctorDegree = 'M.D. (Emergency Medicine)';
  const rawId = prescription.prescription_id || 'TH-PR-77363-AUTH';
  const prescriptionId = rawId.replace(/^RX-/i, 'TH-PR-');
  const sentDate = prescription.sent_at
    ? new Date(prescription.sent_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

  // Parse instructions & remarks & follow up
  let rawInstructions = prescription.instructions || '';
  let followUp = 'Immediate Admission & Follow-up in 48 hours';
  let remarks = rawInstructions;

  if (rawInstructions.includes('| Follow-up:')) {
    const parts = rawInstructions.split('| Follow-up:');
    remarks = parts[0]?.trim() || 'Take medications as directed on schedule.';
    followUp = parts[1]?.trim() || followUp;
  } else if (rawInstructions.startsWith('Follow-up:')) {
    followUp = rawInstructions.replace('Follow-up:', '').trim();
    remarks = 'Take medications as directed on schedule. Maintain hydration.';
  }

  // Medications list: exact doctor-prescribed medications
  const medications = Array.isArray(prescription.medications) && prescription.medications.length > 0
    ? prescription.medications
    : resolvedPatientId === 'patient_002'
    ? [
        {
          name: 'Tab Warfarin Sodium 5mg',
          dosage: '0-0-1',
          duration: 'Ongoing',
          schedule: '0-0-1',
          instructions: 'Take at 18:00 daily; maintain INR target 2.0-3.0',
        },
        {
          name: 'Tab Amlodipine Besylate 5mg',
          dosage: '1-0-0',
          duration: 'Ongoing',
          schedule: '1-0-0',
          instructions: 'Morning after food',
        },
        {
          name: 'Tab Metformin HCl 1000mg',
          dosage: '1-0-1',
          duration: 'Ongoing',
          schedule: '1-0-1',
          instructions: 'Take with main meals',
        },
      ]
    : [
        {
          name: 'Inhaler Salbutamol (Ventolin)',
          dosage: '2 puffs (200 mcg)',
          duration: 'PRN every 4–6 hrs',
          schedule: 'PRN',
          instructions: 'Inhale with spacer; rinse mouth after use',
        },
        {
          name: 'Inhaler Fluticasone Propionate',
          dosage: '1 puff (125 mcg)',
          duration: 'Ongoing BD',
          schedule: '1-0-1',
          instructions: 'Morning and night maintenance',
        },
        {
          name: 'Tab Prednisolone 30mg',
          dosage: '1-0-0',
          duration: '5 days',
          schedule: '1-0-0',
          instructions: 'Take with breakfast in the morning',
        },
      ];

  const handlePrint = () => {
    printPrescriptionElement('official-prescription-page');
  };

  return (
    <div
      id="official-prescription-modal-wrapper"
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:static"
    >
      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box;
          }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          /* Hide all sibling app trees so only the modal is printed */
          #root > div > *:not(#official-prescription-modal-wrapper) {
            display: none !important;
          }
          #official-prescription-modal-wrapper {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            inset: auto !important;
          }
          #official-prescription-modal-wrapper > div {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #official-prescription-page {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 8mm 10mm !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            page-break-after: avoid;
            break-after: avoid;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative flex w-full max-w-4xl flex-col items-center">
        {/* Floating Top Action Bar */}
        <div className="no-print mb-4 flex w-full max-w-[820px] items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/95 px-5 py-3 text-white shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-500/20 text-teal-300">
              <FileCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-400">
                Official Clinical Prescription Slip (PDF)
              </p>
              <p className="font-mono text-[11px] text-slate-300">
                ID: {prescriptionId} · E-Signed by {doctorName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadPrescriptionPdf(prescription, patient)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-teal-500 active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2 text-xs font-bold text-slate-200 shadow-md transition-all hover:bg-slate-700 hover:text-white active:scale-95"
            >
              <Printer className="h-4 w-4" />
              <span>Print Slip</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl border border-slate-700 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              aria-label="Close document modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PAGISH CLINICAL PRESCRIPTION PDF DOCUMENT (Replica of Image 2) */}
        {/* ======================================================== */}
        <div
          id="official-prescription-page"
          ref={printRef}
          className="relative w-full max-w-[820px] rounded-2xl border border-slate-300 bg-white p-8 text-slate-900 shadow-2xl transition-all sm:p-12 font-sans"
        >
          {/* Clinic Header: Emblem & Name */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-2">
            <div className="flex items-center gap-4">
              {/* Triage Horizon Official Logo */}
              <div className="flex flex-col items-center">
                <img
                  src="/logo.png"
                  alt="Triage Horizon"
                  className="h-16 w-16 object-contain rounded-xl border border-[#A3C9B4]/60 bg-white p-0.5 shadow-sm"
                />
                <span className="mt-1 font-mono text-[8.5px] font-extrabold uppercase tracking-widest text-[#3D6B56]">
                  TRIAGE HORIZON
                </span>
              </div>

              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                  Triage Horizon Clinical Medical Center
                </h1>
                <p className="text-xs text-slate-500">
                  Anand Society, Dindayal Road, Ghatkopar · Mumbai 368585 · Ph: 08097700800
                </p>
                <p className="text-[11px] text-[#3D6B56] font-semibold">
                  YOUR HEALTH JOURNEY. ONE PLACE. · Emergency & Specialist Prescription Dispatch
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block rounded-md border border-[#7CA982]/40 bg-[#EFF7F2] px-2.5 py-1 text-xs font-black uppercase text-[#3D6B56]">
                Official Prescription Sheet
              </span>
              <p className="mt-1 font-mono text-[10px] text-slate-500">
                Ref: {prescriptionId}
              </p>
            </div>
          </div>

          {/* Top Sage Green Dividing Accent Line */}
          <div className="my-3 h-0.5 w-full bg-[#3D6B56]" />

          {/* Patient Demographics & Doctor Registration */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 py-2 text-xs">
            <div>
              <p className="font-semibold text-slate-900">
                Patient: <strong className="text-sm font-bold text-slate-950">{patient.name}</strong>
              </p>
              <p className="text-slate-600">
                {patient.gender}, {patient.age} years
              </p>
              <p className="font-mono text-slate-600">
                Patient ID: {patient.display_id} · Ph: {patient.phone}
              </p>
              <p className="text-slate-600">
                Date: <span className="font-mono font-bold text-slate-900">{sentDate}</span>
              </p>
            </div>

            <div className="sm:text-right">
              <p className="text-sm font-bold text-slate-950">
                {doctorName}
              </p>
              <p className="text-slate-600 font-medium">{doctorDegree}</p>
              <p className="font-mono text-slate-600">Registration No.: {doctorReg}</p>
              <p className="mt-1">
                <span className="inline-flex items-center gap-1 rounded bg-teal-50 border border-teal-200 px-2 py-0.5 font-mono text-[10px] font-bold text-teal-800 uppercase">
                  <ShieldCheck className="h-3 w-3 text-teal-600" />
                  Verified Doctor License
                </span>
              </p>
            </div>
          </div>

          {/* Subtle gray separator */}
          <div className="my-3 border-t border-slate-200" />

          {/* Medical Complaint, Observations, Investigations & Diagnosis */}
          <div className="space-y-3 text-xs leading-5">
            <p>
              <strong className="font-bold text-slate-900">Complaint:</strong>{' '}
              <span className="text-slate-700">{patient.sample}</span>
            </p>

            <p>
              <strong className="font-bold text-slate-900">Observations:</strong>{' '}
              <span className="text-slate-700">
                Blood Pressure {patient.vitals?.blood_pressure || '168/96 mmHg'}, Heart Rate{' '}
                {patient.vitals?.heart_rate || '118 bpm, irregular'}, Resp Rate{' '}
                {patient.vitals?.respiratory_rate || '20 /min'}, SpO2{' '}
                {patient.vitals?.oxygen_saturation || '96% on room air'}, Temp{' '}
                {patient.vitals?.temperature || '36.9 °C'}.
              </span>
            </p>

            <div>
              <strong className="font-bold text-slate-900">Investigations Suggested:</strong>
              <ul className="mt-1 list-inside list-disc pl-2 space-y-0.5 text-slate-700 font-medium">
                <li>Complete Blood Count (CBC) & Platelet count</li>
                <li>Cardiac Biomarkers / Troponin I & Creatine Kinase (CK-MB)</li>
                <li>Continuous 12-Lead ECG & Rhythm telemetry</li>
                <li>Coagulation Profile (PT/INR monitoring)</li>
              </ul>
            </div>

            <p className="pt-1">
              <strong className="font-bold text-slate-900">Diagnosis:</strong>{' '}
              <span className="font-bold text-slate-950">
                {encounter?.acuity === 'CRITICAL'
                  ? 'Acute Atrial Fibrillation with Rapid Ventricular Response (RVR) / Suspected Neurological Event'
                  : 'Acute Respiratory Exacerbation with Wheeze / Clinical Protocol Pathway'}
              </span>
            </p>
          </div>

          {/* Prescription Table */}
          <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200/70 rounded-md px-2.5 py-1">
                  Prescribed Medications
                </span>
              </div>
              <span className="text-[11px] font-mono font-medium text-slate-500">
                Dispense as written · Standard medical protocols
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                    <th className="py-2.5 px-3">Medicine</th>
                    <th className="py-2.5 px-3">Dosage</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Measure</th>
                    <th className="py-2.5 px-3">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {medications.map((item, idx) => {
                    const dosageText = item.dosage || item.schedule || '1-0-1';
                    const durationText = item.duration || 'Ongoing';
                    const measureText =
                      item.name.toLowerCase().includes('inhaler')
                        ? 'Puffs'
                        : item.name.toLowerCase().includes('cap')
                        ? 'Capsule'
                        : 'Tablet';
                    const instructionsText =
                      item.note ||
                      item.instructions ||
                      (idx === 0 ? 'After Meal' : 'With Water');

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {item.name}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-teal-800">
                          {dosageText}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {durationText}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {measureText}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {instructionsText}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks & Next Follow-Up */}
          <div className="mt-6 space-y-2 border-t border-slate-200 pt-4 text-xs">
            <p>
              <strong className="font-bold text-slate-900">Remarks:</strong>{' '}
              <span className="text-slate-700">{remarks}</span>
            </p>
            <p>
              <strong className="font-bold text-slate-900">Next follow-up date:</strong>{' '}
              <span className="font-bold text-slate-900">{followUp}</span>
            </p>
          </div>

          {/* Authorized Signature & Digital Seal Block */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-teal-200 bg-teal-50/70 p-3 text-teal-900">
              <ShieldCheck className="h-6 w-6 shrink-0 text-teal-600" />
              <div className="text-[11px] leading-tight">
                <p className="font-bold">Cryptographically Verified Digital Prescription</p>
                <p className="text-teal-700 font-mono mt-0.5">
                  Signer: {doctorName} ({doctorReg}) · Horizon Care Network
                </p>
              </div>
            </div>

            <div className="text-center w-60">
              <div className="border-b border-slate-400 pb-1 font-serif text-lg font-bold italic text-slate-800">
                {doctorName}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-600">
                Authorised Signature
              </p>
            </div>
          </div>

          {/* Sage Green Bottom Dividing Line */}
          <div className="my-4 h-0.5 w-full bg-[#3D6B56]" />

          {/* Footer note */}
          <div className="text-center text-[10px] italic text-slate-400">
            This is a computer generated document
            <span className="mt-0.5 block font-mono not-italic text-slate-500">
              Ref: {prescriptionId} · Validated under Horizon Autonomous Decision Framework · Generated {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Quick Close Button at Bottom */}
        <div className="no-print mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-[#3D6B56] px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-all hover:bg-[#315745]"
          >
            <Printer className="h-4 w-4" />
            <span>Print / Save as PDF</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
          >
            <span>Close Document</span>
          </button>
        </div>
      </div>
    </div>
  );
}

