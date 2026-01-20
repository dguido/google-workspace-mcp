import { describe, it, expect } from "vitest";
import {
  CreateGoogleSlidesSchema,
  UpdateGoogleSlidesSchema,
  GetGoogleSlidesContentSchema,
  CreateGoogleSlidesTextBoxSchema,
  CreateGoogleSlidesShapeSchema,
  GetGoogleSlidesSpeakerNotesSchema,
  UpdateGoogleSlidesSpeakerNotesSchema,
  FormatGoogleSlidesElementSchema,
} from "./slides.js";

describe("CreateGoogleSlidesSchema", () => {
  it("accepts valid input", () => {
    const result = CreateGoogleSlidesSchema.safeParse({
      name: "My Presentation",
      slides: [{ title: "Slide 1", content: "Content 1" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiple slides", () => {
    const result = CreateGoogleSlidesSchema.safeParse({
      name: "My Presentation",
      slides: [
        { title: "Slide 1", content: "Content 1" },
        { title: "Slide 2", content: "Content 2" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional parentFolderId", () => {
    const result = CreateGoogleSlidesSchema.safeParse({
      name: "My Presentation",
      slides: [{ title: "Slide 1", content: "Content 1" }],
      parentFolderId: "folder123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = CreateGoogleSlidesSchema.safeParse({
      name: "",
      slides: [{ title: "Slide", content: "Content" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty slides array", () => {
    const result = CreateGoogleSlidesSchema.safeParse({
      name: "My Presentation",
      slides: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateGoogleSlidesSchema", () => {
  it("accepts valid input", () => {
    const result = UpdateGoogleSlidesSchema.safeParse({
      presentationId: "pres123",
      slides: [{ title: "Updated", content: "Updated content" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty presentationId", () => {
    const result = UpdateGoogleSlidesSchema.safeParse({
      presentationId: "",
      slides: [{ title: "Slide", content: "Content" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty slides array", () => {
    const result = UpdateGoogleSlidesSchema.safeParse({
      presentationId: "pres123",
      slides: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("GetGoogleSlidesContentSchema", () => {
  it("accepts valid presentationId", () => {
    const result = GetGoogleSlidesContentSchema.safeParse({
      presentationId: "pres123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional slideIndex", () => {
    const result = GetGoogleSlidesContentSchema.safeParse({
      presentationId: "pres123",
      slideIndex: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty presentationId", () => {
    const result = GetGoogleSlidesContentSchema.safeParse({
      presentationId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative slideIndex", () => {
    const result = GetGoogleSlidesContentSchema.safeParse({
      presentationId: "pres123",
      slideIndex: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateGoogleSlidesTextBoxSchema", () => {
  it("accepts valid input", () => {
    const result = CreateGoogleSlidesTextBoxSchema.safeParse({
      presentationId: "pres123",
      pageObjectId: "page1",
      text: "Hello World",
      x: 100,
      y: 100,
      width: 300,
      height: 50,
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional formatting", () => {
    const result = CreateGoogleSlidesTextBoxSchema.safeParse({
      presentationId: "pres123",
      pageObjectId: "page1",
      text: "Hello",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fontSize: 14,
      bold: true,
      italic: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty text", () => {
    const result = CreateGoogleSlidesTextBoxSchema.safeParse({
      presentationId: "pres123",
      pageObjectId: "page1",
      text: "",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateGoogleSlidesShapeSchema", () => {
  it("accepts valid input", () => {
    const result = CreateGoogleSlidesShapeSchema.safeParse({
      presentationId: "pres123",
      pageObjectId: "page1",
      shapeType: "RECTANGLE",
      x: 100,
      y: 100,
      width: 200,
      height: 100,
    });
    expect(result.success).toBe(true);
  });

  it("accepts all shape types", () => {
    const types = [
      "RECTANGLE",
      "ELLIPSE",
      "DIAMOND",
      "TRIANGLE",
      "STAR",
      "ROUND_RECTANGLE",
      "ARROW",
    ];
    types.forEach((type) => {
      const result = CreateGoogleSlidesShapeSchema.safeParse({
        presentationId: "pres123",
        pageObjectId: "page1",
        shapeType: type,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      expect(result.success).toBe(true);
    });
  });

  it("accepts optional backgroundColor", () => {
    const result = CreateGoogleSlidesShapeSchema.safeParse({
      presentationId: "pres123",
      pageObjectId: "page1",
      shapeType: "RECTANGLE",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: { red: 1, green: 0, blue: 0, alpha: 1 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid shapeType", () => {
    const result = CreateGoogleSlidesShapeSchema.safeParse({
      presentationId: "pres123",
      pageObjectId: "page1",
      shapeType: "INVALID",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(result.success).toBe(false);
  });
});

describe("GetGoogleSlidesSpeakerNotesSchema", () => {
  it("accepts valid input", () => {
    const result = GetGoogleSlidesSpeakerNotesSchema.safeParse({
      presentationId: "pres123",
      slideIndex: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative slideIndex", () => {
    const result = GetGoogleSlidesSpeakerNotesSchema.safeParse({
      presentationId: "pres123",
      slideIndex: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateGoogleSlidesSpeakerNotesSchema", () => {
  it("accepts valid input", () => {
    const result = UpdateGoogleSlidesSpeakerNotesSchema.safeParse({
      presentationId: "pres123",
      slideIndex: 0,
      notes: "These are speaker notes",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty notes", () => {
    const result = UpdateGoogleSlidesSpeakerNotesSchema.safeParse({
      presentationId: "pres123",
      slideIndex: 0,
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative slideIndex", () => {
    const result = UpdateGoogleSlidesSpeakerNotesSchema.safeParse({
      presentationId: "pres123",
      slideIndex: -1,
      notes: "notes",
    });
    expect(result.success).toBe(false);
  });
});

describe("FormatGoogleSlidesElementSchema", () => {
  describe("targetType validation", () => {
    it("requires objectId for text targetType", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "text",
        bold: true,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("objectId required");
      }
    });

    it("requires objectId for shape targetType", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "shape",
        backgroundColor: { red: 1, green: 0, blue: 0 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("objectId required");
      }
    });

    it("requires pageObjectIds for slide targetType", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "slide",
        slideBackgroundColor: { red: 1, green: 1, blue: 1 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          "pageObjectIds required",
        );
      }
    });

    it("rejects empty pageObjectIds array for slide targetType", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "slide",
        pageObjectIds: [],
        slideBackgroundColor: { red: 1, green: 1, blue: 1 },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("text formatting", () => {
    it("accepts valid text formatting with objectId", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "text",
        objectId: "obj456",
        bold: true,
        italic: false,
        fontSize: 14,
        fontFamily: "Arial",
        foregroundColor: { red: 0.5, green: 0.5, blue: 0.5 },
      });
      expect(result.success).toBe(true);
    });

    it("accepts paragraph formatting options", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "text",
        objectId: "obj456",
        alignment: "CENTER",
        lineSpacing: 1.5,
        bulletStyle: "DISC",
      });
      expect(result.success).toBe(true);
    });

    it("accepts text range for partial formatting", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "text",
        objectId: "obj456",
        startIndex: 0,
        endIndex: 10,
        bold: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("shape formatting", () => {
    it("accepts valid shape formatting with objectId", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "shape",
        objectId: "shape789",
        backgroundColor: { red: 1, green: 0, blue: 0, alpha: 0.8 },
        outlineColor: { red: 0, green: 0, blue: 0 },
        outlineWeight: 2,
        outlineDashStyle: "SOLID",
      });
      expect(result.success).toBe(true);
    });

    it("validates outline dash style enum", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "shape",
        objectId: "shape789",
        outlineDashStyle: "INVALID",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("slide background", () => {
    it("accepts valid slide background with pageObjectIds", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "slide",
        pageObjectIds: ["slide1", "slide2"],
        slideBackgroundColor: { red: 0.9, green: 0.9, blue: 0.9, alpha: 1 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("color validation", () => {
    it("rejects color values outside 0-1 range", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "text",
        objectId: "obj456",
        foregroundColor: { red: 255, green: 0, blue: 0 },
      });
      expect(result.success).toBe(false);
    });

    it("accepts color values at boundaries (0 and 1)", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "text",
        objectId: "obj456",
        foregroundColor: { red: 0, green: 1, blue: 0.5 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("enum validations", () => {
    it("validates alignment enum", () => {
      const validAlignments = ["START", "CENTER", "END", "JUSTIFIED"];
      for (const alignment of validAlignments) {
        const result = FormatGoogleSlidesElementSchema.safeParse({
          presentationId: "pres123",
          targetType: "text",
          objectId: "obj456",
          alignment,
        });
        expect(result.success).toBe(true);
      }
    });

    it("validates bulletStyle enum", () => {
      const validStyles = [
        "NONE",
        "DISC",
        "ARROW",
        "SQUARE",
        "DIAMOND",
        "STAR",
        "NUMBERED",
      ];
      for (const bulletStyle of validStyles) {
        const result = FormatGoogleSlidesElementSchema.safeParse({
          presentationId: "pres123",
          targetType: "text",
          objectId: "obj456",
          bulletStyle,
        });
        expect(result.success).toBe(true);
      }
    });

    it("validates targetType enum", () => {
      const result = FormatGoogleSlidesElementSchema.safeParse({
        presentationId: "pres123",
        targetType: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });
});
