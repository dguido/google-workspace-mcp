---
status: pending
priority: p2
issue_id: "002"
tags: [code-review, performance, io]
dependencies: []
---

# Redundant File Reads in Config Validator

## Problem Statement

The config-validator reads the same credential files multiple times during a single validation pass. This is inefficient I/O and could cause inconsistency if files change between reads.

## Findings

**Location:** `src/errors/config-validator.ts`

The validation logic reads credential files in multiple functions:

- `validateOAuthConfig()` reads credentials
- `checkCredentialsFile()` reads the same file again
- Individual check functions may re-read

**Impact:** Medium - Unnecessary I/O operations, potential for race conditions if file changes during validation.

## Proposed Solutions

### Option A: Read once and pass data (Recommended)

**Pros:** Single I/O operation, consistent data throughout validation
**Cons:** Requires refactoring function signatures
**Effort:** Medium
**Risk:** Low

```typescript
async function validateOAuthConfig(): Promise<ConfigCheck[]> {
  const credentialsPath = getCredentialsPath();
  const credentialsData = await readCredentialsOnce(credentialsPath);
  return runAllChecks(credentialsData);
}
```

### Option B: Add caching layer

**Pros:** Minimal code changes
**Cons:** Cache invalidation complexity
**Effort:** Small
**Risk:** Medium

### Option C: Keep as-is

**Pros:** No changes
**Cons:** Performance inefficiency remains
**Effort:** None
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- src/errors/config-validator.ts

## Acceptance Criteria

- [ ] Credentials file read exactly once per validation
- [ ] All validation checks use same data snapshot
- [ ] Performance improvement measurable
- [ ] All existing tests pass

## Work Log

| Date       | Action                          | Learnings                               |
| ---------- | ------------------------------- | --------------------------------------- |
| 2026-01-29 | Created from PR #15 code review | Identified via performance-oracle agent |

## Resources

- PR #15: Add OAuth security hardening, status tool, and error handling
