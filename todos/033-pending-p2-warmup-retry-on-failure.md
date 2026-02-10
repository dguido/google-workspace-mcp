---
status: complete
priority: p2
issue_id: "033"
tags: [bug, typescript, contacts, performance]
dependencies: []
---

# Warmup cache retries on every call after failure

## Problem Statement

In `warmupSearchCache()`, the `searchCacheWarmed` flag is only set to `true` on successful warmup. If the initial warmup call fails (caught silently), the flag remains `false` and every subsequent `handleSearchContacts` / `handleListContacts` call attempts the warmup again — adding latency to every contacts operation.

**Why it matters:** A persistent failure (e.g., temporary API issue, rate limiting) turns every contacts call into two API calls instead of one, degrading performance until the server restarts.

## Findings

**Found by:** All 6 review agents (unanimous finding)

**Evidence:**

- `src/handlers/contacts.ts`: `warmupSearchCache()` only sets `searchCacheWarmed = true` on success path
- Empty catch block means failure is silent
- No timeout on the warmup call (inconsistent with other API calls that use `withTimeout`)

## Proposed Solutions

### Option A: Set flag on both success and failure (Recommended)

**Description:** Set `searchCacheWarmed = true` before or after the API call regardless of outcome. The warmup is best-effort; a failed attempt shouldn't block or slow subsequent calls.

```typescript
async function warmupSearchCache(people: people_v1.People) {
  if (searchCacheWarmed) return;
  searchCacheWarmed = true; // Set immediately to prevent retries
  try {
    await withTimeout(
      people.people.searchContacts({
        query: "",
        readMask: "names",
        pageSize: 1,
      }),
      5000,
    );
  } catch {
    // Best-effort warmup — failure doesn't affect functionality
  }
}
```

**Pros:**

- Eliminates retry-on-failure overhead
- Adds missing `withTimeout` for consistency
- Simple change

**Cons:**

- If the first call fails due to a transient issue, the cache won't be warmed
- Acceptable tradeoff since warmup is a performance optimization, not required

### Option B: Retry with backoff, cap at N attempts

**Description:** Allow 2-3 warmup attempts with exponential backoff before giving up permanently.

**Pros:** Better chance of warming cache after transient failures
**Cons:** More complexity for a best-effort optimization

## Recommended Action

Apply Option A. Set the flag immediately and add `withTimeout`.

## Technical Details

**Affected files:**

- `src/handlers/contacts.ts` — `warmupSearchCache()` function

**Database changes:** None

## Acceptance Criteria

- [ ] `searchCacheWarmed` set to `true` regardless of API call outcome
- [ ] `withTimeout` wraps the warmup API call
- [ ] Silent catch preserved (warmup is best-effort)
- [ ] Tests verify no retry after failure
- [ ] Tests verify no retry after success

## Work Log

| Date       | Action    | Learnings                                                                                                        |
| ---------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| 2026-02-10 | Created   | Unanimous finding across all 6 review agents                                                                     |
| 2026-02-10 | Completed | Already fixed in prior commit — uses WeakSet, adds instance before API call, has withTimeout(10s), logs failures |

## Resources

- `src/handlers/contacts.ts` — `warmupSearchCache()` function
- `src/utils/services.ts` — `withTimeout` utility pattern
