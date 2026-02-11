---
status: pending
priority: p3
issue_id: "051"
tags: [code-review, agent-native, office-extraction]
dependencies: []
---

# Inconsistent Truncation: Office Files Truncated, Google Files Not

## Problem Statement

The Office file path applies `truncateResponse()` and reports `metadata.truncated`. The Google Doc, Google Slides, and text file paths do not apply any truncation or report a `truncated` field. A 500-page Google Doc could exhaust the agent's context window while a 500-page .docx would be safely truncated.

The agent has no way to know whether a non-Office file's content is complete or was silently cut off at some other layer.

## Findings

**Agent:** agent-native-reviewer

**Location:** `src/handlers/unified.ts:593-627` (Office path with truncation) vs lines 468-495 (Google Doc path without)

## Proposed Solutions

### Solution 1: Apply truncateResponse to all get_file_content paths

Ensures agents always have a reliable `metadata.truncated` signal regardless of source format.

- **Effort:** Medium (touches multiple existing code paths)
- **Risk:** Low-Medium (changes behavior of existing paths)

### Solution 2: Document that Google-native files are never truncated

Add a note to the outputSchema description.

- **Effort:** Trivial
- **Risk:** None

## Recommended Action

Solution 1 as a separate PR -- this is a broader change beyond the scope of this Office extraction review.

## Acceptance Criteria

- [ ] All file types in get_file_content have consistent truncation behavior
- [ ] `metadata.truncated` is present in all structured responses

## Work Log

| Date | Action | Learnings |
| ---- | ------ | --------- |

## Resources

- PR #47: https://github.com/dguido/google-workspace-mcp/pull/47
