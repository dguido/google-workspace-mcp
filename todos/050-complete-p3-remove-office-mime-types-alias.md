---
status: pending
priority: p3
issue_id: "050"
tags: [code-review, simplicity, office-extraction]
dependencies: []
---

# OFFICE_MIME_TYPES Is an Unnecessary Alias of EXPORT_MIME_TYPES

## Problem Statement

`OFFICE_MIME_TYPES` at `src/utils/mimeTypes.ts:42-46` re-exports three values from `EXPORT_MIME_TYPES` with no additional logic. The test code already uses `EXPORT_MIME_TYPES` directly. The alias adds an export, an import, and a concept for zero semantic gain.

## Findings

**Agent:** code-simplicity-reviewer

The only consumer is `getTypeFromMime()` in `src/handlers/unified.ts:78-83`, which could reference `EXPORT_MIME_TYPES.DOCX` directly.

## Proposed Solutions

### Solution 1: Remove and use EXPORT_MIME_TYPES directly

- Delete `OFFICE_MIME_TYPES` from mimeTypes.ts
- Replace 3 references in `getTypeFromMime()` with `EXPORT_MIME_TYPES.DOCX/XLSX/PPTX`
- Remove the import from unified.ts

- **Effort:** Trivial
- **Risk:** None

### Solution 2: Keep with improved comment

Add a comment explaining the relationship.

- **Effort:** Trivial

## Recommended Action

Solution 1. The abstraction doesn't earn its keep.

## Acceptance Criteria

- [ ] `OFFICE_MIME_TYPES` removed
- [ ] All references use `EXPORT_MIME_TYPES` directly

## Work Log

| Date | Action | Learnings |
| ---- | ------ | --------- |

## Resources

- PR #47: https://github.com/dguido/google-workspace-mcp/pull/47
