import { z } from "zod";

// Shared schemas

/**
 * Email address with optional display name
 */
export const EmailAddressSchema = z.object({
  email: z.string().email("Valid email required"),
  name: z.string().optional().describe("Display name"),
});

export type EmailAddressInput = z.infer<typeof EmailAddressSchema>;

/**
 * Attachment for sending emails
 */
export const AttachmentSchema = z.object({
  filename: z.string().min(1, "Filename required"),
  content: z.string().describe("Base64-encoded content"),
  mimeType: z.string().optional().describe("MIME type (auto-detected if not provided)"),
});

export type AttachmentInput = z.infer<typeof AttachmentSchema>;

// Core Email Operations

export const SendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1, "At least one recipient required"),
  subject: z.string().min(1, "Subject required"),
  body: z.string().describe("Plain text email body"),
  html: z.string().optional().describe("HTML email body (overrides plain text for HTML clients)"),
  cc: z.array(z.string().email()).optional().describe("CC recipients"),
  bcc: z.array(z.string().email()).optional().describe("BCC recipients"),
  replyTo: z.string().email().optional().describe("Reply-to address"),
  attachments: z.array(AttachmentSchema).optional().describe("File attachments"),
  threadId: z.string().optional().describe("Thread ID to reply to"),
  inReplyTo: z.string().optional().describe("Message-ID header for threading"),
});

export type SendEmailInput = z.infer<typeof SendEmailSchema>;

export const DraftEmailSchema = z.object({
  to: z.array(z.string().email()).optional().describe("Recipients (can be empty for drafts)"),
  subject: z.string().optional().describe("Subject (can be empty for drafts)"),
  body: z.string().optional().describe("Plain text email body"),
  html: z.string().optional().describe("HTML email body"),
  cc: z.array(z.string().email()).optional().describe("CC recipients"),
  bcc: z.array(z.string().email()).optional().describe("BCC recipients"),
  replyTo: z.string().email().optional().describe("Reply-to address"),
  attachments: z.array(AttachmentSchema).optional().describe("File attachments"),
  threadId: z.string().optional().describe("Thread ID for draft replies"),
});

export type DraftEmailInput = z.infer<typeof DraftEmailSchema>;

export const ReadEmailSchema = z.object({
  messageId: z.string().min(1, "Message ID required"),
  format: z
    .enum(["full", "metadata", "minimal", "raw"])
    .optional()
    .default("full")
    .describe("Response format"),
});

export type ReadEmailInput = z.infer<typeof ReadEmailSchema>;

export const SearchEmailsSchema = z.object({
  query: z
    .string()
    .min(1, "Search query required")
    .describe("Gmail search query (e.g., 'from:sender@example.com', 'is:unread', 'subject:hello')"),
  maxResults: z.number().int().min(1).max(500).optional().default(50).describe("Maximum results"),
  pageToken: z.string().optional().describe("Token for pagination"),
  labelIds: z.array(z.string()).optional().describe("Filter by label IDs"),
  includeSpamTrash: z.boolean().optional().default(false).describe("Include spam and trash"),
});

export type SearchEmailsInput = z.infer<typeof SearchEmailsSchema>;

/**
 * Schema for deleting emails - supports single ID or array for batch operations
 */
export const DeleteEmailSchema = z.object({
  messageId: z
    .union([z.string().min(1), z.array(z.string().min(1)).min(1).max(1000)])
    .describe("Message ID or array of IDs (max 1000 for batch)"),
});

export type DeleteEmailInput = z.infer<typeof DeleteEmailSchema>;

/**
 * Schema for modifying email labels - supports single ID or array for batch operations
 */
export const ModifyEmailSchema = z.object({
  messageId: z
    .union([z.string().min(1), z.array(z.string().min(1)).min(1).max(1000)])
    .describe("Message ID or array of IDs (max 1000 for batch)"),
  addLabelIds: z.array(z.string()).optional().describe("Label IDs to add"),
  removeLabelIds: z.array(z.string()).optional().describe("Label IDs to remove"),
});

export type ModifyEmailInput = z.infer<typeof ModifyEmailSchema>;

export const DownloadAttachmentSchema = z.object({
  messageId: z.string().min(1, "Message ID required"),
  attachmentId: z.string().min(1, "Attachment ID required"),
  filename: z.string().optional().describe("Save filename (uses original if not specified)"),
  outputPath: z.string().optional().describe("Output directory path"),
});

export type DownloadAttachmentInput = z.infer<typeof DownloadAttachmentSchema>;


// Label Management

export const CreateLabelSchema = z.object({
  name: z.string().min(1, "Label name required"),
  messageListVisibility: z
    .enum(["show", "hide"])
    .optional()
    .default("show")
    .describe("Show/hide in message list"),
  labelListVisibility: z
    .enum(["labelShow", "labelShowIfUnread", "labelHide"])
    .optional()
    .default("labelShow")
    .describe("Show/hide in label list"),
  backgroundColor: z.string().optional().describe("Background color (hex, e.g., #ff0000)"),
  textColor: z.string().optional().describe("Text color (hex, e.g., #ffffff)"),
});

