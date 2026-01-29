---
status: pending
priority: p3
issue_id: "007"
tags: [code-review, typescript, quality]
dependencies: []
---

# Add Explicit Null Checks for PKCE Values

## Problem Statement

The OAuth server uses non-null assertions (`!`) for PKCE values (codeChallenge, expectedState). While these are set before use, explicit null checks would be safer and more self-documenting.

## Findings

**Location:** `src/auth/server.ts:43-44, 252-254`

```typescript
code_challenge: this.codeChallenge!,
state: this.expectedState!,
```

**Impact:** Low - Values are always set before use, but non-null assertions hide potential bugs.

## Proposed Solutions

### Option A: Add explicit guards (Recommended)

**Pros:** Self-documenting, catches logic errors
**Cons:** Slightly more code
**Effort:** Small
**Risk:** Low

```typescript
if (!this.codeChallenge || !this.expectedState) {
  throw new Error("PKCE not initialized - call start() first");
}
const authUrl = this.flowOAuth2Client.generateAuthUrl({
  code_challenge: this.codeChallenge,
  state: this.expectedState,
  // ...
});
```

### Option B: Keep as-is

**Pros:** No changes
**Cons:** Non-null assertions remain
**Effort:** None
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- src/auth/server.ts

## Acceptance Criteria

- [ ] Non-null assertions replaced with explicit checks
- [ ] Clear error messages if PKCE not initialized
- [ ] All tests pass

## Work Log

| Date       | Action                          | Learnings                                       |
| ---------- | ------------------------------- | ----------------------------------------------- |
| 2026-01-29 | Created from PR #15 code review | Identified via kieran-typescript-reviewer agent |

## Resources

- PR #15: Add OAuth security hardening, status tool, and error handling
