import type { drive_v3, sheets_v4 } from "googleapis";
import {
  structuredResponse,
  errorResponse,
  withTimeout,
  validateArgs,
  toToon,
} from "../utils/index.js";
import { GOOGLE_MIME_TYPES, getMimeTypeSuggestion } from "../utils/mimeTypes.js";
import type { ToolResponse } from "../utils/index.js";
import {
  SheetTabsSchema,
  CreateGoogleSheetSchema,
  UpdateGoogleSheetSchema,
  GetGoogleSheetContentSchema,
  FormatGoogleSheetCellsSchema,
  MergeGoogleSheetCellsSchema,
  AddGoogleSheetConditionalFormatSchema,
} from "../schemas/index.js";
import { resolveOptionalFolderPath, checkFileExists, convertA1ToGridRange } from "./helpers.js";
import {
  getCachedSheetMetadata,
  setCachedSheetMetadata,
  clearSheetCache,
} from "../utils/sheetCache.js";
import { toSheetsColorStyle } from "../utils/colors.js";

async function getSheetInfo(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  range: string,
): Promise<{ sheetId: number; a1Range: string }> {
  const sheetName = range.includes("!") ? range.split("!")[0] : "Sheet1";
  const a1Range = range.includes("!") ? range.split("!")[1] : range;

  // Check cache first
  const cached = getCachedSheetMetadata(spreadsheetId, sheetName);
  if (cached) {
    return { sheetId: cached.sheetId, a1Range };
  }

  // Cache miss - fetch from API
  const rangeData = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  // Cache all sheets from this spreadsheet
  const sheetsData =
    rangeData.data.sheets
      ?.filter((s) => s.properties?.title && s.properties?.sheetId !== undefined)
      .map((s) => ({
        title: s.properties!.title!,
        sheetId: s.properties!.sheetId!,
      })) || [];

  if (sheetsData.length > 0) {
    setCachedSheetMetadata(spreadsheetId, sheetsData);
  }

  const sheet = sheetsData.find((s) => s.title === sheetName);
  if (!sheet) {
    const availableSheets = sheetsData.map((s) => s.title).join(", ");
    throw new Error(
      `Sheet "${sheetName}" not found. Available sheets: ${availableSheets || "none"}`,
    );
  }

  return { sheetId: sheet.sheetId, a1Range };
}

export async function handleCreateGoogleSheet(
  drive: drive_v3.Drive,
  sheets: sheets_v4.Sheets,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateGoogleSheetSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const parentFolderId = await resolveOptionalFolderPath(
    drive,
    data.parentFolderId,
    data.parentPath,
  );

  // Check if spreadsheet already exists
  const existingFileId = await checkFileExists(drive, data.name, parentFolderId);
  if (existingFileId) {
    return errorResponse(
      `A spreadsheet named "${data.name}" already exists in this location. ` +
        `To update it, use updateGoogleSheet with spreadsheetId: ${existingFileId}`,
    );
  }

  // Create spreadsheet with initial sheet
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: data.name },
      sheets: [
        {
          properties: {
            sheetId: 0,
            title: "Sheet1",
            gridProperties: {
              rowCount: Math.max(data.data.length, 1000),
              columnCount: Math.max(data.data[0]?.length || 0, 26),
            },
          },
        },
      ],
    },
  });

  await drive.files.update({
    fileId: spreadsheet.data.spreadsheetId || "",
    addParents: parentFolderId,
    removeParents: "root",
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });

  // Now update with data
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheet.data.spreadsheetId!,
    range: "Sheet1!A1",
    valueInputOption: data.valueInputOption || "RAW",
    requestBody: { values: data.data },
  });

  return structuredResponse(
    `Created Google Sheet: ${data.name}\nID: ${spreadsheet.data.spreadsheetId}`,
    {
      id: spreadsheet.data.spreadsheetId!,
      name: data.name,
    },
  );
}

