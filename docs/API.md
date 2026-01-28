# API Reference

Complete reference for all Google Workspace MCP tools (85 total across 8 services).

## Discovery

### list_tools

List available tools, optionally filtered by service or keyword.

| Parameter        | Type    | Required | Description                                                                        |
| ---------------- | ------- | -------- | ---------------------------------------------------------------------------------- |
| `service`        | string  | No       | Filter by service: drive, docs, sheets, slides, calendar, gmail, contacts, unified |
| `keyword`        | string  | No       | Filter by keyword in tool name or description                                      |
| `includeSchemas` | boolean | No       | Include full input/output schemas (default: false)                                 |

## Drive (29 tools)

### search

Search files and folders in Drive.

| Parameter    | Type   | Required | Description                                                                                                    |
| ------------ | ------ | -------- | -------------------------------------------------------------------------------------------------------------- |
| `query`      | string | Yes      | Search query                                                                                                   |
| `searchType` | string | No       | Search type: `fulltext` (default, searches content), `name` (filename contains), `name_exact` (exact filename) |
| `pageSize`   | number | No       | Results per page (default: 50, max: 100)                                                                       |
| `pageToken`  | string | No       | Token for next page                                                                                            |

### list_folder

List folder contents.

| Parameter   | Type   | Required | Description                            |
| ----------- | ------ | -------- | -------------------------------------- |
| `folderId`  | string | No       | Folder ID (defaults to root)           |
| `pageSize`  | number | No       | Items per page (default: 50, max: 100) |
| `pageToken` | string | No       | Token for next page                    |

### create_text_file

Create a text or markdown file.

| Parameter        | Type   | Required | Description                                                               |
| ---------------- | ------ | -------- | ------------------------------------------------------------------------- |
| `name`           | string | Yes      | File name (.txt or .md)                                                   |
| `content`        | string | Yes      | File content                                                              |
| `parentFolderId` | string | No       | Parent folder ID (mutually exclusive with parentPath)                     |
| `parentPath`     | string | No       | Parent folder path like '/Documents/Projects' (creates folders if needed) |

### update_text_file

Update content of a text or markdown file.

| Parameter | Type   | Required | Description                     |
| --------- | ------ | -------- | ------------------------------- |
| `fileId`  | string | Yes      | File ID to update               |
| `content` | string | Yes      | New file content                |
| `name`    | string | No       | Optional new name (.txt or .md) |

### create_folder

Create a new folder.

| Parameter    | Type   | Required | Description                                           |
| ------------ | ------ | -------- | ----------------------------------------------------- |
| `name`       | string | Yes      | Folder name                                           |
| `parent`     | string | No       | Parent folder ID (mutually exclusive with parentPath) |
| `parentPath` | string | No       | Parent folder path (creates folders if needed)        |

### delete_item

Move item to trash.

| Parameter | Type   | Required | Description              |
| --------- | ------ | -------- | ------------------------ |
| `itemId`  | string | Yes      | Item ID to move to trash |

### rename_item

Rename a file or folder.

| Parameter | Type   | Required | Description       |
| --------- | ------ | -------- | ----------------- |
| `itemId`  | string | Yes      | Item ID to rename |
| `newName` | string | Yes      | New name          |

### move_item

Move item to a new folder.

| Parameter             | Type   | Required | Description                                                     |
| --------------------- | ------ | -------- | --------------------------------------------------------------- |
| `itemId`              | string | Yes      | Item ID to move                                                 |
| `destinationFolderId` | string | No       | Destination folder ID (mutually exclusive with destinationPath) |
| `destinationPath`     | string | No       | Destination folder path (creates folders if needed)             |

### copy_file

Copy a file with optional new name.

| Parameter             | Type   | Required | Description                                          |
| --------------------- | ------ | -------- | ---------------------------------------------------- |
| `sourceFileId`        | string | Yes      | File ID to copy                                      |
| `destinationName`     | string | No       | Name for the copy (defaults to 'Copy of <original>') |
| `destinationFolderId` | string | No       | Destination folder ID (defaults to same folder)      |

### get_file_metadata

Get file or folder metadata.

| Parameter | Type   | Required | Description       |
| --------- | ------ | -------- | ----------------- |
| `fileId`  | string | Yes      | File or folder ID |

### export_file

Export Workspace files to other formats.

| Parameter    | Type   | Required | Description                                                   |
| ------------ | ------ | -------- | ------------------------------------------------------------- |
| `fileId`     | string | Yes      | Google Doc, Sheet, or Slides ID                               |
| `format`     | string | Yes      | Export format: pdf, docx, xlsx, pptx, csv, tsv, odt, ods, odp |
| `outputPath` | string | No       | Directory to save file (returns base64 if not provided)       |

### share_file

Share a file with a user, group, domain, or make public.

