---
status: pending
priority: p2
issue_id: "044"
tags: [code-review, quality, office-extraction]
dependencies: []
---

# extractXlsxText Exceeds 100-Line Function Limit

## Problem Statement

`extractXlsxText` in `src/utils/office.ts` is 135 lines (lines 65-199), exceeding the project's hard limit of 100 lines per function. The function handles four distinct concerns: shared string parsing, sheet name parsing, worksheet sorting, and cell-by-cell extraction with three cell type branches.

**Why it matters:** Violates a documented hard limit in CLAUDE.md. The function's cyclomatic complexity (~10 branches) is also at the margin.

## Findings

**Agents:** architecture-strategist, pattern-recognition-specialist, kieran-typescript-reviewer, git-history-analyzer (all flagged independently)

The function decomposes naturally along its existing comment boundaries:

1. Parse shared strings (lines 74-91)
2. Parse sheet names from workbook.xml (lines 94-103)
3. Collect and sort worksheet filenames (lines 106-112)
4. Parse each worksheet's cells and build TSV output (lines 114-199)

## Proposed Solutions

### Solution 1: Extract helper functions (Recommended)

Pull out `parseSharedStrings(xml)`, `parseSheetNames(xml)`, and `parseWorksheetRows(xml, sharedStrings)`. The main function becomes a ~30-40 line orchestrator.

- **Pros:** Each helper is independently testable, main function is clear, under line limit
- **Cons:** Slightly more functions to navigate
- **Effort:** Small
- **Risk:** Low

### Solution 2: Leave as-is

The function works and is tested.

- **Pros:** Zero effort
- **Cons:** Violates hard limit, harder to maintain
- **Effort:** None
- **Risk:** Low (functional), medium (standards compliance)

## Recommended Action

Solution 1.

## Acceptance Criteria

- [ ] `extractXlsxText` is under 100 lines
- [ ] Helper functions have their own unit tests
- [ ] All existing tests still pass

## Work Log

| Date | Action | Learnings |
| ---- | ------ | --------- |

## Resources

- PR #47: https://github.com/dguido/google-workspace-mcp/pull/47
