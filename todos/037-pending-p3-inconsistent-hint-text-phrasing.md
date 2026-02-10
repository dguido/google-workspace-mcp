---
status: complete
priority: p3
issue_id: "037"
tags: [improvement, typescript, error-handling, consistency]
dependencies: []
---

# Inconsistent hint text between auth and generic error paths

## Problem Statement

The diagnostic hint text differs between `authErrorResponse` and the generic catch block in `src/index.ts`. The auth path uses one phrasing for directing to `get_status`, while the generic config-error catch uses different wording. Inconsistent hint text makes the experience less predictable for agents.

**Why it matters:** Agents parse hint text to determine next actions. Consistent phrasing helps agents reliably identify and follow diagnostic instructions.

## Findings

**Found by:** pattern recognition reviewer, TypeScript quality reviewer, simplicity reviewer

**Evidence:**

- `src/utils/responses.ts`: auth error hint text
- `src/index.ts`: generic catch block hint text
- Different wording for the same `get_status` recommendation

## Proposed Solutions

### Option A: Standardize hint text

**Description:** Extract a shared constant or utility for the diagnostic hint text.

**Effort:** Small
**Risk:** Low

## Recommended Action

Low-priority polish. Apply when touching either file for other reasons.

## Acceptance Criteria

- [ ] Hint text is consistent between auth and generic error paths
- [ ] Both reference `get_status` with same phrasing

## Work Log

| Date       | Action    | Learnings                                                                          |
| ---------- | --------- | ---------------------------------------------------------------------------------- |
| 2026-02-10 | Created   | Found by 3 review agents                                                           |
| 2026-02-10 | Completed | Already uses shared DIAGNOSTIC_HINT constant in both auth and generic error paths. |
