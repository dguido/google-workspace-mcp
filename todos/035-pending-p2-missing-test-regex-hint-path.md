---
status: complete
priority: p2
issue_id: "035"
tags: [testing, typescript, error-handling]
dependencies: []
---

# Missing test coverage for regex-based config error hint

## Problem Statement

The generic catch block in `src/index.ts` uses a regex to detect config-related errors and append a diagnostic hint. There are no tests verifying this behavior — neither that the hint is appended for matching errors nor that it's absent for non-matching errors.

**Why it matters:** Without test coverage, the regex or hint logic can silently break during refactoring. Given the regex already has false-positive concerns (see #032), tests are essential for validating changes.

## Findings

**Found by:** TypeScript quality reviewer, simplicity reviewer, pattern recognition reviewer

**Evidence:**

- `src/index.ts` lines 686-706: generic catch block with regex
- `src/utils/responses.test.ts`: tests for `authErrorResponse` exist but not for the generic catch hint path
- No integration test exercises the full tool dispatch → error → hint flow

## Proposed Solutions

### Option A: Add unit tests for the regex hint logic (Recommended)

**Description:** Test the generic catch block by simulating tool handler errors that match and don't match the config regex. Verify the hint text is appended only for matching errors.

**Pros:**

- Direct coverage of the regex behavior
- Enables safe refactoring of the regex (see #032)
- Catches regressions

**Cons:**

- Requires mocking the tool dispatch flow

## Recommended Action

Apply Option A alongside the regex fix in #032.

## Technical Details

**Affected files:**

- New or existing test file for index.ts tool dispatch logic

**Database changes:** None

## Acceptance Criteria

- [ ] Test: config-related error message gets diagnostic hint appended
- [ ] Test: non-config error message does NOT get hint appended
- [ ] Test: hint text matches expected format
- [ ] Tests cover at least 3 regex match cases and 2 non-match cases

## Work Log

| Date       | Action    | Learnings                                                                                                                                                               |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-10 | Created   | Found by 3 review agents                                                                                                                                                |
| 2026-02-10 | Completed | Tests already existed in responses.test.ts:73-95 — 12 parametrized cases for isConfigurationError + DIAGNOSTIC_HINT reference check. Added 4 more false-positive cases. |

## Resources

- `src/index.ts` — generic catch block
- Related: #032 (regex false-positive fix)
