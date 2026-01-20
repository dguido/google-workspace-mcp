import type { drive_v3, sheets_v4 } from "googleapis";
import {
  successResponse,
  structuredResponse,
  errorResponse,
  withTimeout,
  validateArgs,
} from "../utils/index.js";
import {
  GOOGLE_MIME_TYPES,
  getMimeTypeSuggestion,
} from "../utils/mimeTypes.js";
import type { ToolResponse } from "../utils/index.js";
import {
  ListSheetTabsSchema,
  CreateGoogleSheetSchema,
  UpdateGoogleSheetSchema,
  GetGoogleSheetContentSchema,
  FormatGoogleSheetCellsSchema,
  MergeGoogleSheetCellsSchema,
  AddGoogleSheetConditionalFormatSchema,
  CreateSheetTabSchema,
  DeleteSheetTabSchema,
  RenameSheetTabSchema,
} from "../schemas/index.js";
import {
  resolveOptionalFolderPath,
  checkFileExists,
  convertA1ToGridRange,
} from "./helpers.js";
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
      ?.filter(
        (s) => s.properties?.title && s.properties?.sheetId !== undefined,
      )
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
  const existingFileId = await checkFileExists(
    drive,
    data.name,
    parentFolderId,
  );
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

  return successResponse(
    `Created Google Sheet: ${data.name}\nID: ${spreadsheet.data.spreadsheetId}`,
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

  return successResponse(`Updated Google Sheet range: ${data.range}`);
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
    return errorResponse(
      `"${fileName}" is not a Google Sheet (type: ${mimeType}). ${suggestion}`,
    );
  }

  // If no range specified, get the first sheet name and use it as range
  let range = data.range;
  if (!range) {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: data.spreadsheetId,
      fields: "sheets(properties(title))",
    });

    const firstSheetName =
      spreadsheet.data.sheets?.[0]?.properties?.title || "Sheet1";
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
  const columnCount =
    values.length > 0 ? Math.max(...values.map((row) => row.length)) : 0;

  return structuredResponse(content, {
    spreadsheetId: data.spreadsheetId,
    range: range,
    values: values,
    rowCount: rowCount,
    columnCount: columnCount,
  });
}

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
    return errorResponse((err as Error).message);
  }

  const gridRange = convertA1ToGridRange(sheetInfo.a1Range, sheetInfo.sheetId);
  const requests: sheets_v4.Schema$Request[] = [];
  const appliedFormats: string[] = [];

  // Build cell format (background, alignment, wrap, text, number)
  const cellFields: string[] = [];
  const userEnteredFormat: sheets_v4.Schema$CellFormat = {};

  // Background color
  if (data.backgroundColor) {
    userEnteredFormat.backgroundColorStyle = toSheetsColorStyle(
      data.backgroundColor,
    );
    cellFields.push("userEnteredFormat.backgroundColorStyle");
  }

  // Alignment and wrap
  if (data.horizontalAlignment) {
    userEnteredFormat.horizontalAlignment = data.horizontalAlignment;
    cellFields.push("userEnteredFormat.horizontalAlignment");
  }
  if (data.verticalAlignment) {
    userEnteredFormat.verticalAlignment = data.verticalAlignment;
    cellFields.push("userEnteredFormat.verticalAlignment");
  }
  if (data.wrapStrategy) {
    userEnteredFormat.wrapStrategy = data.wrapStrategy;
    cellFields.push("userEnteredFormat.wrapStrategy");
  }

  // Text formatting
  const textFormatFields: string[] = [];
  const textFormat: sheets_v4.Schema$TextFormat = {};

  if (data.bold !== undefined) {
    textFormat.bold = data.bold;
    textFormatFields.push("bold");
  }
  if (data.italic !== undefined) {
    textFormat.italic = data.italic;
    textFormatFields.push("italic");
  }
  if (data.strikethrough !== undefined) {
    textFormat.strikethrough = data.strikethrough;
    textFormatFields.push("strikethrough");
  }
  if (data.underline !== undefined) {
    textFormat.underline = data.underline;
    textFormatFields.push("underline");
  }
  if (data.fontSize !== undefined) {
    textFormat.fontSize = data.fontSize;
    textFormatFields.push("fontSize");
  }
  if (data.fontFamily !== undefined) {
    textFormat.fontFamily = data.fontFamily;
    textFormatFields.push("fontFamily");
  }
  if (data.foregroundColor) {
    textFormat.foregroundColorStyle = toSheetsColorStyle(data.foregroundColor);
    textFormatFields.push("foregroundColorStyle");
  }

  if (textFormatFields.length > 0) {
    userEnteredFormat.textFormat = textFormat;
    cellFields.push(
      "userEnteredFormat.textFormat(" + textFormatFields.join(",") + ")",
    );
    appliedFormats.push("text");
  }

  // Number formatting
  if (data.numberFormat) {
    userEnteredFormat.numberFormat = {
      pattern: data.numberFormat.pattern,
      ...(data.numberFormat.type && { type: data.numberFormat.type }),
    };
    cellFields.push("userEnteredFormat.numberFormat");
    appliedFormats.push("number");
  }

  // Add repeatCell request if any cell formatting specified
  if (cellFields.length > 0) {
    requests.push({
      repeatCell: {
        range: gridRange,
        cell: { userEnteredFormat },
        fields: cellFields.join(","),
      },
    });
    if (
      !appliedFormats.includes("text") &&
      !appliedFormats.includes("number")
    ) {
      appliedFormats.push("cell");
    }
  }

  // Border formatting (uses separate updateBorders request)
  if (data.borders) {
    const border: sheets_v4.Schema$Border = {
      style: data.borders.style,
      width: data.borders.width || 1,
      ...(data.borders.color && {
        colorStyle: toSheetsColorStyle(data.borders.color),
      }),
    };

    const updateBordersRequest: sheets_v4.Schema$UpdateBordersRequest = {
      range: gridRange,
    };

    if (data.borders.top !== false) updateBordersRequest.top = border;
    if (data.borders.bottom !== false) updateBordersRequest.bottom = border;
    if (data.borders.left !== false) updateBordersRequest.left = border;
    if (data.borders.right !== false) updateBordersRequest.right = border;
    if (data.borders.innerHorizontal)
      updateBordersRequest.innerHorizontal = border;
    if (data.borders.innerVertical) updateBordersRequest.innerVertical = border;

    requests.push({ updateBorders: updateBordersRequest });
    appliedFormats.push("borders");
  }

  if (requests.length === 0) {
    return errorResponse("No formatting options specified");
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests },
  });

  const formatDesc = appliedFormats.join(", ");
  return successResponse(
    `Formatted cells in range ${data.range} (${formatDesc})`,
  );
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
    return errorResponse((err as Error).message);
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

  return successResponse(
    `Merged cells in range ${data.range} with type ${data.mergeType}`,
  );
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
    return errorResponse((err as Error).message);
  }

  const gridRange = convertA1ToGridRange(sheetInfo.a1Range, sheetInfo.sheetId);

  // Build condition based on type
  const booleanCondition: sheets_v4.Schema$BooleanCondition = {
    type: data.condition.type,
    values: [{ userEnteredValue: data.condition.value }],
  };

  const format: sheets_v4.Schema$CellFormat = {};
  if (data.format.backgroundColor) {
    format.backgroundColorStyle = toSheetsColorStyle(
      data.format.backgroundColor,
    );
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

  return successResponse(`Added conditional formatting to range ${data.range}`);
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
      ?.filter(
        (s) => s.properties?.title && s.properties?.sheetId !== undefined,
      )
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

export async function handleCreateSheetTab(
  sheets: sheets_v4.Sheets,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateSheetTabSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Check if sheet name already exists
  const existingSheetId = await getSheetIdByTitle(
    sheets,
    data.spreadsheetId,
    data.title,
  );
  if (existingSheetId !== null) {
    return errorResponse(
      `A sheet tab named "${data.title}" already exists in this spreadsheet.`,
    );
  }

  // Create the new sheet
  const addSheetRequest: sheets_v4.Schema$Request = {
    addSheet: {
      properties: {
        title: data.title,
        ...(data.index !== undefined && { index: data.index }),
      },
    },
  };

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests: [addSheetRequest] },
  });

  // Clear cache for this spreadsheet
  clearSheetCache(data.spreadsheetId);

  const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;

  return successResponse(
    `Created new sheet tab "${data.title}" (ID: ${newSheetId})`,
  );
}

