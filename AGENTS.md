# Triage Horizon Backend Rules

STACK: Node.js + Express (ES modules only: import/export), Socket.IO, MongoDB/Mongoose, jsonwebtoken.
FOLDER: all backend code in `server/src/`.

RULES:
1. ES module syntax only. NEVER use `require()`.
2. Never invent npm packages. Only use standard, real packages.
3. Facility status enum: AVAILABLE | BUSY | OFFLINE | LIMITED
4. Acuity enum: CRITICAL | HIGH | MODERATE | LOW
5. care_tier enum: telehealth | urgent_specialist | emergency
6. Socket.IO events: FACILITY_STATE_CHANGED, ROUTE_UPDATED, AGENT_THINKING, TRIAGE_COMPLETE, SIMULATE_SHOCK, VIDEO_CALL_INITIATED, VIDEO_CALL_ACCEPTED, VIDEO_CALL_ENDED, PRESCRIPTION_SENT, ADMIN_STATE_SYNC
7. Simulate Shock: backend must explicitly invoke rerouting after state change.
8. USE_LIVE_LLM flag in config.js controls mock vs live mode.
9. Output complete files, never truncate.