import { z } from "zod";

// Unified sheet tabs schema - replaces list/create/delete/rename individual schemas
export const SheetTabsSchema = z
  .object({
    spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
    action: z.enum(["list", "create", "delete", "rename"]),
    title: z.string().optional().describe("Tab title (for create/delete)"),
    index: z.number().int().min(0).optional().describe("Position for new tab (create only)"),
    currentTitle: z.string().optional().describe("Current title to rename (rename only)"),
    newTitle: z.string().optional().describe("New title (rename only)"),
  })
  .refine(
    (data) => {
      switch (data.action) {
        case "list":
          return true;
        case "create":
        case "delete":
          return !!data.title;
        case "rename":
          return !!(data.currentTitle && data.newTitle);
        default:
          return false;
      }
    },
    {
      message:
        "Missing required params: create/delete need 'title', rename needs 'currentTitle' and 'newTitle'",
    },
  );

export type SheetTabsInput = z.infer<typeof SheetTabsSchema>;

export const CreateGoogleSheetSchema = z
  .object({
    name: z.string().min(1, "Sheet name is required"),
    data: z.array(z.array(z.string())),
    parentFolderId: z.string().optional(),
    parentPath: z.string().optional(),
    valueInputOption: z.enum(["RAW", "USER_ENTERED"]).optional(),
  })
  .refine((data) => !(data.parentFolderId && data.parentPath), {
    message: "Provide either parentFolderId or parentPath, not both",
  });

export const UpdateGoogleSheetSchema = z.object({
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
  range: z.string().min(1, "Range is required"),
  data: z.array(z.array(z.string())),
  valueInputOption: z.enum(["RAW", "USER_ENTERED"]).optional(),
});

export const GetGoogleSheetContentSchema = z.object({
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
  range: z.string().optional(),
});

// Color schema reused across formatting options
const ColorSchema = z.object({
  red: z.number().min(0).max(1).optional(),
  green: z.number().min(0).max(1).optional(),
  blue: z.number().min(0).max(1).optional(),
});

export const FormatGoogleSheetCellsSchema = z.object({
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
  range: z.string().min(1, "Range is required"),
  // Cell formatting
  backgroundColor: ColorSchema.optional(),
  horizontalAlignment: z.enum(["LEFT", "CENTER", "RIGHT"]).optional(),
  verticalAlignment: z.enum(["TOP", "MIDDLE", "BOTTOM"]).optional(),
  wrapStrategy: z.enum(["OVERFLOW_CELL", "CLIP", "WRAP"]).optional(),
  // Text formatting
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  underline: z.boolean().optional(),
  fontSize: z.number().min(1).optional(),
  fontFamily: z.string().optional(),
  foregroundColor: ColorSchema.optional(),
  // Number formatting
  numberFormat: z
    .object({
      pattern: z.string(),
      type: z
        .enum(["NUMBER", "CURRENCY", "PERCENT", "DATE", "TIME", "DATE_TIME", "SCIENTIFIC"])
        .optional(),
    })
    .optional(),
  // Border formatting
  borders: z
    .object({
      style: z.enum(["SOLID", "DASHED", "DOTTED", "DOUBLE"]),
      width: z.number().min(1).max(3).optional(),
      color: ColorSchema.optional(),
      top: z.boolean().optional(),
      bottom: z.boolean().optional(),
      left: z.boolean().optional(),
      right: z.boolean().optional(),
      innerHorizontal: z.boolean().optional(),
      innerVertical: z.boolean().optional(),
    })
    .optional(),
});

export const MergeGoogleSheetCellsSchema = z.object({
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
  range: z.string().min(1, "Range is required"),
  mergeType: z.enum(["MERGE_ALL", "MERGE_COLUMNS", "MERGE_ROWS"]),
});

export const AddGoogleSheetConditionalFormatSchema = z.object({
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
  range: z.string().min(1, "Range is required"),
  condition: z.object({
    type: z.enum([
      "NUMBER_GREATER",
      "NUMBER_LESS",
      "TEXT_CONTAINS",
      "TEXT_STARTS_WITH",
      "TEXT_ENDS_WITH",
      "CUSTOM_FORMULA",
    ]),
    value: z.string(),
  }),
  format: z.object({
    backgroundColor: z
      .object({
        red: z.number().min(0).max(1).optional(),
        green: z.number().min(0).max(1).optional(),
        blue: z.number().min(0).max(1).optional(),
      })
      .optional(),
    textFormat: z
      .object({
        bold: z.boolean().optional(),
        foregroundColor: z
          .object({
            red: z.number().min(0).max(1).optional(),
            green: z.number().min(0).max(1).optional(),
            blue: z.number().min(0).max(1).optional(),
          })
          .optional(),
      })
      .optional(),
  }),
});

// Type exports
export type CreateGoogleSheetInput = z.infer<typeof CreateGoogleSheetSchema>;
export type UpdateGoogleSheetInput = z.infer<typeof UpdateGoogleSheetSchema>;
export type GetGoogleSheetContentInput = z.infer<typeof GetGoogleSheetContentSchema>;
export type FormatGoogleSheetCellsInput = z.infer<typeof FormatGoogleSheetCellsSchema>;
export type MergeGoogleSheetCellsInput = z.infer<typeof MergeGoogleSheetCellsSchema>;
export type AddGoogleSheetConditionalFormatInput = z.infer<
  typeof AddGoogleSheetConditionalFormatSchema
>;
