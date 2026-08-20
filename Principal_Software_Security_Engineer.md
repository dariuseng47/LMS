[CONTEXT & GOAL]
You are a Principal Software Security Engineer and Full-Stack Developer. I am building an IoT RFID Laundry Management System with:

- Frontend: React Dashboard & React Native Mobile App (Expo)
- Backend: Node.js (Express.js) REST API, Pure JS ES Modules (`import`/`export`), NO TypeScript
- Database: MySQL

Generate production-ready, highly secure, and robust boilerplate code adhering strictly to OWASP Top 10 security standards and Defense-in-Depth architecture.

[SECURITY REQUIREMENTS TO IMPLEMENT]

1. NODE.JS / EXPRESS BACKEND:
   - Security Middleware: Use `helmet` for strict HTTP security headers and explicit `cors` restricted to trusted web origins.
   - Rate Limiting: Implement `express-rate-limit` globally (100 req/15m) and a strict rate limit on auth endpoints `/api/v1/auth/login` and `/refresh` (5 req/15m).
   - Authentication & Token Rotation:
     - Access Token: Short-lived (15 mins JWT) passed via Bearer header.
     - Refresh Token: Long-lived (7 days JWT) with DB whitelist tracking/rotation.
     - Web Client: Store Refresh Token in HttpOnly, Secure, SameSite=Strict cookie.
     - Mobile Client (React Native): Accept Refresh Token in Request Body / Authorization Header and return via JSON payload.
   - Password Hashing: Use `bcrypt` (salt rounds = 12) or `argon2id`.
   - Input Validation: Implement strict `zod` schema validation middleware for all request bodies, query params, and route parameters.
   - SQL Injection Prevention: Use `mysql2/promise` with parameterized queries (Prepared Statements) or Prisma ORM.
   - Error Handling: Centralized error middleware that sanitizes all error outputs in production (never expose stack traces or raw MySQL error codes).

2. MYSQL DATABASE SECURITY:
   - Provide SQL DDL scripts to create a dedicated App DB user with minimal privileges:
     `GRANT SELECT, INSERT, UPDATE, DELETE ON laundry_db.* TO 'laundry_app_user'@'%'`
   - Ensure `users` table has appropriate column length for hashed passwords (`VARCHAR(255)`) and refresh token hashes.

3. REACT DASHBOARD (WEB):
   - Secure token lifecycle: Store Access Token in React State/Memory only.
   - Axios Interceptor setup: Automatically attach Bearer token to requests, handle 401 Unauthorized errors, call `/refresh` endpoint, update token, and retry failed requests seamlessly.

4. REACT NATIVE APP (MOBILE):
   - Token Storage: Use `expo-secure-store` to store Refresh Token securely on device Keychain / EncryptedSharedPreferences.
   - Axios Interceptor setup: Handle token rotation natively using stored SecureStore tokens.

[OUTPUT REQUIRED]
Provide clean, modular, well-commented pure JavaScript (ES6+ Modules) code snippets for:

1. Express Server Entrypoint (`server.js` / `app.js`) with security middlewares, Helmet, Cors, and Rate Limiters.
2. Auth Controller (`auth.controller.js`) covering Login, Refresh Token Rotation, and Logout (clearing cookies & revoking token).
3. Zod Request Validation Middleware (`validateRequest.js`) with sample auth schema.
4. Secure Database Pool (`db.js`) with connection pooling and SSL options.
5. MySQL Grant Privileges SQL Script (`init_security.sql`).
6. Web Axios Client Interceptor (`apiClient.web.js`).
7. React Native Axios Client Interceptor (`apiClient.mobile.js`).
