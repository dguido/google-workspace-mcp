import { describe, it, expect } from 'vitest';
import {
  CreateGoogleDocSchema,
  UpdateGoogleDocSchema,
  FormatGoogleDocTextSchema,
  FormatGoogleDocParagraphSchema,
  GetGoogleDocContentSchema
} from './docs.js';

describe('CreateGoogleDocSchema', () => {
  it('accepts valid input', () => {
    const result = CreateGoogleDocSchema.safeParse({ name: 'My Doc', content: 'Hello world' });
    expect(result.success).toBe(true);
  });

  it('accepts optional parentFolderId', () => {
    const result = CreateGoogleDocSchema.safeParse({
      name: 'My Doc',
      content: 'Hello',
      parentFolderId: 'folder123'
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = CreateGoogleDocSchema.safeParse({ name: '', content: 'Hello' });
    expect(result.success).toBe(false);
  });
});

describe('UpdateGoogleDocSchema', () => {
  it('accepts valid input', () => {
    const result = UpdateGoogleDocSchema.safeParse({ documentId: 'doc123', content: 'New content' });
    expect(result.success).toBe(true);
  });

  it('rejects empty documentId', () => {
    const result = UpdateGoogleDocSchema.safeParse({ documentId: '', content: 'content' });
    expect(result.success).toBe(false);
  });
});

describe('FormatGoogleDocTextSchema', () => {
  it('accepts valid input with formatting', () => {
    const result = FormatGoogleDocTextSchema.safeParse({
      documentId: 'doc123',
      startIndex: 1,
      endIndex: 10,
      bold: true
    });
    expect(result.success).toBe(true);
  });

  it('accepts all optional formatting options', () => {
    const result = FormatGoogleDocTextSchema.safeParse({
      documentId: 'doc123',
      startIndex: 1,
      endIndex: 10,
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
      fontSize: 14,
      foregroundColor: { red: 1, green: 0, blue: 0 }
    });
    expect(result.success).toBe(true);
  });

  it('rejects startIndex less than 1', () => {
    const result = FormatGoogleDocTextSchema.safeParse({
      documentId: 'doc123',
      startIndex: 0,
      endIndex: 10,
      bold: true
    });
    expect(result.success).toBe(false);
  });

  it('rejects color values outside 0-1 range', () => {
    const result = FormatGoogleDocTextSchema.safeParse({
      documentId: 'doc123',
      startIndex: 1,
      endIndex: 10,
      foregroundColor: { red: 2 }
    });
    expect(result.success).toBe(false);
  });
});

describe('FormatGoogleDocParagraphSchema', () => {
  it('accepts valid input', () => {
    const result = FormatGoogleDocParagraphSchema.safeParse({
      documentId: 'doc123',
      startIndex: 1,
      endIndex: 10,
      alignment: 'CENTER'
    });
    expect(result.success).toBe(true);
  });

  it('accepts all named style types', () => {
    const validStyles = [
      'NORMAL_TEXT', 'TITLE', 'SUBTITLE',
      'HEADING_1', 'HEADING_2', 'HEADING_3',
      'HEADING_4', 'HEADING_5', 'HEADING_6'
    ];
    validStyles.forEach(style => {
      const result = FormatGoogleDocParagraphSchema.safeParse({
        documentId: 'doc123',
        startIndex: 1,
        endIndex: 10,
        namedStyleType: style
      });
      expect(result.success).toBe(true);
    });
  });

  it('rejects invalid alignment', () => {
    const result = FormatGoogleDocParagraphSchema.safeParse({
      documentId: 'doc123',
      startIndex: 1,
      endIndex: 10,
      alignment: 'INVALID'
    });
    expect(result.success).toBe(false);
  });
});

describe('GetGoogleDocContentSchema', () => {
  it('accepts valid documentId', () => {
    const result = GetGoogleDocContentSchema.safeParse({ documentId: 'doc123' });
    expect(result.success).toBe(true);
  });

  it('rejects empty documentId', () => {
    const result = GetGoogleDocContentSchema.safeParse({ documentId: '' });
    expect(result.success).toBe(false);
  });
});
