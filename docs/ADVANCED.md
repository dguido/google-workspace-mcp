# Advanced Configuration

## Tool Search Optimization

For MCP clients with tool search (regex/BM25), tools can be configured for deferred loading to reduce context overhead.

### Core Tools (keep non-deferred)

These tools are used frequently and should remain in the main tool list:

- `search` - Finding files
- `listFolder` - Navigation
- `getFileContent` - Reading content
- `createFile` - Creating files
- `updateFile` - Modifying files
- `resolveFilePath` - Path resolution

### Specialized Tools (good for defer_loading)

These tools are used less frequently and can be loaded on-demand:

**Formatting:**

- `formatGoogleDocRange` - Document text and paragraph styling
- `formatGoogleSheetCells` - Spreadsheet cell formatting
- `formatGoogleSlidesElement` - Slides text, shape, and background formatting

**Batch Operations:**

- `batchDelete` - Delete multiple files
- `batchMove` - Move multiple files
- `batchShare` - Share multiple files

**Trash Management:**

- `listTrash` - View trashed files
- `restoreFromTrash` - Recover files
- `emptyTrash` - Permanently delete trash

**Revision History:**

- `listRevisions` - View file versions
- `restoreRevision` - Restore previous version

**Slides Creation:**

- `createGoogleSlidesTextBox` - Add text boxes
- `createGoogleSlidesShape` - Add shapes

**Speaker Notes:**

- `getGoogleSlidesSpeakerNotes` - Read notes
- `updateGoogleSlidesSpeakerNotes` - Edit notes

### MCP Client Configuration Example

```json
{
  "mcpServers": {
    "google-drive": {
      "command": "npx",
      "args": ["@dguido/google-workspace-mcp"],
      "tool_configuration": {
        "defer_loading": [
          "formatGoogleDocRange",
          "formatGoogleSheetCells",
          "formatGoogleSlidesElement",
          "batchDelete",
          "batchMove",
          "batchShare",
          "listTrash",
          "restoreFromTrash",
          "emptyTrash",
          "listRevisions",
          "restoreRevision",
          "createGoogleSlidesTextBox",
          "createGoogleSlidesShape",
          "getGoogleSlidesSpeakerNotes",
          "updateGoogleSlidesSpeakerNotes"
        ]
      }
    }
  }
}
```

## Environment Variables

### User-Configured Variables

**Credentials** (required - use one of these methods):

| Variable                         | Description                                             | Example                         |
| -------------------------------- | ------------------------------------------------------- | ------------------------------- |
| `GOOGLE_DRIVE_OAUTH_CREDENTIALS` | Path to your OAuth credentials JSON file                | `/home/user/secrets/oauth.json` |
| _(or place file at)_             | Default location: `gcp-oauth.keys.json` in project root | `./gcp-oauth.keys.json`         |

**Optional** (for customization):

| Variable                          | Description                      | Default                                      | Example                    |
| --------------------------------- | -------------------------------- | -------------------------------------------- | -------------------------- |
| `GOOGLE_WORKSPACE_MCP_TOKEN_PATH` | Override token storage location  | `~/.config/google-workspace-mcp/tokens.json` | `/custom/path/tokens.json` |
| `GOOGLE_WORKSPACE_TOON_FORMAT`    | Enable TOON format for responses | `false`                                      | `true`                     |
| `DEBUG`                           | Enable debug logging             | (disabled)                                   | `google-workspace-mcp:*`   |

### System Variables

These are standard system environment variables that the application reads but you typically don't need to set:

| Variable          | Description                          | Used For                                   |
| ----------------- | ------------------------------------ | ------------------------------------------ |
| `XDG_CONFIG_HOME` | Linux/Unix config directory standard | Determining default token storage location |
| `NODE_ENV`        | Node.js environment mode             | May affect error handling and logging      |

### Deprecated Variables (do not use)

