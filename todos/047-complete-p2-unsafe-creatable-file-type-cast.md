---
status: done
priority: p2
issue_id: "047"
tags: [code-review, quality, type-safety, office-extraction]
dependencies: []
---

# Unsafe `as CreatableFileType` Cast in inferFileType

## Problem Statement

At `src/handlers/unified.ts:43`:

```typescript
const extType = EXTENSION_TO_TYPE[ext] as CreatableFileType | undefined;
```

This cast silently asserts that `EXTENSION_TO_TYPE` values are always a subset of `CreatableFileType`. If someone later adds `"docx"` as a value in `EXTENSION_TO_TYPE`, the cast would hide the mismatch at compile time.

## Findings

**Agent:** kieran-typescript-reviewer

## Proposed Solutions

### Solution 1: Runtime guard (Recommended)

Replace the cast with an explicit narrowing check:

```typescript
const extType = EXTENSION_TO_TYPE[ext];
if (extType === "doc" || extType === "sheet" || extType === "slides" || extType === "text") {
  return extType;
}
```

- **Pros:** Self-documenting, compiler narrows the type, catches future mismatches
- **Cons:** Three more lines
- **Effort:** Trivial
- **Risk:** None

## Acceptance Criteria

- [x] No `as CreatableFileType` cast in the code
- [x] Type narrowing is done via runtime check

## Work Log

| Date | Action | Learnings |
| ---- | ------ | --------- |

## Resources

- PR #47: https://github.com/dguido/google-workspace-mcp/pull/47
