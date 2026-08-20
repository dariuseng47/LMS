[CONTEXT & GOAL]
You are a Principal Software Security Engineer and Full-Stack Developer. I am building a Multi-Tenant IoT RFID Laundry Management System with:

- Frontend (Web): React + Tailwind CSS + Socket.io Client
- Frontend (Mobile): React Native (Expo) + WatermelonDB/SQLite (Offline Sync Queue) + Expo Camera + Expo Location
- Backend: Node.js (Express.js) REST API + Socket.io Server (Pure JS ES Modules `import/export`, NO TypeScript)
- Database: MySQL (`mysql2/promise` with connection pool)
- Edge Hardware: Raspberry Pi 4 (Node.js Edge Agent for Weight Scale + Multi-Antenna RFID Readers)

[DETAILED SYSTEM WORKFLOW & BUSINESS LOGIC TO IMPLEMENT]

1. LAUNDRY OPERATIONAL FLOW & EXCEPTIONS:
   - Flow: Wash -> Dry -> Weight Scale & 3-Sensor RFID Counting -> QC Folding Table (Bundle Check) -> Central Stock -> Ward Cabinet Replenishment.
   - Weight & Count Station: Read `weight_kg` from scale via Serial/API and scan 3 RFID sensors (Left/Right/Top-Bottom).
   - Bundle Check Station: Scan bundles (e.g., 5 or 6 items). Trigger alert if count != bundle target OR if RFID RSSI < configured threshold.
   - Sequence Exception Detector: Log `STEP_SKIPPED` if a fabric arrives at the weight station without proper checkout log from ward cabinet.
   - Ward Cabinet Replenishment: Select department once -> 1st scan (reads remaining cabinet fabrics) -> Replenish -> 2nd scan (Moves fabrics from cart to ward cabinet). Auto-deduce fabrics when they reappear at Weight Station.

2. DASHBOARD, MONITORING & SOCKET.IO REAL-TIME:
   - Real-time Multi-screen Sync: Emit Socket.io events on any scan or data mutation so all open web clients update instantaneously.
   - Par Level & Warning: Display department cabinet stock % with customizable warning thresholds.
   - Top 10 Inactive/Stagnant Fabrics: Highlight fabrics with no scans over N days.
   - Status Timeout Alerts: Trigger alerts if fabrics linger in a single status longer than configured max hours.

3. FABRIC & ASSET LIFECYCLE:
   - Track total wash counts per fabric and per lot. Alert when wash count reaches max limit.
   - Hold & Decommission Module: Allow soft-disable/decommission with reason codes and photo upload URLs.
   - Inter-Hospital Transfer: Re-assign fabric/lot tenant ownership to another hospital.

4. REACT NATIVE MOBILE FEATURES:
   - Offline-First Queue: Store scans locally in SQLite/WatermelonDB when offline; auto-sync or manual "Upload Later".
   - Undo/Countdown Button: 3-5 second delay timer to cancel accidental scans.
   - Capture device Latitude/Longitude & Camera photo on damage reporting.
   - Scan options: Bulk/Single registration, Cross-step transfer, Hold scan, Decommission scan, and Location lookup.

5. SECURITY & OWASP STANDARDS:
   - Auth: Short-lived Access Token (15m JWT) + Long-lived Refresh Token (7d JWT) in HttpOnly, Secure, SameSite=Strict Cookie (Web) and Expo SecureStore (Mobile).
   - Password Hashing: `bcryptjs` (salt = 12).
   - Backend Protection: `helmet`, strict `cors` origins, global & auth `express-rate-limit`, `zod` input validation, parameterized MySQL queries, and sanitized production error handling.

[OUTPUT REQUIRED]
Provide clean, modular, production-ready, well-commented pure JavaScript (ES6+ Modules) code snippets for:

1. `server.js`: Express + Socket.io Server + Security Middlewares + Rate Limiters setup.
2. `socketHandler.js`: Socket.io event emitter for real-time dashboard state updates.
3. `laundryController.js`: Handlers for Weight Station Ingestion, Ward Replenishment Two-Pass Scan, and Exception Detection.
4. `db.js`: MySQL `mysql2/promise` pool configuration.
5. `apiClient.mobile.js`: React Native Axios Interceptor with Expo SecureStore & Offline-queue fallback logic.
