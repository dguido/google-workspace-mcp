import { z } from 'zod';

export const CreateGoogleSlidesSchema = z.object({
  name: z.string().min(1, "Presentation name is required"),
  slides: z.array(z.object({
    title: z.string(),
    content: z.string()
  })).min(1, "At least one slide is required"),
  parentFolderId: z.string().optional()
});

export const UpdateGoogleSlidesSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  slides: z.array(z.object({
    title: z.string(),
    content: z.string()
  })).min(1, "At least one slide is required")
});

export const GetGoogleSlidesContentSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  slideIndex: z.number().min(0).optional()
});

export const FormatGoogleSlidesTextSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  objectId: z.string().min(1, "Object ID is required"),
  startIndex: z.number().min(0).optional(),
  endIndex: z.number().min(0).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  foregroundColor: z.object({
    red: z.number().min(0).max(1).optional(),
    green: z.number().min(0).max(1).optional(),
    blue: z.number().min(0).max(1).optional()
  }).optional()
});

export const FormatGoogleSlidesParagraphSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  objectId: z.string().min(1, "Object ID is required"),
  alignment: z.enum(['START', 'CENTER', 'END', 'JUSTIFIED']).optional(),
  lineSpacing: z.number().optional(),
  bulletStyle: z.enum([
    'NONE', 'DISC', 'ARROW', 'SQUARE',
    'DIAMOND', 'STAR', 'NUMBERED'
  ]).optional()
});

export const StyleGoogleSlidesShapeSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  objectId: z.string().min(1, "Shape object ID is required"),
  backgroundColor: z.object({
    red: z.number().min(0).max(1).optional(),
    green: z.number().min(0).max(1).optional(),
    blue: z.number().min(0).max(1).optional(),
    alpha: z.number().min(0).max(1).optional()
  }).optional(),
  outlineColor: z.object({
    red: z.number().min(0).max(1).optional(),
    green: z.number().min(0).max(1).optional(),
    blue: z.number().min(0).max(1).optional()
  }).optional(),
  outlineWeight: z.number().optional(),
  outlineDashStyle: z.enum([
    'SOLID', 'DOT', 'DASH', 'DASH_DOT',
    'LONG_DASH', 'LONG_DASH_DOT'
  ]).optional()
});

export const SetGoogleSlidesBackgroundSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  pageObjectIds: z.array(z.string()).min(1, "At least one page object ID is required"),
  backgroundColor: z.object({
    red: z.number().min(0).max(1).optional(),
    green: z.number().min(0).max(1).optional(),
    blue: z.number().min(0).max(1).optional(),
    alpha: z.number().min(0).max(1).optional()
  })
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
  italic: z.boolean().optional()
});

export const CreateGoogleSlidesShapeSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  pageObjectId: z.string().min(1, "Page object ID is required"),
  shapeType: z.enum([
    'RECTANGLE', 'ELLIPSE', 'DIAMOND', 'TRIANGLE',
    'STAR', 'ROUND_RECTANGLE', 'ARROW'
  ]),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  backgroundColor: z.object({
    red: z.number().min(0).max(1).optional(),
    green: z.number().min(0).max(1).optional(),
    blue: z.number().min(0).max(1).optional(),
    alpha: z.number().min(0).max(1).optional()
  }).optional()
});

export const GetGoogleSlidesSpeakerNotesSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  slideIndex: z.number().min(0, "Slide index must be non-negative")
});

export const UpdateGoogleSlidesSpeakerNotesSchema = z.object({
  presentationId: z.string().min(1, "Presentation ID is required"),
  slideIndex: z.number().min(0, "Slide index must be non-negative"),
  notes: z.string()
});

// Type exports
export type CreateGoogleSlidesInput = z.infer<typeof CreateGoogleSlidesSchema>;
export type UpdateGoogleSlidesInput = z.infer<typeof UpdateGoogleSlidesSchema>;
export type GetGoogleSlidesContentInput = z.infer<typeof GetGoogleSlidesContentSchema>;
export type FormatGoogleSlidesTextInput = z.infer<typeof FormatGoogleSlidesTextSchema>;
export type FormatGoogleSlidesParagraphInput = z.infer<typeof FormatGoogleSlidesParagraphSchema>;
export type StyleGoogleSlidesShapeInput = z.infer<typeof StyleGoogleSlidesShapeSchema>;
export type SetGoogleSlidesBackgroundInput = z.infer<typeof SetGoogleSlidesBackgroundSchema>;
export type CreateGoogleSlidesTextBoxInput = z.infer<typeof CreateGoogleSlidesTextBoxSchema>;
export type CreateGoogleSlidesShapeInput = z.infer<typeof CreateGoogleSlidesShapeSchema>;
export type GetGoogleSlidesSpeakerNotesInput = z.infer<typeof GetGoogleSlidesSpeakerNotesSchema>;
export type UpdateGoogleSlidesSpeakerNotesInput = z.infer<typeof UpdateGoogleSlidesSpeakerNotesSchema>;
