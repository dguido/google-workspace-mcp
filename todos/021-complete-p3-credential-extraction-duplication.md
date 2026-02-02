---
status: pending
priority: p3
issue_id: "021"
tags: [code-review, dry, maintainability]
dependencies: []
---

# Duplicate Credential Extraction Logic

## Problem Statement

The logic to extract `client_id`, `client_secret`, and `redirect_uris` from credentials files is duplicated across three locations. Each location checks for `installed`, `web`, or direct format.

**Why it matters:** Changes to supported credential formats require updating multiple places. Risk of inconsistency if one location is missed.

## Findings

**Agents:** pattern-recognition-specialist, code-simplicity-reviewer

**Evidence:**

**Location 1:** `src/auth/client.ts:12-37`

```typescript
if (keys.installed?.client_id) {
  return { client_id: keys.installed.client_id, ... };
} else if (keys.web?.client_id) {
  return { client_id: keys.web.client_id, ... };
} else if (keys.client_id) {
  return { client_id: keys.client_id, ... };
}
```

**Location 2:** `src/auth/client.ts:51-65` (legacy fallback)

```typescript
if (legacyKeys.installed?.client_id) { ... }
else if (legacyKeys.web?.client_id) { ... }
```

**Location 3:** `src/errors/config-validator.ts:79-85`

```typescript
const clientId =
  credentials.installed?.client_id || credentials.web?.client_id || credentials.client_id;
```

## Proposed Solutions

### Option A: Extract Helper Function (Recommended)

**Description:** Create a utility function in `src/auth/utils.ts`:

```typescript
export interface ExtractedCredentials {
  client_id: string;
  client_secret?: string;
  redirect_uris?: string[];
}

export function extractCredentials(keys: CredentialsFile): ExtractedCredentials | null {
  const source = keys.installed || keys.web || (keys.client_id ? keys : null);
  if (!source?.client_id) return null;

  return {
    client_id: source.client_id,
    client_secret: source.client_secret,
    redirect_uris: source.redirect_uris || ["http://127.0.0.1/oauth2callback"],
  };
}
```

**Pros:**

- Single source of truth
- Easy to add new formats
- Reduces ~20 lines across files

**Cons:**

- Need to update imports

**Effort:** Small (1-2 hours)
**Risk:** Very Low

### Option B: Use Zod Transform

**Description:** Add transform to the Zod schema that normalizes credential format.

**Pros:**

- Validation and normalization in one place

**Cons:**

- More complex schema
- May not fit all use cases

**Effort:** Small-Medium (2-3 hours)
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `src/auth/utils.ts` - add helper function
- `src/auth/client.ts` - use helper
- `src/errors/config-validator.ts` - use helper

**Components:** Authentication, Configuration

## Acceptance Criteria

- [ ] Single function extracts credentials from all supported formats
- [ ] All three locations use the shared function
- [ ] Tests verify all credential formats work

## Work Log

| Date       | Action                   | Learnings                           |
| ---------- | ------------------------ | ----------------------------------- |
| 2025-02-01 | Created from code review | Pattern repeated in three locations |

## Resources

- DRY principle
- src/types/credentials.ts - existing credential types
