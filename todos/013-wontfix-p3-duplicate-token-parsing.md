---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, patterns, quality]
dependencies: []
---

# Consolidate Duplicate Token Parsing Logic

## Problem Statement

Token file parsing and validation logic is duplicated across multiple locations. This creates maintenance burden and risk of inconsistent behavior.

## Findings

**Location:** Multiple files

- `src/auth/tokenManager.ts` - Token loading and parsing
- `src/handlers/status.ts` - Token file reading for diagnostics
- `src/errors/config-validator.ts` - Token validation checks

Each location has similar but slightly different parsing logic.

**Impact:** Low - Works correctly but violates DRY.

## Proposed Solutions

### Option A: Extract shared token utilities (Recommended)

**Pros:** Single source of truth, consistent behavior
**Cons:** Requires refactoring
**Effort:** Medium
**Risk:** Low

Create `src/auth/token-utils.ts`:

```typescript
export interface TokenData {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  created_at?: string;
}

export async function readTokenFile(path: string): Promise<TokenData | null> {
  // Consolidated parsing logic
}

export function validateTokenData(data: unknown): data is TokenData {
  // Consolidated validation
}
```

### Option B: Keep as-is

**Pros:** No refactoring needed
**Cons:** Duplication continues
**Effort:** None
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- src/auth/tokenManager.ts
- src/handlers/status.ts
- src/errors/config-validator.ts
- New file: src/auth/token-utils.ts (if Option A)

## Acceptance Criteria

- [ ] Single token parsing implementation
- [ ] All consumers use shared utilities
- [ ] Consistent error handling across all callers
- [ ] All tests pass

## Work Log

| Date       | Action                          | Learnings                                     |
| ---------- | ------------------------------- | --------------------------------------------- |
| 2026-01-29 | Created from PR #15 code review | Identified via code-simplicity-reviewer agent |

## Resources

- PR #15: Add OAuth security hardening, status tool, and error handling
