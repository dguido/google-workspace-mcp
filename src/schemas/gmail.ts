import { z } from "zod";

/**
 * Gmail's allowed label colors (restricted palette)
 * @see https://developers.google.com/gmail/api/reference/rest/v1/users.labels
 */
export const GMAIL_LABEL_COLORS = [
  "#000000",
  "#434343",
  "#666666",
  "#999999",
  "#cccccc",
  "#efefef",
  "#f3f3f3",
  "#ffffff",
  "#fb4c2f",
  "#ffad47",
  "#fad165",
  "#16a766",
  "#43d692",
  "#4a86e8",
  "#a479e2",
  "#f691b3",
  "#f6c5be",
  "#ffe6c7",
  "#fef1d1",
  "#b9e4d0",
  "#c6f3de",
  "#c9daf8",
  "#e4d7f5",
  "#fcdee8",
  "#efa093",
  "#ffd6a2",
  "#fce8b3",
  "#89d3b2",
  "#a0eac9",
  "#a4c2f4",
  "#d0bcf1",
  "#fbc8d9",
  "#e66550",
  "#ffbc6b",
  "#fcda83",
  "#5dc28c",
  "#74db9b",
  "#6d9eeb",
  "#b694e8",
  "#f7a7c0",
  "#cc3a21",
  "#eaa041",
  "#f2c960",
  "#149e60",
  "#44b984",
  "#3c78d8",
  "#8e63ce",
  "#e07798",
  "#ac2b16",
  "#cf8933",
  "#d5ae49",
  "#0b804b",
  "#339966",
  "#285bac",
  "#653e9b",
  "#b65775",
  "#822111",
  "#a46a21",
  "#aa8831",
  "#076239",
  "#1a764d",
  "#1c4587",
  "#41236d",
  "#83334c",
] as const;

export type GmailLabelColor = (typeof GMAIL_LABEL_COLORS)[number];

/**
 * Schema for validating Gmail label colors (case-insensitive)
 */
const gmailLabelColorSchema = z
  .string()
  .refine((color) => GMAIL_LABEL_COLORS.includes(color.toLowerCase() as GmailLabelColor), {
    message: `Invalid Gmail label color. Must be one of: ${GMAIL_LABEL_COLORS.slice(0, 8).join(", ")}... (see GMAIL_LABEL_COLORS for full list)`,
  })
  .transform((color) => color.toLowerCase());

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
  id: z.string().min(1, "Message ID required"),
  format: z
    .enum(["full", "metadata", "minimal", "raw"])
    .optional()
    .default("full")
    .describe("Response format"),
  contentFormat: z
    .enum(["full", "text", "headers"])
    .optional()
    .default("full")
    .describe("Content format: 'full' (text+HTML), 'text' (plain text only), 'headers' (no body)"),
});

export type ReadEmailInput = z.infer<typeof ReadEmailSchema>;

export const SearchEmailsSchema = z
  .object({
    query: z
      .string()
      .max(500)
      .optional()
      .describe(
        "Gmail search query. Operators: from: to: subject: " +
          "has:attachment is:unread after:YYYY/MM/DD " +
          "before:YYYY/MM/DD larger: smaller: label:. " +
          "Gmail ignores special characters like $ and " +
          "commas — use plain numbers (5149 not $5,149).",
      ),
    from: z.string().max(254).optional().describe("Sender email or name"),
    to: z.string().max(254).optional().describe("Recipient email or name"),
    subject: z.string().max(500).optional().describe("Subject line text"),
    after: z.string().max(10).optional().describe("After date (YYYY/MM/DD)"),
    before: z.string().max(10).optional().describe("Before date (YYYY/MM/DD)"),
    hasAttachment: z.boolean().optional().describe("Filter for messages with attachments"),
    label: z.string().max(225).optional().describe("Gmail label name"),
    maxResults: z.number().int().min(1).max(500).optional().default(50).describe("Maximum results"),
    pageToken: z.string().optional().describe("Token for pagination"),
    labelIds: z.array(z.string()).optional().describe("Filter by label IDs"),
    includeSpamTrash: z.boolean().optional().default(false).describe("Include spam and trash"),
  })
  .refine(
    (d) =>
      d.query || d.from || d.to || d.subject || d.after || d.before || d.hasAttachment || d.label,
    { message: "At least one search parameter required" },
  );

export type SearchEmailsInput = z.infer<typeof SearchEmailsSchema>;

/**
 * Schema for deleting emails - supports single ID or array for batch operations
 */
export const DeleteEmailSchema = z.object({
  id: z
    .union([z.string().min(1), z.array(z.string().min(1)).min(1).max(1000)])
    .describe("Message ID or array of IDs (max 1000 for batch)"),
});

export type DeleteEmailInput = z.infer<typeof DeleteEmailSchema>;

/**
 * Schema for modifying email labels - supports single ID or array for batch operations
 */
export const ModifyEmailSchema = z.object({
  threadId: z
    .union([z.string().min(1), z.array(z.string().min(1)).min(1).max(1000)])
    .describe("Thread ID or array of IDs (max 1000 for batch)"),
  addLabelIds: z.array(z.string()).optional().describe("Label IDs to add"),
  removeLabelIds: z.array(z.string()).optional().describe("Label IDs to remove"),
});

export type ModifyEmailInput = z.infer<typeof ModifyEmailSchema>;

export const DownloadAttachmentSchema = z.object({
  id: z.string().min(1, "Message ID required"),
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
  backgroundColor: gmailLabelColorSchema
    .optional()
    .describe("Background color from Gmail palette (e.g., #fb4c2f)"),
  textColor: gmailLabelColorSchema
    .optional()
    .describe("Text color from Gmail palette (e.g., #ffffff)"),
});

export type CreateLabelInput = z.infer<typeof CreateLabelSchema>;

export const UpdateLabelSchema = z.object({
  labelId: z.string().min(1, "Label ID required"),
  name: z.string().optional().describe("New label name"),
  messageListVisibility: z.enum(["show", "hide"]).optional(),
  labelListVisibility: z.enum(["labelShow", "labelShowIfUnread", "labelHide"]).optional(),
  backgroundColor: gmailLabelColorSchema.optional().describe("Background color from Gmail palette"),
  textColor: gmailLabelColorSchema.optional().describe("Text color from Gmail palette"),
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
  backgroundColor: gmailLabelColorSchema.optional(),
  textColor: gmailLabelColorSchema.optional(),
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
