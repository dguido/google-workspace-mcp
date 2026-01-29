---
status: pending
priority: p3
issue_id: "009"
tags: [code-review, security, information-disclosure]
dependencies: []
---

# Reduce Token Path Information Disclosure

## Problem Statement

The OAuth success page displays the full filesystem path where tokens are stored. While useful for debugging, this discloses system structure information.

## Findings

**Location:** `src/auth/server.ts:136-137`

```typescript
<p>Your authentication tokens have been saved successfully to:</p>
<p><code>${tokenPath}</code></p>
```

Example output: `/Users/username/.config/google-workspace-mcp/token.json`

**Impact:** Very Low - Only shown to the authenticated user, but reveals username and directory structure.

## Proposed Solutions

### Option A: Show relative/abbreviated path

**Pros:** Less information disclosure
**Cons:** Less helpful for debugging
**Effort:** Small
**Risk:** Low

```typescript
const displayPath = tokenPath.replace(os.homedir(), "~");
// Shows: ~/.config/google-workspace-mcp/token.json
```

### Option B: Remove path entirely

**Pros:** No information disclosure
**Cons:** Less helpful for users
**Effort:** Small
**Risk:** Low

### Option C: Keep as-is

**Pros:** Maximum helpfulness
**Cons:** Full path disclosure
**Effort:** None
**Risk:** Very Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- src/auth/server.ts

## Acceptance Criteria

- [ ] Token path display appropriately abbreviated
- [ ] User can still locate token file if needed
- [ ] Success page renders correctly

## Work Log

| Date       | Action                          | Learnings                              |
| ---------- | ------------------------------- | -------------------------------------- |
| 2026-01-29 | Created from PR #15 code review | Identified via security-sentinel agent |

## Resources

- PR #15: Add OAuth security hardening, status tool, and error handling
