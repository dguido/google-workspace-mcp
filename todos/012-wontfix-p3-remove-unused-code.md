---
status: pending
priority: p3
issue_id: "012"
tags: [code-review, cleanup, quality]
dependencies: []
---

# Remove Unused Code Paths

## Problem Statement

The codebase contains approximately 270 lines of potentially unused or dead code that could be removed to improve maintainability.

## Findings

**Location:** Various files

Identified candidates:

- Unused helper functions
- Unreachable code paths
- Over-engineered error handling for impossible cases
- Commented or disabled features

**Impact:** Low - Code works correctly but is larger than necessary.

## Proposed Solutions

### Option A: Audit and remove unused code (Recommended)

**Pros:** Cleaner codebase, easier maintenance
**Cons:** Risk of removing code that's actually needed
**Effort:** Medium
**Risk:** Low (with proper testing)

Steps:

1. Use TypeScript compiler with `noUnusedLocals`
2. Use coverage reports to identify dead code
3. Review each removal carefully
4. Run full test suite after changes

### Option B: Keep as-is

**Pros:** No risk of removing needed code
**Cons:** Technical debt accumulates
**Effort:** None
**Risk:** None

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- Multiple files TBD during audit

## Acceptance Criteria

- [ ] Unused exports identified and removed
- [ ] Dead code paths eliminated
- [ ] TypeScript strict mode passes
- [ ] All tests pass
- [ ] No functionality regression

## Work Log

| Date       | Action                          | Learnings                                     |
| ---------- | ------------------------------- | --------------------------------------------- |
| 2026-01-29 | Created from PR #15 code review | Identified via code-simplicity-reviewer agent |

## Resources

- PR #15: Add OAuth security hardening, status tool, and error handling
