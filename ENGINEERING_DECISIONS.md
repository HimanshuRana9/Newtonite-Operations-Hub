# Engineering Decisions — Newtonite Operations Hub

This document explains the core engineering decisions made during the design and implementation of the **Newtonite Operations Hub**, along with the context, alternatives considered, chosen approach, trade-offs, and failure mode protections.

---

## 1. PostgreSQL as the Single System of Record

### Context & Problem
Operations management under high pressure requires that work items, versioning, permissions, activity history, idempotency keys, and background tasks never diverge. If state is split across disparate datastores (e.g. document store for items, in-memory cache for idempotency, separate broker for jobs), partial failure modes lead to state corruption.

### Chosen Approach
PostgreSQL 17 serves as the unified source of truth. All core business data, idempotency tokens, append-only activity audits, and transactional outbox events reside in the same relational schema managed by Prisma ORM.

### Alternatives Considered
- **NoSQL / Document Store (MongoDB):** Flexible schemas, but lack of multi-document cross-collection strict constraints and ACID rollback guarantees under complex concurrent operations.
- **External Message Broker (RabbitMQ / Redis):** High throughput, but introduces dual-write hazards where a work-item update commits to the database but message publishing fails.

### Trade-offs & Protections
- *Trade-off:* Relational constraints and schema migrations require disciplined design and versioning.
- *Mitigation:* Strict normalization, composite uniqueness constraints (e.g., `[userId, operation, key]`), foreign-key cascaded deletion policies, and targeted B-tree indexes matching query patterns (`[teamId, createdAt DESC, id DESC]`).

---

## 2. Version-Based Optimistic Concurrency Control for Edits

### Context & Problem
Multiple operators frequently inspect and edit the same work item. In high-tempo operational incidents, if Operator A and Operator B open the same item and submit updates seconds apart, a default "last-write-wins" approach silently overwrites Operator A's diagnostic findings without notification.

### Chosen Approach
Every `WorkItem` record contains an integer `version` field. When mutating an item (`PATCH /api/items/:id` or workflow transitions), the caller must supply the expected `version`. The update executes with:

```sql
UPDATE work_items
SET title = ..., description = ..., version = version + 1, "updatedAt" = NOW()
WHERE id = :itemId AND "teamId" = :teamId AND version = :expectedVersion
RETURNING *;
```

If zero rows are returned due to a version mismatch, the API returns **HTTP 409 Conflict** with detailed diagnostics. The frontend intercepts the 409 and prompts the operator to reload the latest state rather than losing data.

### Alternatives Considered
- **Pessimistic Row Locking (`SELECT FOR UPDATE` during read):** Prevents concurrent reads/edits by holding database locks until transaction commit. This causes severe lock contention, UI bottlenecks, and risk of deadlocks when operators keep tabs open.
- **Last-Write-Wins (LWW):** Simplest to implement, but causes silent data corruption in multi-operator environments.

### Trade-offs & Protections
- *Trade-off:* Users with stale views must refresh and re-apply conflicting changes.
- *Mitigation:* The API response includes the current database version, allowing the UI to present conflict banners and auto-reconciliation actions.

---

## 3. Atomic Conditional Claims and Transactional Activity History

### Context & Problem
When urgent unassigned incidents arrive, multiple operators attempt to claim the item simultaneously. A naive "read item, check if unassigned, then assign" pattern introduces a race condition (Time-of-Check to Time-of-Use) where two operators both believe they successfully claimed the incident.

### Chosen Approach
Claims are executed using an atomic conditional update inside a database transaction:

```sql
UPDATE work_items
SET "assigneeId" = :userId,
    status = 'IN_PROGRESS'::"WorkItemStatus",
    version = version + 1,
    "updatedAt" = NOW()
WHERE id = :itemId
  AND "teamId" = :authorizedTeamId
  AND "assigneeId" IS NULL
  AND status = 'OPEN'::"WorkItemStatus"
RETURNING *;
```

- Exactly **one** competing request updates the row and receives HTTP 200.
- All competing requests match 0 rows and immediately receive **HTTP 409 Conflict**.
- In the **same database transaction**, the winning request inserts an append-only `ActivityEvent` (`CLAIMED`) and queues an `OutboxEvent`. If any step fails, the entire claim transaction rolls back.

### Alternatives Considered
- **Application-Level Mutex:** Only works across a single process instance and fails under multiple API server instances.
- **Ad-hoc Polling:** Latent and leaves windows open for overlapping claims.

### Trade-offs & Protections
- *Trade-off:* Claiming logic requires raw SQL parameter bindings to ensure conditional atomicity beyond standard ORM abstractions.
- *Mitigation:* Verified by automated integration tests executing simultaneous concurrent HTTP requests (`Promise.all`) against PostgreSQL.

---

## 4. Team-Scoped Authorization & Server-Enforced Workflow State Machine

### Context & Problem
In high-pressure organizations, users belong to multiple operational units with different roles (`VIEWER`, `MEMBER`, `LEAD`, `ADMIN`). If permissions or workflow transitions are checked solely on the client or globally, cross-team access violations and invalid lifecycle jumps occur.

