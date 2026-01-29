---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, testing, quality]
dependencies: []
---

# Missing Tests for Status Handler Edge Cases

## Problem Statement

The status handler (`src/handlers/status.ts`) is 632 lines of code handling complex diagnostic logic but has limited test coverage. Edge cases like network failures, partial file corruption, and concurrent access are not tested.

## Findings

**Location:** `src/handlers/status.ts`

The handler covers:

- OAuth configuration validation
- Token file reading and parsing
- File permission checks
- Network connectivity (implicit via token refresh)
- Multiple diagnostic modes (basic vs full)

**Missing test coverage:**

- Malformed token files
- Missing/corrupted credentials files
- Permission denied scenarios
- Concurrent status calls during auth flow
- Edge cases in diagnostic mode

**Impact:** Medium - Complex untested code paths could have bugs.

## Proposed Solutions

### Option A: Add comprehensive test suite (Recommended)

**Pros:** Catches bugs, documents expected behavior
**Cons:** Time investment
**Effort:** Large
**Risk:** Low

Test cases to add:

- Malformed JSON in token file
- Missing required fields in credentials
- File permission errors (read-only, no access)
- Token expiry edge cases
- Error message formatting

### Option B: Add critical path tests only

**Pros:** Faster to implement
**Cons:** Less coverage
**Effort:** Medium
**Risk:** Low

### Option C: Keep as-is

**Pros:** No time investment
**Cons:** Risk of bugs in production
**Effort:** None
**Risk:** Medium

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- src/handlers/status.ts (implementation)
- src/handlers/status.test.ts (new or existing)

## Acceptance Criteria

- [ ] Test file exists with meaningful coverage
- [ ] Edge cases documented and tested
- [ ] Error scenarios verified
- [ ] All tests pass in CI

## Work Log

| Date       | Action                          | Learnings                                     |
| ---------- | ------------------------------- | --------------------------------------------- |
| 2026-01-29 | Created from PR #15 code review | Identified via code-simplicity-reviewer agent |

## Resources

- PR #15: Add OAuth security hardening, status tool, and error handling
