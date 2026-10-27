import facilityStateManager from './facilityStateManager.js';
import {
  checkFacilityAvailability,
  evaluateAdherenceRisk,
  evaluateMentalHealthContext,
} from '../agent/tools.js';

const ACUITY_ORDER = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

const PROTOCOLS = {
  STROKE: {
    code: 'NEURO-003',
    label: 'Suspected Stroke Protocol',
    required_specialty: 'neurology',
    preferred_types: ['teaching_hospital', 'multi_specialty_hospital'],
    emergency: true,
    adherence_sensitive: true,
  },
  CARDIAC: {
    code: 'CARD-001',
    label: 'Cardiac Protocol',
    required_specialty: 'cardiology',
    preferred_types: ['teaching_hospital', 'multi_specialty_hospital'],
    emergency: true,
    adherence_sensitive: true,
  },
  RESPIRATORY: {
    code: 'RESP-002',
    label: 'Asthma Exacerbation Protocol',
    required_specialty: 'pulmonology',
    preferred_types: ['primary_care_clinic', 'multi_specialty_hospital'],
    emergency: false,
    adherence_sensitive: true,
  },
  GASTRO: {
    code: 'GI-004',
    label: 'GERD / Dyspepsia Protocol',
    required_specialty: 'general_medicine',
    preferred_types: ['primary_care_clinic', 'multi_specialty_hospital'],
    emergency: false,
    adherence_sensitive: true,
  },
  MENTAL_HEALTH: {
    code: 'MH-001',
    label: 'Mental Health Support Protocol',
    required_specialty: 'mental_health',
    preferred_types: ['mental_health_clinic'],
    emergency: false,
    adherence_sensitive: false,
  },
  FEBRILE: {
    code: 'GEN-002',
    label: 'Febrile Illness Protocol',
    required_specialty: 'general_medicine',
    preferred_types: ['primary_care_clinic', 'multi_specialty_hospital'],
    emergency: false,
    adherence_sensitive: true,
  },
  GENERAL: {
    code: 'GEN-000',
    label: 'General Triage Protocol',
    required_specialty: 'general_medicine',
    preferred_types: ['primary_care_clinic', 'multi_specialty_hospital'],
    emergency: false,
    adherence_sensitive: false,
  },
};

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  if (typeof value === 'string') {
    return value
      .split(/[,;]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Returns true when a symptom term appears outside a negated clause.
 * "No vomiting" must not score as vomiting, and "no chest pain" must not
 * select the cardiac protocol.
 */
function isNegated(text, index) {
  const prefix = text.slice(0, index);
  const boundary = Math.max(
    prefix.lastIndexOf('.'),
    prefix.lastIndexOf(';'),
    prefix.lastIndexOf('!'),
    prefix.lastIndexOf('?'),
    prefix.lastIndexOf(' but '),
    prefix.lastIndexOf(' however '),
    prefix.lastIndexOf(' except ')
  );
  const window = prefix.slice(boundary + 1);
  const negation = window.match(
    /\b(no|not|without|denies|denied|never|negative for)\b([\s\S]*)$/
  );

  if (!negation) return false;

  // A contrast or positive reporting verb re-opens the clause:
  // "denies chest pain, reports shortness of breath".
  return !/\b(but|however|reports?|reported|has|have|with|developed|started|feels?|experiencing)\b/.test(
    negation[2]
  );
}

function includesTerm(text, term) {
  let index = text.indexOf(term);

  while (index !== -1) {
    if (!isNegated(text, index)) return true;
    index = text.indexOf(term, index + Math.max(1, term.length));
  }

  return false;
}

function includesAny(text, terms) {
  return terms.some((term) => includesTerm(text, term));
}

function hasPositivePattern(text, pattern) {
  const flags = pattern.flags.includes('g')
    ? pattern.flags
    : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  let match = regex.exec(text);

  while (match !== null) {
    if (!isNegated(text, match.index)) return true;
    if (match[0].length === 0) regex.lastIndex += 1;
    match = regex.exec(text);
  }

  return false;
}

export function matchProtocol(symptom) {
  const text = String(symptom ?? '').toLowerCase();

  if (
    includesAny(text, [
      'stroke',
      'face droop',
      'facial droop',
      'slurred speech',
      'arm weakness',
      'left-arm weakness',
      'right-arm weakness',
      'one-sided weakness',
      'weakness on one side',
      'vision loss',
    ])
  ) {
    return PROTOCOLS.STROKE;
  }

  if (
    includesAny(text, [
      'chest pain',
      'crushing chest',
      'chest pressure',
      'palpitation',
      'heart racing',
      'cardiac',
      'radiating pain',
    ])
  ) {
    return PROTOCOLS.CARDIAC;
  }

  if (
    includesAny(text, [
      'wheez',
      'asthma',
      'breathless',
      'shortness of breath',
      'cannot breathe',
      "can't breathe",
      'inhaler',
      'cough',
    ])
  ) {
    return PROTOCOLS.RESPIRATORY;
  }

  if (
    includesAny(text, [
      'heartburn',
      'reflux',
      'gerd',
      'dyspepsia',
      'difficulty swallowing',
      'acid',
      'indigestion',
    ])
  ) {
    return PROTOCOLS.GASTRO;
  }

  if (
    includesAny(text, [
      'anxiety',
      'anxious',
      'panic',
      'depress',
      'hopeless',
      'mood',
      'mental health',
      'overwhelmed',
    ])
  ) {
    return PROTOCOLS.MENTAL_HEALTH;
  }

  if (includesAny(text, ['fever', 'temperature', 'chills', 'infection'])) {
    return PROTOCOLS.FEBRILE;
  }

  return PROTOCOLS.GENERAL;
}

function scoreAcuity(symptom) {
  const text = String(symptom ?? '').toLowerCase();

  const criticalPatterns = [
    /chest pain.*(sweat|radiat|crush|pressure|short)/,
    /(sweat|radiat|crush).*chest pain/,
    /(face droop|facial droop|slurred speech|arm weakness|one-sided weakness|weakness on one side)/,
    /(unconscious|unresponsive|not breathing|stopped breathing|severe bleeding|bleeding heavily|seizure)/,
    /(suicidal|overdose|self-harm|self harm)/,
  ];

  if (criticalPatterns.some((pattern) => hasPositivePattern(text, pattern))) {
    return 'CRITICAL';
  }

  const highPatterns = [
    /(severe|worst).*(pain|headache|abdominal|chest)/,
    /(9|10)\s*\/\s*10/,
    /(cannot breathe|can't breathe|breathless at rest|shortness of breath at rest)/,
    /(confusion|confused|disoriented)/,
    /(fever|temperature).*(39|40|41)/,
    /(vomiting blood|blood in vomit|black stool)/,
    /(palpitations|heart racing).*(dizziness|dizzy|faint|lightheaded)/,
    /(sudden).*(weakness|numbness|vision loss)/,
  ];

  if (highPatterns.some((pattern) => hasPositivePattern(text, pattern))) {
    return 'HIGH';
  }

  const moderatePatterns = [
    /(wheez|asthma|breathless|shortness of breath)/,
    /(fever|temperature)/,
    /(abdominal pain|stomach pain|vomiting|diarrhea)/,
    /(migraine|headache)/,
    /(urinary|burning urination)/,
    /(palpitations|heart racing)/,
    /(chest tightness)/,
  ];

  if (moderatePatterns.some((pattern) => hasPositivePattern(text, pattern))) {
    return 'MODERATE';
  }

  return 'LOW';
}

function escalateAcuity(acuity) {
  const index = ACUITY_ORDER.indexOf(acuity);
  if (index < 0 || index >= ACUITY_ORDER.length - 1) return acuity;
  return ACUITY_ORDER[index + 1];
}

function facilitySpecialtyMatch(facility, specialty) {
  if (!specialty) return false;

  const normalized = specialty.toLowerCase().replace(/\s+/g, '_');

  return (facility.specialties ?? []).some((entry) => {
    const value = String(entry).toLowerCase().replace(/\s+/g, '_');
    return value === normalized || value.includes(normalized);
  });
}

function reasonForRejection(facility, selected, careTier, mentalContext) {
  if (facility.status === 'OFFLINE') {
    return 'Offline during this assessment; capacity and emergency resources are unavailable.';
  }

  if (facility.capacity_pct >= 95) {
    return `${facility.capacity_pct}% capacity; no safe reserve for an additional patient.`;
  }

  if (facility.type === 'mental_health_clinic' && !mentalContext) {
    return 'Mental-health services only; cannot assess or treat the presenting complaint.';
  }

  if (careTier === 'emergency' && !facility.has_icu) {
    return 'No ICU capability; unsafe destination for an emergency presentation.';
  }

  if (
    careTier === 'urgent_specialist' &&
    (facility.capacity_pct >= 90 || facility.er_wait_min >= 60)
  ) {
    return `${facility.capacity_pct}% capacity with a ${facility.er_wait_min}-minute ER wait; emergency resources are reserved for higher-acuity patients.`;
  }

  if (selected && facility.eta_min > selected.eta_min) {
    return `Farther away at ${facility.distance_km} km / ${facility.eta_min} min with no clinical advantage for this presentation.`;
  }

  return 'Clinically appropriate but a better-matched option was available.';
}

function buildTelehealthDestination(mental) {
  return {
    id: 'telehealth',
    name: 'Triage Horizon Telehealth',
    type: 'telehealth',
    distance_km: 0,
    eta_min: 0,
    capacity_pct: null,
    reason: mental.has_context
      ? 'Low-acuity presentation with a mental-health component. Telehealth can start care now, screen for alarm features and coordinate a mental-health follow-up without an in-person visit.'
      : 'Low-acuity presentation suitable for a secure video visit. Telehealth avoids unnecessary emergency-department demand and can escalate to in-person care if red flags appear.',
  };
}

function selectDestination({ acuity, careTier, protocol, mental }) {
  const allFacilities = facilityStateManager.getAllStates();

  const available = allFacilities.filter(
    (facility) => facility.status !== 'OFFLINE' && facility.capacity_pct < 95
  );

  if (careTier === 'telehealth') {
    if (mental.has_context && mental.facility_type === 'mental_health_clinic') {
      const mentalFacility = [...available]
        .filter((facility) => facility.type === 'mental_health_clinic')
        .sort((a, b) => {
          const statusDelta =
            Number(a.status === 'AVAILABLE') - Number(b.status === 'AVAILABLE');
          if (statusDelta !== 0) return -statusDelta;
          return a.eta_min - b.eta_min;
        })[0];

      if (mentalFacility) {
        const selected = {
          ...mentalFacility,
          reason: `Low-acuity mental-health presentation. ${mentalFacility.name} can deliver the telehealth consultation and coordinate ongoing psychological care; ${mentalFacility.eta_min}-minute travel is only required if an in-person review is needed.`,
        };

        return {
          selected,
          rejected: allFacilities
            .filter((facility) => facility.id !== selected.id)
            .map((facility) => ({
              id: facility.id,
              name: facility.name,
              reason: reasonForRejection(
                facility,
                selected,
                careTier,
                mental.has_context
              ),
            })),
        };
      }
    }

    const selected = buildTelehealthDestination(mental);

    return {
      selected,
      rejected: allFacilities.map((facility) => ({
        id: facility.id,
        name: facility.name,
        reason: reasonForRejection(
          facility,
          selected,
          careTier,
          mental.has_context
        ),
      })),
    };
  }

  let candidates = available.filter(
    (facility) => facility.type !== 'mental_health_clinic' || mental.has_context
  );

  if (careTier === 'emergency') {
    const capable = candidates.filter(
      (facility) => facility.has_icu || facility.has_cath_lab
    );

    if (capable.length > 0) {
      candidates = capable;
    }
  } else {
    const routineCapable = candidates.filter(
      (facility) => facility.capacity_pct < 90 && facility.er_wait_min < 60
    );

    if (routineCapable.length > 0) {
      candidates = routineCapable;
    }
  }

  if (candidates.length === 0) {
    const selected = buildTelehealthDestination(mental);
    return {
      selected,
      rejected: allFacilities.map((facility) => ({
        id: facility.id,
        name: facility.name,
        reason:
          'No in-person facility currently has safe capacity; telehealth is the interim safe pathway.',
      })),
    };
  }

  const scored = [...candidates].sort((a, b) => {
    const aPreferred = protocol.preferred_types.includes(a.type) ? 1 : 0;
    const bPreferred = protocol.preferred_types.includes(b.type) ? 1 : 0;
    if (aPreferred !== bPreferred) return bPreferred - aPreferred;

    const aSpecialty = facilitySpecialtyMatch(a, protocol.required_specialty)
      ? 1
      : 0;
    const bSpecialty = facilitySpecialtyMatch(b, protocol.required_specialty)
      ? 1
      : 0;
    if (aSpecialty !== bSpecialty) return bSpecialty - aSpecialty;

    if (careTier === 'emergency') {
      const aCapability =
        Number(a.has_icu) + Number(a.has_cath_lab) + Number(a.has_icu && a.has_cath_lab);
      const bCapability =
        Number(b.has_icu) + Number(b.has_cath_lab) + Number(b.has_icu && b.has_cath_lab);
      if (aCapability !== bCapability) return bCapability - aCapability;
    }

    if (a.eta_min !== b.eta_min) return a.eta_min - b.eta_min;
    return a.capacity_pct - b.capacity_pct;
  });

  const selected = scored[0];

  const destination = {
    ...selected,
    reason: `${selected.name} is the best match for ${protocol.code} at ${selected.distance_km} km / ${selected.eta_min} min with ${selected.capacity_pct}% capacity and ${selected.er_beds_available} ER beds available.`,
  };

  return {
    selected: destination,
    rejected: allFacilities
      .filter((facility) => facility.id !== selected.id)
      .map((facility) => ({
        id: facility.id,
        name: facility.name,
        reason: reasonForRejection(
          facility,
          selected,
          careTier,
          mental.has_context
        ),
      })),
  };
}

function buildSpecialFlags({ patient, symptom, protocol, adherence, mental }) {
  const text = String(symptom ?? '').toLowerCase();
  const flags = new Set();

  for (const condition of normalizeList(patient?.conditions)) {
    const value = condition.toLowerCase();

    if (value.includes('asthma')) flags.add('ASTHMA_HISTORY');
    if (value.includes('anxiety')) flags.add('ANXIETY_HISTORY');
    if (value.includes('depress')) flags.add('DEPRESSION_HISTORY');
    if (value.includes('gerd') || value.includes('reflux')) flags.add('GERD');
    if (value.includes('diabetes')) flags.add('DIABETES');
    if (value.includes('hypertension')) flags.add('HYPERTENSION');
    if (value.includes('atrial fibrillation')) flags.add('ATRIAL_FIBRILLATION');
  }

  for (const allergy of normalizeList(patient?.allergies)) {
    const value = allergy.toLowerCase();
    if (value.includes('penicillin')) flags.add('PENICILLIN_ALLERGY');
    if (value.includes('sulfa')) flags.add('SULFA_ALLERGY');
  }

  if (includesAny(text, ['reliever', 'inhaler']) && includesAny(text, ['twice', 'multiple', 'overuse'])) {
    flags.add('RELIEVER_OVERUSE');
  }

  if (includesAny(text, ['warfarin', 'anticoagul'])) {
    flags.add('ANTICOAGULANT_THERAPY');
  }

  if (protocol.code === 'NEURO-003') flags.add('SUSPECTED_STROKE');
  if (protocol.code === 'MH-001' || mental.has_context) flags.add('MENTAL_HEALTH_CONTEXT');
  if (adherence.risk === 'HIGH') flags.add('ADHERENCE_GAP');
  if (protocol.emergency) flags.add('EMERGENCY_PATHWAY');

  return Array.from(flags);
}

function buildRiskModifiers({ adherence, mental }) {
  const modifiers = [];

  if (adherence.risk === 'HIGH' || adherence.risk === 'MODERATE') {
    modifiers.push({
      key: 'adherence',
      label: 'Adherence risk',
      level: adherence.risk,
      detail: adherence.detail,
      source: 'Medicine adherence',
    });
  }

  if (mental.has_context) {
    modifiers.push({
      key: 'mental_health',
      label: 'Mental-health routing context',
      level: 'INFO',
      detail: mental.detail,
      source: 'Mental health',
    });
  }

  return modifiers;
}

function buildTrace({
  patient,
  protocol,
  adherence,
  mental,
  destination,
  availableCount,
}) {
  const timestamp = () => new Date().toISOString();
  const conditions = normalizeList(patient?.conditions);
  const medications = normalizeList(patient?.medications);

  return [
    {
      timestamp: timestamp(),
      tool: 'getPatientHistory',
      detail: `Retrieved ${conditions.length} condition${
        conditions.length === 1 ? '' : 's'
      }, ${medications.length} medication${medications.length === 1 ? '' : 's'}`,
      status: 'ok',
    },
    {
      timestamp: timestamp(),
      tool: 'evaluateAdherenceRisk',
      detail:
        adherence.risk === 'HIGH'
          ? 'HIGH RISK DETECTED'
          : `${adherence.risk} risk`,
      status: adherence.risk === 'HIGH' ? 'warning' : 'ok',
    },
    {
      timestamp: timestamp(),
      tool: 'evaluateMentalHealthContext',
      detail: mental.has_context
        ? `telehealth recommended · ${mental.facility_type}`
        : 'No mental-health flags',
      status: mental.has_context ? 'warning' : 'ok',
    },
    {
      timestamp: timestamp(),
      tool: 'matchProtocol',
      detail: `${protocol.code}: ${protocol.label}`,
      status: 'ok',
    },
    {
      timestamp: timestamp(),
      tool: 'checkFacilityAvailability',
      detail: `Filtered ${availableCount}/5 facilities`,
      status: 'ok',
    },
    {
      timestamp: timestamp(),
      tool: 'estimateEta',
      detail: destination
        ? `${destination.name} at ${destination.eta_min} min`
        : 'No destination available',
      status: 'ok',
    },
    {
      timestamp: timestamp(),
      tool: 'DECISION',
      detail: destination
        ? `Route to ${destination.name} (${protocol.code})`
        : 'Manual care coordination required',
      status: 'decision',
    },
  ];
}

function buildRationale({
  protocol,
  acuity,
  careTier,
  destination,
  adherence,
  mental,
}) {
  const rationale = [
    `${protocol.code} matched the presenting complaint; acuity is ${acuity} and the care tier is ${careTier.replaceAll('_', ' ')}.`,
  ];

  if (adherence.risk !== 'LOW') {
    rationale.push(`Adherence modifier: ${adherence.detail}`);
  } else if (adherence.recorded) {
    rationale.push(`Adherence modifier: ${adherence.detail}`);
  }

  if (mental.has_context) {
    rationale.push(`Mental-health modifier: ${mental.detail}`);
  }

  if (destination) {
    rationale.push(
      `${destination.name} selected at ${destination.distance_km} km / ${destination.eta_min} min${
        destination.capacity_pct != null
          ? ` with ${destination.capacity_pct}% capacity`
          : ''
      }.`
    );
  }

  return rationale;
}

/**
 * Deterministic triage engine used in mock mode. It produces the same shape as
 * the future live-LLM pipeline so the frontend and encounter model do not need
 * to change when the model is wired in.
 */
export function evaluateTriage({ patient, symptom }) {
  const normalizedSymptom = String(symptom ?? '').trim();
  const protocol = matchProtocol(normalizedSymptom);
  const adherence = evaluateAdherenceRisk(patient);
  const mental = evaluateMentalHealthContext(patient, normalizedSymptom);

  let acuity = scoreAcuity(normalizedSymptom);

  // Adherence escalation is applied only when the presentation is directly
  // adherence-sensitive. A low-acuity mental-health presentation keeps its
  // telehealth pathway while still surfacing the HIGH risk to the clinician.
  if (
    adherence.acuity_escalation &&
    protocol.adherence_sensitive &&
    !mental.has_context
  ) {
    acuity = escalateAcuity(acuity);
  }

  let careTier;

  if (acuity === 'CRITICAL' || acuity === 'HIGH') {
    careTier = 'emergency';
  } else if (acuity === 'MODERATE') {
    careTier = 'urgent_specialist';
  } else {
    careTier = 'telehealth';
  }

  if (mental.has_context && careTier !== 'emergency') {
    careTier = 'telehealth';
  }

  const availableFacilities = checkFacilityAvailability();
  const { selected, rejected } = selectDestination({
    acuity,
    careTier,
    protocol,
    mental,
  });

  const specialFlags = buildSpecialFlags({
    patient,
    symptom: normalizedSymptom,
    protocol,
    adherence,
    mental,
  });

  const riskModifiers = buildRiskModifiers({ adherence, mental });

  const agentTrace = buildTrace({
    patient,
    protocol,
    adherence,
    mental,
    destination: selected,
    availableCount: availableFacilities.length,
  });

  const agentRationale = buildRationale({
    protocol,
    acuity,
    careTier,
    destination: selected,
    adherence,
    mental,
  });

  return {
    patient_id: patient?.id ?? null,
    patient_name: patient?.name ?? '',
    symptom: normalizedSymptom,
    protocol_matched: `${protocol.code}: ${protocol.label}`,
    acuity,
    care_tier: careTier,
    selected_facility: selected,
    rejected_facilities: rejected,
    special_flags: specialFlags,
    risk_modifiers: riskModifiers,
    agent_rationale: agentRationale,
    agent_trace: agentTrace,
    adherence,
    mental_health: mental,
    timestamp: new Date().toISOString(),
    is_simulated: true,
  };
}

export default { evaluateTriage, matchProtocol };
