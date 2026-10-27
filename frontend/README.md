# Triage Horizon — Frontend

A strict Manchester Triage System interface for the Triage Horizon clinical
routing backend. The UI is tri-theme, high-contrast and intentionally free of
glassmorphism, gradients and shadows.

Located at `Triage Horizon/frontend`, alongside the Express API in
`Triage Horizon/server`.

## Stack

- Vite + React 19 (JavaScript, no TypeScript)
- Tailwind CSS 3
- Framer Motion (live-arrival springs, reroute layout transitions and the outage pulse)
- Zustand
- Socket.IO Client
- React Router
- Axios
- Lucide React
- Recharts (admin analytics only)
- clsx + tailwind-merge

## Design rules

- **Patient portal** — `#F9FAFB` canvas, white cards, `#111827` text,
  `#E5E7EB` borders.
- **Doctor portal** — clinical white `#FFFFFF` with structured medical-record
  tables and high contrast text.
- **Admin portal** — `#111827` canvas, `#1F2937` cards, `#F3F4F6` text,
  `#374151` borders.
- **Typography** — Inter for all UI text; 16px base with a 14px minimum.
  JetBrains Mono is reserved for AI thinking logs and raw data IDs.
- **Components** — 6px corners, 1px solid borders, no static shadows or blur.
  The only glow is the transient 2-second facility outage pulse.
- **Acuity** — CRITICAL `#DC2626`, HIGH `#EA580C`, MODERATE `#CA8A04`,
  LOW `#16A34A`.

## Experience

- **Login** — real email/password form with a Patient, Doctor or Admin portal
  selector. Credentials are verified by `/api/auth/login`, the JWT is stored in
  `localStorage`, and the selected portal must match the account role.
- **Patient portal** — verified profile summary, large symptom textarea,
  step-by-step triage reasoning, then a routing decision with the acuity badge,
  selected facility in bold and the declined facilities with reasons. When
  `ROUTE_UPDATED` arrives, an amber banner explains the outage for two seconds
  before the selected facility, ETA and distance animate to the new route.
- **Doctor portal** — data-dense queue table sorted CRITICAL first, handoff
  record with presenting complaint, synthetic vitals, history and recommended
  actions, plus an e-prescription form wired to `/api/handoff/prescription`.
  `TRIAGE_COMPLETE` events slide into a **Live Incoming Queue** with a pulsing
  acuity border, and the selected handoff's Destination/ETA fields animate to
  the new facility on `ROUTE_UPDATED`.
- **Admin portal** — Recharts bar chart for diverted ER visits and network load,
  live facility status/capacity table, and a red facility-shock control. The
  outage target follows the highest-acuity active queue entry, the affected
  facility row pulses red for two seconds, and the status reads
  **Rerouting active cases...** until Socket.IO confirms the new routes.
- **Realtime** — `FACILITY_STATE_CHANGED`, `ROUTE_UPDATED`, `TRIAGE_COMPLETE` and
  `ADMIN_STATE_SYNC` update the Zustand store immediately. Portal-local socket
  listeners add presentation-only reactions without duplicating queue entries.

## Run

Two processes are required. Start the API first, from the repository root:

```bash
cd server
node src/server.js
```

Then start this client, from `frontend`:

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

If a port is already taken (`EADDRINUSE`), something is already listening —
check it instead of starting a second copy:

```powershell
Get-NetTCPConnection -LocalPort 5000,5173 -State Listen | Select-Object LocalPort, OwningProcess
```

## Demo accounts

| Portal | Email | Password |
| --- | --- | --- |
| Patient | `patient@demo.com` | `patient123` |
| Doctor | `doctor@demo.com` | `doctor123` |
| Admin | `admin@demo.com` | `admin123` |

Open each role in a separate browser profile or incognito window. The demo
session is stored in `localStorage`, so signing in as another role replaces the
previous session in the same profile.

The patient portal uses the seeded demo patient `patient_001`. The doctor queue
is fed by live `TRIAGE_COMPLETE` events; use **Load demo queue** to submit the
three synthetic intakes through the real triage endpoint. Handoff vitals are
clearly labelled synthetic because the backend does not expose a vitals
endpoint. The admin outage target prioritises the selected facility of the
highest-acuity active queue entry (falling back to the demo critical route), so
shocking after a single patient submission targets that patient's facility.

## Configuration

Copy `.env.example` to `.env` when the API is not on the default port:

```env
VITE_API_ORIGIN=http://localhost:5000
```

## Checks

```bash
npm run lint
npm run build
```
