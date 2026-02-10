---
status: complete
priority: p1
issue_id: "031"
tags: [bug, typescript, error-handling]
dependencies: []
---

# Inner catch blocks in sheets.ts bypass error diagnosis hints

## Problem Statement

Several handler functions in `sheets.ts` have inner try/catch blocks that catch Google API errors and return error responses directly. These bypass the generic catch block in the tool dispatch (in `src/index.ts`) that adds diagnostic hints for config errors.

**Why it matters:** When a sheets operation fails due to an auth or config issue, the user/agent gets a bare error without the diagnostic hint pointing to `get_status`. The error-to-diagnosis flow is silently short-circuited.

## Findings

**Found by:** agent-native reviewer, pattern recognition reviewer

**Evidence:**

- `src/handlers/sheets.ts` lines 381-382, 436-437, 473-474: inner catch blocks return `errorResponse()` directly
- `src/index.ts` lines 686-706: generic catch block with regex-based config error detection only runs if error propagates up
- Same pattern may exist in other handler files

## Proposed Solutions

### Option A: Re-throw auth/config errors from inner catch blocks (Recommended)

**Description:** In the inner catch blocks, check if the error matches auth/config patterns and re-throw those, letting the generic catch add diagnosis hints. Only catch and handle domain-specific errors locally.

```typescript
catch (error) {
  if (isAuthOrConfigError(error)) throw error;
  return errorResponse(`Failed to update sheet: ${error}`);
}
```

**Pros:**

- Auth/config errors get proper diagnosis hints
- Domain-specific errors still handled locally
- Minimal change per catch block

**Cons:**

- Need to define `isAuthOrConfigError()` utility
- Must audit all handler files for similar patterns

### Option B: Move hint injection into errorResponse utility

**Description:** Have `errorResponse()` itself check error messages for config patterns and add hints.

**Pros:** Centralized, no catch block changes
**Cons:** Mixes concerns in the response utility

## Recommended Action

Apply Option A. Extract a shared `isAuthOrConfigError()` check and audit all handlers.

## Technical Details

**Affected files:**

- `src/handlers/sheets.ts` — 3 inner catch blocks
- Other handler files (audit needed)
- `src/utils/responses.ts` or new utility — `isAuthOrConfigError()`

**Database changes:** None

## Acceptance Criteria

- [ ] Auth/config errors from sheets handlers include diagnostic hints
- [ ] Other handler files audited for same pattern
- [ ] `isAuthOrConfigError()` utility extracted if appropriate
- [ ] Existing non-auth error handling unchanged
- [ ] Tests cover auth error propagation from inner catch blocks

## Work Log

| Date       | Action    | Learnings                                                                                                                           |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-10 | Created   | Found by agent-native and pattern recognition reviewers                                                                             |
| 2026-02-10 | Completed | Sheets.ts catch already re-throws correctly. Fixed gmail.ts:466 and drive.ts:1443 — re-throw 401/403 errors instead of masking them |

## Resources

- `src/handlers/sheets.ts` — inner catch blocks at lines 381, 436, 473
- `src/index.ts` — generic catch block with regex detection
