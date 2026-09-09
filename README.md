# SchemeFit AI — prototype (Smart India Hackathon)

> **This is a hackathon prototype, not an official government service.** Scheme
> rules, eligibility outcomes, "approvals", partner organisations and operational
> metrics shown in this app are **demonstration data** and carry no legal effect.
> The Make in India lion and the Ashoka Emblem are used only for the approved
> visual design of this prototype and do not imply government endorsement.

A citizen ↔ bank/channel-partner ↔ administrator workflow for matching micro-
entrepreneurs to financing schemes, planning repayment, preparing documents and
routing applications to partners.

- **Frontend** — React 19 + Vite + TypeScript (repo root, `src/`). The approved
  design, screens, colours, typography and responsive layout are preserved; all
  mock business behaviour has been replaced with the real API.
- **Backend** — Node + Express + TypeScript + MongoDB/Mongoose (`server/`).
  Cookie sessions, Zod validation, Argon2id hashing, CSRF, exact-origin CORS,
  object-level authorization, a deterministic rule engine, private file storage,
  and OpenAPI docs.

---

## 1. Prerequisites

| Tool | Version used | Notes |
|---|---|---|
| Node.js | 20+ (tested on 24) | |
| MongoDB | 6/7 running locally | `mongodb://127.0.0.1:27017` — no auth needed for local dev |
| npm | 10+ | |

Check MongoDB is up: `mongosh --eval "db.runCommand({ ping: 1 })"`

---

## 2. Setup — exact commands

```bash
# ---------- backend ----------
cd server
cp .env.example .env
# generate a real session secret (macOS/Linux):
node -e "const c=require('crypto'),f=require('fs');let s=f.readFileSync('.env','utf8');s=s.replace(/^SESSION_SECRET=.*/m,'SESSION_SECRET='+c.randomBytes(48).toString('base64url'));f.writeFileSync('.env',s)"
npm install
npm run seed -- --fresh        # deterministic demo data + dev accounts
npm run dev                     # API on http://localhost:4000/api/v1  (docs: /api/v1/docs)

# ---------- frontend (second terminal) ----------
cd ..                           # repo root
npm install
npm run dev                     # app on http://localhost:5173  (/api is proxied to :4000)
```

Open **http://localhost:5173** and sign in with a development account (below).

---

## 3. Development accounts (created by `npm run seed`)

Seeding is **never** run at server startup and refuses to run against
`NODE_ENV=production` unless `SEED_ALLOW_PROD=true`.

| Role | Email | Password |
|---|---|---|
| ADMIN | `admin@schemefit.dev` | `DevAdmin!2026` |
| PARTNER (SCA Ghaziabad) | `officer.ghaziabad@partners.schemefit.dev` | `PartnerGzb!2026` |
| PARTNER (Bank A) | `officer.banka@partners.schemefit.dev` | `PartnerBankA!2026` |
| PARTNER (Bihar SCA) | `officer.bihar@partners.schemefit.dev` | `PartnerBihar!2026` |
| CITIZEN (Ravi — NSFDC-eligible, under review) | `ravi.kumar@citizens.schemefit.dev` | `CitizenRavi!2026` |
| CITIZEN (Shabnam — micro-credit, approved) | `shabnam.ali@citizens.schemefit.dev` | `CitizenShabnam!2026` |
| CITIZEN (Ankit — PMMY, assigned) | `ankit.verma@citizens.schemefit.dev` | `CitizenAnkit!2026` |
| CITIZEN (Meena — education, draft) | `meena.devi@citizens.schemefit.dev` | `CitizenMeena!2026` |
| CITIZEN (Priya — sparse profile → needs_information) | `new.applicant@citizens.schemefit.dev` | `CitizenNewbie!2026` |

The **admin creates all partner/admin accounts** (`POST /api/v1/admin/users`). The
role-selection screen only chooses where you land — it never grants a role.

---

## 4. Environment variables (`server/.env`)

