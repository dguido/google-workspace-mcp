# Google Workspace MCP Server

MCP server providing Claude access to Google Drive, Docs, Sheets, Slides, Calendar, Gmail, and Contacts.

## Quick Start

### Prerequisites

- **Node.js** 22+ (LTS recommended)
- **Google Cloud Project** with Drive, Docs, Sheets, Slides, Calendar, Gmail, and People APIs enabled
- **OAuth 2.0 Credentials** (Desktop application type)

### 1. Set Up Google Cloud

See [Google Cloud Setup](#google-cloud-setup) below for detailed instructions.

### 2. Authenticate

```bash
npx @dguido/google-workspace-mcp auth
```

This opens your browser for Google OAuth consent. Tokens are saved to `~/.config/google-workspace-mcp/tokens.json`.

### 3. Configure Claude Desktop

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["@dguido/google-workspace-mcp"],
      "env": {
        "GOOGLE_DRIVE_OAUTH_CREDENTIALS": "/path/to/your/gcp-oauth.keys.json",
        "GOOGLE_WORKSPACE_SERVICES": "drive,gmail,calendar"
      }
    }
  }
}
```

## What You Can Do

```
Create a Google Doc called "Project Plan" in /Work/Projects with an outline for Q1.
```

```
Search for files containing "budget" and organize them into the Finance folder.
```

```
Create a presentation called "Product Roadmap" with slides for Q1 milestones.
```

## Google Cloud Setup

### 1. Create a Google Cloud Project

- Go to the [Google Cloud Console](https://console.cloud.google.com)
- Click "Select a project" > "New Project"
- Name your project (e.g., "Google Drive MCP")

### 2. Enable Required APIs

- Go to "APIs & Services" > "Library"
- Enable: **Google Drive API**, **Google Docs API**, **Google Sheets API**, **Google Slides API**, **Google Calendar API**, **Gmail API**, **People API**

### 3. Configure OAuth Consent Screen

- Go to "APIs & Services" > "OAuth consent screen"
- Fill in app name, support email, and developer contact
- Choose "External" (or "Internal" for Workspace)
- Add your email as a test user
- Add scopes: `drive.file`, `documents`, `spreadsheets`, `presentations`, `drive`, `drive.readonly`, `calendar`, `gmail.modify`, `gmail.labels`, `contacts`

### 4. Create OAuth 2.0 Credentials

- Go to "APIs & Services" > "Credentials"
- Click "+ CREATE CREDENTIALS" > "OAuth client ID"
- Application type: **Desktop app**
- Download the JSON file and rename to `gcp-oauth.keys.json`

## Configuration

| Method                            | Description                                       |
| --------------------------------- | ------------------------------------------------- |
| `GOOGLE_DRIVE_OAUTH_CREDENTIALS`  | Environment variable pointing to credentials file |
| `gcp-oauth.keys.json`             | Default file in project root                      |
| `GOOGLE_WORKSPACE_MCP_TOKEN_PATH` | Custom token storage location                     |
| `GOOGLE_WORKSPACE_SERVICES`       | Comma-separated list of services to enable        |

Tokens are stored at `~/.config/google-workspace-mcp/tokens.json` by default.

### Token-Efficient Output (TOON)

For LLM-optimized responses that reduce token usage by 20-50%, enable TOON format:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["@dguido/google-workspace-mcp"],
      "env": {
        "GOOGLE_DRIVE_OAUTH_CREDENTIALS": "/path/to/gcp-oauth.keys.json",
        "GOOGLE_WORKSPACE_SERVICES": "drive,gmail,calendar",
        "GOOGLE_WORKSPACE_TOON_FORMAT": "true"
      }
    }
  }
}
```

TOON (Token-Oriented Object Notation) encodes structured responses more compactly than JSON by eliminating repeated field names. Savings are highest for list operations (calendars, events, emails, filters).

### Service Configuration

By default, we recommend enabling only the core services (`drive,gmail,calendar`) as shown in Quick Start. This provides file management, email, and calendar capabilities without the complexity of document editing tools.

