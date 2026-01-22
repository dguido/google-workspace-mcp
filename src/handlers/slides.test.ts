import { describe, it, expect, vi, beforeEach } from "vitest";
import type { drive_v3, slides_v1 } from "googleapis";
import {
  handleCreateGoogleSlides,
  handleUpdateGoogleSlides,
  handleGetGoogleSlidesContent,
  handleCreateGoogleSlidesTextBox,
  handleCreateGoogleSlidesShape,
  handleSlidesSpeakerNotes,
  handleFormatSlidesText,
  handleFormatSlidesShape,
  handleFormatSlideBackground,
} from "./slides.js";

vi.mock("../utils/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/index.js")>();
  return {
    ...actual,
    log: vi.fn(),
    withTimeout: <T>(promise: Promise<T>) => promise,
  };
});

function createMockDrive(): drive_v3.Drive {
  return {
    files: {
      list: vi.fn(),
      update: vi.fn(),
      get: vi.fn(),
    },
  } as unknown as drive_v3.Drive;
}

function createMockSlides(): slides_v1.Slides {
  return {
    presentations: {
      create: vi.fn(),
      get: vi.fn(),
      batchUpdate: vi.fn(),
      pages: {
        get: vi.fn(),
      },
    },
  } as unknown as slides_v1.Slides;
}

describe("handleCreateGoogleSlides", () => {
  let mockDrive: drive_v3.Drive;
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockDrive = createMockDrive();
    mockSlides = createMockSlides();
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [] },
    } as never);
  });

  it("creates presentation successfully", async () => {
    vi.mocked(mockSlides.presentations.create).mockResolvedValue({
      data: { presentationId: "pres123" },
    } as never);
    vi.mocked(mockDrive.files.update).mockResolvedValue({} as never);
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [
          { objectId: "default" },
          {
            objectId: "slide1",
            pageElements: [
              { objectId: "title1", shape: { placeholder: { type: "TITLE" } } },
              { objectId: "body1", shape: { placeholder: { type: "BODY" } } },
            ],
          },
        ],
      },
    } as never);

    const result = await handleCreateGoogleSlides(mockDrive, mockSlides, {
      name: "Test Presentation",
      slides: [{ title: "Slide 1", content: "Content 1" }],
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created Google Slides");
  });

  it("returns error when presentation already exists", async () => {
    vi.mocked(mockDrive.files.list).mockResolvedValue({
      data: { files: [{ id: "existing123" }] },
    } as never);

    const result = await handleCreateGoogleSlides(mockDrive, mockSlides, {
      name: "Existing Presentation",
      slides: [{ title: "Slide", content: "Content" }],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("already exists");
  });

  it("returns error for empty slides array", async () => {
    const result = await handleCreateGoogleSlides(mockDrive, mockSlides, {
      name: "Test",
      slides: [],
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleUpdateGoogleSlides", () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it("updates presentation successfully", async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [
          {
            objectId: "slide1",
            pageElements: [
              {
                objectId: "title1",
                shape: { placeholder: { type: "TITLE" }, text: {} },
              },
              {
                objectId: "body1",
                shape: { placeholder: { type: "BODY" }, text: {} },
              },
            ],
          },
        ],
      },
    } as never);
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleUpdateGoogleSlides(mockSlides, {
      presentationId: "pres123",
      slides: [{ title: "Updated Title", content: "Updated Content" }],
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Updated Google Slides");
  });

  it("returns error for empty presentation", async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: { slides: undefined },
    } as never);

    const result = await handleUpdateGoogleSlides(mockSlides, {
      presentationId: "pres123",
      slides: [{ title: "Title", content: "Content" }],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No slides found");
  });

  it("returns error for empty slides array", async () => {
    const result = await handleUpdateGoogleSlides(mockSlides, {
      presentationId: "pres123",
      slides: [],
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleGetGoogleSlidesContent", () => {
  let mockDrive: drive_v3.Drive;
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockDrive = createMockDrive();
    mockSlides = createMockSlides();
    // Mock files.get to return correct MIME type
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        mimeType: "application/vnd.google-apps.presentation",
        name: "Test Presentation",
      },
    } as never);
  });

  it("returns content successfully", async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [
          {
            objectId: "slide1",
            pageElements: [
              {
                objectId: "text1",
                shape: {
                  text: {
                    textElements: [{ textRun: { content: "Hello World" } }],
                  },
                },
              },
            ],
          },
        ],
      },
    } as never);

    const result = await handleGetGoogleSlidesContent(mockDrive, mockSlides, {
      presentationId: "pres123",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Hello World");
  });

  it("returns error for empty presentation", async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: { slides: undefined },
    } as never);

    const result = await handleGetGoogleSlidesContent(mockDrive, mockSlides, {
      presentationId: "pres123",
    });
    expect(result.isError).toBe(true);
  });

  it("returns helpful error for file type mismatch", async () => {
    vi.mocked(mockDrive.files.get).mockResolvedValue({
      data: {
        mimeType: "application/vnd.google-apps.spreadsheet",
        name: "My Sheet",
      },
    } as never);

    const result = await handleGetGoogleSlidesContent(mockDrive, mockSlides, {
      presentationId: "sheet123",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("is not a Google Slides presentation");
    expect(result.content[0].text).toContain("Use getGoogleSheetContent");
  });
});

