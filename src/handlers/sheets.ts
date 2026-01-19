import type { drive_v3, sheets_v4 } from 'googleapis';
import { successResponse, errorResponse } from '../utils/index.js';
import type { ToolResponse } from '../utils/index.js';
import {
  CreateGoogleSheetSchema,
  UpdateGoogleSheetSchema,
  GetGoogleSheetContentSchema,
  FormatGoogleSheetCellsSchema,
  FormatGoogleSheetTextSchema,
  FormatGoogleSheetNumbersSchema,
  SetGoogleSheetBordersSchema,
  MergeGoogleSheetCellsSchema,
  AddGoogleSheetConditionalFormatSchema,
  CreateSheetTabSchema,
  DeleteSheetTabSchema,
  RenameSheetTabSchema
} from '../schemas/index.js';
import { resolveFolderId, checkFileExists, convertA1ToGridRange } from './helpers.js';
import {
  getCachedSheetMetadata,
  setCachedSheetMetadata,
  clearSheetCache
} from '../utils/sheetCache.js';

async function getSheetInfo(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  range: string
): Promise<{ sheetId: number; a1Range: string }> {
  const sheetName = range.includes('!') ? range.split('!')[0] : 'Sheet1';
  const a1Range = range.includes('!') ? range.split('!')[1] : range;

  // Check cache first
  const cached = getCachedSheetMetadata(spreadsheetId, sheetName);
  if (cached) {
    return { sheetId: cached.sheetId, a1Range };
  }

  // Cache miss - fetch from API
  const rangeData = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))'
  });

  // Cache all sheets from this spreadsheet
  const sheetsData = rangeData.data.sheets
    ?.filter(s => s.properties?.title && s.properties?.sheetId !== undefined)
    .map(s => ({
      title: s.properties!.title!,
      sheetId: s.properties!.sheetId!
    })) || [];

  if (sheetsData.length > 0) {
    setCachedSheetMetadata(spreadsheetId, sheetsData);
  }

  const sheet = sheetsData.find(s => s.title === sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  return { sheetId: sheet.sheetId, a1Range };
}

export async function handleCreateGoogleSheet(
  drive: drive_v3.Drive,
  sheets: sheets_v4.Sheets,
  args: unknown
): Promise<ToolResponse> {
  const validation = CreateGoogleSheetSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  const parentFolderId = await resolveFolderId(drive, data.parentFolderId);

  // Check if spreadsheet already exists
  const existingFileId = await checkFileExists(drive, data.name, parentFolderId);
  if (existingFileId) {
    return errorResponse(
      `A spreadsheet named "${data.name}" already exists in this location. ` +
      `To update it, use updateGoogleSheet with spreadsheetId: ${existingFileId}`
    );
  }

  // Create spreadsheet with initial sheet
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: data.name },
      sheets: [{
        properties: {
          sheetId: 0,
          title: 'Sheet1',
          gridProperties: {
            rowCount: Math.max(data.data.length, 1000),
            columnCount: Math.max(data.data[0]?.length || 0, 26)
          }
        }
      }]
    }
  });

  await drive.files.update({
    fileId: spreadsheet.data.spreadsheetId || '',
    addParents: parentFolderId,
    removeParents: 'root',
    fields: 'id, name, webViewLink',
    supportsAllDrives: true
  });

  // Now update with data
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheet.data.spreadsheetId!,
    range: 'Sheet1!A1',
    valueInputOption: data.valueInputOption || 'RAW',
    requestBody: { values: data.data }
  });

  return successResponse(
    `Created Google Sheet: ${data.name}\nID: ${spreadsheet.data.spreadsheetId}`
  );
}

export async function handleUpdateGoogleSheet(
  sheets: sheets_v4.Sheets,
  args: unknown
): Promise<ToolResponse> {
  const validation = UpdateGoogleSheetSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  await sheets.spreadsheets.values.update({
    spreadsheetId: data.spreadsheetId,
    range: data.range,
    valueInputOption: data.valueInputOption || 'RAW',
    requestBody: { values: data.data }
  });

  return successResponse(`Updated Google Sheet range: ${data.range}`);
}

