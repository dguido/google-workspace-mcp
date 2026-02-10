---
status: complete
priority: p3
issue_id: "038"
tags: [improvement, typescript, contacts, observability]
dependencies: ["033"]
---

# Silent catch in warmup should log for observability

## Problem Statement

The `warmupSearchCache()` function in `src/handlers/contacts.ts` has an empty catch block. If the warmup API call fails, the error is silently discarded with no logging, making it invisible during debugging.

**Why it matters:** When investigating contacts search issues, there's no way to tell if the warmup succeeded or failed. A debug-level log would help diagnose problems without adding noise.

## Findings

**Found by:** TypeScript quality reviewer, simplicity reviewer

**Evidence:**

- `src/handlers/contacts.ts`: empty catch block in `warmupSearchCache()`

## Proposed Solutions

### Option A: Add console.error with context

**Description:** Log the error at debug/warn level in the catch block.

```typescript
catch (error) {
  console.error("Search cache warmup failed (non-fatal):", error);
}
```

**Effort:** Trivial
**Risk:** None

## Recommended Action

Apply alongside #033 fix.

## Acceptance Criteria

- [ ] Warmup failures logged with context
- [ ] Log level appropriate (not noisy in normal operation)

## Work Log

| Date       | Action    | Learnings                                                                          |
| ---------- | --------- | ---------------------------------------------------------------------------------- |
| 2026-02-10 | Created   | Found by TypeScript quality and simplicity reviewers                               |
| 2026-02-10 | Completed | Already fixed in prior commit — logs error message with context via log() utility. |