describe("handleCreateGoogleSlidesTextBox", () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it("creates text box successfully", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleCreateGoogleSlidesTextBox(mockSlides, {
      presentationId: "pres123",
      pageObjectId: "page1",
      text: "Hello",
      x: 100,
      y: 100,
      width: 200,
      height: 50,
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created text box");
  });

  it("returns error for empty text", async () => {
    const result = await handleCreateGoogleSlidesTextBox(mockSlides, {
      presentationId: "pres123",
      pageObjectId: "page1",
      text: "",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleCreateGoogleSlidesShape", () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it("creates shape successfully", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleCreateGoogleSlidesShape(mockSlides, {
      presentationId: "pres123",
      pageObjectId: "page1",
      shapeType: "RECTANGLE",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created");
    expect(result.content[0].text).toContain("shape");
  });
});

describe("handleSlidesSpeakerNotes - get action", () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it("returns speaker notes successfully", async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [
          {
            slideProperties: {
              notesPage: {
                notesProperties: { speakerNotesObjectId: "notes1" },
                pageElements: [
                  {
                    objectId: "notes1",
                    shape: {
                      text: {
                        textElements: [{ textRun: { content: "Speaker notes here" } }],
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    } as never);

    const result = await handleSlidesSpeakerNotes(mockSlides, {
      presentationId: "pres123",
      slideIndex: 0,
      action: "get",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Speaker notes here");
  });

  it("returns error for invalid slide index", async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: { slides: [{}] },
    } as never);

    const result = await handleSlidesSpeakerNotes(mockSlides, {
      presentationId: "pres123",
      slideIndex: 5,
      action: "get",
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleSlidesSpeakerNotes - update action", () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it("updates speaker notes successfully", async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [
          {
            slideProperties: {
              notesPage: {
                notesProperties: { speakerNotesObjectId: "notes1" },
              },
            },
          },
        ],
      },
    } as never);
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleSlidesSpeakerNotes(mockSlides, {
      presentationId: "pres123",
      slideIndex: 0,
      action: "update",
      notes: "New speaker notes",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Successfully updated");
  });

  it("returns error when no speaker notes object", async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [
          {
            slideProperties: {},
          },
        ],
      },
    } as never);

    const result = await handleSlidesSpeakerNotes(mockSlides, {
      presentationId: "pres123",
      slideIndex: 0,
      action: "update",
      notes: "Notes",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("does not have a speaker notes");
  });

  it("updates speaker notes successfully when notes are empty", async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [
          {
            slideProperties: {
              notesPage: {
                notesProperties: { speakerNotesObjectId: "notes1" },
                pageElements: [
                  {
                    objectId: "notes1",
                    shape: {
                      text: {
                        textElements: [], // Empty notes
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    } as never);
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleSlidesSpeakerNotes(mockSlides, {
      presentationId: "pres123",
      slideIndex: 0,
      action: "update",
      notes: "New speaker notes",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Successfully updated");

    // Verify that deleteText was NOT called (only insertText should be called)
    const batchUpdateCall = vi.mocked(mockSlides.presentations.batchUpdate).mock.calls[0][0] as {
      requestBody?: { requests?: Array<{ deleteText?: unknown }> };
    };
    const requests = batchUpdateCall.requestBody?.requests || [];
    expect(requests.length).toBe(1);
    expect(requests[0].deleteText).toBeUndefined();
  });

  it("updates speaker notes successfully when notes have whitespace only", async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [
          {
            slideProperties: {
              notesPage: {
                notesProperties: { speakerNotesObjectId: "notes1" },
                pageElements: [
                  {
                    objectId: "notes1",
                    shape: {
                      text: {
                        textElements: [{ textRun: { content: "   \n  " } }], // Whitespace only
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    } as never);
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleSlidesSpeakerNotes(mockSlides, {
      presentationId: "pres123",
      slideIndex: 0,
      action: "update",
      notes: "New content",
    });
    expect(result.isError).toBe(false);

    // Whitespace-only is treated as empty, so no deleteText
    const batchUpdateCall = vi.mocked(mockSlides.presentations.batchUpdate).mock.calls[0][0] as {
      requestBody?: { requests?: Array<{ deleteText?: unknown }> };
    };
    const requests = batchUpdateCall.requestBody?.requests || [];
    expect(requests.length).toBe(1);
    expect(requests[0].deleteText).toBeUndefined();
  });

  it("deletes existing text before inserting when notes have content", async () => {
    vi.mocked(mockSlides.presentations.get).mockResolvedValue({
      data: {
        slides: [
          {
            slideProperties: {
              notesPage: {
                notesProperties: { speakerNotesObjectId: "notes1" },
                pageElements: [
                  {
                    objectId: "notes1",
                    shape: {
                      text: {
                        textElements: [{ textRun: { content: "Existing notes" } }],
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    } as never);
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleSlidesSpeakerNotes(mockSlides, {
      presentationId: "pres123",
      slideIndex: 0,
      action: "update",
      notes: "New content",
    });
    expect(result.isError).toBe(false);

    // Should have both deleteText and insertText
    const batchUpdateCall = vi.mocked(mockSlides.presentations.batchUpdate).mock.calls[0][0] as {
      requestBody?: {
        requests?: Array<{ deleteText?: unknown; insertText?: unknown }>;
      };
    };
    const requests = batchUpdateCall.requestBody?.requests || [];
    expect(requests.length).toBe(2);
    expect(requests[0].deleteText).toBeDefined();
    expect(requests[1].insertText).toBeDefined();
  });
});

describe("handleFormatSlidesText", () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it("formats text with style options", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatSlidesText(mockSlides, {
      presentationId: "pres123",
      objectId: "obj123",
      bold: true,
      italic: true,
      fontSize: 14,
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Formatted text");
    expect(result.content[0].text).toContain("text style");
  });

  it("formats text with paragraph options", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatSlidesText(mockSlides, {
      presentationId: "pres123",
      objectId: "obj123",
      alignment: "CENTER",
      lineSpacing: 1.5,
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("alignment");
    expect(result.content[0].text).toContain("line spacing");
  });

  it("formats text with both style and paragraph options", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatSlidesText(mockSlides, {
      presentationId: "pres123",
      objectId: "obj123",
      bold: true,
      alignment: "CENTER",
      bulletStyle: "DISC",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("text style");
    expect(result.content[0].text).toContain("alignment");
    expect(result.content[0].text).toContain("bullet style");
  });

  it("handles text range formatting", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatSlidesText(mockSlides, {
      presentationId: "pres123",
      objectId: "obj123",
      startIndex: 0,
      endIndex: 10,
      bold: true,
    });
    expect(result.isError).toBe(false);
  });

  it("handles NUMBERED bullet style", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatSlidesText(mockSlides, {
      presentationId: "pres123",
      objectId: "obj123",
      bulletStyle: "NUMBERED",
    });
    expect(result.isError).toBe(false);
  });

  it("handles NONE bullet style (removes bullets)", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatSlidesText(mockSlides, {
      presentationId: "pres123",
      objectId: "obj123",
      bulletStyle: "NONE",
    });
    expect(result.isError).toBe(false);
  });

  it("returns error when no formatting options specified", async () => {
    const result = await handleFormatSlidesText(mockSlides, {
      presentationId: "pres123",
      objectId: "obj123",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No formatting options");
  });

  it("returns error when objectId is missing", async () => {
    const result = await handleFormatSlidesText(mockSlides, {
      presentationId: "pres123",
      bold: true,
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleFormatSlidesShape", () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it("styles shape with background color", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatSlidesShape(mockSlides, {
      presentationId: "pres123",
      objectId: "shape123",
      backgroundColor: { red: 1, green: 0, blue: 0, alpha: 0.8 },
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("background color");
  });

  it("styles shape with outline options", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatSlidesShape(mockSlides, {
      presentationId: "pres123",
      objectId: "shape123",
      outlineColor: { red: 0, green: 0, blue: 0 },
      outlineWeight: 2,
      outlineDashStyle: "DASH",
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("outline color");
    expect(result.content[0].text).toContain("outline weight");
    expect(result.content[0].text).toContain("outline dash style");
  });

  it("styles shape with all options", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatSlidesShape(mockSlides, {
      presentationId: "pres123",
      objectId: "shape123",
      backgroundColor: { red: 1, green: 1, blue: 1 },
      outlineColor: { red: 0, green: 0, blue: 0 },
      outlineWeight: 1,
      outlineDashStyle: "SOLID",
    });
    expect(result.isError).toBe(false);
  });

  it("returns error when no formatting options specified", async () => {
    const result = await handleFormatSlidesShape(mockSlides, {
      presentationId: "pres123",
      objectId: "shape123",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No formatting options");
  });

  it("returns error when objectId is missing", async () => {
    const result = await handleFormatSlidesShape(mockSlides, {
      presentationId: "pres123",
      backgroundColor: { red: 1 },
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleFormatSlideBackground", () => {
  let mockSlides: slides_v1.Slides;

  beforeEach(() => {
    mockSlides = createMockSlides();
  });

  it("sets slide background color for multiple slides", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatSlideBackground(mockSlides, {
      presentationId: "pres123",
      pageObjectIds: ["slide1", "slide2"],
      backgroundColor: { red: 0.9, green: 0.9, blue: 0.9, alpha: 1 },
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("2 slide(s)");
  });

  it("sets background for single slide", async () => {
    vi.mocked(mockSlides.presentations.batchUpdate).mockResolvedValue({} as never);

    const result = await handleFormatSlideBackground(mockSlides, {
      presentationId: "pres123",
      pageObjectIds: ["slide1"],
      backgroundColor: { red: 1, green: 1, blue: 1 },
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("1 slide(s)");
  });

  it("returns error when pageObjectIds is empty", async () => {
    const result = await handleFormatSlideBackground(mockSlides, {
      presentationId: "pres123",
      pageObjectIds: [],
      backgroundColor: { red: 1 },
    });
    expect(result.isError).toBe(true);
  });

  it("returns error when backgroundColor is missing", async () => {
    const result = await handleFormatSlideBackground(mockSlides, {
      presentationId: "pres123",
      pageObjectIds: ["slide1"],
    });
    expect(result.isError).toBe(true);
  });
});
