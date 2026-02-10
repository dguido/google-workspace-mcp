---
status: wontfix
priority: p3
issue_id: "036"
tags: [improvement, typescript, mcp-protocol]
dependencies: []
---

# MCP instructions string is ~50% longer than needed

## Problem Statement

The MCP server `instructions` field (set in `src/index.ts` ~line 252) contains verbose text that could be shortened by about half without losing information. Every MCP session transmits this text, adding unnecessary token overhead.

**Why it matters:** Token efficiency matters for agent interactions. Shorter instructions reduce context window usage across all conversations.

## Findings

**Found by:** simplicity reviewer, agent-native reviewer

**Evidence:**

- `src/index.ts` lines 252-258: instructions string
- Contains redundant phrasing and could be tightened

## Proposed Solutions

### Option A: Tighten the instructions text

**Description:** Rewrite to be more concise while preserving all actionable information.

**Effort:** Small
**Risk:** Low

## Recommended Action

Low-priority polish. Apply when touching the file for other reasons.

## Acceptance Criteria

- [ ] Instructions string is shorter
- [ ] All actionable information preserved
- [ ] No behavioral change

## Work Log

| Date       | Action  | Learnings                                                                                       |
| ---------- | ------- | ----------------------------------------------------------------------------------------------- |
| 2026-02-10 | Created | Found by simplicity and agent-native reviewers                                                  |
| 2026-02-10 | Wontfix | Instructions text is already concise (1 sentence). Review agents evaluated a different version. |
