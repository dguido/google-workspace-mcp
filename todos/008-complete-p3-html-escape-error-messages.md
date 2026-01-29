---
status: pending
priority: p3
issue_id: "008"
tags: [code-review, security, xss]
dependencies: []
---

# Escape HTML in Error Page Messages

## Problem Statement

The OAuth error page embeds `authError.reason` directly into HTML without escaping. If an attacker could control the error message content, this could lead to XSS.

## Findings

**Location:** `src/auth/server.ts:191`

```typescript
<p class="reason">${authError.reason}</p>
```

**Impact:** Low - Error messages come from Google API responses, not user input. However, defense-in-depth suggests escaping all dynamic content.

## Proposed Solutions

### Option A: Add HTML escaping utility (Recommended)

**Pros:** Defense-in-depth, prevents future issues
**Cons:** Slightly more code
**Effort:** Small
**Risk:** Low

```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Usage:
<p class="reason">${escapeHtml(authError.reason)}</p>
```

### Option B: Keep as-is

**Pros:** No changes
**Cons:** Potential XSS vector if error sources change
**Effort:** None
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- src/auth/server.ts

## Acceptance Criteria

- [ ] All dynamic content in HTML responses is escaped
- [ ] Error pages display correctly with special characters
- [ ] No XSS possible via error messages

## Work Log

| Date       | Action                          | Learnings                              |
| ---------- | ------------------------------- | -------------------------------------- |
| 2026-01-29 | Created from PR #15 code review | Identified via security-sentinel agent |

## Resources

- PR #15: Add OAuth security hardening, status tool, and error handling
- OWASP XSS Prevention Cheat Sheet
