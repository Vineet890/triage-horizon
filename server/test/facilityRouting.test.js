import assert from 'node:assert/strict';
import test from 'node:test';
import { rankFacilities } from '../src/services/facilityRouting.js';

const protocol = {
  code: 'CARD-001',
  required_specialty: 'cardiology',
  preferred_types: ['multi_specialty_hospital', 'teaching_hospital'],
};

const facilities = [
  {
    id: 'offline',
    type: 'multi_specialty_hospital',
    status: 'OFFLINE',
    capacity_pct: 10,
    eta_min: 1,
    has_icu: true,
    has_cath_lab: true,
    specialties: ['cardiology'],
  },
  {
    id: 'clinic',
    type: 'primary_care_clinic',
    status: 'AVAILABLE',
    capacity_pct: 10,
    eta_min: 2,
    has_icu: false,
    has_cath_lab: false,
    specialties: ['general_medicine'],
  },
  {
    id: 'nearest',
    type: 'multi_specialty_hospital',
    status: 'AVAILABLE',
    capacity_pct: 50,
    eta_min: 6,
    has_icu: true,
    has_cath_lab: true,
    specialties: ['cardiology'],
  },
  {
    id: 'farther',
    type: 'teaching_hospital',
    status: 'AVAILABLE',
    capacity_pct: 45,
    eta_min: 12,
    has_icu: true,
    has_cath_lab: true,
    specialties: ['cardiology'],
  },
];

test('reroute selection uses triage ranking and excludes the shocked facility', () => {
  const initial = rankFacilities({
    facilities,
    protocol,
    careTier: 'emergency',
  });
  const afterShock = rankFacilities({
    facilities,
    protocol,
    careTier: 'emergency',
    excludeFacilityIds: [initial[0].id],
  });

  assert.equal(initial[0].id, 'nearest');
  assert.equal(afterShock[0].id, 'farther');
  assert.equal(afterShock.some((facility) => facility.id === 'nearest'), false);
  assert.equal(afterShock.some((facility) => facility.id === 'clinic'), false);
});

test('does not route emergency care to an incapable facility', () => {
  const selected = rankFacilities({
    facilities: facilities.filter((facility) => facility.id === 'clinic'),
    protocol,
    careTier: 'emergency',
  });

  assert.deepEqual(selected, []);
});
