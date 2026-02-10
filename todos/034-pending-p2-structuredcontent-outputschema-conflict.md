---
status: wontfix
priority: p2
issue_id: "034"
tags: [bug, typescript, mcp-protocol, error-handling]
dependencies: []
---

# structuredContent.diagnostic_tool may conflict with outputSchema

## Problem Statement

The `authErrorResponse` adds `diagnostic_tool: "get_status"` to `structuredContent`, but tools with `outputSchema` defined have strict schema validation. If `diagnostic_tool` isn't declared in a tool's `outputSchema`, the MCP client may reject the response or silently drop the field.

**Why it matters:** The diagnostic hint may never reach the agent for tools that have strict output schemas, silently defeating the error-to-diagnosis flow for those specific tools.

## Findings

**Found by:** architecture reviewer, TypeScript quality reviewer

**Evidence:**

- `src/utils/responses.ts` lines 126-142: `authErrorResponse` spreads `diagnostic_tool` into `structuredContent`
- Multiple tools define `outputSchema` in `src/tools/definitions.ts`
- MCP spec behavior for extra fields in `structuredContent` when `outputSchema` is defined is unclear

## Proposed Solutions

### Option A: Use error content block instead of structuredContent (Recommended)

**Description:** Return diagnostic info via the `text` field or a separate `content` block (MCP text content) rather than `structuredContent`, which is subject to schema validation.

**Pros:**

- `text` content is always returned regardless of schema
- Agents can always read text error messages
- No schema conflicts

**Cons:**

- Less machine-readable than structured data
- Agent must parse text to find the hint

### Option B: Do nothing — verify MCP client behavior

**Description:** Test whether Claude and other MCP clients actually reject extra `structuredContent` fields. If they don't, the conflict is theoretical.

**Pros:** No code change needed if clients are lenient
**Cons:** Relies on undefined behavior that could change

## Recommended Action

Investigate Option B first. If clients reject extra fields, apply Option A.

## Technical Details

**Affected files:**

- `src/utils/responses.ts` — `authErrorResponse` structuredContent handling

**Database changes:** None

## Acceptance Criteria

- [ ] Verify whether MCP clients reject extra structuredContent fields
- [ ] If yes, move diagnostic hint to text content
- [ ] Diagnostic hint is accessible to agents for all tools (with and without outputSchema)

## Work Log

| Date       | Action  | Learnings                                                                                                                                                                                        |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-02-10 | Created | Found by architecture and TypeScript quality reviewers                                                                                                                                           |
| 2026-02-10 | Wontfix | Error responses (isError: true) don't validate against outputSchema. MCP clients accept extra structuredContent fields on errors. The diagnostic hint is also in the text content as a fallback. |

## Resources

- `src/utils/responses.ts` — `authErrorResponse` function
- `src/tools/definitions.ts` — tools with `outputSchema`
- MCP specification for `structuredContent` behavior
