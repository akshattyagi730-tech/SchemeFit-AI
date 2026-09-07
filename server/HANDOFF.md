# SchemeFit AI backend — handoff

## Implemented capabilities (verified)

### Authentication & sessions
- Citizen self-registration → always creates a `CITIZEN` + a `CitizenProfile`.
  Role/`partnerOrganizationId` in the request body are ignored.
- Login / logout / logout-all / current-session (`GET /auth/me`).
- **Persistent server-side sessions** (`Session` collection): opaque 32-byte
  token in an `httpOnly` cookie, only its SHA-256 hash stored, explicit
  `expiresAt` + `revokedAt`, Mongo TTL cleanup.
- Login **rate limiting** per IP+email (`express-rate-limit`, generic
  `Invalid email or password` for every failure, decoy Argon2 verify to level
  timing).
- **CSRF**: double-submit cookie (`sf_csrf` non-httpOnly) + `X-CSRF-Token`
  header on every mutating request, constant-time compare, one automatic
  client-side retry on staleness.
- **Exact-origin CORS** (`CLIENT_ORIGIN`, `credentials: true`), `helmet`,
  JSON body cap, `Secure` cookies forced on in production.
- **Object-level authorization on every protected route** — identity + role are
  read from the session, never the request.

### Roles
- `CITIZEN` — own profile, own applications, own documents only.
- `PARTNER` — applications assigned to their `partnerOrganizationId` only;
  review limited to currently-assigned applications.
- `ADMIN` — schemes, partners, partner-user provisioning, assignment /
  reassignment, all applications, audit, KPIs.
- Partner/admin accounts are provisioned only via `POST /admin/users` or the dev
  seed.

### Data models (timestamps, validation, indexes)
`User`, `Session`, `CitizenProfile`, `Scheme`, `PartnerOrganization`,
`Application`, `Document`, `PartnerAssignment`, `Notification`, `AuditEvent`,
plus `Counter` for application references. All monetary fields are **integer
paise**; timestamps are UTC. A submitted `Application` stores immutable
`profileSnapshot` / `financingSnapshot` / `eligibilitySnapshot` /
`financePlanSnapshot`, so editing a profile or scheme never rewrites history.

### Deterministic eligibility & explainable ranking (`src/domain/`)
- `evaluateEligibility()` — mandatory conditions (category, age, income, purpose,
  location, business plan, financing limits) → `eligible` / `ineligible` /
  `needs_information`, with the exact passed / failed / unknown conditions and
  non-blocking advisories (e.g. an unplanned funding gap). **No LLM is
  involved.** Missing info never becomes a confident eligibility claim.
- `scoreScheme()` — ranks **eligible** schemes only, 0–100 from six weighted
  factors, each returned with raw score, weight and explanation, plus an explicit
  "this is a ranking, not an approval probability" disclaimer.
- Project cost, requested loan and own contribution are treated as separate
  inputs. The scheme's project-cost-percentage cap is applied to **project
  cost**, not the requested loan (asserted by tests). NSFDC-TL and PMMY are
  modelled as distinct schemes with different eligibility, limits and rates.
- Scheme rule sets carry `source.{url, verificationDate, effectiveFrom/To,
  version, demoData}`. **All seeded schemes are `demoData: true`** and are
  surfaced to the UI as `dataClassification: "demonstration-data"`.

### Financial planner (`src/domain/finance.ts`)
- Authoritative `POST /finance/calculate`. Inputs: scheme, project cost, own
  contribution, requested loan, rate (bps), tenure, moratorium.
- Outputs: scheme financing cap, funding gap, illustrative EMI, total interest &
  repayment, moratorium interest, full amortization schedule, assumptions,
  validation messages.
- Handles **zero-interest** loans, positive-value validation, **final-instalment
  rounding** (schedule always closes at exactly 0 paise), and per-scheme
  moratorium policy: `serviced` vs `capitalised`, tenure-includes-moratorium vs
  not. Nothing is hardcoded to a screenshot.
- The frontend live preview (`src/lib/finance.ts`) uses the identical algorithm;
  parity is pinned by shared golden vectors
  (`tests/unit/finance.vectors.json`, asserted by both test suites).

### Channel-partner routing (`src/domain/routing.ts`)
- **Mandatory filters first**: active + authorised + supports the scheme +
  serves the applicant's area + accepting applications. A filtered-out partner is
  removed entirely — proximity cannot rescue it.
- Then ranks survivors on distance / workload / capacity-headroom / scheme-focus
  (configurable weights). Returns score, per-factor breakdown, reason, metric
  timestamp, and `metricsSimulated: true` for demo data.
