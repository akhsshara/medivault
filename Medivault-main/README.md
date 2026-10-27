# MediVault

MediVault is a patient-centered medical record locker prototype for India. The repository contains a React/Vite/Tailwind web app and an Express/Mongoose API. It includes a synthetic-data demo and a connected account path for local MVP development.

## What is implemented

- Patient registration, sign-in, sign-out, password recovery, and secure account cookies.
- Patient timeline with record search, categories, private upload, preview, download, sharing, revocation, and correction requests.
- Verified organization and staff membership controls for the provider portal.
- Provider-issued records linked to a patient and encounter, with consent-scoped access to previously issued records.
- Admin screens and API routes for organization review, staff accounts, account suspension, correction requests, and audit history.
- File type, size, and file-signature validation. Files are stored outside the public web root, encrypted with AES-256-GCM, and served only after a fresh authorization check.
- Append-style audit events for account, record, consent, provider, and administrator actions.

The default app view is an interactive demo with synthetic records. Use **Sign in** to register or connect to the API. The demo role selector is available only while signed out.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and a reachable MongoDB instance.

1. Create `backend/.env` locally. Environment files are intentionally excluded from this repository.
2. Set `MONGO_URI` to a local or development MongoDB database. Add `JWT_SECRET` and `STORAGE_ENCRYPTION_KEY` as independent random secrets; never commit them.
   Set `APP_ORIGIN` to the frontend URL used for recovery links. If you open the app from another address, add each exact frontend origin to the comma-separated `APP_ALLOWED_ORIGINS` setting (for example, a LAN IP on port 5173).

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Use the first output for `JWT_SECRET` and the second for `STORAGE_ENCRYPTION_KEY`. The encryption key must be 64 hexadecimal characters.
3. Install dependencies from the repository root with `npm install`.
4. Start the client and API with `npm run dev`.
5. Open `http://localhost:5173`. Register a patient account to use connected storage and consent flows. The API runs on port 4000 and Vite proxies `/api` to it.

To preview the synthetic interface without MongoDB, run `npm run dev:frontend` and open the same address. Account sign-in and connected features need the API environment above.

Password recovery sends an email only when all SMTP settings in `backend/.env` are configured. Until then, the endpoint returns a neutral response and does not expose account existence.

## Create an administrator

Create the first administrator from a protected terminal after setting the database environment and the three admin values. Use a unique password of at least 16 characters. The script does not print or return the password.

```powershell
$env:ADMIN_NAME = "MediVault Admin"
$env:ADMIN_EMAIL = "admin@example.test"
$env:ADMIN_PASSWORD = "choose-a-unique-long-password"
npm --workspace backend run seed:admin
Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
```

The admin console can create organizations, mark them verified, add staff accounts, suspend staff accounts, and review correction requests. Staff need a membership in a verified organization before provider endpoints will work.

## Main API routes

| Area | Routes |
| --- | --- |
| Authentication | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` |
| Patient records | `GET/POST /api/records`, `GET /api/records/:id`, `GET /api/records/:id/file`, `POST /api/records/:id/correction-requests` |
| Provider | `POST /api/hospital/records`, `GET /api/hospital/patients/lookup`, `GET /api/hospital/patients/:patientId/records` |
| Consent | `GET /api/organizations`, `GET/POST /api/consents`, `DELETE /api/consents/:grantId` |
| Audit | `GET /api/audit`, `GET /api/admin/audit` |
| Administration | `/api/admin/organizations`, `/api/admin/staff`, `/api/admin/corrections`, `/api/admin/summary` |

Sessions are signed, 12-hour JWTs in `HttpOnly`, `SameSite=Strict` cookies. Logout, password recovery, and staff suspension invalidate existing sessions. Unsafe requests require the configured origin. Every record query and file access is scoped by patient ownership or an active organization consent grant. Storage keys and encryption secrets are never returned to the browser. Records staff can issue documents but cannot read patient files; clinicians and organization administrators need an active matching consent to read them or issue within its category scope.

## Deployment boundary

This code is an MVP starting point. Do not use real patient records or present the local-development setup as a production health-record service. Before a real-patient pilot, arrange privacy, legal, clinical workflow, threat-model, accessibility, and security reviews; deploy only behind HTTPS; serve the UI and `/api` on the same origin or reverse-proxy API requests; use managed MongoDB with encryption at rest and tested backups; and replace local disk storage with a private object-storage adapter using managed key encryption, retention controls, malware scanning, and short-lived authorized downloads. Configure monitored audit retention and operational incident response. No ABDM integration is implemented or claimed.

The file encryption key is read from the server environment. Losing it makes stored files unreadable; rotating it requires a controlled re-encryption process. The project has no deployment-specific secret manager or key-rotation workflow yet. OAuth, MFA, verified patient identity matching, file malware scanning, and production email delivery configuration also need deployment-level decisions.
