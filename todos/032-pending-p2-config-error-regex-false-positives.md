---
status: complete
priority: p2
issue_id: "032"
tags: [bug, typescript, error-handling, reliability]
dependencies: []
---

# Config error regex has false-positive risk

## Problem Statement

The regex `/credentials|auth|token|scope|API.*not.*enabled/i` in the generic catch block matches common words that can appear in legitimate error messages unrelated to config issues. For example, "auth" could appear in a file path, "token" in pagination, or "scope" in a document title.

**Why it matters:** False positives would add misleading diagnostic hints to unrelated errors, confusing the agent and wasting time on irrelevant `get_status` calls.

## Findings

**Found by:** TypeScript quality reviewer, security reviewer, architecture reviewer, simplicity reviewer

**Evidence:**

- `src/index.ts` lines 686-706: regex used in generic catch block
- Terms like "token" (pageToken), "scope" (document scope), "auth" (author) are common in Google API contexts
- No word boundary constraints or multi-term requirements

## Proposed Solutions

### Option A: Add word boundaries and tighten patterns (Recommended)

**Description:** Use more specific patterns that reduce false positives while still catching real config errors:

```typescript
const isConfigError =
  /\b(credentials?|oauth|authentication|authorization)\b|token.*(expired|invalid|revoked)|\bscope\b.*(denied|insufficient)|API.*not.*enabled/i;
```

**Pros:**

- Dramatically reduces false positives
- Still catches real auth/config errors
- Low effort change

**Cons:**

- Could miss some edge case error messages (mitigated by `get_status` being available anyway)

### Option B: Check error type/code instead of message text

**Description:** Use Google API error codes or HTTP status codes (401, 403) instead of regex on error messages.

**Pros:** More reliable than text matching
**Cons:** Higher effort, Google API error structure varies

## Recommended Action

Apply Option A as an immediate fix. Consider Option B as a follow-up if false positives persist.

## Technical Details

**Affected files:**

- `src/index.ts` — regex in generic catch block

**Database changes:** None

## Acceptance Criteria

- [ ] Regex doesn't match "pageToken", "author", "scope" in non-error contexts
- [ ] Regex still matches real auth/config error messages from Google APIs
- [ ] Test coverage for both true positives and false-positive resistance
- [ ] TypeScript compiles without errors

## Work Log

| Date       | Action    | Learnings                                                                                                                                         |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-10 | Created   | Found by 4 review agents unanimously                                                                                                              |
| 2026-02-10 | Completed | Added word boundaries: `\btoken\b`, `\bscopes?\b`. Added 4 false-positive test cases (pageToken, microscope, horoscope). Verified 825 tests pass. |

## Resources

- `src/index.ts` — generic catch block regex
- Google API error message examples for testing
