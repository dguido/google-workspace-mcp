---
status: pending
priority: p1
issue_id: "043"
tags: [code-review, security, performance, office-extraction]
dependencies: []
---

# Unbounded Column Index in XLSX Parser -- OOM via Crafted Cell Reference

## Problem Statement

The `columnIndex()` function converts Excel column letters (e.g., "C", "AA", "XFD") to a 0-based index using base-26 arithmetic with no upper bound. A crafted XLSX file containing a cell reference like `ZZZZZZZZZZ1` produces a column index of ~146 trillion. This value is used as `maxCol`, and the row normalization loop pads every row with empty strings up to that length, causing an immediate OOM crash.

**Why it matters:** Same threat model as zip bombs -- any file in a shared Drive can crash the server.

## Findings

**Agents:** security-sentinel, performance-oracle, code-simplicity-reviewer

- `columnIndex()` at `src/utils/office.ts:51-58` has no cap
- `maxCol` at line 121 grows unbounded: `if (col + 1 > maxCol) maxCol = col + 1`
- Row normalization at lines 193-194: `while (row.length < maxCol) row.push("")` attempts to allocate `maxCol` empty strings per row
- Excel's real maximum is column XFD = 16,383
- The `maxCol` tracking + row normalization is arguably unnecessary for LLM-consumed TSV output (simplicity reviewer finding)

**Location:** `src/utils/office.ts:51-58, 121, 143-144, 193-194`

## Proposed Solutions

### Solution 1: Cap column index + skip invalid refs (Recommended)

Add a column cap. Excel's maximum is 16,384. Cap at 20,000 to be safe.

```typescript
const col = columnIndex(rMatch[1]);
if (col < 0 || col > 20_000) continue; // skip invalid cell refs
```

- **Pros:** One-line fix, prevents OOM, handles adversarial input
- **Cons:** None meaningful
- **Effort:** Trivial
- **Risk:** Low

### Solution 2: Remove maxCol normalization entirely

Remove `maxCol` tracking and row normalization. Just join each row as-is without padding to uniform width. The LLM consumer doesn't need trailing tabs.

- **Pros:** Removes the vulnerable code path entirely, simplifies logic
- **Cons:** Rows have different widths in TSV output (unlikely to matter for LLM)
- **Effort:** Trivial
- **Risk:** Low

### Solution 3: Both (cap + remove normalization)

Apply the cap as a safety guard AND remove the normalization.

- **Pros:** Defense in depth + simplification
- **Effort:** Trivial
- **Risk:** Low

## Recommended Action

Solution 3. The cap prevents the OOM, and removing normalization eliminates the code that would be affected by it.

## Acceptance Criteria

- [ ] Cell references with column index > 20,000 are skipped
- [ ] No OOM on crafted XLSX with distant column references
- [ ] Test added for multi-letter column references (AA, AZ, XFD)

## Work Log

| Date | Action | Learnings |
| ---- | ------ | --------- |

## Resources

- PR #47: https://github.com/dguido/google-workspace-mcp/pull/47
