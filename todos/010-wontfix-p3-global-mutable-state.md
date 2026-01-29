---
status: pending
priority: p3
issue_id: "010"
tags: [code-review, typescript, architecture]
dependencies: []
---

# Refactor Global Mutable State for lastAuthError

## Problem Statement

The `lastAuthError` variable is a module-level mutable singleton. This pattern can cause issues with testing and makes the code harder to reason about.

## Findings

**Location:** `src/auth/tokenManager.ts:14-24`

```typescript
/** Last auth error for diagnostic purposes */
let lastAuthError: GoogleAuthError | null = null;

/** Get the last auth error that occurred */
export function getLastTokenAuthError(): GoogleAuthError | null {
  return lastAuthError;
}

/** Clear the last auth error */
export function clearLastTokenAuthError(): void {
  lastAuthError = null;
}
```

**Impact:** Low - Works correctly but is an anti-pattern for testability.

## Proposed Solutions

### Option A: Move to TokenManager instance (Recommended)

**Pros:** Encapsulated state, easier to test
**Cons:** Requires changes to consumers
**Effort:** Medium
**Risk:** Low

```typescript
class TokenManager {
  private lastAuthError: GoogleAuthError | null = null;

  getLastAuthError(): GoogleAuthError | null {
    return this.lastAuthError;
  }
}
```

### Option B: Keep as-is

**Pros:** No changes, simpler API
**Cons:** Global mutable state pattern
**Effort:** None
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- src/auth/tokenManager.ts
- src/handlers/status.ts (consumer)

## Acceptance Criteria

- [ ] No module-level mutable state
- [ ] Error state accessible through instance
- [ ] Tests can verify error state independently
- [ ] All existing functionality preserved

## Work Log

| Date       | Action                          | Learnings                                       |
| ---------- | ------------------------------- | ----------------------------------------------- |
| 2026-01-29 | Created from PR #15 code review | Identified via kieran-typescript-reviewer agent |

## Resources

- PR #15: Add OAuth security hardening, status tool, and error handling
