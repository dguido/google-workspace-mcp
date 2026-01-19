import { describe, it, expect } from 'vitest';
import {
  getExtensionFromFilename,
  getMimeTypeFromFilename,
  validateTextFileExtension,
  convertA1ToGridRange
} from './helpers.js';

describe('getExtensionFromFilename', () => {
  it('returns extension for simple filename', () => {
    expect(getExtensionFromFilename('file.txt')).toBe('txt');
  });

  it('returns extension for filename with multiple dots', () => {
    expect(getExtensionFromFilename('file.name.md')).toBe('md');
  });

  it('returns lowercase extension', () => {
    expect(getExtensionFromFilename('FILE.TXT')).toBe('txt');
  });

  it('returns filename for filename without extension', () => {
    // split('.').pop() returns the whole string when there's no dot
    expect(getExtensionFromFilename('filename')).toBe('filename');
  });
});

describe('getMimeTypeFromFilename', () => {
  it('returns text/plain for .txt files', () => {
    expect(getMimeTypeFromFilename('file.txt')).toBe('text/plain');
  });

  it('returns text/markdown for .md files', () => {
    expect(getMimeTypeFromFilename('README.md')).toBe('text/markdown');
  });

  it('returns text/plain for unknown extensions', () => {
    expect(getMimeTypeFromFilename('file.xyz')).toBe('text/plain');
  });

  it('returns text/plain for files without extension', () => {
    expect(getMimeTypeFromFilename('filename')).toBe('text/plain');
  });
});

describe('validateTextFileExtension', () => {
  it('does not throw for .txt files', () => {
    expect(() => validateTextFileExtension('file.txt')).not.toThrow();
  });

  it('does not throw for .md files', () => {
    expect(() => validateTextFileExtension('readme.md')).not.toThrow();
  });

  it('throws for invalid extension', () => {
    expect(() => validateTextFileExtension('file.pdf')).toThrow(
      'File name must end with .txt or .md for text files.'
    );
  });

  it('throws for files without extension', () => {
    expect(() => validateTextFileExtension('filename')).toThrow(
      'File name must end with .txt or .md for text files.'
    );
  });
});

describe('convertA1ToGridRange', () => {
  it('converts single cell A1', () => {
    const result = convertA1ToGridRange('A1', 0);
    expect(result).toEqual({
      sheetId: 0,
      startColumnIndex: 0,
      endColumnIndex: 1,
      startRowIndex: 0,
      endRowIndex: 1
    });
  });

  it('converts range A1:B2', () => {
    const result = convertA1ToGridRange('A1:B2', 0);
    expect(result).toEqual({
      sheetId: 0,
      startColumnIndex: 0,
      endColumnIndex: 2,
      startRowIndex: 0,
      endRowIndex: 2
    });
  });

  it('converts multi-letter column AA1:AB10', () => {
    const result = convertA1ToGridRange('AA1:AB10', 0);
    expect(result).toEqual({
      sheetId: 0,
      startColumnIndex: 26,
      endColumnIndex: 28,
      startRowIndex: 0,
      endRowIndex: 10
    });
  });

  it('converts column-only range A:B', () => {
    const result = convertA1ToGridRange('A:B', 0);
    expect(result).toEqual({
      sheetId: 0,
      startColumnIndex: 0,
      endColumnIndex: 2
    });
  });

  it('converts row-only range 1:5', () => {
    const result = convertA1ToGridRange('1:5', 0);
    expect(result).toEqual({
      sheetId: 0,
      startRowIndex: 0,
      endRowIndex: 5
    });
  });

  it('handles single column A', () => {
    const result = convertA1ToGridRange('A', 0);
    expect(result).toEqual({
      sheetId: 0,
      startColumnIndex: 0,
      endColumnIndex: 1
    });
  });

  it('preserves sheetId', () => {
    const result = convertA1ToGridRange('A1', 42);
    expect(result.sheetId).toBe(42);
  });

  it('throws for invalid A1 notation', () => {
    expect(() => convertA1ToGridRange('invalid!', 0)).toThrow(
      'Invalid A1 notation: invalid!'
    );
  });
});
