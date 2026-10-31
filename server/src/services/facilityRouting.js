function specialtyMatches(facility, specialty) {
  if (!specialty) return false;

  const normalized = specialty.toLowerCase().replace(/\s+/g, '_');
  return (facility.specialties ?? []).some((entry) => {
    const value = String(entry).toLowerCase().replace(/\s+/g, '_');
    return value === normalized || value.includes(normalized);
  });
}

function emergencyCapability(facility) {
  return Number(Boolean(facility.has_icu)) +
    Number(Boolean(facility.has_cath_lab));
}

export function rankFacilities({
  facilities = [],
  protocol = null,
  careTier,
  mentalHealthContext = false,
  excludeFacilityIds = [],
}) {
  const excluded = new Set(excludeFacilityIds);
  let candidates = facilities.filter(
    (facility) =>
      facility?.id &&
      !excluded.has(facility.id) &&
      facility.status !== 'OFFLINE' &&
      Number(facility.capacity_pct) < 95
  );

  if (careTier === 'telehealth') {
    return mentalHealthContext
      ? candidates
          .filter((facility) => facility.type === 'mental_health_clinic')
          .sort(
            (a, b) =>
              Number(b.status === 'AVAILABLE') -
                Number(a.status === 'AVAILABLE') ||
              Number(a.eta_min) - Number(b.eta_min)
          )
      : [];
  }

  candidates = candidates.filter(
    (facility) =>
      mentalHealthContext || facility.type !== 'mental_health_clinic'
  );

  if (careTier === 'emergency') {
    candidates = candidates.filter(
      (facility) => emergencyCapability(facility) > 0
    );
  } else {
    const routineCapable = candidates.filter(
      (facility) =>
        Number(facility.capacity_pct) < 90 &&
        Number(facility.er_wait_min) < 60
    );
    if (routineCapable.length > 0) candidates = routineCapable;
  }

  return candidates.sort((a, b) => {
    const aPreferred = protocol?.preferred_types?.includes(a.type) ? 1 : 0;
    const bPreferred = protocol?.preferred_types?.includes(b.type) ? 1 : 0;
    if (aPreferred !== bPreferred) return bPreferred - aPreferred;

    const aSpecialty = specialtyMatches(a, protocol?.required_specialty) ? 1 : 0;
    const bSpecialty = specialtyMatches(b, protocol?.required_specialty) ? 1 : 0;
    if (aSpecialty !== bSpecialty) return bSpecialty - aSpecialty;

    if (careTier === 'emergency') {
      const capabilityDelta =
        emergencyCapability(b) - emergencyCapability(a);
      if (capabilityDelta !== 0) return capabilityDelta;
    }

    return (
      Number(a.eta_min) - Number(b.eta_min) ||
      Number(a.capacity_pct) - Number(b.capacity_pct)
    );
  });
}

export default { rankFacilities };
