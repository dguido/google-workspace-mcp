---
status: pending
priority: p3
issue_id: "022"
tags: [code-review, architecture, testability]
dependencies: ["020"]
---

# Global Mutable State for Auth Error Tracking

## Problem Statement

The `lastAuthError` variable in `tokenManager.ts` is module-level global mutable state. This creates hidden coupling between components and makes testing harder.

**Why it matters:**

- Tests must remember to clear state between runs
- Error persists indefinitely until explicitly cleared
- Multiple TokenManager instances share the same global error
- Creates hidden dependencies (status handler imports from tokenManager internals)

## Findings

**Agents:** architecture-strategist, security-sentinel

**Location:** `src/auth/tokenManager.ts:11-22`

**Evidence:**

```typescript
/** Last auth error for diagnostic purposes */
let lastAuthError: GoogleAuthError | null = null;

export function getLastTokenAuthError(): GoogleAuthError | null {
  return lastAuthError;
}

export function clearLastTokenAuthError(): void {
  lastAuthError = null;
}
```

**Coupling Evidence:**

```typescript
// src/handlers/status.ts line 11
import { getLastTokenAuthError } from "../auth/tokenManager.js";

// src/auth/server.ts line 3
import { TokenManager, getLastTokenAuthError } from "./tokenManager.js";
```

**Note:** This was previously flagged as 010-wontfix-p3-global-mutable-state. However, the recent changes adding `isClientInvalidError()` have increased the coupling, making this more impactful.

## Proposed Solutions

### Option A: Move to Instance Property (Recommended)

**Description:** Make `lastAuthError` an instance property of `TokenManager`:

```typescript
export class TokenManager {
  private lastAuthError: GoogleAuthError | null = null;

  public getLastError(): GoogleAuthError | null {
    return this.lastAuthError;
  }

  public clearLastError(): void {
    this.lastAuthError = null;
  }
}
```

Then pass TokenManager instance to components that need error access.

**Pros:**

- No global state
- Each TokenManager has its own error tracking
- Easier to test in isolation
- Clearer ownership

**Cons:**

- Requires passing TokenManager to status handler
- Breaking change to current API

**Effort:** Medium (3-4 hours)
**Risk:** Low-Medium (API change)

### Option B: Keep Global but Document

**Description:** Accept the trade-off for a single-user CLI tool, document the limitation.

**Pros:**

- No code change
- Works fine for current use case

**Cons:**

- Technical debt remains
- Testability issues persist

**Effort:** Small (documentation only)
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `src/auth/tokenManager.ts` - move state to instance
- `src/auth/server.ts` - get error from TokenManager instance
- `src/handlers/status.ts` - receive TokenManager instance

**Components:** Token Management, Status Handler

## Acceptance Criteria

- [ ] No module-level mutable state in tokenManager.ts
- [ ] Error tracking is per-instance
- [ ] Tests don't need to clear global state
- [ ] Status handler works with instance-level errors

## Work Log

| Date       | Action                   | Learnings                                    |
| ---------- | ------------------------ | -------------------------------------------- |
| 2025-02-01 | Created from code review | Coupling increased with isClientInvalidError |

## Resources

- 010-wontfix-p3-global-mutable-state.md (previous analysis)
- Dependency injection patterns