export async function handleGetGoogleSheetContent(
  sheets: sheets_v4.Sheets,
  args: unknown
): Promise<ToolResponse> {
  const validation = GetGoogleSheetContentSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: data.spreadsheetId,
    range: data.range
  });

  const values = response.data.values || [];
  let content = `Content for range ${data.range}:\n\n`;

  if (values.length === 0) {
    content += "(empty range)";
  } else {
    values.forEach((row, rowIndex) => {
      content += `Row ${rowIndex + 1}: ${row.join(', ')}\n`;
    });
  }

  return successResponse(content);
}

export async function handleFormatGoogleSheetCells(
  sheets: sheets_v4.Sheets,
  args: unknown
): Promise<ToolResponse> {
  const validation = FormatGoogleSheetCellsSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  let sheetInfo;
  try {
    sheetInfo = await getSheetInfo(sheets, data.spreadsheetId, data.range);
  } catch (err) {
    return errorResponse((err as Error).message);
  }

  const gridRange = convertA1ToGridRange(sheetInfo.a1Range, sheetInfo.sheetId);

  const requests: sheets_v4.Schema$Request[] = [{
    repeatCell: {
      range: gridRange,
      cell: {
        userEnteredFormat: {
          ...(data.backgroundColor && {
            backgroundColor: {
              red: data.backgroundColor.red || 0,
              green: data.backgroundColor.green || 0,
              blue: data.backgroundColor.blue || 0
            }
          }),
          ...(data.horizontalAlignment && { horizontalAlignment: data.horizontalAlignment }),
          ...(data.verticalAlignment && { verticalAlignment: data.verticalAlignment }),
          ...(data.wrapStrategy && { wrapStrategy: data.wrapStrategy })
        }
      },
      fields: [
        data.backgroundColor && 'userEnteredFormat.backgroundColor',
        data.horizontalAlignment && 'userEnteredFormat.horizontalAlignment',
        data.verticalAlignment && 'userEnteredFormat.verticalAlignment',
        data.wrapStrategy && 'userEnteredFormat.wrapStrategy'
      ].filter(Boolean).join(',')
    }
  }];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests }
  });

  return successResponse(`Formatted cells in range ${data.range}`);
}

export async function handleFormatGoogleSheetText(
  sheets: sheets_v4.Sheets,
  args: unknown
): Promise<ToolResponse> {
  const validation = FormatGoogleSheetTextSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  let sheetInfo;
  try {
    sheetInfo = await getSheetInfo(sheets, data.spreadsheetId, data.range);
  } catch (err) {
    return errorResponse((err as Error).message);
  }

  const gridRange = convertA1ToGridRange(sheetInfo.a1Range, sheetInfo.sheetId);

  const textFormat: Record<string, unknown> = {};
  const fields: string[] = [];

  if (data.bold !== undefined) {
    textFormat.bold = data.bold;
    fields.push('bold');
  }
  if (data.italic !== undefined) {
    textFormat.italic = data.italic;
    fields.push('italic');
  }
  if (data.strikethrough !== undefined) {
    textFormat.strikethrough = data.strikethrough;
    fields.push('strikethrough');
  }
  if (data.underline !== undefined) {
    textFormat.underline = data.underline;
    fields.push('underline');
  }
  if (data.fontSize !== undefined) {
    textFormat.fontSize = data.fontSize;
    fields.push('fontSize');
  }
  if (data.fontFamily !== undefined) {
    textFormat.fontFamily = data.fontFamily;
    fields.push('fontFamily');
  }
  if (data.foregroundColor) {
    textFormat.foregroundColor = {
      red: data.foregroundColor.red || 0,
      green: data.foregroundColor.green || 0,
      blue: data.foregroundColor.blue || 0
    };
    fields.push('foregroundColor');
  }

  const requests: sheets_v4.Schema$Request[] = [{
    repeatCell: {
      range: gridRange,
      cell: {
        userEnteredFormat: { textFormat }
      },
      fields: 'userEnteredFormat.textFormat(' + fields.join(',') + ')'
    }
  }];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests }
  });

  return successResponse(`Applied text formatting to range ${data.range}`);
}

