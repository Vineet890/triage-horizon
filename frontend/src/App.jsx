import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from './lib/api';
import socket from './lib/socket';
import useTriageStore from './store/useTriageStore';
import { BrandMark } from './components/Brand';
import RouteToast from './components/RouteToast';
import PrescriptionToast from './components/PrescriptionToast';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';

const PatientPortal = lazy(() => import('./portals/PatientPortal'));
const DoctorPortal = lazy(() => import('./portals/DoctorPortal'));
const AdminPortal = lazy(() => import('./portals/AdminPortal'));

const ROLE_HOME = {
  PATIENT: '/patient',
  DOCTOR: '/doctor',
  ADMIN: '/admin',
};

function PortalLoading() {
  return (
    <div className="grid min-h-screen bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <BrandMark className="h-11 w-11" />
        <div className="flex items-center gap-2 text-base text-[var(--ink-secondary)]">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Opening clinical portal…
        </div>
      </div>
    </div>
  );
}

function RequireRole({ role, children }) {
  const auth = useTriageStore((state) => state.auth);
  const location = useLocation();

  if (!auth) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (role && auth.role !== role) {
    return <Navigate to={ROLE_HOME[auth.role] ?? '/'} replace />;
  }

  return children;
}

function RoleHome() {
  const auth = useTriageStore((state) => state.auth);

  if (!auth) return <Navigate to="/login" replace />;

  return <Navigate to={ROLE_HOME[auth.role] ?? '/'} replace />;
}

// Signing out through a public route keeps the protected route from seeing an
// empty session and racing a /login redirect against the home navigation.
function SignOutRoute() {
  const signOut = useTriageStore((state) => state.signOut);

  useEffect(() => {
    signOut();
  }, [signOut]);

  return <Navigate to="/" replace />;
}

export default function App() {
  const auth = useTriageStore((state) => state.auth);
  const setFacilities = useTriageStore((state) => state.setFacilities);
  const updateFacility = useTriageStore((state) => state.updateFacility);
  const applyRouteUpdate = useTriageStore((state) => state.applyRouteUpdate);
  const addTriageEvent = useTriageStore((state) => state.addTriageEvent);
  const upsertEncounter = useTriageStore((state) => state.upsertEncounter);
  const setEncounters = useTriageStore((state) => state.setEncounters);
  const setAgentTrace = useTriageStore((state) => state.setAgentTrace);
  const addPrescription = useTriageStore((state) => state.addPrescription);
  const setSocketConnected = useTriageStore((state) => state.setSocketConnected);

  useEffect(() => {
    if (!auth?.token) {
      setSocketConnected(false);
      socket.disconnect();
      return undefined;
    }

    let active = true;

    const loadFacilities = () => {
      api
        .get('/facilities')
        .then(({ data }) => {
          if (active) setFacilities(data);
        })
        .catch(() => {
          // Keep the last known facility snapshot; the next connect retries.
        });
    };

    const loadEncounters = () => {
      const path =
        auth.role === 'PATIENT' ? '/encounters' : '/encounters?active=true';

      api
        .get(path)
        .then(({ data }) => {
          if (!active) return;
          setEncounters(data.encounters ?? data);
        })
        .catch(() => {
          // The socket stream remains the fallback source of truth.
        });
    };

    const handleConnect = () => {
      setSocketConnected(true);
      loadFacilities();
      loadEncounters();

      if (auth.role === 'DOCTOR' || auth.role === 'ADMIN') {
        socket.emit('REQUEST_STATE_SYNC', {}, () => {});
      }
    };

    const handleDisconnect = () => setSocketConnected(false);
    const handleConnectError = () => setSocketConnected(false);

    const handleFacilityState = (payload) => updateFacility(payload);
    const handleRouteUpdate = (payload) => applyRouteUpdate(payload);
    const handleTriageComplete = (payload) => addTriageEvent(payload);
    const handleEncounterUpdated = (payload) => upsertEncounter(payload);

    const handleAgentThinking = (payload) => {
      if (!Array.isArray(payload?.steps) || payload.steps.length === 0) return;
      setAgentTrace(payload.steps, payload.encounter_id ?? null);
    };

    const handlePrescriptionSent = (payload) => {
      if (auth.role !== 'PATIENT') return;
      if (payload?.patient_id && payload.patient_id !== auth.userId) return;
      addPrescription(payload);
    };

    const handleAdminSync = (payload) => {
      if (!Array.isArray(payload?.facilities)) return;

      const current = useTriageStore.getState().facilities;

      if (current.length === 0) {
        setFacilities(payload.facilities);
        return;
      }

      setFacilities(
        current.map((facility) => {
          const live = payload.facilities.find((entry) => entry.id === facility.id);
          return live ? { ...facility, ...live } : facility;
        })
      );
    };

    loadFacilities();
    loadEncounters();

    socket.auth = { token: auth.token };
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('FACILITY_STATE_CHANGED', handleFacilityState);
    socket.on('ROUTE_UPDATED', handleRouteUpdate);
    socket.on('TRIAGE_COMPLETE', handleTriageComplete);
    socket.on('ENCOUNTER_UPDATED', handleEncounterUpdated);
    socket.on('AGENT_THINKING', handleAgentThinking);
    socket.on('PRESCRIPTION_SENT', handlePrescriptionSent);
    socket.on('ADMIN_STATE_SYNC', handleAdminSync);

    setSocketConnected(socket.connected);
    socket.connect();

    return () => {
      active = false;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('FACILITY_STATE_CHANGED', handleFacilityState);
      socket.off('ROUTE_UPDATED', handleRouteUpdate);
      socket.off('TRIAGE_COMPLETE', handleTriageComplete);
      socket.off('ENCOUNTER_UPDATED', handleEncounterUpdated);
      socket.off('AGENT_THINKING', handleAgentThinking);
      socket.off('PRESCRIPTION_SENT', handlePrescriptionSent);
      socket.off('ADMIN_STATE_SYNC', handleAdminSync);
      socket.disconnect();
    };
  }, [
    addPrescription,
    addTriageEvent,
    applyRouteUpdate,
    auth?.role,
    auth?.token,
    auth?.userId,
    setAgentTrace,
    setEncounters,
    setFacilities,
    setSocketConnected,
    updateFacility,
    upsertEncounter,
  ]);

  return (
    <div className="min-h-screen">
      <Suspense fallback={<PortalLoading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/logout" element={<SignOutRoute />} />
          <Route
            path="/patient"
            element={
              <RequireRole role="PATIENT">
                <PatientPortal />
              </RequireRole>
            }
          />
          <Route
            path="/doctor"
            element={
              <RequireRole role="DOCTOR">
                <DoctorPortal />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole role="ADMIN">
                <AdminPortal />
              </RequireRole>
            }
          />
          <Route path="/portal" element={<RoleHome />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <RouteToast />
      <PrescriptionToast />
    </div>
  );
}
