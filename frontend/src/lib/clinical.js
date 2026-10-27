export const ACUITY_ORDER = {
  CRITICAL: 0,
  HIGH: 1,
  MODERATE: 2,
  LOW: 3,
};

export const ACUITY_META = {
  CRITICAL: {
    code: 'CRITICAL',
    label: 'Immediate',
    hex: '#DC2626',
    background: 'rgba(220, 38, 38, 0.10)',
    border: 'rgba(220, 38, 38, 0.32)',
    tint: '#FEF2F2',
  },
  HIGH: {
    code: 'HIGH',
    label: 'Very urgent',
    hex: '#EA580C',
    background: 'rgba(234, 88, 12, 0.10)',
    border: 'rgba(234, 88, 12, 0.32)',
    tint: '#FFF7ED',
  },
  MODERATE: {
    code: 'MODERATE',
    label: 'Urgent',
    hex: '#CA8A04',
    background: 'rgba(202, 138, 4, 0.12)',
    border: 'rgba(202, 138, 4, 0.34)',
    tint: '#FEFCE8',
  },
  LOW: {
    code: 'LOW',
    label: 'Standard',
    hex: '#16A34A',
    background: 'rgba(22, 163, 74, 0.10)',
    border: 'rgba(22, 163, 74, 0.30)',
    tint: '#F0FDF4',
  },
};

export const FACILITY_STATUS_META = {
  AVAILABLE: {
    label: 'Available',
    hex: '#16A34A',
    background: 'rgba(22, 163, 74, 0.10)',
    border: 'rgba(22, 163, 74, 0.30)',
  },
  LIMITED: {
    label: 'Limited',
    hex: '#CA8A04',
    background: 'rgba(202, 138, 4, 0.12)',
    border: 'rgba(202, 138, 4, 0.34)',
  },
  BUSY: {
    label: 'Busy',
    hex: '#EA580C',
    background: 'rgba(234, 88, 12, 0.10)',
    border: 'rgba(234, 88, 12, 0.32)',
  },
  OFFLINE: {
    label: 'Offline',
    hex: '#DC2626',
    background: 'rgba(220, 38, 38, 0.10)',
    border: 'rgba(220, 38, 38, 0.32)',
  },
};

export const CARE_TIER_LABELS = {
  telehealth: 'Telehealth',
  urgent_specialist: 'Urgent specialist',
  emergency: 'Emergency department',
};

export function getAcuityMeta(acuity) {
  return ACUITY_META[acuity] ?? ACUITY_META.LOW;
}

export function getFacilityStatusMeta(status) {
  return FACILITY_STATUS_META[status] ?? FACILITY_STATUS_META.LIMITED;
}

export function getCareTierLabel(careTier) {
  return CARE_TIER_LABELS[careTier] ?? 'Care pathway';
}

export const ACUITY_LEGEND = [
  ACUITY_META.CRITICAL,
  ACUITY_META.HIGH,
  ACUITY_META.MODERATE,
  ACUITY_META.LOW,
];