export async function handleFormatGoogleSheetNumbers(
  sheets: sheets_v4.Sheets,
  args: unknown
): Promise<ToolResponse> {
  const validation = FormatGoogleSheetNumbersSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  let sheetInfo;
  try {
    sheetInfo = await getSheetInfo(sheets, data.spreadsheetId, data.range);
  } catch (err) {
    return errorResponse((err as Error).message);
  }

  const gridRange = convertA1ToGridRange(sheetInfo.a1Range, sheetInfo.sheetId);

  const numberFormat: Record<string, unknown> = {
    pattern: data.pattern
  };
  if (data.type) {
    numberFormat.type = data.type;
  }

  const requests: sheets_v4.Schema$Request[] = [{
    repeatCell: {
      range: gridRange,
      cell: {
        userEnteredFormat: { numberFormat }
      },
      fields: 'userEnteredFormat.numberFormat'
    }
  }];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests }
  });

  return successResponse(`Applied number formatting to range ${data.range}`);
}

export async function handleSetGoogleSheetBorders(
  sheets: sheets_v4.Sheets,
  args: unknown
): Promise<ToolResponse> {
  const validation = SetGoogleSheetBordersSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  let sheetInfo;
  try {
    sheetInfo = await getSheetInfo(sheets, data.spreadsheetId, data.range);
  } catch (err) {
    return errorResponse((err as Error).message);
  }

  const gridRange = convertA1ToGridRange(sheetInfo.a1Range, sheetInfo.sheetId);

  const border = {
    style: data.style,
    width: data.width || 1,
    color: data.color ? {
      red: data.color.red || 0,
      green: data.color.green || 0,
      blue: data.color.blue || 0
    } : undefined
  };

  const updateBordersRequest: sheets_v4.Schema$UpdateBordersRequest = {
    range: gridRange
  };

  if (data.top !== false) updateBordersRequest.top = border;
  if (data.bottom !== false) updateBordersRequest.bottom = border;
  if (data.left !== false) updateBordersRequest.left = border;
  if (data.right !== false) updateBordersRequest.right = border;
  if (data.innerHorizontal) updateBordersRequest.innerHorizontal = border;
  if (data.innerVertical) updateBordersRequest.innerVertical = border;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests: [{ updateBorders: updateBordersRequest }] }
  });

  return successResponse(`Set borders for range ${data.range}`);
}

export async function handleMergeGoogleSheetCells(
  sheets: sheets_v4.Sheets,
  args: unknown
): Promise<ToolResponse> {
  const validation = MergeGoogleSheetCellsSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  let sheetInfo;
  try {
    sheetInfo = await getSheetInfo(sheets, data.spreadsheetId, data.range);
  } catch (err) {
    return errorResponse((err as Error).message);
  }

  const gridRange = convertA1ToGridRange(sheetInfo.a1Range, sheetInfo.sheetId);

  const requests: sheets_v4.Schema$Request[] = [{
    mergeCells: {
      range: gridRange,
      mergeType: data.mergeType
    }
  }];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests }
  });

  return successResponse(
    `Merged cells in range ${data.range} with type ${data.mergeType}`
  );
}

export async function handleAddGoogleSheetConditionalFormat(
  sheets: sheets_v4.Sheets,
  args: unknown
): Promise<ToolResponse> {
  const validation = AddGoogleSheetConditionalFormatSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
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
    values: [{ userEnteredValue: data.condition.value }]
  };

  const format: sheets_v4.Schema$CellFormat = {};
  if (data.format.backgroundColor) {
    format.backgroundColor = {
      red: data.format.backgroundColor.red || 0,
      green: data.format.backgroundColor.green || 0,
      blue: data.format.backgroundColor.blue || 0
    };
  }
  if (data.format.textFormat) {
    format.textFormat = {};
    if (data.format.textFormat.bold !== undefined) {
      format.textFormat.bold = data.format.textFormat.bold;
    }
    if (data.format.textFormat.foregroundColor) {
      format.textFormat.foregroundColor = {
        red: data.format.textFormat.foregroundColor.red || 0,
        green: data.format.textFormat.foregroundColor.green || 0,
        blue: data.format.textFormat.foregroundColor.blue || 0
      };
    }
  }

  const requests: sheets_v4.Schema$Request[] = [{
    addConditionalFormatRule: {
      rule: {
        ranges: [gridRange],
        booleanRule: {
          condition: booleanCondition,
          format: format
        }
      },
      index: 0
    }
  }];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests }
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
  title: string
): Promise<number | null> {
  // Check cache first
  const cached = getCachedSheetMetadata(spreadsheetId, title);
  if (cached) {
    return cached.sheetId;
  }

  // Fetch from API
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))'
  });

  const sheetsData = response.data.sheets
    ?.filter(s => s.properties?.title && s.properties?.sheetId !== undefined)
    .map(s => ({
      title: s.properties!.title!,
      sheetId: s.properties!.sheetId!
    })) || [];

  // Cache all sheets
  if (sheetsData.length > 0) {
    setCachedSheetMetadata(spreadsheetId, sheetsData);
  }

  const sheet = sheetsData.find(s => s.title === title);
  return sheet ? sheet.sheetId : null;
}