| Variable                    | Description                                                            |
| --------------------------- | ---------------------------------------------------------------------- |
| `GOOGLE_TOKEN_PATH`         | Legacy token path - use `GOOGLE_WORKSPACE_MCP_TOKEN_PATH` instead      |
| `GOOGLE_CLIENT_SECRET_PATH` | Legacy credentials path - use `GOOGLE_DRIVE_OAUTH_CREDENTIALS` instead |

## Multi-Account Setup

If you use multiple Google accounts (e.g., work, personal), store credentials per-project:

### Option 1: CLI Flags (Simplest)

```bash
# Create project credentials directory
mkdir -p .credentials

# Authenticate with project-level storage
npx @dguido/google-workspace-mcp auth \
  --credentials-path .credentials/gcp-oauth.keys.json \
  --token-path .credentials/tokens.json

# Add to .gitignore
echo ".credentials/" >> .gitignore
```

### Option 2: Environment Variables

```bash
export GOOGLE_DRIVE_OAUTH_CREDENTIALS=".credentials/gcp-oauth.keys.json"
export GOOGLE_WORKSPACE_MCP_TOKEN_PATH=".credentials/tokens.json"
npx @dguido/google-workspace-mcp auth
```

### Claude Code MCP Config (Project-Level)

```json
{
  "mcpServers": {
    "google-drive": {
      "command": "npx",
      "args": ["-y", "@dguido/google-workspace-mcp"],
      "env": {
        "GOOGLE_DRIVE_OAUTH_CREDENTIALS": ".credentials/gcp-oauth.keys.json",
        "GOOGLE_WORKSPACE_MCP_TOKEN_PATH": ".credentials/tokens.json"
      }
    }
  }
}
```

Relative paths resolve from the working directory where Claude Code is launched.

### When to Use Each Approach

| Approach                        | Best For                                         |
| ------------------------------- | ------------------------------------------------ |
| User-level (`~/.config/`)       | Single Google account, convenience               |
| Project-level (`.credentials/`) | Multiple accounts, account isolation per project |

## Token Storage

Authentication tokens are stored securely following the XDG Base Directory specification:

| Priority | Location    | Configuration                                              |
| -------- | ----------- | ---------------------------------------------------------- |
| 1        | Custom path | Set `GOOGLE_WORKSPACE_MCP_TOKEN_PATH` environment variable |
| 2        | XDG Config  | `$XDG_CONFIG_HOME/google-workspace-mcp/tokens.json`        |
| 3        | Default     | `~/.config/google-workspace-mcp/tokens.json`               |

**Security Notes:**

- Tokens are created with secure permissions (0600)
- Never commit tokens to version control
- Tokens auto-refresh before expiration
- Google OAuth apps in "Testing" status have refresh tokens that expire after 7 days

## TOON Format

TOON (Token-Oriented Object Notation) is a token-efficient encoding format designed for LLM consumption. When enabled, structured responses use TOON instead of JSON, reducing token usage by 20-50%.

### Enabling TOON

```bash
GOOGLE_WORKSPACE_TOON_FORMAT=true
```

### How It Works

TOON eliminates repeated field names in arrays. Instead of:

```json
{
  "files": [
    { "id": "abc", "name": "doc.txt", "size": 1024 },
    { "id": "def", "name": "notes.md", "size": 2048 }
  ]
}
```

TOON encodes as:

```
files[2]{id,name,size}:
  abc,doc.txt,1024
  def,notes.md,2048
```

### Expected Savings

| Data Pattern                              | Token Savings |
| ----------------------------------------- | ------------- |
| Uniform arrays (10+ items, scalar fields) | 40-55%        |
| Nested objects with uniform sub-arrays    | 25-35%        |
| Deeply nested objects                     | 20-30%        |
| Single items                              | 5-15%         |

### Best Use Cases

- `list_calendars`, `search` (Drive) - uniform arrays with many fields
- `list_events`, `search_emails` - mixed structures with nested arrays
- `list_labels`, `list_filters` - large collections

### Fallback Behavior

If TOON encoding fails for any reason, responses automatically fall back to JSON formatting.