export async function handleDeleteSheetTab(
  sheets: sheets_v4.Sheets,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(DeleteSheetTabSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Resolve sheet title to sheetId
  const sheetId = await getSheetIdByTitle(
    sheets,
    data.spreadsheetId,
    data.sheetTitle,
  );
  if (sheetId === null) {
    // Fetch available sheets for better error message
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: data.spreadsheetId,
    });
    const availableSheets =
      spreadsheet.data.sheets
        ?.map((s) => s.properties?.title)
        .filter(Boolean)
        .join(", ") || "none";
    return errorResponse(
      `Sheet tab "${data.sheetTitle}" not found. Available sheets: ${availableSheets}`,
    );
  }

  // Delete the sheet
  const deleteSheetRequest: sheets_v4.Schema$Request = {
    deleteSheet: { sheetId },
  };

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: data.spreadsheetId,
      requestBody: { requests: [deleteSheetRequest] },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    // Check if it's the "cannot delete last sheet" error
    if (
      err.message?.includes("last sheet") ||
      err.message?.includes("at least one sheet")
    ) {
      return errorResponse(
        `Cannot delete "${data.sheetTitle}" - a spreadsheet must have at least one sheet.`,
      );
    }
    throw error;
  }

  // Clear cache for this spreadsheet
  clearSheetCache(data.spreadsheetId);

  return successResponse(`Deleted sheet tab "${data.sheetTitle}"`);
}

