import { z } from "zod";

// Reusable color schemas
const ColorSchema = z.object({
  red: z.number().min(0).max(1).optional(),
  green: z.number().min(0).max(1).optional(),
  blue: z.number().min(0).max(1).optional(),
});

const ColorWithAlphaSchema = ColorSchema.extend({
  alpha: z.number().min(0).max(1).optional(),
});

export const ListSlidePagesSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
});

export type ListSlidePagesInput = z.infer<typeof ListSlidePagesSchema>;

export const CreateGoogleSlidesSchema = z
  .object({
    name: z.string().min(1, "Presentation name is required"),
    slides: z
      .array(
        z.object({
          title: z.string(),
          content: z.string(),
        }),
      )
      .min(1, "At least one slide is required"),
    parentFolderId: z.string().optional(),
    parentPath: z.string().optional(),
  })
  .refine((data) => !(data.parentFolderId && data.parentPath), {
    message: "Provide either parentFolderId or parentPath, not both",
  });

export const UpdateGoogleSlidesSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  slides: z
    .array(
      z.object({
        title: z.string(),
        content: z.string(),
      }),
    )
    .min(1, "At least one slide is required"),
});

export const GetGoogleSlidesContentSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  slideIndex: z.number().min(0).optional(),
});

export const CreateGoogleSlidesTextBoxSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  pageObjectId: z.string().min(1, "Page object ID is required"),
  text: z.string().min(1, "Text content is required"),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  fontSize: z.number().optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
});

export const CreateGoogleSlidesShapeSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  pageObjectId: z.string().min(1, "Page object ID is required"),
  shapeType: z.enum([
    "RECTANGLE",
    "ELLIPSE",
    "DIAMOND",
    "TRIANGLE",
    "STAR",
    "ROUND_RECTANGLE",
    "ARROW",
  ]),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  backgroundColor: z
    .object({
      red: z.number().min(0).max(1).optional(),
      green: z.number().min(0).max(1).optional(),
      blue: z.number().min(0).max(1).optional(),
      alpha: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

// Unified speaker notes schema - replaces get/update individual schemas
export const SlidesSpeakerNotesSchema = z
  .object({
    presentationId: z.string().min(1, "Presentation ID is required"),
    slideIndex: z.number().min(0, "Slide index must be non-negative"),
    action: z.enum(["get", "update"]),
    notes: z.string().optional().describe("Notes content (required for update)"),
  })
  .refine(
    (data) => {
      if (data.action === "update") return data.notes !== undefined;
      return true;
    },
    { message: "notes is required for update action" },
  );

export type SlidesSpeakerNotesInput = z.infer<typeof SlidesSpeakerNotesSchema>;

// Focused text formatting schema
export const FormatSlidesTextSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  objectId: z.string().min(1, "Object ID is required"),

  // Text range (optional - defaults to all text)
  startIndex: z.number().min(0).optional(),
  endIndex: z.number().min(0).optional(),

  // Character formatting
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  foregroundColor: ColorSchema.optional(),

  // Paragraph formatting
  alignment: z.enum(["START", "CENTER", "END", "JUSTIFIED"]).optional(),
  lineSpacing: z.number().optional(),
  bulletStyle: z
    .enum(["NONE", "DISC", "ARROW", "SQUARE", "DIAMOND", "STAR", "NUMBERED"])
    .optional(),
});

// Focused shape styling schema
export const FormatSlidesShapeSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  objectId: z.string().min(1, "Object ID is required"),

  // Shape fill
  backgroundColor: ColorWithAlphaSchema.optional(),

  // Outline styling
  outlineColor: ColorSchema.optional(),
  outlineWeight: z.number().optional(),
  outlineDashStyle: z
    .enum(["SOLID", "DOT", "DASH", "DASH_DOT", "LONG_DASH", "LONG_DASH_DOT"])
    .optional(),
});

// Focused slide background schema
export const FormatSlideBackgroundSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  pageObjectIds: z.array(z.string().min(1)).min(1, "At least one slide ID is required"),
  backgroundColor: ColorWithAlphaSchema,
});

// Type exports
export type CreateGoogleSlidesInput = z.infer<typeof CreateGoogleSlidesSchema>;
export type UpdateGoogleSlidesInput = z.infer<typeof UpdateGoogleSlidesSchema>;
export type GetGoogleSlidesContentInput = z.infer<typeof GetGoogleSlidesContentSchema>;
export type CreateGoogleSlidesTextBoxInput = z.infer<typeof CreateGoogleSlidesTextBoxSchema>;
export type CreateGoogleSlidesShapeInput = z.infer<typeof CreateGoogleSlidesShapeSchema>;
export type FormatSlidesTextInput = z.infer<typeof FormatSlidesTextSchema>;
export type FormatSlidesShapeInput = z.infer<typeof FormatSlidesShapeSchema>;
export type FormatSlideBackgroundInput = z.infer<typeof FormatSlideBackgroundSchema>;