export async function handleUpdateGoogleSheet(
  sheets: sheets_v4.Sheets,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(UpdateGoogleSheetSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  await sheets.spreadsheets.values.update({
    spreadsheetId: data.spreadsheetId,
    range: data.range,
    valueInputOption: data.valueInputOption || "RAW",
    requestBody: { values: data.data },
  });

  return structuredResponse(`Updated Google Sheet range: ${data.range}`, {
    range: data.range,
    updated: true,
  });
}

export async function handleGetGoogleSheetContent(
  drive: drive_v3.Drive,
  sheets: sheets_v4.Sheets,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetGoogleSheetContentSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Check file type before calling Sheets API to provide helpful error messages
  const metadata = await drive.files.get({
    fileId: data.spreadsheetId,
    fields: "mimeType,name",
    supportsAllDrives: true,
  });

  const mimeType = metadata.data.mimeType;
  if (mimeType !== GOOGLE_MIME_TYPES.SPREADSHEET) {
    const fileName = metadata.data.name || data.spreadsheetId;
    const suggestion = getMimeTypeSuggestion(mimeType);
    return errorResponse(`"${fileName}" is not a Google Sheet (type: ${mimeType}). ${suggestion}`);
  }

  // If no range specified, get the first sheet name and use it as range
  let range = data.range;
  if (!range) {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: data.spreadsheetId,
      fields: "sheets(properties(title))",
    });

    const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title || "Sheet1";
    range = firstSheetName;
  }

  const response = await withTimeout(
    sheets.spreadsheets.values.get({
      spreadsheetId: data.spreadsheetId,
      range: range,
    }),
    30000,
    "Get sheet content",
  );

  const values = response.data.values || [];
  let content = `Content for range ${range}:\n\n`;

  if (values.length === 0) {
    content += "(empty range)";
  } else {
    values.forEach((row, rowIndex) => {
      content += `Row ${rowIndex + 1}: ${row.join(", ")}\n`;
    });
  }

  const rowCount = values.length;
  const columnCount = values.length > 0 ? Math.max(...values.map((row) => row.length)) : 0;

  return structuredResponse(content, {
    spreadsheetId: data.spreadsheetId,
    range: range,
    values: values,
    rowCount: rowCount,
    columnCount: columnCount,
  });
}

// -----------------------------------------------------------------------------
// SHEET FORMATTING HELPERS
// -----------------------------------------------------------------------------

interface SheetFormatOptions {
  backgroundColor?: { red?: number; green?: number; blue?: number };
  horizontalAlignment?: string;
  verticalAlignment?: string;
  wrapStrategy?: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  foregroundColor?: { red?: number; green?: number; blue?: number };
  numberFormat?: { pattern: string; type?: string };
}

interface CellFormatResult {
  format: sheets_v4.Schema$CellFormat;
  fields: string[];
  appliedTypes: string[];
}

function buildCellFormat(data: SheetFormatOptions): CellFormatResult {
  const fields: string[] = [];
  const format: sheets_v4.Schema$CellFormat = {};
  const appliedTypes: string[] = [];

  if (data.backgroundColor) {
    format.backgroundColorStyle = toSheetsColorStyle(data.backgroundColor);
    fields.push("userEnteredFormat.backgroundColorStyle");
  }
  if (data.horizontalAlignment) {
    format.horizontalAlignment = data.horizontalAlignment;
    fields.push("userEnteredFormat.horizontalAlignment");
  }
  if (data.verticalAlignment) {
    format.verticalAlignment = data.verticalAlignment;
    fields.push("userEnteredFormat.verticalAlignment");
  }
  if (data.wrapStrategy) {
    format.wrapStrategy = data.wrapStrategy;
    fields.push("userEnteredFormat.wrapStrategy");
  }

  const textResult = buildTextFormat(data);
  if (textResult.fields.length > 0) {
    format.textFormat = textResult.format;
    fields.push("userEnteredFormat.textFormat(" + textResult.fields.join(",") + ")");
    appliedTypes.push("text");
  }

  if (data.numberFormat) {
    format.numberFormat = {
      pattern: data.numberFormat.pattern,
      ...(data.numberFormat.type && { type: data.numberFormat.type }),
    };
    fields.push("userEnteredFormat.numberFormat");
    appliedTypes.push("number");
  }

  return { format, fields, appliedTypes };
}

function buildTextFormat(data: SheetFormatOptions): {
  format: sheets_v4.Schema$TextFormat;
  fields: string[];
} {
  const fields: string[] = [];
  const format: sheets_v4.Schema$TextFormat = {};

  if (data.bold !== undefined) {
    format.bold = data.bold;
    fields.push("bold");
  }
  if (data.italic !== undefined) {
    format.italic = data.italic;
    fields.push("italic");
  }
  if (data.strikethrough !== undefined) {
    format.strikethrough = data.strikethrough;
    fields.push("strikethrough");
  }
  if (data.underline !== undefined) {
    format.underline = data.underline;
    fields.push("underline");
  }
  if (data.fontSize !== undefined) {
    format.fontSize = data.fontSize;
    fields.push("fontSize");
  }
  if (data.fontFamily !== undefined) {
    format.fontFamily = data.fontFamily;
    fields.push("fontFamily");
  }
  if (data.foregroundColor) {
    format.foregroundColorStyle = toSheetsColorStyle(data.foregroundColor);
    fields.push("foregroundColorStyle");
  }

  return { format, fields };
}

interface BorderOptions {
  style: string;
  width?: number;
  color?: { red?: number; green?: number; blue?: number };
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  innerHorizontal?: boolean;
  innerVertical?: boolean;
}

