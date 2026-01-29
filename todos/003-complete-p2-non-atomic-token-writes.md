---
status: pending
priority: p2
issue_id: "003"
tags: [code-review, data-integrity, security]
dependencies: []
---

# Non-Atomic Token File Writes

## Problem Statement

Token files are written directly using `fs.writeFile()`. If the process crashes or is interrupted during write, the token file could be left in a corrupted/partial state, breaking authentication.

## Findings

**Location:** `src/auth/tokenManager.ts`

```typescript
await fs.writeFile(this.tokenPath, JSON.stringify(tokensWithTimestamp, null, 2), {
  mode: 0o600,
});
```

This pattern is not atomic - a crash during write leaves corrupted data.

**Impact:** Medium - Token file corruption could require re-authentication.

## Proposed Solutions

### Option A: Write-then-rename pattern (Recommended)

**Pros:** Atomic on POSIX systems, industry standard
**Cons:** Slightly more complex code
**Effort:** Small
**Risk:** Low

```typescript
const tempPath = `${this.tokenPath}.tmp`;
await fs.writeFile(tempPath, JSON.stringify(tokensWithTimestamp, null, 2), {
  mode: 0o600,
});
await fs.rename(tempPath, this.tokenPath);
```

### Option B: Use write-file-atomic package

**Pros:** Cross-platform atomic writes, handles edge cases
**Cons:** New dependency
**Effort:** Small
**Risk:** Low

### Option C: Keep as-is

**Pros:** No changes
**Cons:** Risk of corruption remains
**Effort:** None
**Risk:** Medium

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- src/auth/tokenManager.ts (saveTokens method, setupTokenRefresh callback)

## Acceptance Criteria

- [ ] Token writes use atomic pattern
- [ ] No partial/corrupted files possible
- [ ] Temp files cleaned up on success
- [ ] Error handling for failed rename
- [ ] All existing tests pass

## Work Log

| Date       | Action                          | Learnings                                    |
| ---------- | ------------------------------- | -------------------------------------------- |
| 2026-01-29 | Created from PR #15 code review | Identified via data-integrity-guardian agent |

## Resources

- PR #15: Add OAuth security hardening, status tool, and error handling