| Parameter               | Type    | Required | Description                                           |
| ----------------------- | ------- | -------- | ----------------------------------------------------- |
| `fileId`                | string  | Yes      | File ID to share                                      |
| `role`                  | string  | Yes      | Permission role: reader, commenter, writer, organizer |
| `type`                  | string  | Yes      | Permission type: user, group, domain, anyone          |
| `emailAddress`          | string  | No       | Email (required for user/group)                       |
| `domain`                | string  | No       | Domain (required for domain type)                     |
| `sendNotificationEmail` | boolean | No       | Send notification email (default: true)               |
| `emailMessage`          | string  | No       | Custom notification message                           |

### get_sharing

Get sharing settings and permissions for a file.

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `fileId`  | string | Yes      | File ID     |

### remove_permission

Remove sharing permission from a file.

| Parameter      | Type   | Required | Description                                           |
| -------------- | ------ | -------- | ----------------------------------------------------- |
| `fileId`       | string | Yes      | File ID                                               |
| `permissionId` | string | No       | Permission ID (from get_sharing)                      |
| `email`        | string | No       | Email address to remove (alternative to permissionId) |

### list_revisions

List file version history.

| Parameter  | Type   | Required | Description                             |
| ---------- | ------ | -------- | --------------------------------------- |
| `fileId`   | string | Yes      | File ID                                 |
| `pageSize` | number | No       | Max revisions (default: 100, max: 1000) |

### restore_revision

Restore file to previous revision.

| Parameter    | Type   | Required | Description            |
| ------------ | ------ | -------- | ---------------------- |
| `fileId`     | string | Yes      | File ID                |
| `revisionId` | string | Yes      | Revision ID to restore |

### download_file

Download a file as base64 or to disk.

| Parameter    | Type   | Required | Description                                             |
| ------------ | ------ | -------- | ------------------------------------------------------- |
| `fileId`     | string | Yes      | File ID                                                 |
| `outputPath` | string | No       | Directory to save file (returns base64 if not provided) |

### upload_file

Upload file from disk or base64.

| Parameter       | Type   | Required | Description                                                |
| --------------- | ------ | -------- | ---------------------------------------------------------- |
| `name`          | string | Yes      | File name with extension                                   |
| `sourcePath`    | string | No       | Path to source file                                        |
| `base64Content` | string | No       | Base64-encoded content                                     |
| `mimeType`      | string | No       | MIME type (auto-detected if omitted)                       |
| `folderId`      | string | No       | Destination folder ID (mutually exclusive with folderPath) |
| `folderPath`    | string | No       | Destination folder path (creates folders if needed)        |

### get_storage_quota

Get Google Drive storage quota and usage.

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| (none)    |      |          |             |

### star_file

Star or unstar a file.

| Parameter | Type    | Required | Description                   |
| --------- | ------- | -------- | ----------------------------- |
| `fileId`  | string  | Yes      | File ID                       |
| `starred` | boolean | Yes      | true to star, false to unstar |

### resolve_file_path

Resolve file path to ID.

| Parameter | Type   | Required | Description                                        |
| --------- | ------ | -------- | -------------------------------------------------- |
| `path`    | string | Yes      | File path (e.g., 'Documents/Projects/Budget.xlsx') |
| `type`    | string | No       | Type: file, folder, or any (default)               |

### batch_delete

Batch move files to trash (max 100 per batch).

| Parameter | Type  | Required | Description                 |
| --------- | ----- | -------- | --------------------------- |
| `fileIds` | array | Yes      | Array of file IDs (max 100) |

### batch_restore

Batch restore files from trash (max 100 per batch).

| Parameter | Type  | Required | Description                 |
| --------- | ----- | -------- | --------------------------- |
| `fileIds` | array | Yes      | Array of file IDs (max 100) |

### batch_move

Batch move files to folder (max 100 per batch).

| Parameter             | Type   | Required | Description                                                     |
| --------------------- | ------ | -------- | --------------------------------------------------------------- |
| `fileIds`             | array  | Yes      | Array of file IDs (max 100)                                     |
| `destinationFolderId` | string | No       | Destination folder ID (mutually exclusive with destinationPath) |
| `destinationPath`     | string | No       | Destination folder path (creates folders if needed)             |

### batch_share

Batch share files with a user (max 100 per batch).

| Parameter          | Type    | Required | Description                                |
| ------------------ | ------- | -------- | ------------------------------------------ |
| `fileIds`          | array   | Yes      | Array of file IDs (max 100)                |
| `email`            | string  | Yes      | Email address to share with                |
| `role`             | string  | Yes      | Permission role: reader, writer, commenter |
| `sendNotification` | boolean | No       | Send email notification (default: true)    |

### list_trash

List files in trash.

| Parameter   | Type   | Required | Description                            |
| ----------- | ------ | -------- | -------------------------------------- |
| `pageSize`  | number | No       | Items per page (default: 50, max: 100) |
| `pageToken` | string | No       | Token for next page                    |

### restore_from_trash

Restore a file from trash.

| Parameter             | Type   | Required | Description                                                  |
| --------------------- | ------ | -------- | ------------------------------------------------------------ |
| `fileId`              | string | Yes      | File ID to restore                                           |
| `destinationFolderId` | string | No       | Destination folder ID (restores to original if not provided) |
| `destinationPath`     | string | No       | Destination folder path                                      |

