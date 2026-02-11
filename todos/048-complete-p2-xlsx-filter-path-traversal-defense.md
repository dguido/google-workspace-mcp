---
status: pending
priority: p2
issue_id: "048"
tags: [code-review, security, defense-in-depth, office-extraction]
dependencies: []
---

# XLSX Filter Uses Loose startsWith Instead of Anchored Regex

## Problem Statement

The XLSX `unzipSync` filter uses `f.name.startsWith("xl/worksheets/sheet")`, which would match entries like `xl/worksheets/sheet../../etc/passwd`. While not exploitable in current code (fflate returns an in-memory dictionary, not filesystem paths), the PPTX filter uses the much stricter `/^ppt\/slides\/slide\d+\.xml$/` regex. The inconsistency is a defense-in-depth gap.

## Findings

**Agent:** security-sentinel

**Location:** `src/utils/office.ts:69`

## Proposed Solutions

### Solution 1: Tighten to anchored regex (Recommended)

```typescript
filter: (f) =>
  f.name === "xl/sharedStrings.xml" ||
  f.name === "xl/workbook.xml" ||
  /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name),
```

- **Effort:** Trivial
- **Risk:** None

## Acceptance Criteria

- [ ] XLSX filter uses anchored regex matching the PPTX pattern style

## Work Log

| Date | Action | Learnings |
| ---- | ------ | --------- |

## Resources

- PR #47: https://github.com/dguido/google-workspace-mcp/pull/47
