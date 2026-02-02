---
status: pending
priority: p2
issue_id: "020"
tags: [code-review, architecture, authentication]
dependencies: []
---

# Error Classification Logic in Wrong Location

## Problem Statement

The `isClientInvalidError()` method in `AuthServer` reaches into `TokenManager`'s global state to classify errors. This creates tight coupling between components and places error classification logic in the wrong location.

**Why it matters:** Error classification belongs in the error module, not the auth server. This makes testing harder and creates hidden dependencies.

## Findings

**Agents:** architecture-strategist, pattern-recognition-specialist

**Location:** `src/auth/server.ts:43-49`

**Evidence:**

```typescript
private isClientInvalidError(): boolean {
  const lastError = getLastTokenAuthError();  // Reaches into TokenManager's state
  return (
    lastError !== null &&
    (lastError.code === "DELETED_CLIENT" || lastError.code === "INVALID_CLIENT")
  );
}
```

This pattern has several issues:

1. AuthServer depends on TokenManager's internal state
2. Error classification logic is spread across modules
3. Similar logic exists in tokenManager.ts for deciding when to clear tokens

## Proposed Solutions

### Option A: Add Method to GoogleAuthError Class (Recommended)

**Description:** Move error classification to the error class itself:

```typescript
// In src/errors/google-auth-error.ts
export class GoogleAuthError extends Error {
  // ... existing code ...

  /** Check if this error indicates the OAuth client itself is invalid/deleted */
  isClientInvalid(): boolean {
    return this.code === "DELETED_CLIENT" || this.code === "INVALID_CLIENT";
  }

  /** Check if this error requires clearing tokens and re-authenticating */
  requiresReauth(): boolean {
    return ["INVALID_GRANT", "TOKEN_REVOKED", "DELETED_CLIENT"].includes(this.code);
  }
}
```

Then in AuthServer:

```typescript
private isClientInvalidError(): boolean {
  const lastError = getLastTokenAuthError();
  return lastError?.isClientInvalid() ?? false;
}
```

**Pros:**

- Single source of truth for error classification
- Encapsulation - error knows how to classify itself
- Reusable across codebase
- Easier to test

**Cons:**

- Minor change to GoogleAuthError class

**Effort:** Small (1-2 hours)
**Risk:** Very Low

### Option B: Create Centralized Error Classification Constants

**Description:** Define sets of error codes in the errors module:

```typescript
// In src/errors/google-auth-error.ts
export const CLIENT_INVALID_CODES = new Set(["DELETED_CLIENT", "INVALID_CLIENT"]);
export const REQUIRES_REAUTH_CODES = new Set(["INVALID_GRANT", "TOKEN_REVOKED", "DELETED_CLIENT"]);
```

**Pros:**

- Simple, explicit constants
- Easy to extend

**Cons:**

- Less encapsulated than methods on the class

**Effort:** Small (30 minutes)
**Risk:** Very Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `src/errors/google-auth-error.ts` - add classification methods
- `src/auth/server.ts` - use new methods
- `src/auth/tokenManager.ts` - use new methods for token clearing logic

**Components:** Error Handling, Authentication

## Acceptance Criteria

- [ ] Error classification methods added to GoogleAuthError
- [ ] AuthServer uses new methods instead of inline checks
- [ ] TokenManager uses new methods for token clearing decision
- [ ] Consistent error classification across codebase

## Work Log

| Date       | Action                   | Learnings                                |
| ---------- | ------------------------ | ---------------------------------------- |
| 2025-02-01 | Created from code review | Multiple agents flagged placement issues |

## Resources

- Encapsulation principles
- Single responsibility principle
