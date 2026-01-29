---
status: pending
priority: p3
issue_id: "006"
tags: [code-review, security]
dependencies: []
---

# Use Timing-Safe State Parameter Comparison

## Problem Statement

The OAuth state parameter comparison uses `===` which is vulnerable to timing attacks. While exploitation is unlikely in this context, security best practice is to use constant-time comparison for security-critical values.

## Findings

**Location:** `src/auth/server.ts:52-53`

```typescript
if (!this.expectedState || receivedState !== this.expectedState) {
  // Timing attack possible - string comparison exits early on mismatch
}
```

**Impact:** Low - Timing attacks on local OAuth callback are impractical, but this is a security anti-pattern.

## Proposed Solutions

### Option A: Use crypto.timingSafeEqual (Recommended)

**Pros:** Follows security best practices, no dependencies
**Cons:** Slightly more verbose
**Effort:** Small
**Risk:** Low

```typescript
import crypto from "crypto";

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
```

### Option B: Keep as-is

**Pros:** No changes needed
**Cons:** Security anti-pattern in codebase
**Effort:** None
**Risk:** Very Low (practical exploitation unlikely)

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- src/auth/server.ts

## Acceptance Criteria

- [ ] State comparison uses timing-safe method
- [ ] OAuth flow still works correctly
- [ ] Tests pass

## Work Log

| Date       | Action                          | Learnings                              |
| ---------- | ------------------------------- | -------------------------------------- |
| 2026-01-29 | Created from PR #15 code review | Identified via security-sentinel agent |

## Resources

- PR #15: Add OAuth security hardening, status tool, and error handling
- https://codahale.com/a-lesson-in-timing-attacks/
