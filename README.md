# Newtonite Operations Hub

> An internal work-item operations platform engineered for teams operating under high pressure. Built with robust concurrency controls, atomic claims, versioned optimistic locking, team-scoped authorization, append-only transactional audit history, and a self-healing transactional outbox worker.

---

## 1. System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   React + Vite Dashboard               │
│        (TanStack Query · TypeScript · Tailwind/CSS)     │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / JSON
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Express API Server                   │
│   (JWT Auth · Zod Validation · Team-Scoped RBAC)       │
└───────────────────────────┬────────────────────────────┘
                            │ ACID Transactions
                            ▼
┌────────────────────────────────────────────────────────┐
│                   PostgreSQL 17 Database               │
│  ┌───────────────┬─────────────────┬────────────────┐  │
│  │  Work Items   │ Activity Events │ IdempotencyKeys│  │
│  ├───────────────┼─────────────────┼────────────────┤  │
│  │ Users & Teams │ Memberships     │ Outbox Events  │  │
│  └───────────────┴─────────────────┴────────────────┘  │
└───────────────────────────▲────────────────────────────┘
                            │ FOR UPDATE SKIP LOCKED
┌───────────────────────────┴────────────────────────────┐
│               Background Outbox Worker                 │
│      (Lease Recovery · Retries · Idempotent Handlers)  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

- **Frontend:** React 18, Vite, TypeScript, TanStack Query v5, React Router v7, Lucide Icons
- **Backend:** Node.js (v24), Express 4, TypeScript, Zod validation
- **Database & ORM:** PostgreSQL 17, Prisma ORM 5.22
- **Background Processing:** PostgreSQL Transactional Outbox + Worker process (`FOR UPDATE SKIP LOCKED`)
- **Testing & Tooling:** Vitest 2, Supertest 7, Docker Compose

---

## 3. Key Non-CRUD Engineering Behaviors Implemented

1. **Atomic Conditional Claiming:**
   - Evaluated via `UPDATE work_items ... WHERE id = :id AND assignee_id IS NULL AND status = 'OPEN' RETURNING *`.
   - Competing requests are atomically synchronized in the database: exactly one winner succeeds with HTTP 200; all losers receive HTTP 409 Conflict.
2. **Version-Based Optimistic Concurrency Control:**
   - Every mutation requires the item's current `version`.
   - Conflicting edits made against stale client data are rejected with HTTP 409 Conflict, preventing silent lost updates.
3. **Idempotent Work Item Creation:**
   - Supports `Idempotency-Key` request header.
   - Computes SHA-256 fingerprint of payload and enforces database uniqueness on `(userId, operation, key)`.
   - Repeated requests with identical payloads return cached results; altered payloads return HTTP 409 Conflict.
4. **Append-Only Transactional Activity History:**
   - Every creation, claim, edit, state transition, and comment is committed in the same database transaction as the business entity. Zero divergence between items and audit history.
5. **Durable Transactional Outbox Worker with Lease Recovery:**
   - Non-blocking batch claiming via `FOR UPDATE SKIP LOCKED`.
   - Automatic lease recovery (`leaseUntil < NOW()`) for abandoned jobs from crashed worker instances.
   - Bounded exponential backoff and permanent failure logging (`FAILED` status after max attempts).
   - Idempotent handlers backed by PostgreSQL uniqueness constraints.
6. **Server-Enforced Workflow State Machine:**
   - Canonical transition matrix: `OPEN → IN_PROGRESS → AWAITING_APPROVAL → RESOLVED → CLOSED`.
   - Enforces role requirements server-side: transitions into/out of approval strictly require `LEAD` or `ADMIN`.
7. **Stable Cursor Pagination:**
   - Base64 composite cursor `(createdAt DESC, id DESC)` for zero-drift pagination across high-frequency updates.

---

## 4. Quick Start & Local Execution

### Prerequisites
- Node.js `>= 18.x` (Tested on `v24.18.1`)
- npm `>= 9.x`
- PostgreSQL 17 (or Docker)

### Step 1: Clone & Install Dependencies
```bash
git clone https://github.com/HimanshuRana9/Newtonite-Operations-Hub.git
cd Newtonite-Operations-Hub
npm install
```

### Step 2: Environment Setup
```bash
cp .env.example .env
```
Ensure `.env` matches your PostgreSQL connection strings.

> [!WARNING]
> **Database Authentication Notice:** The default local development configuration (`.pgdata`) uses PostgreSQL `trust` authentication scoped strictly to loopback interfaces (`127.0.0.1/32` and `::1/128`). This is intended solely for local developer onboarding and CI test suites. For production deployments, PostgreSQL **must** be configured with `scram-sha-256` password authentication, TLS/SSL encryption, and cloud-managed secret injection.

