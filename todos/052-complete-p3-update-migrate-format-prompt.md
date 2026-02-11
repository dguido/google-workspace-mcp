---
status: pending
priority: p3
issue_id: "052"
tags: [code-review, agent-native, office-extraction]
dependencies: []
---

# migrate-format Prompt Not Updated for New Reading Capability

## Problem Statement

The `migrate-format` prompt in `src/prompts/definitions.ts:100-118` tells agents to convert `.docx`, `.xlsx`, `.pptx` to Google Workspace formats. With this PR, agents can now read OOXML files directly via `get_file_content` without conversion. The prompt gives agents slightly stale guidance.

## Findings

**Agent:** agent-native-reviewer

## Proposed Solutions

### Solution 1: Update prompt to note OOXML is readable (Recommended)

Mention that modern OOXML files are readable without conversion, and focus the migration use case on editability and legacy binary formats (.doc/.xls/.ppt).

- **Effort:** Trivial
- **Risk:** None

## Acceptance Criteria

- [ ] Prompt mentions that .docx/.xlsx/.pptx are now readable without conversion
- [ ] Migration guidance focuses on editability and legacy binary formats

## Work Log

| Date | Action | Learnings |
| ---- | ------ | --------- |

## Resources

- PR #47: https://github.com/dguido/google-workspace-mcp/pull/47
