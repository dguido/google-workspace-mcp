# Google Workspace MCP Server

MCP server providing Claude access to Google Drive, Docs, Sheets, Slides, Calendar, Gmail, and Contacts.

## Quick Start

### 1. Set Up Google Cloud

1. Go to the [Google Cloud Console](https://console.cloud.google.com) and create or select a project
2. [Enable all required APIs](https://console.cloud.google.com/flows/enableapi?apiid=drive.googleapis.com,docs.googleapis.com,sheets.googleapis.com,slides.googleapis.com,calendar-json.googleapis.com,gmail.googleapis.com,people.googleapis.com) (one-click link)
3. Go to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials) and create an OAuth 2.0 Client ID (Desktop app type)
4. Copy the **Client ID** and **Client Secret**

### 2. Configure Claude Desktop

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["@dguido/google-workspace-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "YOUR_CLIENT_ID.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "YOUR_CLIENT_SECRET",
        "GOOGLE_WORKSPACE_SERVICES": "drive,gmail,calendar"
      }
    }
  }
}
```

That's it. On first tool call, a browser window opens for Google OAuth consent. Tokens are saved automatically.

<details>
<summary>Alternative: file-based credentials</summary>

Download the credentials JSON from Google Cloud Console and save to `~/.config/google-workspace-mcp/credentials.json`, then authenticate manually:

```bash
npx @dguido/google-workspace-mcp auth
```

See [Advanced Configuration](docs/ADVANCED.md) for file-based setup, named profiles, and multi-account setup.

</details>

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

- [Enable all APIs at once](https://console.cloud.google.com/flows/enableapi?apiid=drive.googleapis.com,docs.googleapis.com,sheets.googleapis.com,slides.googleapis.com,calendar-json.googleapis.com,gmail.googleapis.com,people.googleapis.com) (one-click link)
- Or manually: Go to "APIs & Services" > "Library" and enable: **Google Drive API**, **Google Docs API**, **Google Sheets API**, **Google Slides API**, **Google Calendar API**, **Gmail API**, **People API**

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
- Copy the **Client ID** and **Client Secret** (or download the JSON file)

## Configuration

### File Locations

Both credentials and tokens are stored in `~/.config/google-workspace-mcp/` by default:

| File              | Default Path                                      |
| ----------------- | ------------------------------------------------- |
| OAuth credentials | `~/.config/google-workspace-mcp/credentials.json` |
| Auth tokens       | `~/.config/google-workspace-mcp/tokens.json`      |

### Environment Variables

| Variable                          | Description                                                   |
| --------------------------------- | ------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`                | OAuth Client ID (simplest setup — no credentials file needed) |
| `GOOGLE_CLIENT_SECRET`            | OAuth Client Secret (used with `GOOGLE_CLIENT_ID`)            |
| `GOOGLE_WORKSPACE_MCP_TOKEN_PATH` | Custom token storage location                                 |
| `GOOGLE_WORKSPACE_MCP_PROFILE`    | Named profile for credential isolation                        |
| `GOOGLE_WORKSPACE_SERVICES`       | Comma-separated list of services to enable                    |

### Token-Efficient Output (TOON)

For LLM-optimized responses that reduce token usage by 20-50%, enable TOON format:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["@dguido/google-workspace-mcp"],
      "env": {
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
        "GOOGLE_WORKSPACE_SERVICES": "drive,gmail,calendar,docs,sheets,slides"
      }
    }
  }
}
```

**Available services:** `drive`, `docs`, `sheets`, `slides`, `calendar`, `gmail`, `contacts`

- Omit `GOOGLE_WORKSPACE_SERVICES` entirely to enable all services
- Unified tools (`create_file`, `update_file`, `get_file_content`) require `drive`, `docs`, `sheets`, and `slides`
- When you limit services, only the OAuth scopes for those services are requested during authentication. If you change enabled services, re-authenticate to update granted scopes.

See [Advanced Configuration](docs/ADVANCED.md) for named profiles, multi-account setup, and environment variables.

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

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars in your MCP config, or save your credentials file to `~/.config/google-workspace-mcp/credentials.json`.

### "Authentication failed" or browser doesn't open

Ensure credential type is "Desktop app" (not "Web application"). The server uses an ephemeral port assigned by the OS, so no specific ports need to be available.

### "Tokens expired" or "Invalid grant"

Apps in "Testing" status expire tokens after 7 days. Re-authenticate:

```bash
rm ~/.config/google-workspace-mcp/tokens.json
npx @dguido/google-workspace-mcp auth
```

**To avoid weekly re-authentication:** Publish your OAuth app (see [Avoiding Token Expiry](#avoiding-token-expiry) below).

### "API not enabled"

Enable the missing API in [Google Cloud Console](https://console.cloud.google.com) > APIs & Services > Library.

### "Login Required" even with valid tokens

Revoke app access at [Google Account Permissions](https://myaccount.google.com/permissions), clear tokens, and re-authenticate.

[Full Troubleshooting Guide](docs/TROUBLESHOOTING.md)

## Security

- RFC 8252-compliant OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- Loopback-only authentication server (127.0.0.1)
- State parameter for CSRF protection
- Automatic token refresh
- Tokens stored with 0600 permissions
- All processing happens locally
- Never commit credentials or tokens to version control

## Avoiding Token Expiry

OAuth apps in "Testing" status automatically expire tokens after 7 days. To avoid weekly re-authentication:

### Option 1: Publish Your OAuth App (Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com) > APIs & Services > OAuth consent screen
2. Click "PUBLISH APP"
3. For personal use, you don't need to complete Google's verification process
4. Published apps keep tokens valid until explicitly revoked

**Note:** Publishing makes your app available to any Google user, but since you control the OAuth credentials, only you can authenticate.

### Option 2: Use Internal App (Workspace Only)

If you have a Google Workspace account:

1. Set User Type to "Internal" on the OAuth consent screen
2. Internal apps don't expire tokens and don't require publishing

### Monitoring Token Age

Use `get_status` to check token age. Tokens older than 6 days show a warning automatically.

## Development

```bash
npm install
npm run build    # Compile TypeScript
npm run check    # typecheck + lint + format check
npm test         # Run tests
```

See [Contributing Guide](CONTRIBUTING.md) for project structure and development workflow.

## Origin

This project is a substantial rewrite of [piotr-agier/google-drive-mcp](https://github.com/piotr-agier/google-drive-mcp), originally created by Piotr Agier.

## License

MIT - See LICENSE file for details.