function buildBordersRequest(
  gridRange: sheets_v4.Schema$GridRange,
  options: BorderOptions,
): sheets_v4.Schema$UpdateBordersRequest {
  const border: sheets_v4.Schema$Border = {
    style: options.style,
    width: options.width || 1,
    ...(options.color && { colorStyle: toSheetsColorStyle(options.color) }),
  };

  const request: sheets_v4.Schema$UpdateBordersRequest = { range: gridRange };
  if (options.top !== false) request.top = border;
  if (options.bottom !== false) request.bottom = border;
  if (options.left !== false) request.left = border;
  if (options.right !== false) request.right = border;
  if (options.innerHorizontal) request.innerHorizontal = border;
  if (options.innerVertical) request.innerVertical = border;

  return request;
}

// -----------------------------------------------------------------------------
// SHEET FORMATTING HANDLER
// -----------------------------------------------------------------------------

export async function handleFormatGoogleSheetCells(
  sheets: sheets_v4.Sheets,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(FormatGoogleSheetCellsSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  let sheetInfo;
  try {
    sheetInfo = await getSheetInfo(sheets, data.spreadsheetId, data.range);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err));
  }

  const gridRange = convertA1ToGridRange(sheetInfo.a1Range, sheetInfo.sheetId);
  const requests: sheets_v4.Schema$Request[] = [];
  const appliedFormats: string[] = [];

  const cellResult = buildCellFormat(data);
  if (cellResult.fields.length > 0) {
    requests.push({
      repeatCell: {
        range: gridRange,
        cell: { userEnteredFormat: cellResult.format },
        fields: cellResult.fields.join(","),
      },
    });
    appliedFormats.push(...cellResult.appliedTypes);
    if (appliedFormats.length === 0) appliedFormats.push("cell");
  }

  if (data.borders) {
    requests.push({ updateBorders: buildBordersRequest(gridRange, data.borders) });
    appliedFormats.push("borders");
  }

  if (requests.length === 0) {
    return errorResponse("No formatting options specified");
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests },
  });

  return structuredResponse(`Formatted cells in range ${data.range} (${appliedFormats.join(", ")})`, {
    range: data.range,
    applied: true,
  });
}

export async function handleMergeGoogleSheetCells(
  sheets: sheets_v4.Sheets,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(MergeGoogleSheetCellsSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  let sheetInfo;
  try {
    sheetInfo = await getSheetInfo(sheets, data.spreadsheetId, data.range);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err));
  }

  const gridRange = convertA1ToGridRange(sheetInfo.a1Range, sheetInfo.sheetId);

  const requests: sheets_v4.Schema$Request[] = [
    {
      mergeCells: {
        range: gridRange,
        mergeType: data.mergeType,
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests },
  });

  return structuredResponse(`Merged cells in range ${data.range} with type ${data.mergeType}`, {
    range: data.range,
    mergeType: data.mergeType,
  });
}

export async function handleAddGoogleSheetConditionalFormat(
  sheets: sheets_v4.Sheets,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(AddGoogleSheetConditionalFormatSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  let sheetInfo;
  try {
    sheetInfo = await getSheetInfo(sheets, data.spreadsheetId, data.range);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : String(err));
  }

  const gridRange = convertA1ToGridRange(sheetInfo.a1Range, sheetInfo.sheetId);

  // Build condition based on type
  const booleanCondition: sheets_v4.Schema$BooleanCondition = {
    type: data.condition.type,
    values: [{ userEnteredValue: data.condition.value }],
  };

  const format: sheets_v4.Schema$CellFormat = {};
  if (data.format.backgroundColor) {
    format.backgroundColorStyle = toSheetsColorStyle(data.format.backgroundColor);
  }
  if (data.format.textFormat) {
    format.textFormat = {};
    if (data.format.textFormat.bold !== undefined) {
      format.textFormat.bold = data.format.textFormat.bold;
    }
    if (data.format.textFormat.foregroundColor) {
      format.textFormat.foregroundColorStyle = toSheetsColorStyle(
        data.format.textFormat.foregroundColor,
      );
    }
  }

  const requests: sheets_v4.Schema$Request[] = [
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [gridRange],
          booleanRule: {
            condition: booleanCondition,
            format: format,
          },
        },
        index: 0,
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests },
  });

  return structuredResponse(`Added conditional formatting to range ${data.range}`, {
    range: data.range,
    conditionType: data.condition.type,
  });
}

/**
 * Helper function to resolve a sheet title to its sheetId.
 * Returns the sheetId if found, null otherwise.
 */
