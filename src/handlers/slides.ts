import { randomUUID } from "node:crypto";
import type { drive_v3, slides_v1 } from "googleapis";
import {
  successResponse,
  structuredResponse,
  errorResponse,
  withTimeout,
  validateArgs,
} from "../utils/index.js";
import { GOOGLE_MIME_TYPES, getMimeTypeSuggestion } from "../utils/mimeTypes.js";
import type { ToolResponse } from "../utils/index.js";
import {
  ListSlidePagesSchema,
  CreateGoogleSlidesSchema,
  UpdateGoogleSlidesSchema,
  GetGoogleSlidesContentSchema,
  CreateGoogleSlidesTextBoxSchema,
  CreateGoogleSlidesShapeSchema,
  GetGoogleSlidesSpeakerNotesSchema,
  UpdateGoogleSlidesSpeakerNotesSchema,
  FormatGoogleSlidesElementSchema,
} from "../schemas/index.js";
import { resolveOptionalFolderPath, checkFileExists } from "./helpers.js";
import { toSlidesColorStyle, toSlidesSolidFill } from "../utils/colors.js";

export async function handleCreateGoogleSlides(
  drive: drive_v3.Drive,
  slides: slides_v1.Slides,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateGoogleSlidesSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const parentFolderId = await resolveOptionalFolderPath(
    drive,
    data.parentFolderId,
    data.parentPath,
  );

  // Check if presentation already exists
  const existingFileId = await checkFileExists(drive, data.name, parentFolderId);
  if (existingFileId) {
    return errorResponse(
      `A presentation named "${data.name}" already exists in this location. ` +
        `File ID: ${existingFileId}. To modify it, you can use Google Slides directly.`,
    );
  }

  // API call 1: Create presentation
  const presentation = await slides.presentations.create({
    requestBody: { title: data.name },
  });

  // API call 2: Move to folder
  await drive.files.update({
    fileId: presentation.data.presentationId!,
    addParents: parentFolderId,
    removeParents: "root",
    supportsAllDrives: true,
  });

  // Generate all slide IDs upfront
  const slideIds = data.slides.map(() => `slide_${randomUUID().substring(0, 8)}`);

  // API call 3: Batch create all slides at once
  const createSlideRequests: slides_v1.Schema$Request[] = slideIds.map((slideObjectId) => ({
    createSlide: {
      objectId: slideObjectId,
      slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
    },
  }));

  await slides.presentations.batchUpdate({
    presentationId: presentation.data.presentationId!,
    requestBody: { requests: createSlideRequests },
  });

  // API call 4: Fetch all slides to get placeholder IDs
  const updatedPresentation = await slides.presentations.get({
    presentationId: presentation.data.presentationId!,
  });

  // Build insert text requests for all slides
  const insertTextRequests: slides_v1.Schema$Request[] = [];

  // Note: The first slide in the response is the default blank slide created with the presentation
  // Our custom slides start at index 1
  for (let i = 0; i < data.slides.length; i++) {
    const slide = data.slides[i];
    // Our slides start at index 1 (after the default blank slide)
    const presentationSlide = updatedPresentation.data.slides?.[i + 1];

    if (presentationSlide?.pageElements) {
      for (const el of presentationSlide.pageElements) {
        if (el.shape?.placeholder?.type === "TITLE" && el.objectId) {
          insertTextRequests.push({
            insertText: {
              objectId: el.objectId,
              text: slide.title,
              insertionIndex: 0,
            },
          });
        } else if (el.shape?.placeholder?.type === "BODY" && el.objectId) {
          insertTextRequests.push({
            insertText: {
              objectId: el.objectId,
              text: slide.content,
              insertionIndex: 0,
            },
          });
        }
      }
    }
  }

  // API call 5: Batch insert all text at once
  if (insertTextRequests.length > 0) {
    await slides.presentations.batchUpdate({
      presentationId: presentation.data.presentationId!,
      requestBody: { requests: insertTextRequests },
    });
  }

  return successResponse(
    `Created Google Slides presentation: ${data.name}\n` +
      `ID: ${presentation.data.presentationId}\n` +
      `Link: https://docs.google.com/presentation/d/${presentation.data.presentationId}`,
  );
}

