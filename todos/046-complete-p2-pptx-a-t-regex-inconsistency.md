---
status: done
priority: p2
issue_id: "046"
tags: [code-review, quality, office-extraction]
dependencies: []
---

# PPTX <a:t> Regex Does Not Handle Attributes (Inconsistent with DOCX)

## Problem Statement

The docx extractor handles attributes on `<w:t>` elements (e.g., `xml:space="preserve"`):

```typescript
const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g; // docx, line 31
```

The pptx extractor does not:

```typescript
const tRegex = /<a:t>([^<]*)<\/a:t>/g; // pptx, line 225
```

PPTX files can also have `xml:space="preserve"` on `<a:t>` elements. This means the pptx extractor silently drops text elements that have any attributes.

## Findings

**Agent:** kieran-typescript-reviewer

**Location:** `src/utils/office.ts:225`

## Proposed Solutions

### Solution 1: Fix the regex (Recommended)

Change line 225 to match the docx pattern:

```typescript
const tRegex = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;
```

- **Effort:** Trivial (one-line change)
- **Risk:** None

## Acceptance Criteria

- [x] `<a:t>` regex handles optional attributes
- [x] Test added for `<a:t xml:space="preserve">` in pptx

## Work Log

| Date       | Action                                                             | Learnings                    |
| ---------- | ------------------------------------------------------------------ | ---------------------------- |
| 2026-02-10 | Fixed pptx `<a:t>` regex to handle optional attributes, added test | Consistent with docx pattern |

## Resources

- PR #47: https://github.com/dguido/google-workspace-mcp/pull/47