async function getSheetIdByTitle(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string,
): Promise<number | null> {
  // Check cache first
  const cached = getCachedSheetMetadata(spreadsheetId, title);
  if (cached) {
    return cached.sheetId;
  }

  // Fetch from API
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });

  const sheetsData =
    response.data.sheets
      ?.filter((s) => s.properties?.title && s.properties?.sheetId !== undefined)
      .map((s) => ({
        title: s.properties!.title!,
        sheetId: s.properties!.sheetId!,
      })) || [];

  // Cache all sheets
  if (sheetsData.length > 0) {
    setCachedSheetMetadata(spreadsheetId, sheetsData);
  }

  const sheet = sheetsData.find((s) => s.title === title);
  return sheet ? sheet.sheetId : null;
}

/**
 * Unified sheet tabs handler - list, create, delete, or rename tabs
 */
export async function handleSheetTabs(
  sheets: sheets_v4.Sheets,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(SheetTabsSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  switch (data.action) {
    case "list":
      return listSheetTabs(sheets, data.spreadsheetId);

    case "create":
      return createSheetTab(sheets, data.spreadsheetId, data.title!, data.index);

    case "delete":
      return deleteSheetTab(sheets, data.spreadsheetId, data.title!);

    case "rename":
      return renameSheetTab(sheets, data.spreadsheetId, data.currentTitle!, data.newTitle!);

    default:
      return errorResponse(`Unknown action: ${data.action}`);
  }
}

async function listSheetTabs(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<ToolResponse> {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields:
      "spreadsheetId,sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))",
  });

  const tabs =
    response.data.sheets?.map((sheet) => ({
      sheetId: sheet.properties?.sheetId,
      title: sheet.properties?.title,
      index: sheet.properties?.index,
      rowCount: sheet.properties?.gridProperties?.rowCount,
      columnCount: sheet.properties?.gridProperties?.columnCount,
    })) || [];

  return structuredResponse(`Spreadsheet has ${tabs.length} tab(s):\n\n${toToon({ tabs })}`, {
    spreadsheetId,
    tabs,
  });
}

async function createSheetTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string,
  index?: number,
): Promise<ToolResponse> {
  // Check if sheet name already exists
  const existingSheetId = await getSheetIdByTitle(sheets, spreadsheetId, title);
  if (existingSheetId !== null) {
    return errorResponse(`A sheet tab named "${title}" already exists in this spreadsheet.`, {
      code: "ALREADY_EXISTS",
    });
  }

  const addSheetRequest: sheets_v4.Schema$Request = {
    addSheet: {
      properties: {
        title,
        ...(index !== undefined && { index }),
      },
    },
  };

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [addSheetRequest] },
  });

  clearSheetCache(spreadsheetId);
  const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
  return structuredResponse(`Created new sheet tab "${title}" (ID: ${newSheetId})`, {
    action: "create",
    sheetId: newSheetId!,
    title,
  });
}

async function deleteSheetTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string,
): Promise<ToolResponse> {
  const sheetId = await getSheetIdByTitle(sheets, spreadsheetId, title);
  if (sheetId === null) {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const availableSheets =
      spreadsheet.data.sheets
        ?.map((s) => s.properties?.title)
        .filter(Boolean)
        .join(", ") || "none";
    return errorResponse(`Sheet tab "${title}" not found. Available sheets: ${availableSheets}`);
  }

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ deleteSheet: { sheetId } }] },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes("last sheet") || err.message?.includes("at least one sheet")) {
      return errorResponse(`Cannot delete "${title}" - spreadsheet must have at least one sheet.`);
    }
    throw error;
  }

  clearSheetCache(spreadsheetId);
  return structuredResponse(`Deleted sheet tab "${title}"`, {
    action: "delete",
    sheetId,
    title,
  });
}

async function renameSheetTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  currentTitle: string,
  newTitle: string,
): Promise<ToolResponse> {
  const sheetId = await getSheetIdByTitle(sheets, spreadsheetId, currentTitle);
  if (sheetId === null) {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const availableSheets =
      spreadsheet.data.sheets
        ?.map((s) => s.properties?.title)
        .filter(Boolean)
        .join(", ") || "none";
    return errorResponse(
      `Sheet tab "${currentTitle}" not found. Available sheets: ${availableSheets}`,
    );
  }

  const existingNewId = await getSheetIdByTitle(sheets, spreadsheetId, newTitle);
  if (existingNewId !== null) {
    return errorResponse(`A sheet tab named "${newTitle}" already exists in this spreadsheet.`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, title: newTitle },
            fields: "title",
          },
        },
      ],
    },
  });

  clearSheetCache(spreadsheetId);
  return structuredResponse(`Renamed sheet tab "${currentTitle}" to "${newTitle}"`, {
    action: "rename",
    sheetId,
    title: newTitle,
  });
}
