---
status: pending
priority: p2
issue_id: "016"
tags: [code-review, architecture, maintainability]
dependencies: []
---

# Long Methods Exceed 100-Line Guideline

## Problem Statement

Two methods significantly exceed the project's 100-line function limit:

1. `createServer()` in `src/auth/server.ts`: ~190 lines
2. `handleGetStatus()` in `src/handlers/status.ts`: ~160 lines

**Why it matters:** Long methods are harder to test, understand, and maintain. They often indicate multiple responsibilities that should be separated.

## Findings

**Agents:** pattern-recognition-specialist, kieran-typescript-reviewer, code-simplicity-reviewer

**Evidence:**

`createServer()` contains:

- Server setup (~20 lines)
- Request handling (~30 lines)
- OAuth callback processing (~60 lines)
- HTML response generation (~50 lines)
- Error handling (~30 lines)

`handleGetStatus()` contains:

- Basic status checks (~30 lines)
- Service status collection (~40 lines)
- Diagnostic mode logic (~50 lines)
- Response formatting (~40 lines)

## Proposed Solutions

### Option A: Extract Focused Helper Functions (Recommended)

**Description:** Break down into smaller, single-purpose functions:

For `createServer()`:

- `generateSuccessHtml(account)`
- `generateErrorHtml(error)`
- `handleOAuthCallback(req, res, state, codeVerifier)`
- `validateOAuthResponse(query, expectedState)`

For `handleGetStatus()`:

- `collectBasicStatus(oauth2Client, tokenManager)`
- `collectServiceStatus(services)`
- `runDiagnostics(oauth2Client, tokenManager)`
- `formatStatusResponse(status, services, diagnostics?)`

**Pros:**

- Each function has single responsibility
- Easier to test individual pieces
- Improves readability

**Cons:**

- More functions to navigate
- Need to manage shared state carefully

**Effort:** Medium (4-6 hours)
**Risk:** Low

### Option B: Extract Classes

**Description:** Create `AuthServerBuilder` and `StatusCollector` classes with focused methods.

**Pros:**

- Better encapsulation
- State management is clearer

**Cons:**

- More structural change
- May be over-engineering for this use case

**Effort:** Medium-Large (6-8 hours)
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `src/auth/server.ts`
- `src/handlers/status.ts`

**Components:** Authentication Server, Status Handler

## Acceptance Criteria

- [ ] No function exceeds 100 lines
- [ ] Each extracted function has single clear purpose
- [ ] Existing tests continue to pass
- [ ] New helper functions have test coverage

## Work Log

| Date       | Action                   | Learnings                             |
| ---------- | ------------------------ | ------------------------------------- |
| 2025-01-29 | Created from code review | Multiple agents flagged length issues |

## Resources

- PR #15: https://github.com/dguido/google-workspace-mcp/pull/15
- Project CLAUDE.md: ≤100 lines/function guideline