To enable additional services, add them to `GOOGLE_WORKSPACE_SERVICES`:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["@dguido/google-workspace-mcp"],
      "env": {
        "GOOGLE_DRIVE_OAUTH_CREDENTIALS": "/path/to/gcp-oauth.keys.json",
        "GOOGLE_WORKSPACE_SERVICES": "drive,gmail,calendar,docs,sheets,slides"
      }
    }
  }
}
```

**Available services:** `drive`, `docs`, `sheets`, `slides`, `calendar`, `gmail`, `contacts`

- Omit `GOOGLE_WORKSPACE_SERVICES` entirely to enable all services
- Unified tools (`create_file`, `update_file`, `get_file_content`) require `drive`, `docs`, `sheets`, and `slides`

See [Advanced Configuration](docs/ADVANCED.md) for multi-account setup and environment variables.

## Available Tools

### Drive (29 tools)

`search` `listFolder` `createFolder` `createTextFile` `updateTextFile` `deleteItem` `renameItem` `moveItem` `copyFile` `getFileMetadata` `exportFile` `shareFile` `getSharing` `removePermission` `listRevisions` `restoreRevision` `downloadFile` `uploadFile` `getStorageQuota` `starFile` `resolveFilePath` `batchDelete` `batchRestore` `batchMove` `batchShare` `listTrash` `restoreFromTrash` `emptyTrash` `getFolderTree`

### Google Docs (8 tools)

`createGoogleDoc` `updateGoogleDoc` `getGoogleDocContent` `appendToDoc` `insertTextInDoc` `deleteTextInDoc` `replaceTextInDoc` `formatGoogleDocRange`

### Google Sheets (7 tools)

`createGoogleSheet` `updateGoogleSheet` `getGoogleSheetContent` `formatGoogleSheetCells` `mergeGoogleSheetCells` `addGoogleSheetConditionalFormat` `sheetTabs`

### Google Slides (10 tools)

`createGoogleSlides` `updateGoogleSlides` `getGoogleSlidesContent` `formatSlidesText` `formatSlidesShape` `formatSlideBackground` `createGoogleSlidesTextBox` `createGoogleSlidesShape` `slidesSpeakerNotes` `listSlidePages`

### Calendar (7 tools)

`listCalendars` `listEvents` `getEvent` `createEvent` `updateEvent` `deleteEvent` `findFreeTime`

### Gmail (14 tools)

`sendEmail` `draftEmail` `readEmail` `searchEmails` `deleteEmail` `modifyEmail` `downloadAttachment` `listLabels` `getOrCreateLabel` `updateLabel` `deleteLabel` `createFilter` `listFilters` `deleteFilter`

### Contacts (6 tools)

`listContacts` `getContact` `searchContacts` `createContact` `updateContact` `deleteContact`

### Unified (3 tools)

`createFile` `updateFile` `getFileContent`

[Full API Reference](docs/API.md)

## Troubleshooting

### "OAuth credentials not found"

Set `GOOGLE_DRIVE_OAUTH_CREDENTIALS` environment variable or place `gcp-oauth.keys.json` in project root.

### "Authentication failed" or browser doesn't open

Ensure credential type is "Desktop app" (not "Web application") and ports 3000-3004 are available.

### "Tokens expired" or "Invalid grant"

Apps in "Testing" status expire tokens after 7 days. Re-authenticate:

```bash
rm ~/.config/google-workspace-mcp/tokens.json
npx @dguido/google-workspace-mcp auth
```

### "API not enabled"

Enable the missing API in [Google Cloud Console](https://console.cloud.google.com) > APIs & Services > Library.

### "Login Required" even with valid tokens

Revoke app access at [Google Account Permissions](https://myaccount.google.com/permissions), clear tokens, and re-authenticate.

[Full Troubleshooting Guide](docs/TROUBLESHOOTING.md)

## Security

- OAuth 2.0 with automatic token refresh
- Tokens stored with 0600 permissions
- All processing happens locally
- Never commit `gcp-oauth.keys.json` or tokens to version control

## Development

```bash
npm install
npm run build    # Compile TypeScript
npm run check    # typecheck + lint + format check
npm test         # Run tests
```

See [Contributing Guide](CONTRIBUTING.md) for project structure and development workflow.

## Links

- [GitHub Repository](https://github.com/dguido/google-workspace-mcp)
- [Issue Tracker](https://github.com/dguido/google-workspace-mcp/issues)
- [Model Context Protocol](https://modelcontextprotocol.io)

## Origin

This project is a substantial rewrite of [piotr-agier/google-drive-mcp](https://github.com/piotr-agier/google-drive-mcp), originally created by Piotr Agier.

## License

MIT - See LICENSE file for details.
