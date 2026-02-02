---
status: pending
priority: p2
issue_id: "017"
tags: [code-review, dry, maintainability]
dependencies: ["016"]
---

# Duplicate Inline HTML Template Generation

## Problem Statement

The OAuth server generates HTML responses inline with ~140 lines of duplicated HTML structure for success and error pages. This creates maintenance burden and inconsistency risk.

**Why it matters:** Any styling or structure changes require updating multiple places. Violates DRY principle.

## Findings

**Agent:** code-simplicity-reviewer

**Location:** `src/auth/server.ts`

**Evidence:**

- Success page HTML: ~70 lines inline
- Error page HTML: ~70 lines inline
- Shared structure: DOCTYPE, head, meta tags, styles, body wrapper
- Only differences: icon, message text, styling colors

**Estimated reduction:** 100+ lines if consolidated

## Proposed Solutions

### Option A: Template Function with Parameters (Recommended)

**Description:** Create a single `generateAuthPage()` function that takes parameters:

```typescript
interface AuthPageOptions {
  type: "success" | "error";
  title: string;
  message: string;
  details?: string;
}

function generateAuthPage(options: AuthPageOptions): string {
  const icon = options.type === "success" ? checkIcon : errorIcon;
  const color = options.type === "success" ? "#4CAF50" : "#f44336";
  // ... shared template
}
```

**Pros:**

- Single source of truth for HTML structure
- Easy to add new page types
- Reduces ~100 lines

**Cons:**

- Need to handle edge cases in template logic

**Effort:** Small (2-3 hours)
**Risk:** Low

### Option B: Separate Template File

**Description:** Move HTML templates to separate `.html` files, load at runtime.

**Pros:**

- Better separation of concerns
- HTML can be edited without touching TS

**Cons:**

- Runtime file loading complexity
- Build/bundling considerations

**Effort:** Medium (3-4 hours)
**Risk:** Low-Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `src/auth/server.ts` - current inline templates
- `src/auth/templates.ts` - new file for template function

**Components:** Authentication Server

## Acceptance Criteria

- [ ] Single template function generates both success and error pages
- [ ] HTML structure is consistent across page types
- [ ] All dynamic content is properly escaped
- [ ] Styling can be updated in one place

## Work Log

| Date       | Action                   | Learnings                                       |
| ---------- | ------------------------ | ----------------------------------------------- |
| 2025-01-29 | Created from code review | code-simplicity-reviewer identified duplication |

## Resources

- PR #15: https://github.com/dguido/google-workspace-mcp/pull/15