### Step 3: Run Database Migrations & Seed Demo Data
```bash
# Push Prisma schema to development database
npx prisma db push

# Seed demo users, teams, and sample operational incidents
npm run seed
```

### Step 4: Start the Full Stack
```bash
# Concurrently starts backend API (4000), frontend (5173), and outbox worker
npm run dev
```
Alternatively, run processes individually:
```bash
npm run dev:server  # API Server on http://localhost:4000
npm run dev:client  # Frontend Dashboard on http://localhost:5173
npm run worker      # Asynchronous Outbox Worker
```

---

## 5. Demonstration Credentials

All seeded accounts use password: `Password123!`

| Role | Name | Email | Permissions / Description |
| :--- | :--- | :--- | :--- |
| **ADMIN** | Alice Admin | `admin@newtonite.io` | Full governance, team membership management, workflow approvals |
| **LEAD** | Leo Lead | `lead@newtonite.io` | Approves or rejects items in `AWAITING_APPROVAL`, closes resolved items |
| **MEMBER** | Zoro Member | `member@newtonite.io` | Creates, claims, edits assigned items, posts comments, progresses tasks |
| **VIEWER** | Victor Viewer | `viewer@newtonite.io` | Read-only inspection of team tasks; mutations blocked with HTTP 403 |
| **EXTERNAL** | Eve External | `extern@newtonite.io` | Belongs exclusively to "Customer Escalations"; blocked from Platform Core Ops |

---

## 6. Automated Testing & Verification

The automated test suite runs against the dedicated PostgreSQL test database (`newtonite_test`), completely isolated from the development database (`newtonite_ops`):

```bash
# Execute the full automated test suite
npm test
```

### Reproducing Verified Concurrency & Outbox Guarantees
- **Atomic Claiming (`tests/claim.test.ts`):** Dispatches simultaneous `Promise.all` claim requests across multiple authenticated sessions against PostgreSQL. Confirms exactly 1 winner receives HTTP 200 while competing requests receive HTTP 409 Conflict.
- **Optimistic Concurrency (`tests/stale-update.test.ts`):** Simulates two operators editing version 1 simultaneously. Proves the first edit increments version to 2 and the second stale edit is rejected with HTTP 409 Conflict.
- **Idempotency (`tests/idempotency.test.ts`):** Proves repeated creations with identical `Idempotency-Key` headers return cached responses; payload alterations trigger HTTP 409 Conflict; concurrent duplicates are deduplicated via database unique constraints.
- **Outbox Lease Recovery (`tests/outbox.test.ts`):** Simulates crashed workers by writing an abandoned in-flight event with an expired lease timestamp (`leaseUntil < NOW()`). Verifies that the worker query (`FOR UPDATE SKIP LOCKED`) successfully reclaims, increments attempts, and processes the job.
- **Workflow State Machine (`tests/workflow.test.ts`):** Verifies that arbitrary lifecycle jumps fail with HTTP 400, approval transitions require `LEAD` or `ADMIN`, Lead rejection/rework transitions return item to `IN_PROGRESS` with audit reason, item closure requires `LEAD`, and reopening closed items strictly requires `ADMIN`.
- **Role & Cross-Team Authorization (`tests/authorization.test.ts`):** Verifies that `VIEWER` roles cannot create, claim, edit, or comment on work items (blocked with HTTP 403), and users cannot access or mutate resources in teams they do not belong to.
- **Data Isolation:** All tests run exclusively against `TEST_DATABASE_URL` and reset their own test fixtures between test runs without touching development or user data.

### Test Suite Execution Summary
```
Test Files  9 passed (9)
     Tests  31 passed (31)
  Duration  ~10-12s
```


---

## 7. Known Limitations & Production Readiness Roadmap

Newtonite Operations Hub demonstrates resilient core engineering patterns for transactional concurrency, but is not yet rated as production-ready without addressing the following infrastructure considerations:

1. **Production Database Security:** Replace local loopback trust authentication with `scram-sha-256`, SSL enforcement (`sslmode=require`), connection pooling (PgBouncer), and separate read-replicas.
2. **Notification Transports:** The current implementation records notifications to an internal PostgreSQL `notifications` table. A production deployment requires outbound webhook dispatchers or message broker integration (e.g., SQS/SNS, SendGrid, PagerDuty).
3. **Live UI Updates:** The dashboard uses TanStack Query interval polling and mutation cache invalidation. Full duplex WebSockets or SSE (Server-Sent Events) can be added for sub-second updates across multiple active browser sessions.
4. **Rate Limiting:** Production edge requires distributed rate-limiting via reverse proxy (e.g. Cloudflare / NGINX / Redis) to prevent brute force attacks beyond application-level validations.

---

## 8. License

Newtonite Operations Hub is distributed under the ISC License.
