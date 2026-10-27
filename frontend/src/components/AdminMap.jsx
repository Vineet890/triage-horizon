import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import { Ambulance, Crosshair, Radio } from 'lucide-react';
import { ACUITY_ORDER, getCareTierLabel, getFacilityStatusMeta } from '../lib/clinical';
import useTriageStore, {
  ACTIVE_ENCOUNTER_STATUSES,
} from '../store/useTriageStore';
import { patientName } from '../lib/demoPatients';
import { cn, formatRelativeTime } from '../lib/utils';

// Default Vite + Leaflet marker icon fix. Circle markers are used below, but
// keeping this in place means any future L.marker() inherits working icons.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MAP_CENTER = [30.7333, 76.7794];
const MAP_ZOOM = 12;
// Sector 17, the fixed demo origin for every outbound patient route.
const PATIENT_LOCATION = [30.7415, 76.7821];
const PATIENT_LABEL = 'Patient location · Sector 17';

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// CARTO's keyless basemap endpoints now return tiles stamped "API KEY
// REQUIRED". Keep the specified Dark Matter layer as the primary source when a
// key is configured, and fall back to Esri's keyless Dark Gray Canvas so the
// command centre stays clean out of the box.
const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY ?? '';
const CARTO_TILE_URL = CARTO_API_KEY
  ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?api_key=${CARTO_API_KEY}`
  : null;
const ESRI_DARK_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const ESRI_REFERENCE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Esri, HERE, Garmin, &copy; OpenStreetMap contributors';

const ESRI_LIGHT_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const ESRI_LIGHT_REFERENCE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';

// Esri's Dark Gray Canvas only has native tiles through z16. Beyond that the
// service returns blank tiles, which made the local area disappear when users
// zoomed in. OSM is the keyless basemap with real street detail through z19;
// it is filtered dark below so the high-zoom view matches the command centre.
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ESRI_DARK_MAX_NATIVE_ZOOM = 16;
const OSM_MAX_NATIVE_ZOOM = 19;
const MAP_MAX_ZOOM = 19;
const DEEP_ZOOM_START = 17;

const COLORS = {
  green: '#16A34A',
  amber: '#CA8A04',
  red: '#DC2626',
  teal: '#0D9488',
  ink: '#F3F4F6',
  muted: '#9CA3AF',
  line: '#374151',
};

const REROUTE_ANIMATION_MS = 1100;
const DROPPED_MARKER_MS = 4200;

const ACTIVE_STATUS_SET = new Set(ACTIVE_ENCOUNTER_STATUSES);

function statusColor(status) {
  if (status === 'OFFLINE') return COLORS.red;
  if (status === 'AVAILABLE') return COLORS.green;
  // BUSY and LIMITED share the amber treatment on the map.
  return COLORS.amber;
}

function coordinatesOf(facility) {
  const lat = Number(facility?.coordinates?.lat);
  const lng = Number(facility?.coordinates?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function encounterFacilityId(encounter) {
  return encounter?.facility_id ?? encounter?.selected_facility?.id ?? null;
}

function pickPriorityEncounter(encounters) {
  const routable = encounters.filter(
    (encounter) =>
      ACTIVE_STATUS_SET.has(encounter.status) && encounterFacilityId(encounter)
  );

  if (routable.length === 0) return null;

  return [...routable].sort((a, b) => {
    const acuityDelta =
      (ACUITY_ORDER[a.acuity] ?? 9) - (ACUITY_ORDER[b.acuity] ?? 9);
    if (acuityDelta !== 0) return acuityDelta;

    return (
      new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
      new Date(a.updated_at ?? a.created_at ?? 0).getTime()
    );
  })[0];
}

function MapTileLayers({ theme }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const isDark = theme === 'dark';

  useEffect(() => {
    const handleZoom = () => setZoom(map.getZoom());

    map.on('zoomend', handleZoom);
    return () => map.off('zoomend', handleZoom);
  }, [map]);

  if (CARTO_TILE_URL) {
    return (
      <TileLayer
        url={
          isDark
            ? CARTO_TILE_URL
            : CARTO_TILE_URL.replace('/dark_all/', '/light_all/')
        }
        attribution={TILE_ATTRIBUTION}
        maxNativeZoom={18}
        maxZoom={MAP_MAX_ZOOM}
      />
    );
  }

  return (
    <>
      <TileLayer
        url={isDark ? ESRI_DARK_TILE_URL : ESRI_LIGHT_TILE_URL}
        attribution={ESRI_ATTRIBUTION}
        maxNativeZoom={ESRI_DARK_MAX_NATIVE_ZOOM}
        maxZoom={MAP_MAX_ZOOM}
      />
      <TileLayer
        url={isDark ? ESRI_REFERENCE_TILE_URL : ESRI_LIGHT_REFERENCE_TILE_URL}
        attribution=""
        maxNativeZoom={ESRI_DARK_MAX_NATIVE_ZOOM}
        maxZoom={ESRI_DARK_MAX_NATIVE_ZOOM}
      />
      {zoom >= DEEP_ZOOM_START && (
        <TileLayer
          url={OSM_TILE_URL}
          // The Esri attribution already credits OpenStreetMap contributors.
          attribution=""
          maxZoom={MAP_MAX_ZOOM}
          maxNativeZoom={OSM_MAX_NATIVE_ZOOM}
          className={isDark ? 'th-map-osm-dark' : 'th-map-osm-light'}
        />
      )}
    </>
  );
}

function LegendItem({ color, label, pulse = false }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-medium text-ink-secondary">
      <span
        aria-hidden="true"
        className={cn('h-2 w-2 rounded-[1px]', pulse && 'th-map-legend-pulse')}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

export default function AdminMap({ className }) {
  const facilities = useTriageStore((state) => state.facilities);
  const encounters = useTriageStore((state) => state.encounters);
  const routeUpdates = useTriageStore((state) => state.routeUpdates);
  const theme = useTriageStore((state) => state.theme);

  const [lineEnd, setLineEnd] = useState(null);
  const [linePhase, setLinePhase] = useState('idle');
  const [droppedFacilityId, setDroppedFacilityId] = useState('');

  const lineEndRef = useRef(null);
  const animationRef = useRef(null);
  const droppedTimerRef = useRef(null);

  const latestRouteUpdate = routeUpdates[0] ?? null;

  // A fresh reroute takes visual priority so the shock animation is never
  // hidden behind a higher-acuity case that was not affected. Otherwise the
  // command centre follows the highest-acuity active encounter.
  const focusEncounter = useMemo(() => {
    const priority = pickPriorityEncounter(encounters);

    if (!latestRouteUpdate?.patient_id) return priority;

    const rerouted = encounters.find(
      (encounter) =>
        encounter.patient_id === latestRouteUpdate.patient_id &&
        ACTIVE_STATUS_SET.has(encounter.status)
    );

    if (!rerouted) return priority;
    if (!priority) return rerouted;

    const reroutedAt = new Date(latestRouteUpdate.rerouted_at ?? 0).getTime();
    const priorityAt = new Date(
      priority.updated_at ?? priority.created_at ?? 0
    ).getTime();

    // The newest reroute wins until a newer clinical update arrives.
    return reroutedAt >= priorityAt ? rerouted : priority;
  }, [encounters, latestRouteUpdate]);

  const focusFacilityId = encounterFacilityId(focusEncounter);
  const routeFacility = useMemo(() => {
    if (!focusFacilityId) return null;

    return (
      facilities.find((facility) => facility.id === focusFacilityId) ??
      (focusEncounter?.selected_facility?.id === focusFacilityId
        ? focusEncounter.selected_facility
        : null)
    );
  }, [facilities, focusEncounter, focusFacilityId]);

  const routeCoordinates = coordinatesOf(routeFacility);
  const routeEta =
    routeFacility?.eta_min ??
    focusEncounter?.selected_facility?.eta_min ??
    null;

  const targetLat = routeCoordinates?.[0] ?? null;
  const targetLng = routeCoordinates?.[1] ?? null;

  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (targetLat == null || targetLng == null) {
      lineEndRef.current = null;
      setLineEnd(null);
      setLinePhase('idle');
      return undefined;
    }

    const next = { id: focusFacilityId, lat: targetLat, lng: targetLng };
    const previous = lineEndRef.current;

    if (!previous || previous.id === next.id) {
      lineEndRef.current = next;
      setLineEnd(next);
      setLinePhase('steady');
      return undefined;
    }

    // The old destination is marked red while the line sweeps to the new one.
    setDroppedFacilityId(previous.id);
    if (droppedTimerRef.current) window.clearTimeout(droppedTimerRef.current);
    droppedTimerRef.current = window.setTimeout(() => {
      setDroppedFacilityId('');
      droppedTimerRef.current = null;
    }, DROPPED_MARKER_MS);

    setLinePhase('rerouting');

    const startedAt = performance.now();
    const from = { lat: previous.lat, lng: previous.lng };

    const step = (now) => {
      const progress = Math.min(
        1,
        Math.max(0, (now - startedAt) / REROUTE_ANIMATION_MS)
      );
      const eased = 1 - Math.pow(1 - progress, 3);
      const point = {
        id: next.id,
        lat: from.lat + (next.lat - from.lat) * eased,
        lng: from.lng + (next.lng - from.lng) * eased,
      };

      lineEndRef.current = point;
      setLineEnd(point);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        lineEndRef.current = next;
        setLineEnd(next);
        setLinePhase('steady');
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(step);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [focusFacilityId, targetLat, targetLng]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (droppedTimerRef.current) window.clearTimeout(droppedTimerRef.current);
    };
  }, []);

  const rerouting = linePhase === 'rerouting';
  const lineColor = rerouting ? COLORS.amber : COLORS.teal;
  const linePositions =
    lineEnd != null
      ? [PATIENT_LOCATION, [lineEnd.lat, lineEnd.lng]]
      : null;

  return (
    <section
      aria-label="Live facility network map"
      className={cn(
        'overflow-hidden rounded-[6px] border border-border bg-surface',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Radio aria-hidden="true" className="h-4 w-4 text-brand-strong" />
          <h2 className="text-sm font-semibold text-ink">
            Live network map
          </h2>
          <span className="rounded-[4px] border border-brand-border bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-brand-strong">
            {facilities.length || 5} nodes
          </span>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
          Chandigarh grid · Sector 17 origin
        </p>
      </div>

      <div className="relative h-[450px] w-full">
        <MapContainer
          center={MAP_CENTER}
          zoom={MAP_ZOOM}
          minZoom={4}
          maxZoom={MAP_MAX_ZOOM}
          scrollWheelZoom
          zoomControl
          className={cn(
            'h-full w-full',
            theme === 'dark' ? 'th-map-dark' : 'th-map-light'
          )}
          attributionControl
        >
          <MapTileLayers theme={theme} />

          {facilities.map((facility) => {
            const coords = coordinatesOf(facility);
            if (!coords) return null;

            const isDropped = droppedFacilityId === facility.id;
            const offline = facility.status === 'OFFLINE' || isDropped;
            const color = isDropped ? COLORS.red : statusColor(facility.status);
            const statusMeta = getFacilityStatusMeta(
              isDropped ? 'OFFLINE' : facility.status
            );

            return (
              <CircleMarker
                key={`${facility.id}-${offline ? 'pulse' : 'steady'}`}
                center={coords}
                radius={offline ? 10 : 8}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.9,
                  weight: 2,
                  opacity: 1,
                  className: offline ? 'th-marker-pulse' : undefined,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <span className="th-map-tooltip-title">{facility.name}</span>
                  <span className="th-map-tooltip-meta">
                    {isDropped ? 'Rerouted away from this facility' : statusMeta.label}
                    {facility.eta_min != null ? ` · ${facility.eta_min} min ETA` : ''}
                  </span>
                </Tooltip>
              </CircleMarker>
            );
          })}

          {routeCoordinates && (
            <CircleMarker
              center={routeCoordinates}
              radius={14}
              pathOptions={{
                color: rerouting ? COLORS.amber : COLORS.teal,
                weight: 1,
                opacity: 0.9,
                fill: false,
              }}
            />
          )}

          <CircleMarker
            center={PATIENT_LOCATION}
            radius={6}
            pathOptions={{
              color: '#FFFFFF',
              fillColor: COLORS.teal,
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <span className="th-map-tooltip-title">{PATIENT_LABEL}</span>
              <span className="th-map-tooltip-meta">Route origin</span>
            </Tooltip>
          </CircleMarker>

          {linePositions && (
            <Polyline
              positions={linePositions}
              pathOptions={{
                color: lineColor,
                weight: 3,
                opacity: rerouting ? 0.95 : 0.9,
                dashArray: rerouting ? '8 6' : undefined,
                lineCap: 'round',
              }}
            />
          )}
        </MapContainer>

        <div className="pointer-events-none absolute inset-x-2 top-2 z-[1000] rounded-[6px] border border-border bg-surface-muted/[0.85] px-3 py-2 backdrop-blur-sm sm:inset-x-auto sm:right-3 sm:top-3 sm:w-[min(320px,calc(100%-1.5rem))] sm:px-3.5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Active route
            </p>
            {rerouting ? (
              <span className="inline-flex items-center gap-1 rounded-[4px] border border-signal-amber-border bg-signal-amber-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-amber-ink">
                <Ambulance aria-hidden="true" className="h-3 w-3" />
                Rerouting…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-[4px] border border-brand-border bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-strong">
                <Crosshair aria-hidden="true" className="h-3 w-3" />
                Live
              </span>
            )}
          </div>

          <p className="mt-1 text-[13px] font-semibold leading-5 text-ink sm:mt-1.5 sm:text-sm">
            Active Route: {routeFacility?.name ?? 'Standby'}
            <span className="mx-1.5 text-ink-muted">|</span>
            ETA:{' '}
            <span className="font-mono text-brand-strong">
              {routeEta != null ? `${routeEta} min` : '—'}
            </span>
          </p>

          <p className="mt-0.5 hidden text-[11px] text-ink-muted sm:mt-1 sm:block">
            {focusEncounter
              ? `${patientName(focusEncounter.patient_id)} · ${
                  focusEncounter.acuity ?? 'LOW'
                } · ${getCareTierLabel(focusEncounter.care_tier)} · ${
                  focusEncounter.id
                }`
              : 'No active encounter with a destination.'}
          </p>

          {latestRouteUpdate?.rerouted_at && (
            <p className="mt-1 hidden font-mono text-[10px] text-ink-muted sm:block">
              Last reroute {formatRelativeTime(latestRouteUpdate.rerouted_at)}
            </p>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-8 left-3 z-[1000] flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[6px] border border-border bg-surface-muted/[0.85] px-3 py-2 backdrop-blur-sm">
          <LegendItem color={COLORS.green} label="Available" />
          <LegendItem color={COLORS.amber} label="Busy / Limited" />
          <LegendItem color={COLORS.red} label="Offline" pulse />
          <LegendItem color={COLORS.teal} label="Active route" />
        </div>
      </div>
    </section>
  );
}
