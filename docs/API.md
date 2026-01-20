# API Reference

Complete reference for all Google Drive MCP tools.

## Search and Navigation

### search
Search for files across Google Drive.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search terms |
| `pageSize` | number | No | Results per page (default 50, max 100) |
| `pageToken` | string | No | Pagination token for next page |

### listFolder
List contents of a folder.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `folderId` | string | No | Folder ID (defaults to root) |
| `pageSize` | number | No | Results per page (max 100) |
| `pageToken` | string | No | Pagination token |

## File Management

### createTextFile
Create a text or markdown file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | File name (must end with .txt or .md) |
| `content` | string | Yes | File content |
| `parentFolderId` | string | No | Parent folder ID |

### updateTextFile
Update existing text file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | Yes | File ID to update |
| `content` | string | Yes | New content |
| `name` | string | No | New name |

### deleteItem
Move a file or folder to trash (not permanent - items can be restored).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `itemId` | string | Yes | Item ID to move to trash |

### renameItem
Rename a file or folder.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `itemId` | string | Yes | Item ID to rename |
| `newName` | string | Yes | New name |

### moveItem
Move a file or folder.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `itemId` | string | Yes | Item ID to move |
| `destinationFolderId` | string | Yes | Destination folder ID |

### copyFile
Copy a file to a new location.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fileId` | string | Yes | File ID to copy |
| `name` | string | No | Name for the copy |
| `parentFolderId` | string | No | Destination folder ID |

## Folder Operations

### createFolder
Create a new folder.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Folder name |
| `parent` | string | No | Parent folder ID or path |

## Google Docs

### createGoogleDoc
Create a Google Doc.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Document name |
| `content` | string | Yes | Document content |
| `parentFolderId` | string | No | Parent folder ID |

### updateGoogleDoc
Update a Google Doc.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | Yes | Document ID |
| `content` | string | Yes | New content |

### getGoogleDocContent
Get document content with text indices.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | Yes | Document ID |

Returns text with character positions for formatting.

### formatGoogleDocRange
Unified formatting for Google Docs (text + paragraph).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentId` | string | Yes | Document ID |
| `startIndex` | number | No | Start position (default 1) |
| `endIndex` | number | No | End position (default end) |

**Text formatting options:** `bold`, `italic`, `underline`, `strikethrough`, `fontSize`, `fontFamily`, `foregroundColor`

**Paragraph formatting options:** `namedStyleType`, `alignment`, `lineSpacing`, `spaceAbove`, `spaceBelow`

## Google Sheets

### createGoogleSheet
Create a Google Sheet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Spreadsheet name |
| `data` | array | Yes | 2D array of cell values |
| `parentFolderId` | string | No | Parent folder ID |

### updateGoogleSheet
Update a Google Sheet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | Yes | Spreadsheet ID |
| `range` | string | Yes | Range to update (e.g., "A1:C10") |
| `data` | array | Yes | 2D array of new values |

### getGoogleSheetContent
Get spreadsheet content with cell information.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | Yes | Spreadsheet ID |
| `range` | string | Yes | Range to get (e.g., "Sheet1!A1:C10") |

### formatGoogleSheetCells
Format cell properties.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | Yes | Spreadsheet ID |
| `range` | string | Yes | Range to format |
| `backgroundColor` | object | No | Cell background color (RGB 0-1) |
| `horizontalAlignment` | string | No | LEFT, CENTER, or RIGHT |
| `verticalAlignment` | string | No | TOP, MIDDLE, or BOTTOM |
| `wrapStrategy` | string | No | OVERFLOW_CELL, CLIP, or WRAP |

### formatGoogleSheetText
Apply text formatting to cells.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | Yes | Spreadsheet ID |
| `range` | string | Yes | Range to format |
| `bold` | boolean | No | Make text bold |
| `italic` | boolean | No | Make text italic |
| `strikethrough` | boolean | No | Strikethrough text |
| `underline` | boolean | No | Underline text |
| `fontSize` | number | No | Font size in points |
| `fontFamily` | string | No | Font name |
| `foregroundColor` | object | No | Text color (RGB 0-1) |