### empty_trash

Permanently delete all files in trash.

| Parameter | Type    | Required | Description                                          |
| --------- | ------- | -------- | ---------------------------------------------------- |
| `confirm` | boolean | Yes      | Must be true to confirm                              |
| `driveId` | string  | No       | Shared drive ID (empties that drive's trash instead) |

### get_folder_tree

Get folder tree structure (max depth 5).

| Parameter    | Type   | Required | Description                                                      |
| ------------ | ------ | -------- | ---------------------------------------------------------------- |
| `folderId`   | string | No       | Folder ID (defaults to root, mutually exclusive with folderPath) |
| `folderPath` | string | No       | Folder path (mutually exclusive with folderId)                   |
| `depth`      | number | No       | Max depth 1-5 (default: 2)                                       |

## Docs (8 tools)

### create_google_doc

Create a new Google Doc.

| Parameter        | Type   | Required | Description                                           |
| ---------------- | ------ | -------- | ----------------------------------------------------- |
| `name`           | string | Yes      | Document name                                         |
| `content`        | string | Yes      | Document content                                      |
| `parentFolderId` | string | No       | Parent folder ID (mutually exclusive with parentPath) |
| `parentPath`     | string | No       | Parent folder path (creates folders if needed)        |

### update_google_doc

Replace content in a Google Doc.

| Parameter    | Type   | Required | Description |
| ------------ | ------ | -------- | ----------- |
| `documentId` | string | Yes      | Document ID |
| `content`    | string | Yes      | New content |

### get_google_doc_content

Read content from a Google Doc with text indices.

| Parameter    | Type   | Required | Description |
| ------------ | ------ | -------- | ----------- |
| `documentId` | string | Yes      | Document ID |

### append_to_doc

Append text to the end of a Google Doc.

| Parameter       | Type    | Required | Description                                |
| --------------- | ------- | -------- | ------------------------------------------ |
| `documentId`    | string  | Yes      | Document ID                                |
| `text`          | string  | Yes      | Text to append                             |
| `insertNewline` | boolean | No       | Insert newline before text (default: true) |

### insert_text_in_doc

Insert text at a position in a Doc.

| Parameter    | Type   | Required | Description                                                               |
| ------------ | ------ | -------- | ------------------------------------------------------------------------- |
| `documentId` | string | Yes      | Document ID                                                               |
| `text`       | string | Yes      | Text to insert                                                            |
| `index`      | number | Yes      | Character index (1 = beginning). Get indices from get_google_doc_content. |

### delete_text_in_doc

Delete text range from a Google Doc.

| Parameter    | Type   | Required | Description                      |
| ------------ | ------ | -------- | -------------------------------- |
| `documentId` | string | Yes      | Document ID                      |
| `startIndex` | number | Yes      | Start index (inclusive, 1-based) |
| `endIndex`   | number | Yes      | End index (exclusive, 1-based)   |

### replace_text_in_doc

Find and replace text in a Doc.

| Parameter     | Type    | Required | Description                               |
| ------------- | ------- | -------- | ----------------------------------------- |
| `documentId`  | string  | Yes      | Document ID                               |
| `searchText`  | string  | Yes      | Text to search for                        |
| `replaceText` | string  | Yes      | Replacement text (empty string to delete) |
| `matchCase`   | boolean | No       | Match case (default: true)                |

### format_google_doc_range

Format text and paragraphs in a Doc.

| Parameter         | Type    | Required | Description                                               |
| ----------------- | ------- | -------- | --------------------------------------------------------- |
| `documentId`      | string  | Yes      | Document ID                                               |
| `startIndex`      | number  | No       | Start index (1-based, defaults to start)                  |
| `endIndex`        | number  | No       | End index (1-based, defaults to end)                      |
| `bold`            | boolean | No       | Make text bold                                            |
| `italic`          | boolean | No       | Make text italic                                          |
| `underline`       | boolean | No       | Underline text                                            |
| `strikethrough`   | boolean | No       | Strikethrough text                                        |
| `fontSize`        | number  | No       | Font size in points                                       |
| `fontFamily`      | string  | No       | Font family name                                          |
| `foregroundColor` | object  | No       | Text color RGB (values 0-1)                               |
| `alignment`       | string  | No       | START, CENTER, END, JUSTIFIED                             |
| `lineSpacing`     | number  | No       | Line spacing multiplier                                   |
| `spaceAbove`      | number  | No       | Space above paragraph in points                           |
| `spaceBelow`      | number  | No       | Space below paragraph in points                           |
| `namedStyleType`  | string  | No       | NORMAL_TEXT, TITLE, SUBTITLE, HEADING_1 through HEADING_6 |

## Sheets (7 tools)

### create_google_sheet

Create a new Google Sheet.

| Parameter          | Type   | Required | Description                                                                           |
| ------------------ | ------ | -------- | ------------------------------------------------------------------------------------- |
| `name`             | string | Yes      | Spreadsheet name                                                                      |
| `data`             | array  | Yes      | 2D array of cell values                                                               |
| `parentFolderId`   | string | No       | Parent folder ID (mutually exclusive with parentPath)                                 |
| `parentPath`       | string | No       | Parent folder path (creates folders if needed)                                        |
| `valueInputOption` | string | No       | RAW (default, safe) or USER_ENTERED (evaluates formulas - use only with trusted data) |

### update_google_sheet

Update a Google Sheet range.

| Parameter          | Type   | Required | Description                   |
| ------------------ | ------ | -------- | ----------------------------- |
| `spreadsheetId`    | string | Yes      | Spreadsheet ID                |
| `range`            | string | Yes      | Range (e.g., 'Sheet1!A1:C10') |
| `data`             | array  | Yes      | 2D array of values            |
| `valueInputOption` | string | No       | RAW (default) or USER_ENTERED |

### get_google_sheet_content

Read content from a Google Sheet.

| Parameter       | Type   | Required | Description                                                  |
| --------------- | ------ | -------- | ------------------------------------------------------------ |
| `spreadsheetId` | string | Yes      | Spreadsheet ID                                               |
| `range`         | string | No       | Range in A1 notation (defaults to all data from first sheet) |

### format_google_sheet_cells

Format cells in a Google Sheet (unified formatting).

| Parameter             | Type    | Required | Description                                                                                        |
| --------------------- | ------- | -------- | -------------------------------------------------------------------------------------------------- |
| `spreadsheetId`       | string  | Yes      | Spreadsheet ID                                                                                     |
| `range`               | string  | Yes      | Range to format (e.g., 'A1:C10')                                                                   |
| `backgroundColor`     | object  | No       | Background color RGB (values 0-1)                                                                  |
| `horizontalAlignment` | string  | No       | LEFT, CENTER, RIGHT                                                                                |
| `verticalAlignment`   | string  | No       | TOP, MIDDLE, BOTTOM                                                                                |
| `wrapStrategy`        | string  | No       | OVERFLOW_CELL, CLIP, WRAP                                                                          |
| `bold`                | boolean | No       | Make text bold                                                                                     |
| `italic`              | boolean | No       | Make text italic                                                                                   |
| `strikethrough`       | boolean | No       | Strikethrough text                                                                                 |
| `underline`           | boolean | No       | Underline text                                                                                     |
| `fontSize`            | number  | No       | Font size in points                                                                                |
| `fontFamily`          | string  | No       | Font family name                                                                                   |
| `foregroundColor`     | object  | No       | Text color RGB (values 0-1)                                                                        |
| `numberFormat`        | object  | No       | Number format: { pattern, type }                                                                   |
| `borders`             | object  | No       | Border settings: { style, width, color, top, bottom, left, right, innerHorizontal, innerVertical } |

### merge_google_sheet_cells

Merge cells in a range.

| Parameter       | Type   | Required | Description                          |
| --------------- | ------ | -------- | ------------------------------------ |
| `spreadsheetId` | string | Yes      | Spreadsheet ID                       |
| `range`         | string | Yes      | Range to merge (e.g., 'A1:C3')       |
| `mergeType`     | string | Yes      | MERGE_ALL, MERGE_COLUMNS, MERGE_ROWS |

### add_google_sheet_conditional_format

Add conditional formatting rules.

| Parameter       | Type   | Required | Description                                                                                                           |
| --------------- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `spreadsheetId` | string | Yes      | Spreadsheet ID                                                                                                        |
| `range`         | string | Yes      | Range to apply formatting                                                                                             |
| `condition`     | object | Yes      | { type, value } - Types: NUMBER_GREATER, NUMBER_LESS, TEXT_CONTAINS, TEXT_STARTS_WITH, TEXT_ENDS_WITH, CUSTOM_FORMULA |
| `format`        | object | Yes      | { backgroundColor, textFormat } to apply when condition is true                                                       |

### sheet_tabs

Manage tabs in a spreadsheet: list, create, delete, or rename.

| Parameter       | Type   | Required | Description                            |
| --------------- | ------ | -------- | -------------------------------------- |
| `spreadsheetId` | string | Yes      | Spreadsheet ID                         |
| `action`        | string | Yes      | list, create, delete, or rename        |
| `title`         | string | No       | Tab title (required for create/delete) |
| `index`         | number | No       | Position for new tab (create only)     |
| `currentTitle`  | string | No       | Current title (required for rename)    |
| `newTitle`      | string | No       | New title (required for rename)        |

## Slides (10 tools)

### create_google_slides

Create a new Google Slides presentation.

| Parameter        | Type   | Required | Description                                           |
| ---------------- | ------ | -------- | ----------------------------------------------------- |
| `name`           | string | Yes      | Presentation name                                     |
| `slides`         | array  | Yes      | Array of { title, content } objects                   |
| `parentFolderId` | string | No       | Parent folder ID (mutually exclusive with parentPath) |
| `parentPath`     | string | No       | Parent folder path (creates folders if needed)        |

### update_google_slides

Update a Google Slides presentation (replaces all slides).

| Parameter        | Type   | Required | Description                         |
| ---------------- | ------ | -------- | ----------------------------------- |
| `presentationId` | string | Yes      | Presentation ID                     |
| `slides`         | array  | Yes      | Array of { title, content } objects |

### get_google_slides_content

Read content from Google Slides with element IDs.

| Parameter        | Type   | Required | Description          |
| ---------------- | ------ | -------- | -------------------- |
| `presentationId` | string | Yes      | Presentation ID      |
| `slideIndex`     | number | No       | Specific slide index |

### format_slides_text

Format text styling in Google Slides.

| Parameter         | Type    | Required | Description                                        |
| ----------------- | ------- | -------- | -------------------------------------------------- |
| `presentationId`  | string  | Yes      | Presentation ID                                    |
| `objectId`        | string  | Yes      | Text element object ID                             |
| `startIndex`      | number  | No       | Start index (0-based)                              |
| `endIndex`        | number  | No       | End index (0-based)                                |
| `bold`            | boolean | No       | Make text bold                                     |
| `italic`          | boolean | No       | Make text italic                                   |
| `underline`       | boolean | No       | Underline text                                     |
| `strikethrough`   | boolean | No       | Strikethrough text                                 |
| `fontSize`        | number  | No       | Font size in points                                |
| `fontFamily`      | string  | No       | Font family name                                   |
| `foregroundColor` | object  | No       | Text color RGB (values 0-1)                        |
| `alignment`       | string  | No       | START, CENTER, END, JUSTIFIED                      |
| `lineSpacing`     | number  | No       | Line spacing multiplier                            |
| `bulletStyle`     | string  | No       | NONE, DISC, ARROW, SQUARE, DIAMOND, STAR, NUMBERED |

### format_slides_shape

Format shape fill and outline in Google Slides.

| Parameter          | Type   | Required | Description                                          |
| ------------------ | ------ | -------- | ---------------------------------------------------- |
| `presentationId`   | string | Yes      | Presentation ID                                      |
| `objectId`         | string | Yes      | Shape object ID                                      |
| `backgroundColor`  | object | No       | Fill color RGBA (values 0-1)                         |
| `outlineColor`     | object | No       | Outline color RGB (values 0-1)                       |
| `outlineWeight`    | number | No       | Outline thickness in points                          |
| `outlineDashStyle` | string | No       | SOLID, DOT, DASH, DASH_DOT, LONG_DASH, LONG_DASH_DOT |

### format_slide_background

Set slide background color.

| Parameter         | Type   | Required | Description                        |
| ----------------- | ------ | -------- | ---------------------------------- |
| `presentationId`  | string | Yes      | Presentation ID                    |
| `pageObjectIds`   | array  | Yes      | Array of slide IDs to format       |
| `backgroundColor` | object | Yes      | Background color RGBA (values 0-1) |

### create_google_slides_text_box

Create a text box in Google Slides.

| Parameter        | Type    | Required | Description                             |
| ---------------- | ------- | -------- | --------------------------------------- |
| `presentationId` | string  | Yes      | Presentation ID                         |
| `pageObjectId`   | string  | Yes      | Slide ID                                |
| `text`           | string  | Yes      | Text content                            |
| `x`              | number  | Yes      | X position in EMU (1 inch = 914400 EMU) |
| `y`              | number  | Yes      | Y position in EMU                       |
| `width`          | number  | Yes      | Width in EMU                            |
| `height`         | number  | Yes      | Height in EMU                           |
| `fontSize`       | number  | No       | Font size in points                     |
| `bold`           | boolean | No       | Make text bold                          |
| `italic`         | boolean | No       | Make text italic                        |

### create_google_slides_shape

Create a shape in Google Slides.

| Parameter         | Type   | Required | Description                                                         |
| ----------------- | ------ | -------- | ------------------------------------------------------------------- |
| `presentationId`  | string | Yes      | Presentation ID                                                     |
| `pageObjectId`    | string | Yes      | Slide ID                                                            |
| `shapeType`       | string | Yes      | RECTANGLE, ELLIPSE, DIAMOND, TRIANGLE, STAR, ROUND_RECTANGLE, ARROW |
| `x`               | number | Yes      | X position in EMU                                                   |
| `y`               | number | Yes      | Y position in EMU                                                   |
| `width`           | number | Yes      | Width in EMU                                                        |
| `height`          | number | Yes      | Height in EMU                                                       |
| `backgroundColor` | object | No       | Fill color RGBA (values 0-1)                                        |

### slides_speaker_notes

Get or update speaker notes for a slide.

| Parameter        | Type   | Required | Description                         |
| ---------------- | ------ | -------- | ----------------------------------- |
| `presentationId` | string | Yes      | Presentation ID                     |
| `slideIndex`     | number | Yes      | Slide index (0-based)               |
| `action`         | string | Yes      | get or update                       |
| `notes`          | string | No       | Notes content (required for update) |

### list_slide_pages

List slides in a presentation.

| Parameter        | Type   | Required | Description     |
| ---------------- | ------ | -------- | --------------- |
| `presentationId` | string | Yes      | Presentation ID |

## Calendar (7 tools)

### list_calendars

List all calendars accessible to the user.

| Parameter     | Type    | Required | Description                                |
| ------------- | ------- | -------- | ------------------------------------------ |
| `showHidden`  | boolean | No       | Include hidden calendars (default: false)  |
| `showDeleted` | boolean | No       | Include deleted calendars (default: false) |

### list_events

List calendar events (max 2500 per request).

| Parameter      | Type    | Required | Description                                                 |
| -------------- | ------- | -------- | ----------------------------------------------------------- |
| `calendarId`   | string  | No       | Calendar ID (default: 'primary')                            |
| `timeMin`      | string  | No       | Start of time range (RFC3339, e.g., 2024-01-15T00:00:00Z)   |
| `timeMax`      | string  | No       | End of time range (RFC3339)                                 |
| `query`        | string  | No       | Free text search terms                                      |
| `maxResults`   | number  | No       | Maximum events (default: 250, max: 2500)                    |
| `pageToken`    | string  | No       | Pagination token                                            |
| `singleEvents` | boolean | No       | Expand recurring events (default: true)                     |
| `orderBy`      | string  | No       | startTime or updated (startTime requires singleEvents=true) |

### get_event

Get details of a calendar event.

| Parameter    | Type   | Required | Description                      |
| ------------ | ------ | -------- | -------------------------------- |
| `eventId`    | string | Yes      | Event ID                         |
| `calendarId` | string | No       | Calendar ID (default: 'primary') |

### create_event

Create a new calendar event.

| Parameter       | Type    | Required | Description                                                           |
| --------------- | ------- | -------- | --------------------------------------------------------------------- |
| `summary`       | string  | Yes      | Event title                                                           |
| `start`         | object  | Yes      | { dateTime or date, timeZone } - dateTime for timed, date for all-day |
| `end`           | object  | Yes      | { dateTime or date, timeZone }                                        |
| `calendarId`    | string  | No       | Calendar ID (default: 'primary')                                      |
| `description`   | string  | No       | Event description                                                     |
| `location`      | string  | No       | Event location                                                        |
| `attendees`     | array   | No       | Array of { email, displayName?, optional? }                           |
| `addGoogleMeet` | boolean | No       | Add Google Meet video conference (default: false)                     |
| `reminders`     | array   | No       | Custom reminders: [{ method: 'email' or 'popup', minutes }]           |
| `colorId`       | string  | No       | Event color ID (1-11)                                                 |
| `recurrence`    | array   | No       | RRULE strings for recurring events                                    |
| `sendUpdates`   | string  | No       | all, externalOnly, or none (default: all)                             |

### update_event

Update an existing calendar event.

| Parameter       | Type    | Required | Description                      |
| --------------- | ------- | -------- | -------------------------------- |
| `eventId`       | string  | Yes      | Event ID to update               |
| `calendarId`    | string  | No       | Calendar ID (default: 'primary') |
| `summary`       | string  | No       | New event title                  |
| `description`   | string  | No       | New description                  |
| `location`      | string  | No       | New location                     |
| `start`         | object  | No       | New start time                   |
| `end`           | object  | No       | New end time                     |
| `attendees`     | array   | No       | Replace attendee list            |
| `addGoogleMeet` | boolean | No       | Add Google Meet if not present   |
| `reminders`     | array   | No       | New custom reminders             |
| `colorId`       | string  | No       | New color ID (1-11)              |
| `sendUpdates`   | string  | No       | all, externalOnly, or none       |

### delete_event

Delete a calendar event.

| Parameter     | Type   | Required | Description                               |
| ------------- | ------ | -------- | ----------------------------------------- |
| `eventId`     | string | Yes      | Event ID to delete                        |
| `calendarId`  | string | No       | Calendar ID (default: 'primary')          |
| `sendUpdates` | string | No       | all, externalOnly, or none (default: all) |

### find_free_time

Find free time slots across calendars (max 50 calendars).

| Parameter     | Type   | Required | Description                           |
| ------------- | ------ | -------- | ------------------------------------- |
| `calendarIds` | array  | Yes      | Calendar IDs to check (max 50)        |
| `timeMin`     | string | Yes      | Start of search range (RFC3339)       |
| `timeMax`     | string | Yes      | End of search range (RFC3339)         |
| `duration`    | number | Yes      | Minimum free slot duration in minutes |
| `timeZone`    | string | No       | Timezone for results (default: UTC)   |

## Gmail (14 tools)

### send_email

Send an email.

| Parameter     | Type   | Required | Description                                        |
| ------------- | ------ | -------- | -------------------------------------------------- |
| `to`          | array  | Yes      | Recipient email addresses                          |
| `subject`     | string | Yes      | Email subject                                      |
| `body`        | string | Yes      | Plain text email body                              |
| `html`        | string | No       | HTML email body                                    |
| `cc`          | array  | No       | CC recipients                                      |
| `bcc`         | array  | No       | BCC recipients                                     |
| `replyTo`     | string | No       | Reply-to address                                   |
| `attachments` | array  | No       | Array of { filename, content (base64), mimeType? } |
| `threadId`    | string | No       | Thread ID to reply to                              |
| `inReplyTo`   | string | No       | Message-ID for threading                           |

### draft_email

Create a draft email (can be completed later).

| Parameter     | Type   | Required | Description      |
| ------------- | ------ | -------- | ---------------- |
| `to`          | array  | No       | Recipients       |
| `subject`     | string | No       | Subject          |
| `body`        | string | No       | Plain text body  |
| `html`        | string | No       | HTML body        |
| `cc`          | array  | No       | CC recipients    |
| `bcc`         | array  | No       | BCC recipients   |
| `replyTo`     | string | No       | Reply-to address |
| `attachments` | array  | No       | Attachments      |
| `threadId`    | string | No       | Thread ID        |

### read_email

Read email content and metadata.

| Parameter       | Type   | Required | Description                                                                              |
| --------------- | ------ | -------- | ---------------------------------------------------------------------------------------- |
| `messageId`     | string | Yes      | Email message ID                                                                         |
| `format`        | string | No       | Response format: full (default), metadata, minimal, raw                                  |
| `contentFormat` | string | No       | Content format: full (default, includes HTML), text (plain text only), headers (no body) |

### search_emails

Search emails using Gmail query syntax (max 500 per request).

| Parameter          | Type    | Required | Description                             |
| ------------------ | ------- | -------- | --------------------------------------- |
| `query`            | string  | Yes      | Gmail search query                      |
| `maxResults`       | number  | No       | Maximum results (default: 50, max: 500) |
| `pageToken`        | string  | No       | Pagination token                        |
| `labelIds`         | array   | No       | Filter by label IDs                     |
| `includeSpamTrash` | boolean | No       | Include spam and trash (default: false) |

### delete_email

Delete emails permanently (max 1000 IDs per request).

| Parameter   | Type            | Required | Description                           |
| ----------- | --------------- | -------- | ------------------------------------- |
| `messageId` | string or array | Yes      | Message ID or array of IDs (max 1000) |

### modify_email

Add/remove labels (max 1000 IDs per request).

| Parameter        | Type            | Required | Description                           |
| ---------------- | --------------- | -------- | ------------------------------------- |
| `messageId`      | string or array | Yes      | Message ID or array of IDs (max 1000) |
| `addLabelIds`    | array           | No       | Label IDs to add                      |
| `removeLabelIds` | array           | No       | Label IDs to remove                   |

### download_attachment

Download an email attachment to disk.

| Parameter      | Type   | Required | Description                   |
| -------------- | ------ | -------- | ----------------------------- |
| `messageId`    | string | Yes      | Email message ID              |
| `attachmentId` | string | Yes      | Attachment ID from read_email |
| `filename`     | string | No       | Save filename                 |
| `outputPath`   | string | No       | Output directory              |

### list_labels

List all Gmail labels (system and user-created).

| Parameter             | Type    | Required | Description                               |
| --------------------- | ------- | -------- | ----------------------------------------- |
| `includeSystemLabels` | boolean | No       | Include INBOX, SENT, etc. (default: true) |

### get_or_create_label

Get or create a Gmail label.

| Parameter               | Type   | Required | Description                                |
| ----------------------- | ------ | -------- | ------------------------------------------ |
| `name`                  | string | Yes      | Label name                                 |
| `messageListVisibility` | string | No       | show or hide                               |
| `labelListVisibility`   | string | No       | labelShow, labelShowIfUnread, or labelHide |
| `backgroundColor`       | string | No       | Background color                           |
| `textColor`             | string | No       | Text color                                 |

### update_label

Update an existing Gmail label.

| Parameter               | Type   | Required | Description                                |
| ----------------------- | ------ | -------- | ------------------------------------------ |
| `labelId`               | string | Yes      | Label ID to update                         |
| `name`                  | string | No       | New name                                   |
| `messageListVisibility` | string | No       | show or hide                               |
| `labelListVisibility`   | string | No       | labelShow, labelShowIfUnread, or labelHide |
| `backgroundColor`       | string | No       | Background color                           |
| `textColor`             | string | No       | Text color                                 |

### delete_label

Delete a user-created label.

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| `labelId` | string | Yes      | Label ID to delete |

### create_filter

Create an email filter.

| Parameter     | Type    | Required | Description                                                                                      |
| ------------- | ------- | -------- | ------------------------------------------------------------------------------------------------ |
| `criteria`    | object  | No       | Filter criteria: { from, to, subject, query, hasAttachment, excludeChats, size, sizeComparison } |
| `action`      | object  | No       | Actions: { addLabelIds, removeLabelIds, forward }                                                |
| `template`    | string  | No       | Pre-built template: fromSender, withSubject, withAttachments, largeEmails, mailingList           |
| `labelIds`    | array   | No       | Labels (template mode)                                                                           |
| `archive`     | boolean | No       | Archive matching emails (template mode)                                                          |
| `email`       | string  | No       | Email for fromSender/mailingList template                                                        |
| `subject`     | string  | No       | Subject for withSubject template                                                                 |
| `sizeBytes`   | number  | No       | Size for largeEmails template                                                                    |
| `listAddress` | string  | No       | List address for mailingList template                                                            |

### list_filters

List filters or get specific filter details.

| Parameter  | Type   | Required | Description         |
| ---------- | ------ | -------- | ------------------- |
| `filterId` | string | No       | Get specific filter |

### delete_filter

Delete an email filter.

| Parameter  | Type   | Required | Description         |
| ---------- | ------ | -------- | ------------------- |
| `filterId` | string | Yes      | Filter ID to delete |

## Contacts (6 tools)

### list_contacts

List contacts from the user's Google Contacts.

| Parameter   | Type   | Required | Description                                         |
| ----------- | ------ | -------- | --------------------------------------------------- |
| `pageSize`  | number | No       | Results per page (default: 100, max: 1000)          |
| `pageToken` | string | No       | Token for next page                                 |
| `sortOrder` | string | No       | LAST_MODIFIED_ASCENDING or LAST_MODIFIED_DESCENDING |

### get_contact

Get details of a specific contact.

| Parameter      | Type   | Required | Description                                      |
| -------------- | ------ | -------- | ------------------------------------------------ |
| `resourceName` | string | Yes      | Contact resource name (e.g., people/c1234567890) |

### search_contacts

Search contacts by name, email, or phone number.

| Parameter  | Type   | Required | Description                             |
| ---------- | ------ | -------- | --------------------------------------- |
| `query`    | string | Yes      | Search query (name, email, or phone)    |
| `pageSize` | number | No       | Results per page (default: 30, max: 30) |

### create_contact

Create a new contact.

| Parameter        | Type   | Required | Description                                                         |
| ---------------- | ------ | -------- | ------------------------------------------------------------------- |
| `givenName`      | string | Yes      | First name                                                          |
| `familyName`     | string | No       | Last name                                                           |
| `emailAddresses` | array  | No       | Array of { value, type } (type: home, work, other)                  |
| `phoneNumbers`   | array  | No       | Array of { value, type } (type: home, work, mobile, other)          |
| `organizations`  | array  | No       | Array of { name, title, department }                                |
| `addresses`      | array  | No       | Array of { streetAddress, city, region, postalCode, country, type } |

### update_contact

Update an existing contact.

| Parameter        | Type   | Required | Description                                      |
| ---------------- | ------ | -------- | ------------------------------------------------ |
| `resourceName`   | string | Yes      | Contact resource name (e.g., people/c1234567890) |
| `givenName`      | string | No       | New first name                                   |
| `familyName`     | string | No       | New last name                                    |
| `emailAddresses` | array  | No       | Replace email addresses                          |
| `phoneNumbers`   | array  | No       | Replace phone numbers                            |
| `organizations`  | array  | No       | Replace organizations                            |
| `addresses`      | array  | No       | Replace addresses                                |

### delete_contact

Delete a contact.

| Parameter      | Type   | Required | Description                                      |
| -------------- | ------ | -------- | ------------------------------------------------ |
| `resourceName` | string | Yes      | Contact resource name (e.g., people/c1234567890) |

## Unified (3 tools)

Smart tools that auto-detect file types. Require drive+docs+sheets+slides to all be enabled.

### create_file

Create file (auto-detects type from name).

| Parameter        | Type   | Required | Description                                                                           |
| ---------------- | ------ | -------- | ------------------------------------------------------------------------------------- |
| `name`           | string | Yes      | File name with extension (e.g., 'report.docx', 'data.xlsx', 'deck.pptx', 'notes.txt') |
| `content`        | varies | Yes      | String for docs/text, 2D array for sheets, array of {title, content} for slides       |
| `parentFolderId` | string | No       | Parent folder ID (mutually exclusive with parentPath)                                 |
| `parentPath`     | string | No       | Parent folder path (creates folders if needed)                                        |
| `type`           | string | No       | Explicit type override: doc, sheet, slides, text                                      |

### update_file

Update file (auto-detects type).

| Parameter  | Type   | Required | Description                                           |
| ---------- | ------ | -------- | ----------------------------------------------------- |
| `content`  | varies | Yes      | String for docs/text, 2D array for sheets             |
| `fileId`   | string | No       | File ID (mutually exclusive with filePath)            |
| `filePath` | string | No       | File path (mutually exclusive with fileId)            |
| `range`    | string | No       | For sheets only: range to update (default: Sheet1!A1) |

### get_file_content

Get file content (auto-detects type).

| Parameter  | Type   | Required | Description                                           |
| ---------- | ------ | -------- | ----------------------------------------------------- |
| `fileId`   | string | No       | File ID (mutually exclusive with filePath)            |
| `filePath` | string | No       | File path (mutually exclusive with fileId)            |
| `range`    | string | No       | For sheets only: range to read (defaults to all data) |
