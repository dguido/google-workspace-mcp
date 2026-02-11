---
status: pending
priority: p1
issue_id: "042"
tags: [code-review, security, performance, office-extraction]
dependencies: []
---

# No File Size or Decompression Limits -- Zip Bomb / OOM Risk

## Problem Statement

The Office file extraction path downloads the entire file into memory as an `ArrayBuffer`, copies it to a `Uint8Array`, then passes it to `unzipSync` with no limits on compressed or decompressed size. A crafted ZIP archive (e.g., a zip bomb disguised as a .docx) could decompress to gigabytes, crashing the server process. Even legitimate large files (e.g., a 500MB .pptx with images) cause excessive memory consumption.

Peak memory is 4-5x the compressed file size (ArrayBuffer + Uint8Array copy + decompressed XML + string conversions + output arrays).

**Why it matters:** This is a denial-of-service vector. Any user with write access to a shared Google Drive can crash the MCP server by placing a crafted file and triggering `get_file_content`. Since this is a long-running server, one bad request kills all concurrent sessions.

## Findings

**Agents:** security-sentinel, performance-oracle

- `file.data.size` is already fetched in metadata (line 461 of unified.ts) but never checked before download
- `fflate`'s `unzipSync` does not enforce decompressed size limits
- The `filter` callback receives `originalSize` in the `UnzipFileInfo` object but the current code does not check it
- A 100KB compressed ZIP containing 100MB of repeated content decompresses successfully with no guardrails (empirically tested by security-sentinel)

**Locations:**

- `src/handlers/unified.ts:593-601` (no pre-download size check)
- `src/utils/office.ts:21-23, 66-71, 208-210` (unzipSync with no decompressed size limit)

## Proposed Solutions

### Solution 1: Pre-download size check + filter originalSize check (Recommended)

Add a file size check before downloading, and use the filter callback's `originalSize` to reject oversized ZIP entries.

```typescript
// In handler, before download:
const MAX_OFFICE_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const fileSize = parseInt(file.data.size || "0", 10);
if (fileSize > MAX_OFFICE_FILE_SIZE) {
  return errorResponse(
    `Office file "${file.data.name}" is too large for text extraction ` +
      `(${(fileSize / 1024 / 1024).toFixed(1)} MB, limit ${MAX_OFFICE_FILE_SIZE / 1024 / 1024} MB). ` +
      "Use downloadFile for large binary files.",
  );
}

// In extraction functions, filter callback:
const MAX_ENTRY_SIZE = 100 * 1024 * 1024; // 100 MB decompressed
filter: (f) => f.name === "word/document.xml" && f.originalSize < MAX_ENTRY_SIZE;
```

- **Pros:** Two layers of defense (network + decompression), minimal code change, uses existing metadata
- **Cons:** Legitimate large files are rejected (mitigated by actionable error message pointing to downloadFile)
- **Effort:** Small
- **Risk:** Low

### Solution 2: Switch to async unzip with byte counter

Use fflate's streaming `Unzip` API with a byte counter that throws when decompressed output exceeds a threshold.

- **Pros:** More precise control, doesn't block event loop
- **Cons:** Significantly more complex, requires making extractors async
- **Effort:** Large
- **Risk:** Medium

## Recommended Action

Solution 1. The file size guard is the primary defense. The 50MB compressed limit is generous for text extraction (Office files are mostly images at that size). The filter `originalSize` check catches zip bombs where the compressed size is small but decompressed size is huge.

## Technical Details

**Affected files:**

- `src/handlers/unified.ts` (add size check before download)
- `src/utils/office.ts` (add originalSize check in all three filter callbacks)

## Acceptance Criteria

- [ ] Files larger than 50MB return an actionable error without downloading
- [ ] ZIP entries with decompressed size > 100MB are skipped by the filter
- [ ] Tests cover both the size check and the decompressed size check
- [ ] Error messages suggest `downloadFile` as an alternative

## Work Log

| Date | Action | Learnings |
| ---- | ------ | --------- |

## Resources

- PR #47: https://github.com/dguido/google-workspace-mcp/pull/47
- fflate filter docs: https://github.com/101arrowz/fflate
