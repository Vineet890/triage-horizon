import { create } from 'zustand';
import { clearSession, readSession, writeSession } from '../lib/session';
import { applyTheme, readTheme, writeTheme } from '../lib/theme';
import { PATIENT_DIRECTORY } from '../lib/demoPatients';
import { playTriageChime } from '../lib/sound';

const ROUTE_UPDATE_LIMIT = 24;

export const ACTIVE_ENCOUNTER_STATUSES = [
  'TRIAGED',
  'ROUTING',
  'AWAITING_ACCEPTANCE',
  'ACCEPTED',
  'EN_ROUTE',
];

const ACTIVE_STATUS_SET = new Set(ACTIVE_ENCOUNTER_STATUSES);

function createNotificationItem(payload, defaultRead = false) {
  if (!payload?.patient_id && !payload?.id) return null;

  const patientId = payload.patient_id ?? payload.id;
  const symptom =
    payload.symptom ??
    payload.decision?.symptom ??
    payload.encounter?.symptom ??
    'Patient symptom intake submitted';

  const patientName =
    payload.patient_name ??
    payload.patient?.name ??
    PATIENT_DIRECTORY[patientId]?.name ??
    patientId;

  const encounterId = payload.encounter_id ?? payload.id ?? null;
  const notificationId = `notif-${patientId}-${encounterId ?? Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id: notificationId,
    encounter_id: encounterId,
    patient_id: patientId,
    patient_name: patientName,
    symptom,
    acuity: payload.acuity ?? 'MODERATE',
    care_tier: payload.care_tier ?? 'telehealth',
    protocol_matched: payload.protocol_matched ?? 'Clinical Protocol',
    facility_name:
      payload.facility_name ??
      payload.selected_facility?.name ??
      null,
    selected_facility: payload.selected_facility ?? null,
    agent_rationale: payload.agent_rationale ?? '',
    risk_modifiers: payload.risk_modifiers ?? [],
    special_flags: payload.special_flags ?? [],
    timestamp: payload.created_at ?? payload.received_at ?? new Date().toISOString(),
    read: defaultRead,
  };
}

function mergeRoute(entry, payload) {
  if (entry.patient_id !== payload.patient_id) return entry;

  return {
    ...entry,
    selected_facility:
      payload.selected_facility !== undefined
        ? payload.selected_facility
        : entry.selected_facility,
    route_update: payload,
    rerouted_at: payload.rerouted_at,
    reroute_status: payload.reroute_status,
  };
}

function encounterFrom(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const encounter = payload.encounter ?? payload;
  return encounter?.id ? encounter : null;
}

function encounterTime(encounter) {
  return new Date(encounter?.created_at ?? encounter?.updated_at ?? 0).getTime();
}

function sortEncounters(encounters) {
  return [...encounters].sort((a, b) => encounterTime(b) - encounterTime(a));
}

function mergeEncounterList(list, encounter) {
  return sortEncounters([
    encounter,
    ...list.filter((entry) => entry.id !== encounter.id),
  ]);
}

function prescriptionEntry(payload) {
  const prescription = payload?.prescription ?? {
    prescription_id: payload?.prescription_id,
    medications: payload?.medications ?? [],
    instructions: payload?.instructions ?? '',
    doctor_id: payload?.doctor_id ?? null,
    doctor_name: payload?.doctor_name ?? '',
    sent_at: payload?.sent_at ?? new Date().toISOString(),
  };

  if (!prescription?.prescription_id) return null;

  return {
    ...prescription,
    encounter_id: payload?.encounter_id ?? null,
    patient_id: payload?.patient_id ?? null,
  };
}

function collectPrescriptions(encounters) {
  return encounters
    .filter((encounter) => encounter?.prescription?.prescription_id)
    .map((encounter) => ({
      ...encounter.prescription,
      encounter_id: encounter.id,
      patient_id: encounter.patient_id,
    }));
}

function mergePrescriptions(list, incoming) {
  const byId = new Map();

  [...incoming, ...list].forEach((prescription) => {
    if (!prescription?.prescription_id) return;
    if (!byId.has(prescription.prescription_id)) {
      byId.set(prescription.prescription_id, prescription);
    }
  });

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.sent_at ?? 0).getTime() - new Date(a.sent_at ?? 0).getTime()
  );
}

function mergePrescriptionNotifications(existing, incoming, defaultRead) {
  const notifications = new Map(
    existing.map((item) => [item.prescription_id, item])
  );

  incoming.forEach((prescription) => {
    if (!prescription?.prescription_id) return;

    const current = notifications.get(prescription.prescription_id);
    notifications.set(prescription.prescription_id, {
      id: prescription.prescription_id,
      prescription_id: prescription.prescription_id,
      patient_id: prescription.patient_id ?? current?.patient_id ?? null,
      prescription: {
        ...current?.prescription,
        ...prescription,
      },
      sent_at: prescription.sent_at ?? current?.sent_at ?? null,
      read: current?.read ?? defaultRead,
    });
  });

  return Array.from(notifications.values()).sort(
    (a, b) =>
      new Date(b.sent_at ?? 0).getTime() - new Date(a.sent_at ?? 0).getTime()
  );
}

function mergeTriageResult(result, encounter) {
  if (!result || !encounter) return result;
  if (
    result.patient_id !== encounter.patient_id &&
    result.encounter_id !== encounter.id
  ) {
    return result;
  }

  return {
    ...result,
    encounter_id: encounter.id,
    encounter,
    status: encounter.status,
    acuity: encounter.acuity ?? result.acuity,
    care_tier: encounter.care_tier ?? result.care_tier,
    selected_facility:
      encounter.selected_facility !== undefined
        ? encounter.selected_facility
        : result.selected_facility,
    assigned_doctor_id: encounter.assigned_doctor_id ?? null,
    assigned_doctor_name: encounter.assigned_doctor_name ?? null,
    prescription: encounter.prescription ?? result.prescription ?? null,
    route_update: encounter.route_update ?? result.route_update ?? null,
  };
}

function activeEncounterFor(encounters, patientId) {
  if (!patientId) return null;

  return (
    encounters.find(
      (encounter) =>
        encounter.patient_id === patientId &&
        ACTIVE_STATUS_SET.has(encounter.status)
    ) ??
    encounters.find((encounter) => encounter.patient_id === patientId) ??
    null
  );
}

export const useTriageStore = create((set, get) => ({
  facilities: [],
  auth: readSession(),
  theme: readTheme(),
  socketConnected: false,
  currentPatient: null,
  triageResult: null,
  queue: [],
  routeUpdates: [],
  routeToast: null,
  encounters: [],
  activeEncounterId: null,
  agentTrace: [],
  agentTraceEncounterId: null,
  prescriptions: [],
  prescriptionNotifications: [],
  prescriptionToast: null,
  triageNotifications: [],
  triageToast: null,
  notificationSoundEnabled: true,

  setFacilities: (facilities) =>
    set({
      facilities: Array.isArray(facilities) ? facilities : [],
    }),

  updateFacility: (payload) =>
    set((state) => {
      if (!payload?.id) return state;

      const index = state.facilities.findIndex((facility) => facility.id === payload.id);

      if (index === -1) {
        return { facilities: [...state.facilities, payload] };
      }

      const facilities = [...state.facilities];
      facilities[index] = { ...facilities[index], ...payload };

      return { facilities };
    }),

  setEncounters: (list) =>
    set((state) => {
      const encounters = sortEncounters(
        (Array.isArray(list) ? list : []).filter((encounter) => encounter?.id)
      );

      const prescriptions = mergePrescriptions(
        state.prescriptions,
        collectPrescriptions(encounters)
      );
      const prescriptionNotifications = mergePrescriptionNotifications(
        state.prescriptionNotifications,
        collectPrescriptions(encounters),
        true
      );

      const activeEncounterId =
        encounters.some((encounter) => encounter.id === state.activeEncounterId)
          ? state.activeEncounterId
          : encounters.find((encounter) =>
              ACTIVE_STATUS_SET.has(encounter.status)
            )?.id ??
            encounters[0]?.id ??
            null;

      const selected = encounters.find(
        (encounter) => encounter.id === activeEncounterId
      );

      let triageNotifications = state.triageNotifications;
      if (triageNotifications.length === 0 && encounters.length > 0) {
        triageNotifications = encounters
          .filter((enc) => enc.symptom)
          .slice(0, 15)
          .map((enc) => createNotificationItem(enc, true))
          .filter(Boolean);
      }

      return {
        encounters,
        prescriptions,
        prescriptionNotifications,
        triageNotifications,
        activeEncounterId,
        triageResult: selected
          ? mergeTriageResult(state.triageResult, selected)
          : state.triageResult,
      };
    }),

  upsertEncounter: (payload) =>
    set((state) => {
      const encounter = encounterFrom(payload);
      if (!encounter) return state;

      const previousEncounter = state.encounters.find(
        (entry) => entry.id === encounter.id
      );
      const encounters = mergeEncounterList(state.encounters, encounter);
      const incomingPrescription = encounter.prescription
        ? [
            {
              ...encounter.prescription,
              encounter_id: encounter.id,
              patient_id: encounter.patient_id,
            },
          ]
        : [];
      const isNewPrescription = incomingPrescription.some(
        (prescription) =>
          !previousEncounter?.prescription?.prescription_id &&
          !state.prescriptions.some(
            (saved) =>
              saved.prescription_id === prescription.prescription_id
          )
      );
      const prescriptionNotifications = mergePrescriptionNotifications(
        state.prescriptionNotifications,
        incomingPrescription,
        !isNewPrescription
      );

      const matchesCurrent =
        !state.activeEncounterId ||
        state.activeEncounterId === encounter.id ||
        (state.triageResult?.patient_id === encounter.patient_id &&
          ACTIVE_STATUS_SET.has(encounter.status));

      return {
        encounters,
        activeEncounterId: matchesCurrent
          ? encounter.id
          : state.activeEncounterId,
        prescriptions: mergePrescriptions(
          state.prescriptions,
          incomingPrescription
        ),
        prescriptionNotifications,
        queue: state.queue.map((entry) =>
          entry.patient_id === encounter.patient_id
            ? {
                ...entry,
                ...encounter,
                received_at: entry.received_at ?? encounter.created_at,
              }
            : entry
        ),
        triageResult: mergeTriageResult(state.triageResult, encounter),
      };
    }),

  setActiveEncounter: (encounterId) =>
    set((state) => {
      if (!encounterId) return { activeEncounterId: null };

      const encounter = state.encounters.find((entry) => entry.id === encounterId);

      return {
        activeEncounterId: encounter?.id ?? null,
        triageResult: encounter
          ? mergeTriageResult(state.triageResult, encounter)
          : state.triageResult,
      };
    }),

  activeEncounterForPatient: (patientId) =>
    activeEncounterFor(get().encounters, patientId),

  addTriageEvent: (payload) =>
    set((state) => {
      if (!payload?.patient_id) return state;

      const encounter = encounterFrom(payload);
      const entry = {
        ...payload,
        received_at: new Date().toISOString(),
        source: 'live',
      };

      const encounters = encounter
        ? mergeEncounterList(state.encounters, encounter)
        : state.encounters;

      const notification = createNotificationItem(payload, false);
      let triageNotifications = state.triageNotifications;
      let triageToast = state.triageToast;

      if (notification) {
        if (state.notificationSoundEnabled) {
          playTriageChime(notification.acuity);
        }
        triageNotifications = [
          notification,
          ...state.triageNotifications.filter(
            (n) =>
              n.encounter_id !== notification.encounter_id ||
              !notification.encounter_id
          ),
        ].slice(0, 50);
        triageToast = notification;
      }

      return {
        queue: [
          entry,
          ...state.queue.filter((item) => item.patient_id !== entry.patient_id),
        ],
        encounters,
        triageNotifications,
        triageToast,
        activeEncounterId: encounter?.id ?? state.activeEncounterId,
        triageResult:
          state.triageResult?.patient_id === entry.patient_id
            ? mergeTriageResult({ ...state.triageResult, ...entry }, encounter)
            : state.triageResult,
      };
    }),

  setAgentTrace: (steps, encounterId = null) =>
    set({
      agentTrace: Array.isArray(steps) ? steps : [],
      agentTraceEncounterId: encounterId,
    }),

  applyRouteUpdate: (payload) =>
    set((state) => {
      if (!payload?.patient_id) return state;

      const encounters = state.encounters.map((encounter) => {
        if (
          encounter.patient_id !== payload.patient_id ||
          !ACTIVE_STATUS_SET.has(encounter.status)
        ) {
          return encounter;
        }

        const selectedFacility = payload.selected_facility
          ? {
              ...(encounter.selected_facility ?? {}),
              ...payload.selected_facility,
            }
          : null;

        return {
          ...encounter,
          status: 'ROUTING',
          facility_id: payload.selected_facility?.id ?? null,
          facility_name: payload.selected_facility?.name ?? 'Manual care coordination',
          facility_snapshot: selectedFacility,
          selected_facility: selectedFacility,
          route_update: payload,
        };
      });

      const updatedEncounter = encounters.find(
        (encounter) => encounter.patient_id === payload.patient_id
      );

      let triageResult = state.triageResult;

      if (triageResult?.patient_id === payload.patient_id) {
        triageResult = mergeTriageResult(
          {
            ...triageResult,
            selected_facility:
              payload.selected_facility !== undefined
                ? payload.selected_facility
                : triageResult.selected_facility,
            route_update: payload,
          },
          updatedEncounter
        );
      }

      return {
        encounters,
        queue: state.queue.map((entry) => mergeRoute(entry, payload)),
        routeUpdates: [payload, ...state.routeUpdates].slice(0, ROUTE_UPDATE_LIMIT),
        triageResult,
        activeEncounterId:
          updatedEncounter?.id ??
          (state.activeEncounterId
            ? state.activeEncounterId
            : state.encounters[0]?.id ?? null),
        routeToast: {
          id: `${payload.patient_id}-${payload.rerouted_at ?? Date.now()}`,
          patient_id: payload.patient_id,
          facility_name:
            payload.selected_facility?.name ??
            (payload.reroute_status === 'NO_ALTERNATIVE_AVAILABLE'
              ? 'manual care coordination'
              : 'an alternate facility'),
          reason: payload.reason ?? '',
          rerouted_at: payload.rerouted_at ?? new Date().toISOString(),
        },
      };
    }),

  addPrescription: (payload) =>
    set((state) => {
      const prescription = prescriptionEntry(payload);
      if (!prescription) return state;

      const encounters = state.encounters.map((encounter) => {
        if (encounter.id !== prescription.encounter_id) return encounter;

        return {
          ...encounter,
          status:
            encounter.status === 'ACCEPTED' ? 'EN_ROUTE' : encounter.status,
          prescription,
        };
      });

      const updatedEncounter = encounters.find(
        (encounter) => encounter.id === prescription.encounter_id
      );

      return {
        encounters,
        prescriptions: mergePrescriptions(state.prescriptions, [prescription]),
        prescriptionNotifications: mergePrescriptionNotifications(
          state.prescriptionNotifications,
          [prescription],
          false
        ),
        triageResult: mergeTriageResult(state.triageResult, updatedEncounter),
        prescriptionToast: {
          id: prescription.prescription_id,
          prescription_id: prescription.prescription_id,
          medication_count: prescription.medications?.length ?? 0,
          doctor_name: prescription.doctor_name,
          title: 'Prescription received',
          message: 'New prescription added to your care plan.',
        },
      };
    }),

  dismissPrescriptionToast: () => set({ prescriptionToast: null }),

  markPrescriptionNotificationRead: (id) =>
    set((state) => ({
      prescriptionNotifications: state.prescriptionNotifications.map((item) =>
        item.id === id ? { ...item, read: true } : item
      ),
    })),

  markAllPrescriptionNotificationsRead: () =>
    set((state) => ({
      prescriptionNotifications: state.prescriptionNotifications.map((item) => ({
        ...item,
        read: true,
      })),
    })),

  dismissRouteToast: () => set({ routeToast: null }),

  addTriageNotification: (payload) =>
    set((state) => {
      const notification = createNotificationItem(payload, false);
      if (!notification) return state;

      if (state.notificationSoundEnabled) {
        playTriageChime(notification.acuity);
      }

      const filtered = state.triageNotifications.filter(
        (n) =>
          n.encounter_id !== notification.encounter_id ||
          !notification.encounter_id
      );

      return {
        triageNotifications: [notification, ...filtered].slice(0, 50),
        triageToast: notification,
      };
    }),

  dismissTriageToast: () => set({ triageToast: null }),

  markNotificationRead: (id) =>
    set((state) => ({
      triageNotifications: state.triageNotifications.map((item) =>
        item.id === id ? { ...item, read: true } : item
      ),
    })),

  markAllNotificationsRead: () =>
    set((state) => ({
      triageNotifications: state.triageNotifications.map((item) => ({
        ...item,
        read: true,
      })),
    })),

  clearNotifications: () =>
    set({
      triageNotifications: [],
      triageToast: null,
    }),

  toggleNotificationSound: () =>
    set((state) => ({
      notificationSoundEnabled: !state.notificationSoundEnabled,
    })),

  setCurrentPatient: (patient) => set({ currentPatient: patient }),

  setTriageResult: (result) =>
    set((state) => {
      const encounter = result?.encounter ?? null;

      return {
        triageResult: result,
        encounters: encounter
          ? mergeEncounterList(state.encounters, encounter)
          : state.encounters,
        activeEncounterId: encounter?.id ?? state.activeEncounterId,
      };
    }),

  clearTriage: () =>
    set({
      triageResult: null,
      agentTrace: [],
      agentTraceEncounterId: null,
    }),

  resetQueue: () => set({ queue: [], routeUpdates: [] }),

  setAuth: (auth) => {
    writeSession(auth);
    set({ auth });
  },

  signOut: () => {
    clearSession();
    set({
      auth: null,
      currentPatient: null,
      triageResult: null,
      queue: [],
      routeUpdates: [],
      routeToast: null,
      encounters: [],
      activeEncounterId: null,
      agentTrace: [],
      agentTraceEncounterId: null,
      prescriptions: [],
      prescriptionNotifications: [],
      prescriptionToast: null,
      triageNotifications: [],
      triageToast: null,
    });
  },

  setSocketConnected: (connected) => set({ socketConnected: Boolean(connected) }),

  setTheme: (theme) => {
    const next = theme === 'dark' ? 'dark' : 'light';

    writeTheme(next);
    applyTheme(next);
    set({ theme: next });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';

    writeTheme(next);
    applyTheme(next);
    set({ theme: next });
  },
}));

export default useTriageStore;
