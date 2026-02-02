---
status: pending
priority: p2
issue_id: "018"
tags: [code-review, concurrency, data-integrity]
dependencies: []
---

# Token Event Handler Read-Then-Write Race Condition

## Problem Statement

In `tokenManager.ts`, the token refresh event handler reads the current token file, merges with new tokens, then writes back. This creates a TOCTOU (time-of-check-time-of-use) race condition if multiple refresh events fire concurrently.

**Why it matters:** Could result in token data loss or corruption if two refreshes happen simultaneously (e.g., during rapid API calls when token is near expiry).

## Findings

**Agents:** data-integrity-guardian, kieran-typescript-reviewer

**Location:** `src/auth/tokenManager.ts:77-109`

**Evidence:**

```typescript
this.oauth2Client.on("tokens", async (newTokens) => {
  // Race window starts here
  const currentTokens = JSON.parse(await fs.readFile(this.tokenPath, "utf-8"));
  const updatedTokens = {
    ...currentTokens,
    ...newTokens,
    refresh_token: newTokens.refresh_token || currentTokens.refresh_token,
  };
  // Another event could have written between read and write
  await this.atomicWriteTokens(JSON.stringify(updatedTokens, null, 2));
});
```

**Difference from 004-complete:**

- 004 addressed `refreshTokensIfNeeded()` with the `refreshInProgress` promise lock
- This is about the `tokens` event handler which has no synchronization

## Proposed Solutions

### Option A: Mutex for Token File Operations (Recommended)

**Description:** Add a mutex/lock around all token file read-write operations:

```typescript
private tokenFileMutex = new Mutex();

private async updateTokensFile(newTokens: Credentials): Promise<void> {
  await this.tokenFileMutex.runExclusive(async () => {
    const currentTokens = await this.readTokensFile();
    const merged = this.mergeTokens(currentTokens, newTokens);
    await this.atomicWriteTokens(JSON.stringify(merged, null, 2));
  });
}
```

**Pros:**

- Guarantees exclusive access
- Well-understood pattern

**Cons:**

- Adds dependency (async-mutex) or need to implement

**Effort:** Small (2-3 hours)
**Risk:** Low

### Option B: Serialize Token Operations Queue

**Description:** Queue all token operations and process sequentially.

**Pros:**

- Can handle more complex ordering requirements

**Cons:**

- More complex implementation
- Overkill for this use case

**Effort:** Medium (4-5 hours)
**Risk:** Low-Medium

### Option C: Accept Race (Document Trade-off)

**Description:** Document that concurrent token refreshes are rare and atomic write minimizes corruption risk.

**Pros:**

- No code change
- Atomic write already prevents file corruption

**Cons:**

- Doesn't fix the logical race
- Could lose token updates

**Effort:** Small (document only)
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `src/auth/tokenManager.ts`

**Components:** Token Management

## Acceptance Criteria

- [ ] Token file operations are serialized
- [ ] No data loss possible under concurrent refresh
- [ ] Tests verify concurrent access behavior

## Work Log

| Date       | Action                   | Learnings                                               |
| ---------- | ------------------------ | ------------------------------------------------------- |
| 2025-01-29 | Created from code review | Distinct from 004 which addressed refreshTokensIfNeeded |

## Resources

- PR #15: https://github.com/dguido/google-workspace-mcp/pull/15
- async-mutex: https://www.npmjs.com/package/async-mutex