| Var | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `4000` | API port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | **Exact** browser origin for CORS + cookies |
| `MONGO_URL` | `mongodb://127.0.0.1:27017/schemefit` | |
| `MONGO_URL_TEST` | `…/schemefit_test` | used only by `npm test` |
| `SESSION_SECRET` | — (required, ≥32 chars) | session token hashing salt/secret |
| `SESSION_TTL_HOURS` | `168` | session lifetime |
| `COOKIE_SECURE` | `false` (forced `true` in prod / when SameSite=none) | `Secure` cookie flag |
| `COOKIE_SAMESITE` | `lax` | `lax` \| `strict` \| `none`. `lax` works when the web host proxies `/api` to the API (recommended). |
| `COOKIE_DOMAIN` | empty | optional cookie domain |
| `LOGIN_RATE_MAX` / `LOGIN_RATE_WINDOW_MINUTES` | `5` / `15` | login rate limit |
| `STORAGE_DRIVER` | `local` | `local` \| `s3` |
| `STORAGE_LOCAL_DIR` | `./var/uploads` | private dir **outside** any web root |
| `UPLOAD_MAX_BYTES` | `10485760` (10 MB) | per-file limit |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_FORCE_PATH_STYLE` | — | only read when `STORAGE_DRIVER=s3` (works with AWS S3 and Cloudflare R2) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@schemefit.dev` / `DevAdmin!2026` | dev admin bootstrap (seed only) |
| `SEED_ON_BOOT` / `SEED_ALLOW_PROD` | `false` / `false` | run the idempotent seed on boot when the users collection is empty (one-shot demo deploys) |

`CLIENT_ORIGIN` accepts a comma-separated allow-list for prod + preview URLs.

The frontend needs no env for local dev (Vite proxies `/api` → `localhost:4000`).
In production the web host proxies `/api` to the API service (see `vercel.json`)
so the app always calls `/api` on its own origin and cookies stay first-party —
this is what makes it work on mobile. **Full walkthrough:
[`DEPLOYMENT.md`](DEPLOYMENT.md)** (MongoDB Atlas + Render + Vercel).

---

## 5. Tests, type checks, build

```bash
# backend
cd server
npm run typecheck      # tsc --noEmit
npm test               # vitest — 83 tests (unit + integration, needs local MongoDB)
npm run build          # tsc -> dist/

# frontend
cd ..
npm run typecheck      # tsc -b
npm test               # vitest — finance-parity + api client + screen render
npm run build          # tsc -b && vite build -> dist/
```

Backend integration tests use the local MongoDB with database `schemefit_test`
(dropped after the run). No separate mongod download is required.

---

## 6. API documentation

- Interactive: **http://localhost:4000/api/v1/docs** (Swagger UI)
- Raw spec: **http://localhost:4000/api/v1/openapi.json**
- All endpoints live under `/api/v1`. Money is **integer paise** everywhere.
- Mutating requests need the `X-CSRF-Token` header matching the `sf_csrf` cookie
  (`GET /api/v1/auth/csrf` issues it; the frontend client handles this
  automatically).

See [`server/HANDOFF.md`](server/HANDOFF.md) for the capability list, data model,
the eligibility / finance / routing contracts, test coverage and known
limitations.

---

## 7. Project layout

```
.
├── src/                     # frontend (approved design, now API-backed)
│   ├── api/                 # typed client + react-query hooks + wire types
│   ├── app/                 # shell, auth screen, toast, active-application
│   ├── screens/             # Dashboard, Profile, SchemeMatches, LoanPlanner,
│   │                        #   Documents, PartnerRouting, Applications, Admin
│   ├── components/          # shared UI + PartnerPortal + emblem/lion marks
│   └── lib/finance.ts       # live-preview mirror of the server calculation
└── server/
    ├── src/
    │   ├── domain/          # PURE rule engine: eligibility, finance, ranking,
    │   │                    #   routing, readiness, status machine (no LLM)
    │   ├── models/          # Mongoose models (User, Session, CitizenProfile,
    │   │                    #   Scheme, PartnerOrganization, Application,
    │   │                    #   Document, PartnerAssignment, Notification,
    │   │                    #   AuditEvent)
    │   ├── modules/         # auth, users, schemes, recommendations, finance,
    │   │                    #   partners, applications, documents,
    │   │                    #   notifications, admin, audit
    │   ├── storage/         # FileStorage interface + local + S3 adapters
    │   ├── middleware/      # requestId, validate, csrf, auth, rate-limit, errors
    │   ├── openapi/         # OpenAPI 3 document
    │   ├── seed.ts          # idempotent seed CLI  (`--fresh` to reset)
    │   └── seed/run.ts      # shared seed logic (CLI + optional boot seed)
    └── tests/               # vitest: unit (domain) + integration (supertest)

render.yaml     # Render Blueprint for the API
vercel.json     # Vercel config for the web app
server/Dockerfile
DEPLOYMENT.md   # MongoDB Atlas + Render + Vercel walkthrough
```

---

## 8. Deployment

See **[`DEPLOYMENT.md`](DEPLOYMENT.md)** — end-to-end for **MongoDB Atlas + Render
(API) + Vercel (web)**, including cross-site cookie config, the seed-on-boot
option for shell-less hosts, durable file storage, custom domains and
troubleshooting. `render.yaml`, `vercel.json` and `server/Dockerfile` are in the
repo.
