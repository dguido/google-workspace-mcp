import { z } from "zod";

export const ListSheetTabsSchema = z.object({
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
});

export type ListSheetTabsInput = z.infer<typeof ListSheetTabsSchema>;

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
        .enum([
          "NUMBER",
          "CURRENCY",
          "PERCENT",
          "DATE",
          "TIME",
          "DATE_TIME",
          "SCIENTIFIC",
        ])
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

export const CreateSheetTabSchema = z.object({
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
  title: z.string().min(1, "Tab title is required"),
  index: z.number().int().min(0).optional(),
});

export const DeleteSheetTabSchema = z.object({
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
  sheetTitle: z.string().min(1, "Sheet title is required"),
});

export const RenameSheetTabSchema = z.object({
  spreadsheetId: z.string().min(1, "Spreadsheet ID is required"),
  currentTitle: z.string().min(1, "Current title is required"),
  newTitle: z.string().min(1, "New title is required"),
});

// Type exports
export type CreateGoogleSheetInput = z.infer<typeof CreateGoogleSheetSchema>;
export type UpdateGoogleSheetInput = z.infer<typeof UpdateGoogleSheetSchema>;
export type GetGoogleSheetContentInput = z.infer<
  typeof GetGoogleSheetContentSchema
>;
export type FormatGoogleSheetCellsInput = z.infer<
  typeof FormatGoogleSheetCellsSchema
>;
export type MergeGoogleSheetCellsInput = z.infer<
  typeof MergeGoogleSheetCellsSchema
>;
export type AddGoogleSheetConditionalFormatInput = z.infer<
  typeof AddGoogleSheetConditionalFormatSchema
>;
export type CreateSheetTabInput = z.infer<typeof CreateSheetTabSchema>;
export type DeleteSheetTabInput = z.infer<typeof DeleteSheetTabSchema>;
export type RenameSheetTabInput = z.infer<typeof RenameSheetTabSchema>;
