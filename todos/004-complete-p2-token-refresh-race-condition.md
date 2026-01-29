---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, concurrency, data-integrity]
dependencies: []
---

# Race Condition in Token Refresh

## Problem Statement

Concurrent requests can trigger multiple simultaneous token refresh attempts. This could result in:

1. Multiple refresh requests to Google's API
2. Race conditions when writing tokens
3. Potential for token invalidation if refresh tokens are one-time use

## Findings

**Location:** `src/auth/tokenManager.ts:refreshTokensIfNeeded()`

```typescript
async refreshTokensIfNeeded(): Promise<boolean> {
  // No locking mechanism - concurrent calls can all pass this check
  if (isExpired && this.oauth2Client.credentials.refresh_token) {
    const response = await this.oauth2Client.refreshAccessToken();
    // Multiple concurrent refreshes possible
  }
}
```

**Impact:** Medium - Could cause authentication failures under concurrent load.

## Proposed Solutions

### Option A: Add mutex/lock (Recommended)

**Pros:** Prevents concurrent refresh attempts
**Cons:** Adds complexity, potential for deadlocks if not careful
**Effort:** Medium
**Risk:** Low

```typescript
private refreshLock: Promise<boolean> | null = null;

async refreshTokensIfNeeded(): Promise<boolean> {
  if (this.refreshLock) {
    return this.refreshLock;
  }
  this.refreshLock = this._doRefresh();
  try {
    return await this.refreshLock;
  } finally {
    this.refreshLock = null;
  }
}
```

### Option B: Use async-mutex package

**Pros:** Well-tested solution
**Cons:** New dependency
**Effort:** Small
**Risk:** Low

### Option C: Keep as-is

**Pros:** No changes, MCP typically single-threaded
**Cons:** Risk remains for concurrent tool calls
**Effort:** None
**Risk:** Medium

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- src/auth/tokenManager.ts

## Acceptance Criteria

- [ ] Only one refresh attempt occurs at a time
- [ ] Concurrent callers wait for in-flight refresh
- [ ] No deadlocks possible
- [ ] Tests verify concurrent behavior

## Work Log

| Date       | Action                          | Learnings                                    |
| ---------- | ------------------------------- | -------------------------------------------- |
| 2026-01-29 | Created from PR #15 code review | Identified via data-integrity-guardian agent |

## Resources

- PR #15: Add OAuth security hardening, status tool, and error handling
