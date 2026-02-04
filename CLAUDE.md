# Google Workspace MCP

MCP server providing Claude access to Google Drive, Docs, Sheets, Slides, Calendar, and Gmail.

## Architecture

```
src/
├── index.ts           # Entry point, MCP server setup, tool routing
├── auth/              # OAuth2 authentication
├── handlers/          # Tool implementations (drive, docs, sheets, slides, calendar, gmail, unified)
├── schemas/           # Zod validation schemas
├── tools/             # Tool definitions for MCP
├── utils/             # Shared utilities
└── prompts/           # MCP prompt definitions
```

**Three-layer pattern:** Tool Definitions → Schemas → Handlers → ToolResponse

## Development

| Command              | Purpose                         |
| -------------------- | ------------------------------- |
| `npm run build`      | TypeScript check + bundle       |
| `npm run typecheck`  | Type check only                 |
| `npm run lint`       | oxlint                          |
| `npm run format`     | oxfmt                           |
| `npm run check`      | typecheck + lint + format:check |
| `npm test`           | Run tests (Vitest)              |
| `npm run test:watch` | Watch mode                      |
| `npm run auth`       | Run OAuth flow                  |

### Navigating the codebase

```bash
# Find handler implementations
ast-grep --pattern 'export async function handle$_($$$)' --lang ts src/handlers

# Find schema definitions
ast-grep --pattern 'export const $_Schema = z.$_($$$)' --lang ts src/schemas

# Find tool definitions
rg "name: '" src/tools/definitions.ts

# Find all usages of a handler
rg "handleCreateTextFile" src
```

### Serena (LSP symbol tools)

Use Serena's semantic tools when text search isn't enough:

| When you need to...                      | Use                        |
| ---------------------------------------- | -------------------------- |
| Understand a file's structure            | `get_symbols_overview`     |
| Find where something is defined          | `find_symbol`              |
| Find all usages of a function/class/type | `find_referencing_symbols` |
| Rename across the entire codebase        | `rename_symbol`            |

**Prefer Serena over grep/ast-grep when:** You need to follow type relationships, find implementations of interfaces, or refactor symbols safely across files.

### Context7 (library documentation)

Fetches up-to-date docs and examples for any library. Use when working with:

- Google APIs (`googleapis`)
- Zod schemas
- Vitest testing patterns
- Any npm package where you need current API details

**Tools:** `resolve-library-id` → `get-library-docs`

### Exa (web & code search)

| Tool                   | Use for                                             |
| ---------------------- | --------------------------------------------------- |
| `web_search_exa`       | Current info, blog posts, Stack Overflow, tutorials |
| `get_code_context_exa` | Real code examples from GitHub repos                |

**Prefer Exa over WebSearch when:** You need code snippets, implementation examples, or results from developer-focused sources.

**Prefer Context7 over Exa when:** You need official library documentation or API reference.

## Code Standards

**Philosophy:** No speculative features. No premature abstraction. Clarity over cleverness. Justify new dependencies.

**Hard limits:**

- ≤100 lines/function, cyclomatic complexity ≤8
- 100-char line length
- Ban relative (`..`) imports
- All code must pass type checking

**Comments:** Code should be self-documenting. No comments that repeat what code does, no commented-out code, no obvious comments.

**Error handling:** Fail fast with clear, actionable messages. Never swallow exceptions silently. Include context.

## Working on Code

### Adding a new tool

1. **Schema** (`src/schemas/<service>.ts`) - Define Zod schema with `.refine()` for mutual exclusion
2. **Handler** (`src/handlers/<service>.ts`) - `handleX(drive, args)` → validates with `validateArgs()`, returns `ToolResponse`
3. **Definition** (`src/tools/definitions.ts`) - Add to appropriate array (`driveTools`, `docsTools`, etc.)
4. **Registration** (`src/index.ts`) - Import handler, add case to switch
5. **Tests** (`src/handlers/<service>.test.ts`) - Mock Google API services
6. **Exports** - Add schema to `src/schemas/index.ts`, handler to `src/handlers/index.ts`

### Git conventions

- Commit messages: imperative mood, ≤72 char subject line
- One logical change per commit
- Never amend/rebase commits already pushed to shared branches

## Testing

**Framework:** Vitest with colocated `*.test.ts` files.

**Mock boundaries, not logic.** Only mock Google API services (network calls). Use `vi.fn()` for Drive/Docs/Sheets/Slides service methods.

```typescript
function createMockDrive(): drive_v3.Drive {
  return {
    files: { list: vi.fn(), create: vi.fn(), update: vi.fn(), get: vi.fn() },
    permissions: { create: vi.fn(), list: vi.fn() },
  } as unknown as drive_v3.Drive;
}
```

**Verify tests catch failures:** Write test → temporarily break code → verify test fails → fix.

## Internals

### Gotchas

| Gotcha                    | Solution                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path vs ID parameters     | All file/folder params accept either. Use `.refine()` to enforce mutual exclusion                                                                    |
| Folder auto-creation      | `resolvePath()` creates intermediate folders automatically                                                                                           |
| Response type selection   | Use `successResponse(text)` for simple messages, `structuredResponse(text, data)` when machine-readable data needed                                  |
| TOON format in responses  | Use `toToon()` to encode data in text responses; `structuredContent` is auto-suppressed when TOON is enabled                                         |
| Batch operation progress  | Use `processBatchOperation()` - handles progress reporting and partial failures                                                                      |
| Google API errors         | Wrap in try/catch, use `errorResponse()` with context about what operation failed                                                                    |
| outputSchema requirements | Tools with `outputSchema` MUST use `structuredResponse()`. Response data MUST match schema types. Omit optional fields rather than setting to `null` |
| Empty result edge cases   | When fixing response issues, check BOTH the "has results" AND "empty results" code paths                                                             |
| Type consistency          | Similar operations (all deletes, all creates) should return consistent field types. Use `number` for counts (`deleted: 1` not `true`)                |
| Schema descriptions       | outputSchema descriptions must match actual response semantics, especially for batch operations                                                      |

### Key utilities

| Utility                                        | Purpose                                      |
| ---------------------------------------------- | -------------------------------------------- |
| `validateArgs(schema, args)`                   | Validate input, return discriminated union   |
| `resolveOptionalFolderPath(drive, id?, path?)` | Resolve folder ID from ID or path            |
| `resolvePath(drive, path)`                     | Resolve path to ID, auto-creates folders     |
| `processBatchOperation(ids, op, ctx, opts)`    | Handle batch operations with progress        |
| `toToon(data)`                                 | Encode data as TOON format (token-efficient) |
| `withTimeout(promise, ms)`                     | Timeout wrapper                              |
| `withRetry(op, options)`                       | Retry with exponential backoff               |

### Naming conventions

- Handlers: `handle<Action>` (e.g., `handleCreateTextFile`)
- Schemas: `<Action>Schema` / `<Action>Input`
- Constants: `UPPER_SNAKE_CASE`
