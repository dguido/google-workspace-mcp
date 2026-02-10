---
status: complete
priority: p1
issue_id: "030"
tags: [bug, typescript, auth, agent-native]
dependencies: []
---

# get_status unreachable when auth fails

## Problem Statement

The `get_status` tool is the designated diagnostic tool for auth failures (referenced in `authErrorResponse` as `diagnostic_tool: "get_status"`), but `ensureAuthenticated()` is called before tool dispatch, blocking `get_status` from executing when auth is actually broken.

**Why it matters:** This creates a circular failure — the agent is told to call `get_status` to diagnose auth issues, but can't because auth checking prevents it from reaching the handler. This defeats the entire error-to-diagnosis flow.

## Findings

**Found by:** agent-native reviewer, architecture reviewer

**Evidence:**

- `src/index.ts` ~line 662: `ensureAuthenticated()` is called before the tool switch statement
- `src/utils/responses.ts` lines 126-142: `authErrorResponse` includes `diagnostic_tool: "get_status"` in structuredContent
- When auth fails, `ensureAuthenticated()` throws before `handleGetStatus()` can execute

## Proposed Solutions

### Option A: Exempt get_status from ensureAuthenticated (Recommended)

**Description:** Move `get_status` (and `list_tools`) handling before the `ensureAuthenticated()` check, since these tools should work without auth for diagnostic purposes.

```typescript
// Handle tools that don't require auth first
if (name === "get_status") return handleGetStatus(authClient);
if (name === "list_tools") return handleListTools();

await ensureAuthenticated();
// ... rest of tool dispatch
```

**Pros:**

- Directly fixes the circular dependency
- `get_status` already handles null/invalid auth gracefully (reports status)
- Minimal code change

**Cons:**

- Slightly breaks the uniform dispatch pattern

**Effort:** Small
**Risk:** Low

### Option B: Catch auth errors and return diagnostic response

**Description:** Wrap `ensureAuthenticated()` in try/catch and return a diagnostic response that includes status info inline rather than directing to `get_status`.

**Pros:** No dispatch reordering needed
**Cons:** Duplicates status logic, more complex

## Recommended Action

Apply Option A. Exempting diagnostic tools from auth is the standard pattern.

## Technical Details

**Affected files:**

- `src/index.ts` — Move `get_status` dispatch before `ensureAuthenticated()`

**Database changes:** None

## Acceptance Criteria

- [ ] `get_status` returns diagnostic info even when auth is broken
- [ ] `list_tools` remains accessible without auth
- [ ] Other tools still require auth
- [ ] Tests cover `get_status` with broken/missing auth

## Work Log

| Date       | Action    | Learnings                                                                                             |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------- |
| 2026-02-10 | Created   | Found by agent-native and architecture review agents                                                  |
| 2026-02-10 | Completed | Already fixed — get_status/list_tools dispatched before ensureAuthenticated() in src/index.ts:678-683 |

## Resources

- `src/index.ts` — tool dispatch and `ensureAuthenticated()` call
- `src/utils/responses.ts` — `authErrorResponse` with `diagnostic_tool` field
