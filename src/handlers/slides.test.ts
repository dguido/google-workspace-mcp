import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { drive_v3, slides_v1 } from 'googleapis';
import {
  handleCreateGoogleSlides,
  handleUpdateGoogleSlides,
  handleGetGoogleSlidesContent,
  handleFormatGoogleSlidesText,
  handleFormatGoogleSlidesParagraph,
  handleStyleGoogleSlidesShape,
  handleSetGoogleSlidesBackground,
  handleCreateGoogleSlidesTextBox,
  handleCreateGoogleSlidesShape,
  handleGetGoogleSlidesSpeakerNotes,
  handleUpdateGoogleSlidesSpeakerNotes
} from './slides.js';

vi.mock('../utils/index.js', () => ({
  log: vi.fn(),
  successResponse: (text: string) => ({ content: [{ type: 'text', text }], isError: false }),
  errorResponse: (message: string) => ({ content: [{ type: 'text', text: `Error: ${message}` }], isError: true })
}));

function createMockDrive(): drive_v3.Drive {
  return {
    files: {
      list: vi.fn(),
      update: vi.fn()
    }
  } as unknown as drive_v3.Drive;
}

function createMockSlides(): slides_v1.Slides {
  return {
    presentations: {
      create: vi.fn(),
      get: vi.fn(),
      batchUpdate: vi.fn(),
      pages: {
        get: vi.fn()
      }
    }
  } as unknown as slides_v1.Slides;
}

describe('handleCreateGoogleSlides', () => {
  let mockDrive: drive_v3.Drive;
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockDrive = createMockDrive();
    mockSlides = createMockSlides();
    vi.mocked(mockDrive.files.list).mockResolvedValue({ data: { files: [] } } as never);
  });

  it('creates presentation successfully', async () => {
    vi.mocked(mockSlides.presentations.create).mockResolvedValue({
      data: { presentationId: 'pres123' }
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [
          { objectId: 'default' },
          {
            objectId: 'slide1',
            pageElements: [
              { objectId: 'title1', shape: { placeholder: { type: 'TITLE' } } },
              { objectId: 'body1', shape: { placeholder: { type: 'BODY' } } }
            ]
          }
        ]
      }
    } as never);

    const result = await handleCreateGoogleSlides(mockDrive, mockSlides, {
      name: 'Test Presentation',
      slides: [{ title: 'Slide 1', content: 'Content 1' }]
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Created Google Slides');
  });

  it('returns error when presentation already exists', async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [{ id: 'existing123' }] }
    } as never);

    const result = await handleCreateGoogleSlides(mockDrive, mockSlides, {
      name: 'Existing Presentation',
      slides: [{ title: 'Slide', content: 'Content' }]
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('already exists');
  });

  it('returns error for empty slides array', async () => {
    const result = await handleCreateGoogleSlides(mockDrive, mockSlides, {
      name: 'Test',
      slides: []
    });
    expect(result.isError).toBe(true);
  });
});

describe('handleUpdateGoogleSlides', () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it('updates presentation successfully', async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [{
          objectId: 'slide1',
          pageElements: [
            { objectId: 'title1', shape: { placeholder: { type: 'TITLE' }, text: {} } },
            { objectId: 'body1', shape: { placeholder: { type: 'BODY' }, text: {} } }
          ]
        }]
      }
    } as never);
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleUpdateGoogleSlides(mockSlides, {
      presentationId: 'pres123',
      slides: [{ title: 'Updated Title', content: 'Updated Content' }]
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Updated Google Slides');
  });

  it('returns error for empty presentation', async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: { slides: undefined }
    } as never);

    const result = await handleUpdateGoogleSlides(mockSlides, {
      presentationId: 'pres123',
      slides: [{ title: 'Title', content: 'Content' }]
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No slides found');
  });

  it('returns error for empty slides array', async () => {
    const result = await handleUpdateGoogleSlides(mockSlides, {
      presentationId: 'pres123',
      slides: []
    });
    expect(result.isError).toBe(true);
  });
});

describe('handleGetGoogleSlidesContent', () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it('returns content successfully', async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [{
          objectId: 'slide1',
          pageElements: [{
            objectId: 'text1',
            shape: {
              text: {
                textElements: [{ textRun: { content: 'Hello World' } }]
              }
            }
          }]
        }]
      }
    } as never);

    const result = await handleGetGoogleSlidesContent(mockSlides, {
      presentationId: 'pres123'
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Hello World');
  });

  it('returns error for empty presentation', async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: { slides: undefined }
    } as never);

    const result = await handleGetGoogleSlidesContent(mockSlides, {
      presentationId: 'pres123'
    });
    expect(result.isError).toBe(true);
  });
});

