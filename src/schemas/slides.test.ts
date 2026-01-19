import { describe, it, expect } from 'vitest';
import {
  CreateGoogleSlidesSchema,
  UpdateGoogleSlidesSchema,
  GetGoogleSlidesContentSchema,
  FormatGoogleSlidesTextSchema,
  FormatGoogleSlidesParagraphSchema,
  StyleGoogleSlidesShapeSchema,
  SetGoogleSlidesBackgroundSchema,
  CreateGoogleSlidesTextBoxSchema,
  CreateGoogleSlidesShapeSchema,
  GetGoogleSlidesSpeakerNotesSchema,
  UpdateGoogleSlidesSpeakerNotesSchema
} from './slides.js';

describe('CreateGoogleSlidesSchema', () => {
  it('accepts valid input', () => {
    const result = CreateGoogleSlidesSchema.safeParse({
      name: 'My Presentation',
      slides: [{ title: 'Slide 1', content: 'Content 1' }]
    });
    expect(result.success).toBe(true);
  });

  it('accepts multiple slides', () => {
    const result = CreateGoogleSlidesSchema.safeParse({
      name: 'My Presentation',
      slides: [
        { title: 'Slide 1', content: 'Content 1' },
        { title: 'Slide 2', content: 'Content 2' }
      ]
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional parentFolderId', () => {
    const result = CreateGoogleSlidesSchema.safeParse({
      name: 'My Presentation',
      slides: [{ title: 'Slide 1', content: 'Content 1' }],
      parentFolderId: 'folder123'
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = CreateGoogleSlidesSchema.safeParse({
      name: '',
      slides: [{ title: 'Slide', content: 'Content' }]
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty slides array', () => {
    const result = CreateGoogleSlidesSchema.safeParse({
      name: 'My Presentation',
      slides: []
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateGoogleSlidesSchema', () => {
  it('accepts valid input', () => {
    const result = UpdateGoogleSlidesSchema.safeParse({
      presentationId: 'pres123',
      slides: [{ title: 'Updated', content: 'Updated content' }]
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty presentationId', () => {
    const result = UpdateGoogleSlidesSchema.safeParse({
      presentationId: '',
      slides: [{ title: 'Slide', content: 'Content' }]
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty slides array', () => {
    const result = UpdateGoogleSlidesSchema.safeParse({
      presentationId: 'pres123',
      slides: []
    });
    expect(result.success).toBe(false);
  });
});

describe('GetGoogleSlidesContentSchema', () => {
  it('accepts valid presentationId', () => {
    const result = GetGoogleSlidesContentSchema.safeParse({ presentationId: 'pres123' });
    expect(result.success).toBe(true);
  });

  it('accepts optional slideIndex', () => {
    const result = GetGoogleSlidesContentSchema.safeParse({
      presentationId: 'pres123',
      slideIndex: 0
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty presentationId', () => {
    const result = GetGoogleSlidesContentSchema.safeParse({ presentationId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects negative slideIndex', () => {
    const result = GetGoogleSlidesContentSchema.safeParse({
      presentationId: 'pres123',
      slideIndex: -1
    });
    expect(result.success).toBe(false);
  });
});

describe('FormatGoogleSlidesTextSchema', () => {
  it('accepts valid input with formatting', () => {
    const result = FormatGoogleSlidesTextSchema.safeParse({
      presentationId: 'pres123',
      objectId: 'obj123',
      bold: true
    });
    expect(result.success).toBe(true);
  });

  it('accepts all formatting options', () => {
    const result = FormatGoogleSlidesTextSchema.safeParse({
      presentationId: 'pres123',
      objectId: 'obj123',
      startIndex: 0,
      endIndex: 10,
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
      fontSize: 14,
      fontFamily: 'Arial',
      foregroundColor: { red: 1, green: 0, blue: 0 }
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty objectId', () => {
    const result = FormatGoogleSlidesTextSchema.safeParse({
      presentationId: 'pres123',
      objectId: '',
      bold: true
    });
    expect(result.success).toBe(false);
  });
});

describe('FormatGoogleSlidesParagraphSchema', () => {
  it('accepts valid input', () => {
    const result = FormatGoogleSlidesParagraphSchema.safeParse({
      presentationId: 'pres123',
      objectId: 'obj123',
      alignment: 'CENTER'
    });
    expect(result.success).toBe(true);
  });

  it('accepts all bullet styles', () => {
    const styles = ['NONE', 'DISC', 'ARROW', 'SQUARE', 'DIAMOND', 'STAR', 'NUMBERED'];
    styles.forEach(style => {
      const result = FormatGoogleSlidesParagraphSchema.safeParse({
        presentationId: 'pres123',
        objectId: 'obj123',
        bulletStyle: style
      });
      expect(result.success).toBe(true);
    });
  });

  it('rejects invalid alignment', () => {
    const result = FormatGoogleSlidesParagraphSchema.safeParse({
      presentationId: 'pres123',
      objectId: 'obj123',
      alignment: 'INVALID'
    });
    expect(result.success).toBe(false);
  });
});

describe('StyleGoogleSlidesShapeSchema', () => {
  it('accepts valid input with backgroundColor', () => {
    const result = StyleGoogleSlidesShapeSchema.safeParse({
      presentationId: 'pres123',
      objectId: 'shape123',
      backgroundColor: { red: 1, green: 0, blue: 0, alpha: 0.5 }
    });
    expect(result.success).toBe(true);
  });

  it('accepts outline options', () => {
    const result = StyleGoogleSlidesShapeSchema.safeParse({
      presentationId: 'pres123',
      objectId: 'shape123',
      outlineColor: { red: 0, green: 0, blue: 0 },
      outlineWeight: 2,
      outlineDashStyle: 'DASH'
    });
    expect(result.success).toBe(true);
  });

  it('accepts all dash styles', () => {
    const styles = ['SOLID', 'DOT', 'DASH', 'DASH_DOT', 'LONG_DASH', 'LONG_DASH_DOT'];
    styles.forEach(style => {
      const result = StyleGoogleSlidesShapeSchema.safeParse({
        presentationId: 'pres123',
        objectId: 'shape123',
        outlineDashStyle: style
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('SetGoogleSlidesBackgroundSchema', () => {
  it('accepts valid input', () => {
    const result = SetGoogleSlidesBackgroundSchema.safeParse({
      presentationId: 'pres123',
      pageObjectIds: ['page1', 'page2'],
      backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty pageObjectIds', () => {
    const result = SetGoogleSlidesBackgroundSchema.safeParse({
      presentationId: 'pres123',
      pageObjectIds: [],
      backgroundColor: { red: 1 }
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateGoogleSlidesTextBoxSchema', () => {
  it('accepts valid input', () => {
    const result = CreateGoogleSlidesTextBoxSchema.safeParse({
      presentationId: 'pres123',
      pageObjectId: 'page1',
      text: 'Hello World',
      x: 100,
      y: 100,
      width: 300,
      height: 50
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional formatting', () => {
    const result = CreateGoogleSlidesTextBoxSchema.safeParse({
      presentationId: 'pres123',
      pageObjectId: 'page1',
      text: 'Hello',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fontSize: 14,
      bold: true,
      italic: true
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty text', () => {
    const result = CreateGoogleSlidesTextBoxSchema.safeParse({
      presentationId: 'pres123',
      pageObjectId: 'page1',
      text: '',
      x: 0,
      y: 0,
      width: 100,
      height: 50
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateGoogleSlidesShapeSchema', () => {
  it('accepts valid input', () => {
    const result = CreateGoogleSlidesShapeSchema.safeParse({
      presentationId: 'pres123',
      pageObjectId: 'page1',
      shapeType: 'RECTANGLE',
      x: 100,
      y: 100,
      width: 200,
      height: 100
    });
    expect(result.success).toBe(true);
  });

  it('accepts all shape types', () => {
    const types = ['RECTANGLE', 'ELLIPSE', 'DIAMOND', 'TRIANGLE', 'STAR', 'ROUND_RECTANGLE', 'ARROW'];
    types.forEach(type => {
      const result = CreateGoogleSlidesShapeSchema.safeParse({
        presentationId: 'pres123',
        pageObjectId: 'page1',
        shapeType: type,
        x: 0,
        y: 0,
        width: 100,
        height: 100
      });
      expect(result.success).toBe(true);
    });
  });

  it('accepts optional backgroundColor', () => {
    const result = CreateGoogleSlidesShapeSchema.safeParse({
      presentationId: 'pres123',
      pageObjectId: 'page1',
      shapeType: 'RECTANGLE',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: { red: 1, green: 0, blue: 0, alpha: 1 }
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid shapeType', () => {
    const result = CreateGoogleSlidesShapeSchema.safeParse({
      presentationId: 'pres123',
      pageObjectId: 'page1',
      shapeType: 'INVALID',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    });
    expect(result.success).toBe(false);
  });
});

describe('GetGoogleSlidesSpeakerNotesSchema', () => {
  it('accepts valid input', () => {
    const result = GetGoogleSlidesSpeakerNotesSchema.safeParse({
      presentationId: 'pres123',
      slideIndex: 0
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative slideIndex', () => {
    const result = GetGoogleSlidesSpeakerNotesSchema.safeParse({
      presentationId: 'pres123',
      slideIndex: -1
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateGoogleSlidesSpeakerNotesSchema', () => {
  it('accepts valid input', () => {
    const result = UpdateGoogleSlidesSpeakerNotesSchema.safeParse({
      presentationId: 'pres123',
      slideIndex: 0,
      notes: 'These are speaker notes'
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty notes', () => {
    const result = UpdateGoogleSlidesSpeakerNotesSchema.safeParse({
      presentationId: 'pres123',
      slideIndex: 0,
      notes: ''
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative slideIndex', () => {
    const result = UpdateGoogleSlidesSpeakerNotesSchema.safeParse({
      presentationId: 'pres123',
      slideIndex: -1,
      notes: 'notes'
    });
    expect(result.success).toBe(false);
  });
});