export async function handleUpdateGoogleSlides(
  slides: slides_v1.Slides,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(UpdateGoogleSlidesSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // API call 1: Get current presentation details
  const currentPresentation = await slides.presentations.get({
    presentationId: data.presentationId,
  });

  if (!currentPresentation.data.slides) {
    return errorResponse(
      `No slides found in presentation ${data.presentationId}. ` +
        `The presentation may be empty or inaccessible.`,
    );
  }

  if (data.slides.length === 0) {
    return errorResponse("At least one slide must be provided");
  }

  // Collect all slide IDs except the first one (we'll keep it for now)
  const slideIdsToDelete = currentPresentation.data.slides
    .slice(1)
    .map((slide) => slide.objectId)
    .filter((id): id is string => id !== undefined);

  // Prepare all requests for a single batch update
  const requests: slides_v1.Schema$Request[] = [];

  // Delete all slides except the first one
  for (const slideId of slideIdsToDelete) {
    requests.push({ deleteObject: { objectId: slideId } });
  }

  // Clear content of the first slide
  const firstSlide = currentPresentation.data.slides[0];
  if (firstSlide?.pageElements) {
    for (const element of firstSlide.pageElements) {
      if (element.objectId && element.shape?.text) {
        requests.push({
          deleteText: {
            objectId: element.objectId,
            textRange: { type: "ALL" },
          },
        });
      }
    }
  }

  // Update the first slide with new content
  const firstSlideContent = data.slides[0];
  if (firstSlide?.pageElements) {
    let titlePlaceholderId: string | undefined;
    let bodyPlaceholderId: string | undefined;

    for (const element of firstSlide.pageElements) {
      if (
        element.shape?.placeholder?.type === "TITLE" ||
        element.shape?.placeholder?.type === "CENTERED_TITLE"
      ) {
        titlePlaceholderId = element.objectId || undefined;
      } else if (
        element.shape?.placeholder?.type === "BODY" ||
        element.shape?.placeholder?.type === "SUBTITLE"
      ) {
        bodyPlaceholderId = element.objectId || undefined;
      }
    }

    if (titlePlaceholderId) {
      requests.push({
        insertText: {
          objectId: titlePlaceholderId,
          text: firstSlideContent.title,
          insertionIndex: 0,
        },
      });
    }

    if (bodyPlaceholderId) {
      requests.push({
        insertText: {
          objectId: bodyPlaceholderId,
          text: firstSlideContent.content,
          insertionIndex: 0,
        },
      });
    }
  }

  // For additional slides, use placeholderIdMappings to set known IDs upfront
  // This avoids needing a second API call to fetch placeholder IDs
  const newSlideData: Array<{
    slideId: string;
    titleId: string;
    bodyId: string;
  }> = [];

  for (let i = 1; i < data.slides.length; i++) {
    const slideId = `slide_${Date.now()}_${i}`;
    const titleId = `title_${Date.now()}_${i}`;
    const bodyId = `body_${Date.now()}_${i}`;

    newSlideData.push({ slideId, titleId, bodyId });

    requests.push({
      createSlide: {
        objectId: slideId,
        slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
        placeholderIdMappings: [
          {
            layoutPlaceholder: { type: "TITLE" },
            objectId: titleId,
          },
          {
            layoutPlaceholder: { type: "BODY" },
            objectId: bodyId,
          },
        ],
      },
    });
  }

  // Add insertText requests for all additional slides using our pre-assigned IDs
  for (let i = 0; i < newSlideData.length; i++) {
    const slideContent = data.slides[i + 1];
    const { titleId, bodyId } = newSlideData[i];

    requests.push({
      insertText: {
        objectId: titleId,
        text: slideContent.title,
        insertionIndex: 0,
      },
    });
    requests.push({
      insertText: {
        objectId: bodyId,
        text: slideContent.content,
        insertionIndex: 0,
      },
    });
  }

  // API call 2: Execute single batch update with all operations
  await slides.presentations.batchUpdate({
    presentationId: data.presentationId,
    requestBody: { requests },
  });

  return successResponse(
    `Updated Google Slides presentation with ${data.slides.length} slide(s)\n` +
      `Link: https://docs.google.com/presentation/d/${data.presentationId}`,
  );
}

export async function handleGetGoogleSlidesContent(
  drive: drive_v3.Drive,
  slides: slides_v1.Slides,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetGoogleSlidesContentSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Check file type before calling Slides API to provide helpful error messages
  const metadata = await drive.files.get({
    fileId: data.presentationId,
    fields: "mimeType,name",
    supportsAllDrives: true,
  });

  const mimeType = metadata.data.mimeType;
  if (mimeType !== GOOGLE_MIME_TYPES.PRESENTATION) {
    const fileName = metadata.data.name || data.presentationId;
    const suggestion = getMimeTypeSuggestion(mimeType);
    return errorResponse(
      `"${fileName}" is not a Google Slides presentation (type: ${mimeType}). ${suggestion}`,
    );
  }

  const presentation = await withTimeout(
    slides.presentations.get({
      presentationId: data.presentationId,
    }),
    30000,
    "Get presentation content",
  );

  if (!presentation.data.slides) {
    return errorResponse(
      `No slides found in presentation ${data.presentationId}. ` +
        `The presentation may be empty or inaccessible.`,
    );
  }

  let content = "Presentation content with element IDs:\n\n";
  const slidesToShow =
    data.slideIndex !== undefined
      ? [presentation.data.slides[data.slideIndex]]
      : presentation.data.slides;

  interface SlideElement {
    objectId: string;
    type: string;
    text?: string;
    shapeType?: string;
  }

  interface SlideData {
    index: number;
    objectId: string;
    elements: SlideElement[];
  }

  const structuredSlides: SlideData[] = [];

  slidesToShow.forEach((slide, index) => {
    if (!slide || !slide.objectId) return;

    const slideIndex = data.slideIndex ?? index;
    content += `\nSlide ${slideIndex} (ID: ${slide.objectId}):\n`;
    content += "----------------------------\n";

    const slideData: SlideData = {
      index: slideIndex,
      objectId: slide.objectId,
      elements: [],
    };

    if (slide.pageElements) {
      slide.pageElements.forEach((element) => {
        if (!element.objectId) return;

        if (element.shape?.text) {
          content += `  Text Box (ID: ${element.objectId}):\n`;
          const textElements = element.shape.text.textElements || [];
          let text = "";
          textElements.forEach((textElement) => {
            if (textElement.textRun?.content) {
              text += textElement.textRun.content;
            }
          });
          content += `    "${text.trim()}"\n`;
          slideData.elements.push({
            objectId: element.objectId,
            type: "textBox",
            text: text.trim(),
          });
        } else if (element.shape) {
          content += `  Shape (ID: ${element.objectId}): ${element.shape.shapeType || "Unknown"}\n`;
          slideData.elements.push({
            objectId: element.objectId,
            type: "shape",
            shapeType: element.shape.shapeType || undefined,
          });
        } else if (element.image) {
          content += `  Image (ID: ${element.objectId})\n`;
          slideData.elements.push({
            objectId: element.objectId,
            type: "image",
          });
        } else if (element.video) {
          content += `  Video (ID: ${element.objectId})\n`;
          slideData.elements.push({
            objectId: element.objectId,
            type: "video",
          });
        } else if (element.table) {
          content += `  Table (ID: ${element.objectId})\n`;
          slideData.elements.push({
            objectId: element.objectId,
            type: "table",
          });
        }
      });
    }

    structuredSlides.push(slideData);
  });

  return structuredResponse(content, {
    presentationId: data.presentationId,
    title: presentation.data.title,
    slideCount: presentation.data.slides?.length || 0,
    slides: structuredSlides,
  });
}

export async function handleCreateGoogleSlidesTextBox(
  slides: slides_v1.Slides,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateGoogleSlidesTextBoxSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const elementId = `textBox_${randomUUID().substring(0, 8)}`;

  const requests: slides_v1.Schema$Request[] = [
    {
      createShape: {
        objectId: elementId,
        shapeType: "TEXT_BOX",
        elementProperties: {
          pageObjectId: data.pageObjectId,
          size: {
            width: { magnitude: data.width, unit: "EMU" },
            height: { magnitude: data.height, unit: "EMU" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: data.x,
            translateY: data.y,
            unit: "EMU",
          },
        },
      },
    },
    {
      insertText: {
        objectId: elementId,
        text: data.text,
        insertionIndex: 0,
      },
    },
  ];

  // Apply optional formatting
  if (data.fontSize || data.bold || data.italic) {
    const textStyle: Record<string, unknown> = {};
    const fields: string[] = [];

    if (data.fontSize) {
      textStyle.fontSize = { magnitude: data.fontSize, unit: "PT" };
      fields.push("fontSize");
    }

    if (data.bold !== undefined) {
      textStyle.bold = data.bold;
      fields.push("bold");
    }

    if (data.italic !== undefined) {
      textStyle.italic = data.italic;
      fields.push("italic");
    }

    if (fields.length > 0) {
      requests.push({
        updateTextStyle: {
          objectId: elementId,
          style: textStyle,
          fields: fields.join(","),
          textRange: { type: "ALL" },
        },
      });
    }
  }

  await slides.presentations.batchUpdate({
    presentationId: data.presentationId,
    requestBody: { requests },
  });

  return successResponse(`Created text box with ID: ${elementId}`);
}

export async function handleCreateGoogleSlidesShape(
  slides: slides_v1.Slides,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateGoogleSlidesShapeSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const elementId = `shape_${randomUUID().substring(0, 8)}`;

  const requests: slides_v1.Schema$Request[] = [
    {
      createShape: {
        objectId: elementId,
        shapeType: data.shapeType,
        elementProperties: {
          pageObjectId: data.pageObjectId,
          size: {
            width: { magnitude: data.width, unit: "EMU" },
            height: { magnitude: data.height, unit: "EMU" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: data.x,
            translateY: data.y,
            unit: "EMU",
          },
        },
      },
    },
  ];

  // Apply background color if specified
  if (data.backgroundColor) {
    requests.push({
      updateShapeProperties: {
        objectId: elementId,
        shapeProperties: {
          shapeBackgroundFill: {
            solidFill: {
              color: {
                rgbColor: {
                  red: data.backgroundColor.red || 0,
                  green: data.backgroundColor.green || 0,
                  blue: data.backgroundColor.blue || 0,
                },
              },
              alpha: data.backgroundColor.alpha || 1,
            },
          },
        },
        fields: "shapeBackgroundFill",
      },
    });
  }

  await slides.presentations.batchUpdate({
    presentationId: data.presentationId,
    requestBody: { requests },
  });

  return successResponse(`Created ${data.shapeType} shape with ID: ${elementId}`);
}

export async function handleGetGoogleSlidesSpeakerNotes(
  slides: slides_v1.Slides,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetGoogleSlidesSpeakerNotesSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get the presentation to access the slide
  const presentation = await slides.presentations.get({
    presentationId: data.presentationId,
  });

  const slideCount = presentation.data.slides?.length || 0;
  if (!presentation.data.slides || data.slideIndex < 0 || data.slideIndex >= slideCount) {
    return errorResponse(
      `Slide index ${data.slideIndex} is invalid. Valid range: 0 to ${slideCount - 1} (presentation has ${slideCount} slides)`,
    );
  }

  const slide = presentation.data.slides[data.slideIndex];

  // Get the notes page object ID from the slide properties
  const notesObjectId = slide.slideProperties?.notesPage?.notesProperties?.speakerNotesObjectId;

  if (!notesObjectId) {
    return successResponse("No speaker notes found for this slide");
  }

  // Find the notes page for this slide (already fetched in presentation)
  const notesPage = slide.slideProperties?.notesPage;

  if (!notesPage || !notesPage.pageElements) {
    return successResponse("No speaker notes found for this slide");
  }

  // Find the speaker notes shape
  const speakerNotesElement = notesPage.pageElements.find(
    (element) => element.objectId === notesObjectId,
  );

  if (!speakerNotesElement || !speakerNotesElement.shape?.text) {
    return successResponse("No speaker notes found for this slide");
  }

  // Extract the text from the speaker notes
  let notesText = "";
  const textElements = speakerNotesElement.shape.text.textElements || [];
  textElements.forEach((textElement) => {
    if (textElement.textRun?.content) {
      notesText += textElement.textRun.content;
    }
  });

  return successResponse(notesText.trim() || "No speaker notes found for this slide");
}

export async function handleUpdateGoogleSlidesSpeakerNotes(
  slides: slides_v1.Slides,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(UpdateGoogleSlidesSpeakerNotesSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  // Get the presentation to access the slide
  const presentation = await slides.presentations.get({
    presentationId: data.presentationId,
  });

  const slideCount = presentation.data.slides?.length || 0;
  if (!presentation.data.slides || data.slideIndex < 0 || data.slideIndex >= slideCount) {
    return errorResponse(
      `Slide index ${data.slideIndex} is invalid. Valid range: 0 to ${slideCount - 1} (presentation has ${slideCount} slides)`,
    );
  }

  const slide = presentation.data.slides[data.slideIndex];

  // Get the notes page object ID from the slide properties
  const notesObjectId = slide.slideProperties?.notesPage?.notesProperties?.speakerNotesObjectId;

  if (!notesObjectId) {
    return errorResponse(
      "This slide does not have a speaker notes object. " +
        "Speaker notes may need to be initialized manually in Google Slides first.",
    );
  }

  // Check if notes have existing content before attempting to delete
  // (deleteText fails with "startIndex 0 must be less than endIndex 0" on empty notes)
  const notesPage = slide.slideProperties?.notesPage;
  const speakerNotesElement = notesPage?.pageElements?.find(
    (element) => element.objectId === notesObjectId,
  );

  const hasExistingText = speakerNotesElement?.shape?.text?.textElements?.some(
    (el) => el.textRun?.content && el.textRun.content.trim().length > 0,
  );

  // Build requests: only delete if there's existing text
  const requests: slides_v1.Schema$Request[] = [];

  if (hasExistingText) {
    requests.push({
      deleteText: {
        objectId: notesObjectId,
        textRange: { type: "ALL" },
      },
    });
  }

  requests.push({
    insertText: {
      objectId: notesObjectId,
      text: data.notes,
      insertionIndex: 0,
    },
  });

  await slides.presentations.batchUpdate({
    presentationId: data.presentationId,
    requestBody: { requests },
  });

  return successResponse(`Successfully updated speaker notes for slide ${data.slideIndex}`);
}

export async function handleFormatGoogleSlidesElement(
  slides: slides_v1.Slides,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(FormatGoogleSlidesElementSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const requests: slides_v1.Schema$Request[] = [];
  const appliedFormats: string[] = [];

  if (data.targetType === "text") {
    // Text formatting (style)
    const textStyle: Record<string, unknown> = {};
    const textFields: string[] = [];

    if (data.bold !== undefined) {
      textStyle.bold = data.bold;
      textFields.push("bold");
    }
    if (data.italic !== undefined) {
      textStyle.italic = data.italic;
      textFields.push("italic");
    }
    if (data.underline !== undefined) {
      textStyle.underline = data.underline;
      textFields.push("underline");
    }
    if (data.strikethrough !== undefined) {
      textStyle.strikethrough = data.strikethrough;
      textFields.push("strikethrough");
    }
    if (data.fontSize !== undefined) {
      textStyle.fontSize = { magnitude: data.fontSize, unit: "PT" };
      textFields.push("fontSize");
    }
    if (data.fontFamily !== undefined) {
      textStyle.fontFamily = data.fontFamily;
      textFields.push("fontFamily");
    }
    if (data.foregroundColor) {
      textStyle.foregroundColor = {
        opaqueColor: toSlidesColorStyle(data.foregroundColor),
      };
      textFields.push("foregroundColor");
    }

    if (textFields.length > 0) {
      requests.push({
        updateTextStyle: {
          objectId: data.objectId!,
          style: textStyle,
          fields: textFields.join(","),
          textRange:
            data.startIndex !== undefined && data.endIndex !== undefined
              ? {
                  type: "FIXED_RANGE",
                  startIndex: data.startIndex,
                  endIndex: data.endIndex,
                }
              : { type: "ALL" },
        },
      });
      appliedFormats.push("text style");
    }

    // Paragraph formatting
    if (data.alignment) {
      requests.push({
        updateParagraphStyle: {
          objectId: data.objectId!,
          style: { alignment: data.alignment },
          fields: "alignment",
        },
      });
      appliedFormats.push("alignment");
    }

    if (data.lineSpacing !== undefined) {
      requests.push({
        updateParagraphStyle: {
          objectId: data.objectId!,
          style: { lineSpacing: data.lineSpacing },
          fields: "lineSpacing",
        },
      });
      appliedFormats.push("line spacing");
    }

    if (data.bulletStyle) {
      if (data.bulletStyle === "NONE") {
        requests.push({ deleteParagraphBullets: { objectId: data.objectId! } });
      } else if (data.bulletStyle === "NUMBERED") {
        requests.push({
          createParagraphBullets: {
            objectId: data.objectId!,
            bulletPreset: "NUMBERED_DIGIT_ALPHA_ROMAN",
          },
        });
      } else {
        requests.push({
          createParagraphBullets: {
            objectId: data.objectId!,
            bulletPreset: `BULLET_${data.bulletStyle}_CIRCLE_SQUARE`,
          },
        });
      }
      appliedFormats.push("bullet style");
    }
  } else if (data.targetType === "shape") {
    const shapeProperties: Record<string, unknown> = {};
    const fields: string[] = [];

    if (data.backgroundColor) {
      shapeProperties.shapeBackgroundFill = toSlidesSolidFill(data.backgroundColor);
      fields.push("shapeBackgroundFill");
      appliedFormats.push("background color");
    }

    const outline: Record<string, unknown> = {};
    let hasOutlineChanges = false;

    if (data.outlineColor) {
      outline.outlineFill = {
        solidFill: {
          color: toSlidesColorStyle(data.outlineColor),
        },
      };
      hasOutlineChanges = true;
      appliedFormats.push("outline color");
    }

    if (data.outlineWeight !== undefined) {
      outline.weight = { magnitude: data.outlineWeight, unit: "PT" };
      hasOutlineChanges = true;
      appliedFormats.push("outline weight");
    }

    if (data.outlineDashStyle !== undefined) {
      outline.dashStyle = data.outlineDashStyle;
      hasOutlineChanges = true;
      appliedFormats.push("outline dash style");
    }

    if (hasOutlineChanges) {
      shapeProperties.outline = outline;
      fields.push("outline");
    }

    if (fields.length > 0) {
      requests.push({
        updateShapeProperties: {
          objectId: data.objectId!,
          shapeProperties,
          fields: fields.join(","),
        },
      });
    }
  } else if (data.targetType === "slide") {
    if (data.slideBackgroundColor) {
      const bgRequests = data.pageObjectIds!.map((pageObjectId) => ({
        updatePageProperties: {
          objectId: pageObjectId,
          pageProperties: {
            pageBackgroundFill: toSlidesSolidFill(data.slideBackgroundColor!),
          },
          fields: "pageBackgroundFill",
        },
      }));
      requests.push(...bgRequests);
      appliedFormats.push(`slide background (${data.pageObjectIds!.length} slide(s))`);
    }
  }

  if (requests.length === 0) {
    return errorResponse(
      "No formatting options specified. For text: provide bold, italic, underline, strikethrough, " +
        "fontSize, fontFamily, foregroundColor, alignment, lineSpacing, or bulletStyle. " +
        "For shape: provide backgroundColor, outlineColor, outlineWeight, or outlineDashStyle. " +
        "For slide: provide slideBackgroundColor.",
    );
  }

  await slides.presentations.batchUpdate({
    presentationId: data.presentationId,
    requestBody: { requests },
  });

  const targetDesc =
    data.targetType === "slide"
      ? `${data.pageObjectIds!.length} slide(s)`
      : `${data.targetType} ${data.objectId}`;

  return successResponse(`Applied formatting to ${targetDesc}: ${appliedFormats.join(", ")}`);
}

export async function handleListSlidePages(
  slides: slides_v1.Slides,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ListSlidePagesSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  const response = await slides.presentations.get({
    presentationId: data.presentationId,
    fields: "presentationId,slides(objectId,slideProperties(layoutObjectId))",
  });

  const pages =
    response.data.slides?.map((slide, index) => ({
      objectId: slide.objectId,
      index,
      pageType: "SLIDE" as const,
    })) || [];

  const pageList = pages.map((p) => `${p.index}: ${p.objectId}`).join("\n");

  return structuredResponse(`Presentation has ${pages.length} slide(s):\n${pageList}`, {
    presentationId: data.presentationId,
    pages,
  });
}