describe('handleFormatGoogleSlidesText', () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it('formats text successfully', async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatGoogleSlidesText(mockSlides, {
      presentationId: 'pres123',
      objectId: 'obj123',
      bold: true
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Applied text formatting');
  });

  it('returns error when no formatting specified', async () => {
    const result = await handleFormatGoogleSlidesText(mockSlides, {
      presentationId: 'pres123',
      objectId: 'obj123'
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No text formatting');
  });
});

describe('handleFormatGoogleSlidesParagraph', () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it('formats paragraph successfully', async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatGoogleSlidesParagraph(mockSlides, {
      presentationId: 'pres123',
      objectId: 'obj123',
      alignment: 'CENTER'
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Applied paragraph formatting');
  });

  it('returns error when no formatting specified', async () => {
    const result = await handleFormatGoogleSlidesParagraph(mockSlides, {
      presentationId: 'pres123',
      objectId: 'obj123'
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No paragraph formatting');
  });
});

describe('handleStyleGoogleSlidesShape', () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it('styles shape successfully', async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleStyleGoogleSlidesShape(mockSlides, {
      presentationId: 'pres123',
      objectId: 'shape123',
      backgroundColor: { red: 1, green: 0, blue: 0 }
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Applied styling');
  });

  it('returns error when no styling specified', async () => {
    const result = await handleStyleGoogleSlidesShape(mockSlides, {
      presentationId: 'pres123',
      objectId: 'shape123'
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No shape styling');
  });
});

describe('handleSetGoogleSlidesBackground', () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it('sets background successfully', async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleSetGoogleSlidesBackground(mockSlides, {
      presentationId: 'pres123',
      pageObjectIds: ['page1', 'page2'],
      backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Set background color');
  });

  it('returns error for empty pageObjectIds', async () => {
    const result = await handleSetGoogleSlidesBackground(mockSlides, {
      presentationId: 'pres123',
      pageObjectIds: [],
      backgroundColor: { red: 1 }
    });
    expect(result.isError).toBe(true);
  });
});

describe('handleCreateGoogleSlidesTextBox', () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it('creates text box successfully', async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleCreateGoogleSlidesTextBox(mockSlides, {
      presentationId: 'pres123',
      pageObjectId: 'page1',
      text: 'Hello',
      x: 100,
      y: 100,
      width: 200,
      height: 50
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Created text box');
  });

  it('returns error for empty text', async () => {
    const result = await handleCreateGoogleSlidesTextBox(mockSlides, {
      presentationId: 'pres123',
      pageObjectId: 'page1',
      text: '',
      x: 0,
      y: 0,
      width: 100,
      height: 50
    });
    expect(result.isError).toBe(true);
  });
});

describe('handleCreateGoogleSlidesShape', () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it('creates shape successfully', async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleCreateGoogleSlidesShape(mockSlides, {
      presentationId: 'pres123',
      pageObjectId: 'page1',
      shapeType: 'RECTANGLE',
      x: 100,
      y: 100,
      width: 200,
      height: 100
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Created');
    expect(result.content[0].text).toContain('shape');
  });
});

describe('handleGetGoogleSlidesSpeakerNotes', () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it('returns speaker notes successfully', async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [{
          slideProperties: {
            notesPage: {
              notesProperties: { speakerNotesObjectId: 'notes1' },
              pageElements: [{
                objectId: 'notes1',
                shape: {
                  text: {
                    textElements: [{ textRun: { content: 'Speaker notes here' } }]
                  }
                }
              }]
            }
          }
        }]
      }
    } as never);

    const result = await handleGetGoogleSlidesSpeakerNotes(mockSlides, {
      presentationId: 'pres123',
      slideIndex: 0
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Speaker notes here');
  });

  it('returns error for invalid slide index', async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: { slides: [{}] }
    } as never);

    const result = await handleGetGoogleSlidesSpeakerNotes(mockSlides, {
      presentationId: 'pres123',
      slideIndex: 5
    });
    expect(result.isError).toBe(true);
  });
});

describe('handleUpdateGoogleSlidesSpeakerNotes', () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it('updates speaker notes successfully', async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [{
          slideProperties: {
            notesPage: {
              notesProperties: { speakerNotesObjectId: 'notes1' }
            }
          }
        }]
      }
    } as never);
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleUpdateGoogleSlidesSpeakerNotes(mockSlides, {
      presentationId: 'pres123',
      slideIndex: 0,
      notes: 'New speaker notes'
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Successfully updated');
  });

  it('returns error when no speaker notes object', async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [{
          slideProperties: {}
        }]
      }
    } as never);

    const result = await handleUpdateGoogleSlidesSpeakerNotes(mockSlides, {
      presentationId: 'pres123',
      slideIndex: 0,
      notes: 'Notes'
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('does not have a speaker notes');
  });
});