export async function handleCreateSheetTab(
  sheets: sheets_v4.Sheets,
  args: unknown
): Promise<ToolResponse> {
  const validation = CreateSheetTabSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Check if sheet name already exists
  const existingSheetId = await getSheetIdByTitle(sheets, data.spreadsheetId, data.title);
  if (existingSheetId !== null) {
    return errorResponse(
      `A sheet tab named "${data.title}" already exists in this spreadsheet.`
    );
  }

  // Create the new sheet
  const addSheetRequest: sheets_v4.Schema$Request = {
    addSheet: {
      properties: {
        title: data.title,
        ...(data.index !== undefined && { index: data.index })
      }
    }
  };

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests: [addSheetRequest] }
  });

  // Clear cache for this spreadsheet
  clearSheetCache(data.spreadsheetId);

  const newSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;

  return successResponse(
    `Created new sheet tab "${data.title}" (ID: ${newSheetId})`
  );
}

export async function handleDeleteSheetTab(
  sheets: sheets_v4.Sheets,
  args: unknown
): Promise<ToolResponse> {
  const validation = DeleteSheetTabSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Resolve sheet title to sheetId
  const sheetId = await getSheetIdByTitle(sheets, data.spreadsheetId, data.sheetTitle);
  if (sheetId === null) {
    return errorResponse(
      `Sheet tab "${data.sheetTitle}" not found in this spreadsheet.`
    );
  }

  // Delete the sheet
  const deleteSheetRequest: sheets_v4.Schema$Request = {
    deleteSheet: { sheetId }
  };

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: data.spreadsheetId,
      requestBody: { requests: [deleteSheetRequest] }
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    // Check if it's the "cannot delete last sheet" error
    if (err.message?.includes('last sheet') || err.message?.includes('at least one sheet')) {
      return errorResponse(
        `Cannot delete "${data.sheetTitle}" - a spreadsheet must have at least one sheet.`
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
  args: unknown
): Promise<ToolResponse> {
  const validation = RenameSheetTabSchema.safeParse(args);
  if (!validation.success) {
    return errorResponse(validation.error.errors[0].message);
  }
  const data = validation.data;

  // Resolve current title to sheetId
  const sheetId = await getSheetIdByTitle(sheets, data.spreadsheetId, data.currentTitle);
  if (sheetId === null) {
    return errorResponse(
      `Sheet tab "${data.currentTitle}" not found in this spreadsheet.`
    );
  }

  // Check if new title already exists
  const existingSheetId = await getSheetIdByTitle(sheets, data.spreadsheetId, data.newTitle);
  if (existingSheetId !== null) {
    return errorResponse(
      `A sheet tab named "${data.newTitle}" already exists in this spreadsheet.`
    );
  }

  // Rename the sheet
  const updateRequest: sheets_v4.Schema$Request = {
    updateSheetProperties: {
      properties: {
        sheetId,
        title: data.newTitle
      },
      fields: 'title'
    }
  };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: data.spreadsheetId,
    requestBody: { requests: [updateRequest] }
  });

  // Clear cache for this spreadsheet
  clearSheetCache(data.spreadsheetId);

  return successResponse(
    `Renamed sheet tab "${data.currentTitle}" to "${data.newTitle}"`
  );
}
