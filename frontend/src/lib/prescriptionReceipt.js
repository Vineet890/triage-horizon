import { jsPDF } from 'jspdf';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function getDoseTimeLabel(time) {
  if (time === 'PRN') return 'As needed';
  const hour = Number(time.slice(0, 2));
  const period = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night';
  return `${time} (${period})`;
}

function getMedicationTimes(medication) {
  if (medication.as_needed) return ['As needed'];
  const times = Array.isArray(medication.times) ? medication.times : [];
  if (times.length) return times.map(getDoseTimeLabel);

  const schedule = String(medication.schedule ?? '').trim();
  return schedule ? [schedule] : ['As directed by your clinician'];
}

function getDoctorName(medication) {
  if (medication.doctor_name?.trim()) return medication.doctor_name.trim();

  const categoryName = medication.category?.match(/^Prescribed by\s+(.+)$/i)?.[1];
  return categoryName?.trim() || 'Not listed in your medication plan';
}

function safeFilename(value) {
  const normalized = String(value || 'patient')
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return normalized || 'patient';
}

export function createPrescriptionReceipt({
  medications,
  patientName,
  generatedAt = new Date(),
}) {
  if (!Array.isArray(medications) || medications.length === 0) {
    throw new Error('Add at least one medicine before downloading a receipt.');
  }

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 22;

  const ensureSpace = (height) => {
    if (y + height > PAGE_HEIGHT - MARGIN) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  const writeParagraph = (label, value, options = {}) => {
    const { bold = false, size = 10, gap = 2 } = options;
    const prefix = label ? `${label}: ` : '';
    const lines = pdf.splitTextToSize(`${prefix}${value}`, CONTENT_WIDTH);
    ensureSpace(lines.length * 5 + gap);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(bold ? 31 : 75, bold ? 55 : 85, bold ? 75 : 95);
    pdf.text(lines, MARGIN, y);
    y += lines.length * 5 + gap;
  };

  pdf.setFillColor(22, 101, 88);
  pdf.rect(0, 0, PAGE_WIDTH, 8, 'F');
  pdf.setTextColor(22, 101, 88);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('TRIAGE HORIZON', MARGIN, y);
  y += 8;

  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(14);
  pdf.text('E-prescription receipt', MARGIN, y);
  y += 8;

  pdf.setDrawColor(220, 226, 232);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  writeParagraph('Patient', patientName || 'Patient');
  writeParagraph(
    'Prepared',
    new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(generatedAt)
  );
  y += 3;

  medications.forEach((medication, index) => {
    const name = medication.name || 'Medicine';
    const dose = medication.dose || medication.dosage || 'As directed';
    const schedule = medication.schedule || 'As directed';
    const times = getMedicationTimes(medication);
    const prescriptionId = medication.prescription_id;

    ensureSpace(32);
    pdf.setFillColor(243, 247, 246);
    pdf.roundedRect(MARGIN, y - 4, CONTENT_WIDTH, 9, 1.5, 1.5, 'F');
    pdf.setTextColor(22, 101, 88);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(`${index + 1}. ${name}`, MARGIN + 3, y + 2);
    y += 11;

    writeParagraph('Dose', dose);
    writeParagraph('How often', schedule);
    writeParagraph('When to take', times.join(', '));
    writeParagraph('Prescribed by', getDoctorName(medication));
    if (prescriptionId) writeParagraph('Prescription reference', prescriptionId);
    if (medication.note?.trim()) {
      writeParagraph('Additional instructions', medication.note.trim());
    }
    y += 4;
  });

  ensureSpace(18);
  pdf.setDrawColor(220, 226, 232);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 110, 120);
  pdf.text(
    pdf.splitTextToSize(
      'Patient copy. Follow the directions provided by your prescribing clinician. Contact your care team if any details are unclear.',
      CONTENT_WIDTH
    ),
    MARGIN,
    y
  );

  return pdf;
}

export function downloadPrescriptionReceipt(options) {
  const pdf = createPrescriptionReceipt(options);
  pdf.save(
    `triage-horizon-prescription-${safeFilename(options.patientName)}.pdf`
  );
}