### formatGoogleSheetNumbers
Apply number/date formatting.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | Yes | Spreadsheet ID |
| `range` | string | Yes | Range to format |
| `pattern` | string | Yes | Format pattern (e.g., "#,##0.00", "yyyy-mm-dd") |
| `type` | string | No | NUMBER, CURRENCY, PERCENT, DATE, TIME, DATE_TIME, or SCIENTIFIC |

### setGoogleSheetBorders
Configure cell borders.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | Yes | Spreadsheet ID |
| `range` | string | Yes | Range to format |
| `style` | string | Yes | SOLID, DASHED, DOTTED, or DOUBLE |
| `width` | number | No | Border thickness 1-3 |
| `color` | object | No | Border color (RGB 0-1) |
| `top`, `bottom`, `left`, `right` | boolean | No | Apply to specific borders |
| `innerHorizontal`, `innerVertical` | boolean | No | Apply to inner borders |

### mergeGoogleSheetCells
Merge cells in a range.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | Yes | Spreadsheet ID |
| `range` | string | Yes | Range to merge |
| `mergeType` | string | Yes | MERGE_ALL, MERGE_COLUMNS, or MERGE_ROWS |

### addGoogleSheetConditionalFormat
Add conditional formatting rules.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `spreadsheetId` | string | Yes | Spreadsheet ID |
| `range` | string | Yes | Range to apply formatting |
| `condition` | object | Yes | Condition configuration |
| `format` | object | Yes | Format to apply when condition is true |

**Condition types:** NUMBER_GREATER, NUMBER_LESS, TEXT_CONTAINS, TEXT_STARTS_WITH, TEXT_ENDS_WITH, CUSTOM_FORMULA

## Google Slides

### createGoogleSlides
Create a presentation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Presentation name |
| `slides` | array | Yes | Array of slides with title and content |
| `parentFolderId` | string | No | Parent folder ID |

### updateGoogleSlides
Update an existing presentation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `presentationId` | string | Yes | Presentation ID |
| `slides` | array | Yes | Array of slides (replaces all existing slides) |

### getGoogleSlidesContent
Get presentation content with element IDs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `presentationId` | string | Yes | Presentation ID |
| `slideIndex` | number | No | Specific slide index |

### formatGoogleSlidesElement
Unified formatting for Google Slides.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `presentationId` | string | Yes | Presentation ID |
| `targetType` | string | Yes | `text`, `shape`, or `slide` |
| `objectId` | string | Conditional | Required for text/shape targets |
| `pageObjectIds` | array | Conditional | Required for slide targets |

**Text formatting:** `bold`, `italic`, `fontSize`, `fontFamily`, `foregroundColor`, `alignment`, `lineSpacing`, `bulletStyle`

**Shape formatting:** `backgroundColor`, `outlineColor`, `outlineWeight`, `outlineDashStyle`

**Slide formatting:** `slideBackgroundColor`

### createGoogleSlidesTextBox
Create formatted text box.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `presentationId` | string | Yes | Presentation ID |
| `pageObjectId` | string | Yes | Slide ID |
| `text` | string | Yes | Text content |
| `x`, `y`, `width`, `height` | number | Yes | Position/size in EMU (1/360000 cm) |
| `fontSize` | number | No | Font size |
| `bold`, `italic` | boolean | No | Text formatting |

### createGoogleSlidesShape
Create styled shape.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `presentationId` | string | Yes | Presentation ID |
| `pageObjectId` | string | Yes | Slide ID |
| `shapeType` | string | Yes | RECTANGLE, ELLIPSE, DIAMOND, TRIANGLE, STAR, ROUND_RECTANGLE, or ARROW |
| `x`, `y`, `width`, `height` | number | Yes | Position/size in EMU |
| `backgroundColor` | object | No | Fill color (RGBA 0-1) |

### getGoogleSlidesSpeakerNotes
Get speaker notes from a slide.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `presentationId` | string | Yes | Presentation ID |
| `slideIndex` | number | Yes | Slide index (0-based) |

### updateGoogleSlidesSpeakerNotes
Update speaker notes for a slide.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `presentationId` | string | Yes | Presentation ID |
| `slideIndex` | number | Yes | Slide index (0-based) |
| `notes` | string | Yes | Speaker notes content |
