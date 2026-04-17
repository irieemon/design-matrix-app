# Sean Action Queue — Deferred Asks

This queue captures items Eva surfaces that block or need Sean's explicit decision. Items are triaged: blocking (stops all work), flagged (good to know but can work around), informational.

---

## Blocked on Sean

(none yet)

---

## Flagged but Not Blocking

### Cal ADR Follow-ups (2 open)

| Item | Why | Priority | Added |
|------|-----|----------|-------|
| MAX_AUTH_INIT_TIME reconcile: ADR says 15000, code says 5000 | Cal noted mismatch during ADR revision, deferring to spec/requirements clarity | Low | 2026-04-17 |
| authHeaders.ts path audit | Cal listed as `src/lib/api/authHeaders.ts`, verified real path is `src/lib/authHeaders.ts` — confirm intended or update ADR references | Low | 2026-04-17 |

---

## Informational — Wave Split Decision

Eva split Wave 2 (monolithic) into 2a (4 safe T-IDs) + 2b (8 T-IDs, deferred). This keeps per-invocation scope manageable within Haiku token budget (~6k/invocation). Wave 2a shipped; 2b queued after Colby's Wave A build completes.

**No action required** — informational note for session context.

---

## Status Polling

- **Next milestone ship:** Colby Wave A build (4-6h ETA, on-demand dispatch). Roz verifies post-build, then Wave 2b queued.
- **Audit start:** After auth hardening reaches production-verified-green.