### Chosen Approach
1. **Server-Side Team Scoping:** On every request, the backend resolves the item's `teamId` and verifies the caller's explicit membership and minimum role in that exact team. Cross-team access is blocked with HTTP 403 Forbidden.
2. **Explicit Workflow Transition Matrix:** Items progress strictly according to a canonical backend transition map:
   - `OPEN → IN_PROGRESS` (Member, Lead, Admin)
   - `IN_PROGRESS → AWAITING_APPROVAL` (Member, Lead, Admin)
   - `IN_PROGRESS → RESOLVED` (Member, Lead, Admin)
   - `AWAITING_APPROVAL → RESOLVED` (**Requires LEAD or ADMIN**)
   - `AWAITING_APPROVAL → IN_PROGRESS` (**Requires LEAD or ADMIN** for rejection/rework)
   - `RESOLVED → CLOSED` (**Requires LEAD or ADMIN**)
   - `RESOLVED → IN_PROGRESS` (Re-open by Member, Lead, Admin)
   - `CLOSED → OPEN` (**Requires ADMIN**)

Any transition outside this map is rejected with HTTP 400; unauthorized approval attempts by Members return HTTP 403.

### Alternatives Considered
- **Role in Request Body / JWT Token:** Untrusted client data could be tampered with.
- **Global Roles:** Fails when a user is a Lead in Platform Ops but only a Viewer in Escalations.

### Trade-offs & Protections
- *Trade-off:* Each item access involves resolving team membership.
- *Mitigation:* Fast indexed lookups on `memberships (userId, teamId)`.

---

## 5. Transactional Outbox with Abandoned-Lease Recovery & Idempotent Handlers

### Context & Problem
Asynchronous notifications and downstream processing must not be lost if the server restarts or crashes. If an asynchronous event is pushed to an external broker before the database commit, the database may fail, leaving ghost events. Conversely, if pushed after commit, a crash causes dropped events.

### Chosen Approach
1. **Transactional Outbox:** The business mutation, activity event, and outbox event (`PENDING`) are written in the **same database transaction**.
2. **Concurrent Worker Claiming:** The background worker polls using `FOR UPDATE SKIP LOCKED`, preventing multiple worker processes from competing for the same event rows.
3. **Lease Expiration Recovery:** When a worker claims an event, it sets `status = 'PROCESSING'` and `leaseUntil = NOW() + 30s`. If the worker crashes mid-execution, the lease expires. The worker query automatically reclaims abandoned jobs (`status = 'PROCESSING' AND leaseUntil < NOW()`).
4. **Bounded Retries:** Exponential backoff with a hard attempt ceiling (`maxAttempts: 5`). Failed jobs record the error message and transition to `FAILED` for operator visibility.
5. **Idempotent Handlers:** Downstream handlers record notifications with a `@unique` constraint on `outboxEventId`, ensuring duplicate delivery attempts never produce duplicate side effects.

### Alternatives Considered
- **Direct Async Trigger (Fire-and-Forget):** High risk of message loss during process termination.
- **External Redis BullMQ:** Adds operational complexity and infrastructure overhead without transactional co-location in the initial phase.

### Trade-offs & Protections
- *Trade-off:* Polling introduces slight delivery latency (2-second interval).
- *Mitigation:* Provides rock-solid delivery guarantees, crash recovery, and full visibility without additional third-party dependencies.

---

## 6. Database Authentication & Production Security Boundaries

### Context & Problem
During local development, friction in credential management can slow down automated testing and local execution across heterogeneous developer environments. However, authentication shortcuts must never be confused with production security postures.

### Local Development Posture
The local dedicated development cluster (`.pgdata`) is configured via `pg_hba.conf` with `trust` authentication restricted strictly to loopback interfaces:
```
host all all 127.0.0.1/32 trust
host all all ::1/128      trust
```
This permits zero-friction local developer testing and isolated test database teardowns without storing sensitive database passwords in plaintext. Non-local / external network interfaces cannot connect under this rule.

### Production Authentication Blueprint & Non-Readiness Warning
> [!CAUTION]
> The local `trust` configuration is **NOT** a production configuration. Deploying this configuration to an Internet-accessible or shared VPC environment would create severe security vulnerabilities.

For production deployment:
1. **Password Authentication:** PostgreSQL must enforce `scram-sha-256` password hashing.
2. **TLS / SSL Enforcement:** Database connections must mandate TLS encryption (`sslmode=require` or `sslmode=verify-full`).
3. **Least Privilege User Roles:** Separate migration users (DDL permissions) from runtime application users (DML-only: SELECT, INSERT, UPDATE, DELETE).
4. **Secrets Management:** Credentials must be injected via a cloud secrets manager (e.g. AWS Secrets Manager, GCP Secret Manager, Vault) into container environment variables rather than committed `.env` files.
5. **Connection Pooling:** In production, use PgBouncer or managed provider poolers to sustain high concurrent client spikes without exhausting Postgres connection limits.