- Distance is **Haversine straight-line**, labelled as such (never "road
  distance" / "travel time").
- No qualifying partner → explicit no-match state; admin can assign/reassign
  manually.
- Assignment is capacity-guarded with an atomic `$inc` under a
  `activeAssignments < capacity` predicate, plus a partial unique index
  (`{applicationId, active}`) preventing a second active assignment. Verified
  under concurrency (6 applications / 3 slots → never over-allocates).

### Applications & partner workflow
- Status machine: `DRAFT → SUBMITTED → ASSIGNED → UNDER_REVIEW →
  {CHANGES_REQUESTED → UNDER_REVIEW | APPROVED | REJECTED}`.
- Each transition is a **named endpoint** with its own role check + prerequisites
  (no generic "set status"). `request_changes`, `reject`, `reassign` require a
  reason. Timeline records actor, timestamp, previous state, new state, reason.
- Duplicate submission is impossible: one open application per (citizen, scheme)
  via a partial unique index (`openKey`), plus an app-level pre-check.
- `APPROVED` / `REJECTED` are labelled prototype outcomes ("not a government
  sanction, guarantee or disbursement") in every API payload (`workflowNote`).

### Documents, review & readiness
- Real multipart upload → **private storage** (local dir outside any web root, or
  S3 adapter). Allow-listed PDF/JPEG/PNG, configurable size cap, **magic-byte
  signature validation** that must also agree with the declared MIME type.
- Server-generated opaque storage keys; **no public document directory or
  permanent public URL**. Downloads stream through an authenticated + authorised
  endpoint with `Cache-Control: private, no-store`.
- Lifecycle `MISSING → UPLOADED → UNDER_REVIEW → VERIFIED | CHANGES_REQUESTED`.
  **Upload never sets `verified`.** Replacement bumps `version`, marks the prior
  version `supersededAt`, and the new version starts at `uploaded` (its
  predecessor's review no longer counts for readiness). Review history kept.
- Only `PARTNER`/`ADMIN` can review; `changes_requested` requires feedback.
- Readiness is computed **on the server** from the selected scheme's required
  documents; submitted and verified counts are separate; optional documents don't
  affect required-doc completeness. The same computation feeds the dashboard,
  the citizen document screen, the partner review view and the application
  timeline.
- Failed uploads roll back (stored object deleted if the DB write fails);
  missing storage objects return `404`, not a crash.

### Citizen ↔ partner synchronization
Backend-only state (no shared frontend state). The end-to-end path — citizen
uploads → partner sees the new version → partner requests changes with feedback →
citizen sees the feedback + a persisted notification → citizen uploads a
replacement → partner sees it awaiting review → readiness / timeline / dashboard
counts update — is covered by `tests/integration/sync.test.ts`, including a
simulated **server restart** mid-flow (sessions/documents survive because they
live in Mongo).

### Notifications & audit
- `Notification` collection with read/unread, bounded polling from the client
  (query invalidation + `refetchInterval`). WebSockets intentionally not used.
- `AuditEvent` append-only trail for auth, profile edits, scheme/partner changes,
  every application transition and every document review — safe change metadata
  only (field names + before/after for whitelisted keys), never document bytes or
  credentials.

### Admin
- Scheme CRUD + archive/activate; partner-org CRUD; partner/admin user
  provisioning; assign/reassign; application filters; per-application review
  history (timeline + audit); audit log with filters.
- KPIs are **derived live from the database** in `analytics.controller.ts` — no
  hardcoded headline numbers. Denominators are stated inline in the payload.
  Drafts are excluded from submitted totals. "Requested funding" is the **sum of
  requested loan amounts**, not scheme ceilings. Seeded analytics are labelled
  `dataClassification: "derived-from-database"` with a demo-data note.

### Deployment (MongoDB Atlas + Render + Vercel)
- Full step-by-step in the repo-root **`DEPLOYMENT.md`**. `render.yaml` (API
  blueprint), `vercel.json` (web app) and `server/Dockerfile` are included.
- Cross-site cookies: `COOKIE_SAMESITE=none` makes the session + CSRF cookies
  `SameSite=None; Secure` so the SPA (Vercel) and API (Render) can be on
  different sites. `CLIENT_ORIGIN` accepts a comma-separated allow-list (prod +
  preview URLs); a disallowed origin gets no CORS headers (no 500, verified by
  `tests/integration/cors.test.ts`).
- Frontend API base URL is build-time configurable via `VITE_API_BASE_URL`
  (origin only; the client appends `/api/v1`). Unset ⇒ same-origin `/api/v1`.
- `SEED_ON_BOOT=true` runs the idempotent seed once, only when the users
  collection is empty — for a one-shot demo deploy with no shell access. The
  seed logic is now importable (`src/seed/run.ts` → `seedDatabase()`); the CLI
  (`src/seed.ts`) and the boot path share it. Compiled seed: `npm run seed:prod`.

### API conventions
- `/api/v1` prefix, request IDs (`X-Request-Id` echoed), consistent error
  envelope `{ error: { code, message, requestId, fieldErrors? } }`, correct
  `401/403/404/409/422/429`, validated pagination + allow-listed sorting, no
  stack traces or document data in production responses/logs.
- OpenAPI 3 at `/api/v1/openapi.json`, Swagger UI at `/api/v1/docs`.

---

## Setup commands

```bash
cd server
cp .env.example .env       # then set a real SESSION_SECRET (see repo README)
npm install
npm run seed -- --fresh
npm run dev                # http://localhost:4000/api/v1
```

Frontend: `cd .. && npm install && npm run dev` → http://localhost:5173

---

## Environment variables

See the table in the repo `README.md` §4. Required: `SESSION_SECRET` (≥32
chars). Everything else has a working local default.

---

## Development account setup

`npm run seed` (optionally `-- --fresh` to reset transactional collections)
creates the accounts listed in the repo `README.md` §3: one dev admin (from
`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`), three partner officers bound to seeded
partner orgs, and five citizens with profiles + applications across
DRAFT / ASSIGNED / UNDER_REVIEW / APPROVED and a needs-information profile.
Seed is a standalone script — it is not invoked on server startup and refuses to
run when `NODE_ENV=production` (override: `SEED_ALLOW_PROD=true`).

---

## Test results

```
server:  vitest run  →  14 files, 83 passed  (+ CORS exact-origin allow-list)
         - unit: finance (vectors + invariants), eligibility, ranking-adjacent,
           routing, readiness, status machine
         - integration (supertest + local Mongo): auth (csrf, generic errors,
           rate limit, no role elevation), object-level authz (citizen A vs B,
           partner A vs B), applications (snapshots, duplicate submission,
           invalid transitions, full review loop), documents (signature
           validation, upload≠verified, replacement resets review, feedback
           reaches citizen, authenticated downloads), routing & assignment
           (mandatory filters, no-match, reassignment, concurrency), admin KPIs
           (DB-derived, drafts excluded), citizen↔partner sync across a restart
server:  tsc --noEmit  →  clean
server:  tsc build     →  clean (dist/)

web:     vitest run  →  3 files, 12 passed
         - finance mirror matches the shared golden vectors
         - api client (csrf attach, error normalisation, stale-token retry, 204)
         - SchemeMatches screen (loading → eligible ranked vs ineligible-with-
           reasons, "no AI decides eligibility" note)
web:     tsc -b        →  clean
web:     vite build    →  clean (dist/, ~843 kB JS / 247 kB gzip)
```

Reproduce: `cd server && npm run typecheck && npm test && npm run build` then
`cd .. && npm run typecheck && npm test && npm run build`.

---

## Known limitations (not implemented / not verified)

- **Not an official government service.** All scheme rules, limits, rates,
  approvals, partner organisations and operational metrics are illustrative demo
  data. `source.demoData` is `true` for every seeded scheme.
- **Email / SMS delivery is not implemented.** Notifications are in-app only
  (persisted, polled). No OTP, no password reset email.
- **No malware / virus scanning** of uploads beyond magic-byte type checking and
  the size cap.
- **No live government data integration** (no DBT, Aadhaar, PAN, Udyam, credit-
  bureau or bank-core connectivity). Documents are synthetic.
- **Storage durability**: the local driver writes to `server/var/uploads` on the
  app host — fine for the prototype, not durable/replicated. The S3 adapter is
  implemented and type-checked but has not been run against a live bucket in this
  environment.
- **Real-time**: updates use bounded polling + query invalidation, not
  WebSockets (optional per the brief).
- **Rate-limit store** is in-memory (single process). A multi-instance
  deployment needs a shared store (e.g. Redis).
- **OpenAPI** is hand-authored and covers every route with request/response
  shapes at a summary level; it is not generated from the Zod schemas.
- The frontend bundle is a single ~843 kB chunk (leaflet + recharts +
  react-query). Code-splitting was left out to keep the prototype simple.
- **Storage on Render free tier is ephemeral** — uploaded documents are lost when
  the instance recycles. `DEPLOYMENT.md` §3c covers durable options (Render
  persistent disk on a paid plan, or Cloudflare R2 / S3 via the S3 adapter).
- **Render free web services sleep after ~15 min idle** (~30–60 s cold start).
- Partner "distance n/a" appears when a seeded applicant profile has no
  lat/lng; routing still ranks on workload/capacity/scheme-focus in that case.
