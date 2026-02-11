---
status: pending
priority: p3
issue_id: "049"
tags: [code-review, quality, office-extraction]
dependencies: []
---

# decodeXmlEntities Does Not Handle Numeric Character References

## Problem Statement

The `decodeXmlEntities()` function handles only the 5 named XML entities (`&amp;`, `&lt;`, `&gt;`, `&apos;`, `&quot;`). Numeric references like `&#160;` (non-breaking space) or `&#x20;` are not decoded. These appear occasionally in real Office files, especially from third-party tools.

## Findings

**Agents:** security-sentinel, architecture-strategist, pattern-recognition-specialist

**Location:** `src/utils/office.ts:6-13`

## Proposed Solutions

### Solution 1: Add numeric entity support (Recommended)

```typescript
.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
```

Could also consolidate the 5+2 replace passes into a single-pass regex with a lookup map for better performance.

- **Effort:** Trivial
- **Risk:** Low

## Acceptance Criteria

- [ ] `&#60;` decodes to `<`
- [ ] `&#x3C;` decodes to `<`
- [ ] Test covers both decimal and hex numeric entities

## Work Log

| Date | Action | Learnings |
| ---- | ------ | --------- |

## Resources

- PR #47: https://github.com/dguido/google-workspace-mcp/pull/47
