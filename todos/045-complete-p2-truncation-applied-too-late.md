---
status: done
priority: p2
issue_id: "045"
tags: [code-review, performance, office-extraction]
dependencies: ["042"]
---

# Truncation Applied Too Late -- All Extraction Work Done Before Truncate

## Problem Statement

The extractors build a complete string from the entire file, then `truncateResponse` slices to 25K chars. All CPU and memory spent producing characters beyond position 25,000 is wasted. A 1-million-row spreadsheet parses every row and cell, builds the full TSV string, then discards 99.9%+ at truncation time.

**Why it matters:** Even with the file size cap from #042, a 40MB XLSX (within the cap) could still mean decompressing and parsing millions of rows, only to throw away almost all of it.

## Findings

**Agent:** performance-oracle

- `src/handlers/unified.ts:605-613` calls extractor first, then `truncateResponse(rawContent)`
- For large files, this turns O(min(N, 25000)) into O(N) for the output assembly
- The character budget (25K) is already defined in the codebase

## Proposed Solutions

### Solution 1: Pass character budget to extractors (Recommended)

Add an optional `maxChars` parameter. Each extractor's main loop maintains a running character count and breaks early once exceeded.

- **Pros:** Turns O(N) into O(min(N, budget)), major improvement for large files
- **Cons:** Slightly more complex extractor signatures
- **Effort:** Small-Medium
- **Risk:** Low

### Solution 2: Accept current behavior with file size cap

Rely on the file size cap from #042 to bound the work. A 50MB cap limits the worst case.

- **Pros:** Zero additional work
- **Cons:** Still wasteful for files near the cap
- **Effort:** None
- **Risk:** Low

## Recommended Action

Solution 1 as a fast follow after #042.

## Acceptance Criteria

- [x] Extractors accept an optional character budget parameter
- [x] Extraction stops early when budget is exceeded
- [x] Test verifies early termination behavior

## Work Log

| Date       | Action                                                  | Learnings                                                                        |
| ---------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 2026-02-10 | Implemented Solution 1: character budget for extractors | Minimal changes needed; budget check at natural boundaries (paragraph/row/slide) |

## Resources

- PR #47: https://github.com/dguido/google-workspace-mcp/pull/47
