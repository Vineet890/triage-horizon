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
- **Medication adherence** — the patient can review each dose time, mark doses
  taken, and share plain-language adherence and assessment updates with the
  doctor in real time. The medicine list can be downloaded as a PDF receipt with
  dose times and prescriber names. Browser push reminders can arrive while the
  portal is closed after the patient enables them and the backend is configured
  with VAPID keys.
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

Install frontend dependencies once:

```bash
cd frontend
npm install
```

To see backend logs in their own VS Code terminal, open two terminals.

Open both terminals at the repository root (`Triage Horizon`).

**Terminal 1 — backend:**

```powershell
cd server
npm run dev
```

Wait for `Triage Horizon backend listening on port 5000`.

**Terminal 2 — frontend:**

```powershell
cd frontend
npm run dev
```

The frontend launcher reuses the backend already running on port 5000 and
starts Vite on port 5173. Open [http://localhost:5173](http://localhost:5173).
Alternatively, run only `npm run dev` in `frontend`; it starts both services
together and displays their logs in that terminal. If a port is already in use
by another application, the launcher reports which port is occupied.

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

The Vite development server listens on all network interfaces at port 5173 and
proxies `/api` and Socket.IO traffic to the backend on port 5000. Start the
backend and frontend, then forward/open port **5173** in the editor. To access
the app from another device, set that forwarded port's visibility to **Public**
or sign in with an account that can access the private forward. The backend
port does not need to be forwarded or deployed. GitHub Codespaces and VS Code
Dev Tunnels hostnames are allowed by the dev server.
Video calls use Jitsi's supported IFrame API, separately from the forwarded
backend API, so the embedded room receives the required camera, microphone,
autoplay, and display-capture permissions. If the embedded room disconnects on
a device, try **Open room in new tab**; if it disconnects there too, that device
or network cannot maintain a connection to the Jitsi service.

Copy `.env.example` to `.env` only when connecting directly to an API on a
different host or port:

```env
VITE_API_ORIGIN=https://<backend-forwarded-origin>
```

Use the actual backend origin without a trailing slash. Leave the value empty
to use the built-in Vite proxy.

To enable medication push reminders, configure `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in `server/.env`. Generate a key pair
from the `server` folder with `npx web-push generate-vapid-keys --json`, then
restart the backend. The patient must allow notifications in their browser.
Without VAPID keys, dose logging and live doctor activity still work, but
closed-tab reminders are unavailable. Keep the backend running for scheduled
delivery; MongoDB is needed to preserve schedules, dose history, and push
subscriptions across backend restarts. The local in-memory fallback resets
when the backend process stops.

## Checks

```bash
npm run lint
npm run build
```
