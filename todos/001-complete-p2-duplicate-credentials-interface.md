---
status: pending
priority: p2
issue_id: "001"
tags: [code-review, patterns, typescript]
dependencies: []
---

# Duplicate CredentialsFile Interface Definitions

## Problem Statement

The `CredentialsFile` interface is defined in 3 separate files with identical structure. This violates DRY principles and creates maintenance burden - any change to the credentials structure requires updating multiple files.

## Findings

**Locations:**

- `src/auth/client.ts` - CredentialsFile interface
- `src/errors/config-validator.ts` - CredentialsFile interface
- `src/handlers/status.ts` - CredentialsFile interface

All three define the same structure:

```typescript
interface CredentialsFile {
  installed?: { client_id: string; client_secret?: string; ... };
  web?: { client_id: string; client_secret?: string; ... };
}
```

**Impact:** Medium - Code duplication, maintenance burden, potential for drift between definitions.

## Proposed Solutions

### Option A: Extract to shared types file (Recommended)

**Pros:** Single source of truth, TypeScript-native solution
**Cons:** Requires import changes across files
**Effort:** Small
**Risk:** Low

Create `src/types/credentials.ts`:

```typescript
export interface CredentialsFile {
  installed?: OAuthClientConfig;
  web?: OAuthClientConfig;
}
```

### Option B: Re-export from auth/client.ts

**Pros:** Minimal file changes
**Cons:** Creates import dependency on auth module from errors
**Effort:** Small
**Risk:** Low

### Option C: Keep as-is

**Pros:** No changes needed
**Cons:** Continues duplication
**Effort:** None
**Risk:** Low (just technical debt)

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**

- src/auth/client.ts
- src/errors/config-validator.ts
- src/handlers/status.ts
- New file: src/types/credentials.ts (if Option A)

## Acceptance Criteria

- [ ] Single CredentialsFile interface definition exists
- [ ] All files import from shared location
- [ ] TypeScript compilation passes
- [ ] No runtime behavior changes

## Work Log

| Date       | Action                          | Learnings                                           |
| ---------- | ------------------------------- | --------------------------------------------------- |
| 2026-01-29 | Created from PR #15 code review | Identified via pattern-recognition-specialist agent |

## Resources

- PR #15: Add OAuth security hardening, status tool, and error handling