export async function handleRenameSheetTab(
  sheets: sheets_v4.Sheets,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(RenameSheetTabSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Resolve current title to sheetId
  const sheetId = await getSheetIdByTitle(
    sheets,
    data.spreadsheetId,
    data.currentTitle,
  );
  if (sheetId === null) {
    // Fetch available sheets for better error message
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: data.spreadsheetId,
    });
    const availableSheets =
      spreadsheet.data.sheets
        ?.map((s) => s.properties?.title)
        .filter(Boolean)
        .join(", ") || "none";
    return errorResponse(
      `Sheet tab "${data.currentTitle}" not found. Available sheets: ${availableSheets}`,
    );
  }

  // Check if new title already exists
  const existingSheetId = await getSheetIdByTitle(
    sheets,
    data.spreadsheetId,
    data.newTitle,
  );
  if (existingSheetId !== null) {
    return errorResponse(
      `A sheet tab named "${data.newTitle}" already exists in this spreadsheet.`,
    );
  }

  // Rename the sheet
  const updateRequest: sheets_v4.Schema$Request = {
    updateSheetProperties: {
      properties: {
        sheetId,
        title: data.newTitle,
      },
      fields: "title",
    },
  };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests: [updateRequest] },
  });

  // Clear cache for this spreadsheet
  clearSheetCache(data.spreadsheetId);

  return successResponse(
    `Renamed sheet tab "${data.currentTitle}" to "${data.newTitle}"`,
  );
}

export async function handleListSheetTabs(
  sheets: sheets_v4.Sheets,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ListSheetTabsSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const response = await sheets.spreadsheets.get({
    spreadsheetId: data.spreadsheetId,
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

  const tabList = tabs
    .map((t) => `${t.index}: ${t.title} (${t.rowCount}x${t.columnCount})`)
    .join("\n");

  return structuredResponse(
    `Spreadsheet has ${tabs.length} tab(s):\n${tabList}`,
    {
      spreadsheetId: data.spreadsheetId,
      tabs,
    },
  );
}