export type CreateLabelInput = z.infer<typeof CreateLabelSchema>;

export const UpdateLabelSchema = z.object({
  labelId: z.string().min(1, "Label ID required"),
  name: z.string().optional().describe("New label name"),
  messageListVisibility: z.enum(["show", "hide"]).optional(),
  labelListVisibility: z.enum(["labelShow", "labelShowIfUnread", "labelHide"]).optional(),
  backgroundColor: z.string().optional().describe("Background color (hex)"),
  textColor: z.string().optional().describe("Text color (hex)"),
});

export type UpdateLabelInput = z.infer<typeof UpdateLabelSchema>;

export const DeleteLabelSchema = z.object({
  labelId: z.string().min(1, "Label ID required"),
});

export type DeleteLabelInput = z.infer<typeof DeleteLabelSchema>;

export const ListLabelsSchema = z.object({
  includeSystemLabels: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include system labels like INBOX, SENT"),
});

export type ListLabelsInput = z.infer<typeof ListLabelsSchema>;

export const GetOrCreateLabelSchema = z.object({
  name: z.string().min(1, "Label name required"),
  messageListVisibility: z.enum(["show", "hide"]).optional().default("show"),
  labelListVisibility: z.enum(["labelShow", "labelShowIfUnread", "labelHide"]).optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
});

export type GetOrCreateLabelInput = z.infer<typeof GetOrCreateLabelSchema>;

// Filter Management

/**
 * Filter criteria for matching emails
 */
export const FilterCriteriaSchema = z.object({
  from: z.string().optional().describe("Match sender"),
  to: z.string().optional().describe("Match recipient"),
  subject: z.string().optional().describe("Match subject"),
  query: z.string().optional().describe("Gmail search query"),
  hasAttachment: z.boolean().optional().describe("Has attachment"),
  excludeChats: z.boolean().optional().default(true).describe("Exclude chat messages"),
  size: z.number().int().optional().describe("Size threshold in bytes"),
  sizeComparison: z.enum(["larger", "smaller"]).optional().describe("Size comparison"),
});

export type FilterCriteriaInput = z.infer<typeof FilterCriteriaSchema>;

/**
 * Actions to perform on matching emails
 */
export const FilterActionSchema = z.object({
  addLabelIds: z.array(z.string()).optional().describe("Label IDs to add"),
  removeLabelIds: z.array(z.string()).optional().describe("Label IDs to remove"),
  forward: z.string().email().optional().describe("Forward to email address"),
});

export type FilterActionInput = z.infer<typeof FilterActionSchema>;

/**
 * Template types for common filter use cases
 */
export const FilterTemplateType = z.enum([
  "fromSender",
  "withSubject",
  "withAttachments",
  "largeEmails",
  "mailingList",
]);

export type FilterTemplateTypeValue = z.infer<typeof FilterTemplateType>;

/**
 * Create filter - supports direct criteria/action or pre-built templates
 */
export const CreateFilterSchema = z
  .object({
    // Direct mode
    criteria: FilterCriteriaSchema.optional(),
    action: FilterActionSchema.optional(),
    // Template mode
    template: FilterTemplateType.optional().describe("Use a pre-built template"),
    labelIds: z.array(z.string()).optional().describe("Label IDs for template mode"),
    archive: z.boolean().optional().default(false).describe("Remove from inbox (template mode)"),
    email: z.string().email().optional().describe("Email address (for fromSender, mailingList)"),
    subject: z.string().optional().describe("Subject text (for withSubject)"),
    sizeBytes: z.number().int().optional().describe("Size in bytes (for largeEmails)"),
    listAddress: z.string().optional().describe("Mailing list address (for mailingList)"),
  })
  .refine(
    (data) => {
      // Either direct mode or template mode
      if (data.template) {
        // Template mode requires labelIds
        if (!data.labelIds || data.labelIds.length === 0) return false;
        // Template-specific validation
        switch (data.template) {
          case "fromSender":
            return !!data.email;
          case "withSubject":
            return !!data.subject;
          case "largeEmails":
            return !!data.sizeBytes;
          case "mailingList":
            return !!data.listAddress || !!data.email;
          case "withAttachments":
            return true;
        }
      } else {
        // Direct mode requires criteria and action
        return !!data.criteria && !!data.action;
      }
    },
    {
      message:
        "Provide either (criteria + action) for direct mode, or (template + labelIds) for template mode",
    },
  );

export type CreateFilterInput = z.infer<typeof CreateFilterSchema>;

export const ListFiltersSchema = z.object({
  filterId: z
    .string()
    .optional()
    .describe("Optional filter ID to get details of a specific filter"),
});

export type ListFiltersInput = z.infer<typeof ListFiltersSchema>;

export const DeleteFilterSchema = z.object({
  filterId: z.string().min(1, "Filter ID required"),
});

export type DeleteFilterInput = z.infer<typeof DeleteFilterSchema>;

