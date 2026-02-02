---
status: pending
priority: p2
issue_id: "019"
tags: [code-review, security, authentication]
dependencies: []
---

# Token Directory Created Without Explicit Permissions

## Problem Statement

When creating the token directory, the code uses `recursive: true` but does not set explicit permissions. While the token **file** is written with mode `0o600`, the **directory** inherits the default umask, which could be world-readable (e.g., 0755).

**Why it matters:** The token directory may be world-readable/executable, allowing other users on the system to discover the token file path and potentially access it if file permissions are misconfigured.

## Findings

**Agent:** security-sentinel

**Location:** `src/auth/tokenManager.ts:63-74`

**Evidence:**

```typescript
private async ensureTokenDirectoryExists(): Promise<void> {
  try {
    const dir = path.dirname(this.tokenPath);
    await fs.mkdir(dir, { recursive: true });  // <-- No mode specified
  } catch (error: unknown) {
    if (isNodeError(error) && error.code !== "EEXIST") {
      throw error;
    }
  }
}
```

The token file is correctly secured:

```typescript
await fs.writeFile(tempPath, content, { mode: 0o600 }); // Line 54 - correct
```

But the directory is not:

```typescript
await fs.mkdir(dir, { recursive: true }); // Line 66 - missing mode
```

## Proposed Solutions

### Option A: Add Explicit Directory Mode (Recommended)

**Description:** Set directory permissions to `0o700` (owner-only access):

```typescript
await fs.mkdir(dir, { recursive: true, mode: 0o700 });
```

**Pros:**

- Simple one-line change
- Defense in depth - even if file permissions are wrong, directory blocks access
- Follows security best practices

**Cons:**

- None significant

**Effort:** Small (15 minutes)
**Risk:** Very Low

### Option B: Verify Permissions After Creation

**Description:** Check directory permissions after creation and fix if needed.

**Pros:**

- Handles existing directories with wrong permissions

**Cons:**

- More complex
- May fail if directory owned by different user

**Effort:** Small-Medium (1 hour)
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**

- `src/auth/tokenManager.ts`

**Components:** Token Management, Security

## Acceptance Criteria

- [ ] Token directory created with mode `0o700`
- [ ] Directory permissions prevent other users from listing contents
- [ ] Existing functionality unchanged

## Work Log

| Date       | Action                   | Learnings                              |
| ---------- | ------------------------ | -------------------------------------- |
| 2025-02-01 | Created from code review | security-sentinel identified the issue |

## Resources

- XDG Base Directory Specification
- Node.js fs.mkdir documentation
