import { describe, it, expect } from 'vitest';
import {
  CreateGoogleSheetSchema,
  UpdateGoogleSheetSchema,
  GetGoogleSheetContentSchema,
  FormatGoogleSheetCellsSchema,
  FormatGoogleSheetTextSchema,
  FormatGoogleSheetNumbersSchema,
  SetGoogleSheetBordersSchema,
  MergeGoogleSheetCellsSchema,
  AddGoogleSheetConditionalFormatSchema
} from './sheets.js';

describe('CreateGoogleSheetSchema', () => {
  it('accepts valid input', () => {
    const result = CreateGoogleSheetSchema.safeParse({
      name: 'My Sheet',
      data: [['A1', 'B1'], ['A2', 'B2']]
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional parentFolderId and valueInputOption', () => {
    const result = CreateGoogleSheetSchema.safeParse({
      name: 'My Sheet',
      data: [['A1']],
      parentFolderId: 'folder123',
      valueInputOption: 'USER_ENTERED'
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = CreateGoogleSheetSchema.safeParse({ name: '', data: [[]] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid valueInputOption', () => {
    const result = CreateGoogleSheetSchema.safeParse({
      name: 'Sheet',
      data: [[]],
      valueInputOption: 'INVALID'
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateGoogleSheetSchema', () => {
  it('accepts valid input', () => {
    const result = UpdateGoogleSheetSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1:B2',
      data: [['A1', 'B1']]
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty spreadsheetId', () => {
    const result = UpdateGoogleSheetSchema.safeParse({
      spreadsheetId: '',
      range: 'A1',
      data: [[]]
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty range', () => {
    const result = UpdateGoogleSheetSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: '',
      data: [[]]
    });
    expect(result.success).toBe(false);
  });
});

describe('GetGoogleSheetContentSchema', () => {
  it('accepts valid input', () => {
    const result = GetGoogleSheetContentSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1:B10'
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing fields', () => {
    const result = GetGoogleSheetContentSchema.safeParse({ spreadsheetId: 'sheet123' });
    expect(result.success).toBe(false);
  });
});

describe('FormatGoogleSheetCellsSchema', () => {
  it('accepts valid input with backgroundColor', () => {
    const result = FormatGoogleSheetCellsSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1:B2',
      backgroundColor: { red: 1, green: 0, blue: 0 }
    });
    expect(result.success).toBe(true);
  });

  it('accepts all alignment options', () => {
    const result = FormatGoogleSheetCellsSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1',
      horizontalAlignment: 'CENTER',
      verticalAlignment: 'MIDDLE',
      wrapStrategy: 'WRAP'
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid horizontalAlignment', () => {
    const result = FormatGoogleSheetCellsSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1',
      horizontalAlignment: 'INVALID'
    });
    expect(result.success).toBe(false);
  });
});

describe('FormatGoogleSheetTextSchema', () => {
  it('accepts valid text formatting', () => {
    const result = FormatGoogleSheetTextSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1:B2',
      bold: true,
      italic: true,
      fontSize: 12
    });
    expect(result.success).toBe(true);
  });

  it('accepts foregroundColor', () => {
    const result = FormatGoogleSheetTextSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1',
      foregroundColor: { red: 0.5, green: 0.5, blue: 0.5 }
    });
    expect(result.success).toBe(true);
  });

  it('rejects fontSize less than 1', () => {
    const result = FormatGoogleSheetTextSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1',
      fontSize: 0
    });
    expect(result.success).toBe(false);
  });
});

describe('FormatGoogleSheetNumbersSchema', () => {
  it('accepts valid input', () => {
    const result = FormatGoogleSheetNumbersSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1:A10',
      pattern: '$#,##0.00'
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional type', () => {
    const result = FormatGoogleSheetNumbersSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1',
      pattern: '0.00%',
      type: 'PERCENT'
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty pattern', () => {
    const result = FormatGoogleSheetNumbersSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1',
      pattern: ''
    });
    expect(result.success).toBe(false);
  });
});

describe('SetGoogleSheetBordersSchema', () => {
  it('accepts valid border style', () => {
    const result = SetGoogleSheetBordersSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1:B2',
      style: 'SOLID'
    });
    expect(result.success).toBe(true);
  });

  it('accepts all optional border options', () => {
    const result = SetGoogleSheetBordersSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1:B2',
      style: 'DASHED',
      width: 2,
      color: { red: 0, green: 0, blue: 0 },
      top: true,
      bottom: true,
      left: false,
      right: false,
      innerHorizontal: true,
      innerVertical: true
    });
    expect(result.success).toBe(true);
  });

  it('rejects width outside range', () => {
    const result = SetGoogleSheetBordersSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1',
      style: 'SOLID',
      width: 5
    });
    expect(result.success).toBe(false);
  });
});

describe('MergeGoogleSheetCellsSchema', () => {
  it('accepts valid merge request', () => {
    const result = MergeGoogleSheetCellsSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1:B2',
      mergeType: 'MERGE_ALL'
    });
    expect(result.success).toBe(true);
  });

  it('accepts all merge types', () => {
    const types = ['MERGE_ALL', 'MERGE_COLUMNS', 'MERGE_ROWS'];
    types.forEach(type => {
      const result = MergeGoogleSheetCellsSchema.safeParse({
        spreadsheetId: 'sheet123',
        range: 'A1:B2',
        mergeType: type
      });
      expect(result.success).toBe(true);
    });
  });

  it('rejects invalid mergeType', () => {
    const result = MergeGoogleSheetCellsSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1:B2',
      mergeType: 'INVALID'
    });
    expect(result.success).toBe(false);
  });
});

describe('AddGoogleSheetConditionalFormatSchema', () => {
  it('accepts valid conditional format', () => {
    const result = AddGoogleSheetConditionalFormatSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1:A10',
      condition: { type: 'NUMBER_GREATER', value: '100' },
      format: { backgroundColor: { red: 1, green: 0, blue: 0 } }
    });
    expect(result.success).toBe(true);
  });

  it('accepts text format in format', () => {
    const result = AddGoogleSheetConditionalFormatSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1',
      condition: { type: 'TEXT_CONTAINS', value: 'test' },
      format: {
        textFormat: {
          bold: true,
          foregroundColor: { red: 1, green: 0, blue: 0 }
        }
      }
    });
    expect(result.success).toBe(true);
  });

  it('accepts all condition types', () => {
    const types = [
      'NUMBER_GREATER', 'NUMBER_LESS',
      'TEXT_CONTAINS', 'TEXT_STARTS_WITH', 'TEXT_ENDS_WITH',
      'CUSTOM_FORMULA'
    ];
    types.forEach(type => {
      const result = AddGoogleSheetConditionalFormatSchema.safeParse({
        spreadsheetId: 'sheet123',
        range: 'A1',
        condition: { type, value: 'test' },
        format: {}
      });
      expect(result.success).toBe(true);
    });
  });

  it('rejects invalid condition type', () => {
    const result = AddGoogleSheetConditionalFormatSchema.safeParse({
      spreadsheetId: 'sheet123',
      range: 'A1',
      condition: { type: 'INVALID', value: 'test' },
      format: {}
    });
    expect(result.success).toBe(false);
  });
});
