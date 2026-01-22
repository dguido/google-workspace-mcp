import type { gmail_v1 } from "googleapis";
import {
  log,
  successResponse,
  structuredResponse,
  errorResponse,
  validateArgs,
  buildMimeMessage,
  parseEmailHeaders,
  decodeBase64Url,
  truncateResponse,
} from "../utils/index.js";
import type { ToolResponse } from "../utils/index.js";
import {
  SendEmailSchema,
  DraftEmailSchema,
  ReadEmailSchema,
  SearchEmailsSchema,
  DeleteEmailSchema,
  ModifyEmailSchema,
  DownloadAttachmentSchema,
  CreateLabelSchema,
  UpdateLabelSchema,
  DeleteLabelSchema,
  ListLabelsSchema,
  GetOrCreateLabelSchema,
  CreateFilterSchema,
  ListFiltersSchema,
  DeleteFilterSchema,
} from "../schemas/index.js";
import * as fs from "fs/promises";
import * as path from "path";

// System labels that cannot be deleted
const SYSTEM_LABELS = new Set([
  "INBOX",
  "SPAM",
  "TRASH",
  "UNREAD",
  "STARRED",
  "IMPORTANT",
  "SENT",
  "DRAFT",
  "CATEGORY_PERSONAL",
  "CATEGORY_SOCIAL",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
]);

// Helper to extract email body from message parts
function extractEmailBody(payload: gmail_v1.Schema$MessagePart | undefined): {
  text: string;
  html: string;
} {
  if (!payload) return { text: "", html: "" };

  const result = { text: "", html: "" };

  function processpart(part: gmail_v1.Schema$MessagePart) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      result.text = decodeBase64Url(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data) {
      result.html = decodeBase64Url(part.body.data);
    } else if (part.parts) {
      for (const subPart of part.parts) {
        processpart(subPart);
      }
    }
  }

  if (payload.body?.data) {
    if (payload.mimeType === "text/html") {
      result.html = decodeBase64Url(payload.body.data);
    } else {
      result.text = decodeBase64Url(payload.body.data);
    }
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      processpart(part);
    }
  }

  return result;
}

// Helper to extract attachments info
function extractAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined,
): Array<{ id: string; filename: string; mimeType: string; size: number }> {
  const attachments: Array<{ id: string; filename: string; mimeType: string; size: number }> = [];

  function processPart(part: gmail_v1.Schema$MessagePart) {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
      });
    }
    if (part.parts) {
      for (const subPart of part.parts) {
        processPart(subPart);
      }
    }
  }

  if (payload?.parts) {
    for (const part of payload.parts) {
      processPart(part);
    }
  }

  return attachments;
}

// ============================================================================
// Core Email Operations
// ============================================================================

export async function handleSendEmail(gmail: gmail_v1.Gmail, args: unknown): Promise<ToolResponse> {
  const validation = validateArgs(SendEmailSchema, args);
  if (!validation.success) return validation.response;
  const { to, subject, body, html, cc, bcc, replyTo, attachments, threadId, inReplyTo } =
    validation.data;

  const raw = buildMimeMessage({
    to,
    subject,
    body,
    html,
    cc,
    bcc,
    replyTo,
    attachments,
    inReplyTo,
  });

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId,
    },
  });

  log("Sent email", { messageId: response.data.id, threadId: response.data.threadId });

  return structuredResponse(
    `Email sent successfully.\nMessage ID: ${response.data.id}\nThread ID: ${response.data.threadId}`,
    {
      id: response.data.id,
      threadId: response.data.threadId,
      labelIds: response.data.labelIds,
    },
  );
}

export async function handleDraftEmail(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(DraftEmailSchema, args);
  if (!validation.success) return validation.response;
  const { to, subject, body, html, cc, bcc, replyTo, attachments, threadId } = validation.data;

  const raw = buildMimeMessage({
    to: to || [],
    subject: subject || "",
    body: body || "",
    html,
    cc,
    bcc,
    replyTo,
    attachments,
  });

  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw,
        threadId,
      },
    },
  });

  log("Created draft", { draftId: response.data.id });

  return structuredResponse(
    `Draft created successfully.\nDraft ID: ${response.data.id}\nMessage ID: ${response.data.message?.id}`,
    {
      id: response.data.id,
      messageId: response.data.message?.id,
      threadId: response.data.message?.threadId,
    },
  );
}

export async function handleReadEmail(gmail: gmail_v1.Gmail, args: unknown): Promise<ToolResponse> {
  const validation = validateArgs(ReadEmailSchema, args);
  if (!validation.success) return validation.response;
  const { messageId, format, contentFormat } = validation.data;

  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format,
  });

  const message = response.data;
  const headers = parseEmailHeaders(message.payload?.headers || []);
  const attachments = extractAttachments(message.payload);

  // Extract body based on contentFormat
  let text = "";
  let html = "";
  if (contentFormat !== "headers") {
    const body = extractEmailBody(message.payload);
    text = body.text;
    html = contentFormat === "full" ? body.html : "";
  }

  // Build text output based on contentFormat
  const textOutputParts = [
    `From: ${headers.from || "Unknown"}`,
    `To: ${headers.to || "Unknown"}`,
    headers.cc ? `Cc: ${headers.cc}` : null,
    `Subject: ${headers.subject || "(No subject)"}`,
    `Date: ${headers.date || "Unknown"}`,
    `Labels: ${message.labelIds?.join(", ") || "None"}`,
    attachments.length > 0
      ? `Attachments: ${attachments.map((a) => `${a.filename} (${a.size} bytes)`).join(", ")}`
      : null,
  ];

  // Only include body section if contentFormat is not "headers"
  if (contentFormat !== "headers") {
    textOutputParts.push("", "--- Body ---", text || html || "(No content)");
  }

  const textOutput = textOutputParts.filter(Boolean).join("\n");
  const { content: truncatedContent, truncated } = truncateResponse(textOutput);

  log("Read email", { messageId, contentFormat, truncated });

  // Build response body based on contentFormat
  const responseBody =
    contentFormat === "headers" ? undefined : contentFormat === "text" ? { text } : { text, html };

  return structuredResponse(truncatedContent, {
    id: message.id,
    threadId: message.threadId,
    labelIds: message.labelIds,
    snippet: message.snippet,
    headers,
    body: responseBody,
    attachments,
    internalDate: message.internalDate,
    sizeEstimate: message.sizeEstimate,
    truncated,
  });
}

export async function handleSearchEmails(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(SearchEmailsSchema, args);
  if (!validation.success) return validation.response;
  const { query, maxResults, pageToken, labelIds, includeSpamTrash } = validation.data;

  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
    pageToken,
    labelIds,
    includeSpamTrash,
  });

  const messages = response.data.messages || [];

  if (messages.length === 0) {
    return structuredResponse(`No emails found matching: ${query}`, {
      messages: [],
      nextPageToken: null,
      resultSizeEstimate: 0,
    });
  }

  // Fetch basic metadata for each message
  const messageDetails = await Promise.all(
    messages.slice(0, 50).map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });
      const headers = parseEmailHeaders(detail.data.payload?.headers || []);
      return {
        id: detail.data.id,
        threadId: detail.data.threadId,
        snippet: detail.data.snippet,
        from: headers.from,
        to: headers.to,
        subject: headers.subject,
        date: headers.date,
        labelIds: detail.data.labelIds,
      };
    }),
  );

  const formattedList = messageDetails
    .map((m) => `- [${m.id}] ${m.subject || "(No subject)"} from ${m.from || "Unknown"}`)
    .join("\n");

  let textResponse = `Found ${response.data.resultSizeEstimate} email(s):\n\n${formattedList}`;
  if (response.data.nextPageToken) {
    textResponse += `\n\nMore results available. Use pageToken: ${response.data.nextPageToken}`;
  }

  log("Searched emails", { query, count: messages.length });

  return structuredResponse(textResponse, {
    messages: messageDetails,
    nextPageToken: response.data.nextPageToken || null,
    resultSizeEstimate: response.data.resultSizeEstimate,
  });
}

export async function handleDeleteEmail(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(DeleteEmailSchema, args);
  if (!validation.success) return validation.response;
  const { messageId } = validation.data;

  // Normalize to array for uniform handling
  const messageIds = Array.isArray(messageId) ? messageId : [messageId];

  if (messageIds.length === 1) {
    // Single delete
    await gmail.users.messages.delete({
      userId: "me",
      id: messageIds[0],
    });
    log("Deleted email", { messageId: messageIds[0] });
    return successResponse(`Email ${messageIds[0]} permanently deleted.`);
  }

  // Batch delete
  try {
    await gmail.users.messages.batchDelete({
      userId: "me",
      requestBody: { ids: messageIds },
    });
  } catch {
    // Batch API may not be available, fall back to individual deletes
    const results = await Promise.allSettled(
      messageIds.map((id) =>
        gmail.users.messages.delete({
          userId: "me",
          id,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed > 0) {
      return structuredResponse(`Partially completed: ${succeeded} deleted, ${failed} failed.`, {
        succeeded,
        failed,
        total: messageIds.length,
      });
    }
  }

  log("Deleted emails (batch)", { count: messageIds.length });
  return successResponse(`Successfully deleted ${messageIds.length} email(s).`);
}

export async function handleModifyEmail(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ModifyEmailSchema, args);
  if (!validation.success) return validation.response;
  const { messageId, addLabelIds, removeLabelIds } = validation.data;

  // Normalize to array for uniform handling
  const messageIds = Array.isArray(messageId) ? messageId : [messageId];

  if (messageIds.length === 1) {
    // Single modify
    const response = await gmail.users.messages.modify({
      userId: "me",
      id: messageIds[0],
      requestBody: { addLabelIds, removeLabelIds },
    });

    log("Modified email labels", { messageId: messageIds[0], addLabelIds, removeLabelIds });

    return structuredResponse(
      `Email ${messageIds[0]} labels updated.\nCurrent labels: ${response.data.labelIds?.join(", ") || "None"}`,
      {
        id: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds,
      },
    );
  }

  // Batch modify
  await gmail.users.messages.batchModify({
    userId: "me",
    requestBody: {
      ids: messageIds,
      addLabelIds,
      removeLabelIds,
    },
  });

  log("Batch modified emails", { count: messageIds.length, addLabelIds, removeLabelIds });

  return successResponse(
    `Successfully modified labels for ${messageIds.length} email(s).` +
      (addLabelIds ? `\nAdded labels: ${addLabelIds.join(", ")}` : "") +
      (removeLabelIds ? `\nRemoved labels: ${removeLabelIds.join(", ")}` : ""),
  );
}

export async function handleDownloadAttachment(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(DownloadAttachmentSchema, args);
  if (!validation.success) return validation.response;
  const { messageId, attachmentId, filename, outputPath } = validation.data;

  // Get the attachment
  const response = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });

  if (!response.data.data) {
    return errorResponse("Attachment data not found", { code: "NOT_FOUND" });
  }

  // Decode base64url data
  const data = Buffer.from(response.data.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");

  // Determine output filename
  const outputFilename = filename || `attachment_${attachmentId}`;
  const outputDir = outputPath || process.cwd();
  const fullPath = path.join(outputDir, outputFilename);

  // Write to file
  await fs.writeFile(fullPath, data);

  log("Downloaded attachment", { messageId, attachmentId, path: fullPath });

  return structuredResponse(
    `Attachment downloaded successfully.\nSaved to: ${fullPath}\nSize: ${data.length} bytes`,
    {
      path: fullPath,
      size: data.length,
      messageId,
      attachmentId,
    },
  );
}

// ============================================================================
// Label Management
// ============================================================================

export async function handleCreateLabel(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateLabelSchema, args);
  if (!validation.success) return validation.response;
  const { name, messageListVisibility, labelListVisibility, backgroundColor, textColor } =
    validation.data;

  const response = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name,
      messageListVisibility,
      labelListVisibility,
      color:
        backgroundColor || textColor
          ? {
              backgroundColor,
              textColor,
            }
          : undefined,
    },
  });

  log("Created label", { labelId: response.data.id, name });

  return structuredResponse(`Label "${name}" created successfully.\nID: ${response.data.id}`, {
    id: response.data.id,
    name: response.data.name,
    type: response.data.type,
    messageListVisibility: response.data.messageListVisibility,
    labelListVisibility: response.data.labelListVisibility,
    color: response.data.color,
  });
}

export async function handleUpdateLabel(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(UpdateLabelSchema, args);
  if (!validation.success) return validation.response;
  const { labelId, name, messageListVisibility, labelListVisibility, backgroundColor, textColor } =
    validation.data;

  const response = await gmail.users.labels.patch({
    userId: "me",
    id: labelId,
    requestBody: {
      name,
      messageListVisibility,
      labelListVisibility,
      color:
        backgroundColor || textColor
          ? {
              backgroundColor,
              textColor,
            }
          : undefined,
    },
  });

  log("Updated label", { labelId, name });

  return structuredResponse(`Label updated successfully.`, {
    id: response.data.id,
    name: response.data.name,
    type: response.data.type,
    messageListVisibility: response.data.messageListVisibility,
    labelListVisibility: response.data.labelListVisibility,
    color: response.data.color,
  });
}

export async function handleDeleteLabel(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(DeleteLabelSchema, args);
  if (!validation.success) return validation.response;
  const { labelId } = validation.data;

  // Prevent deletion of system labels
  if (SYSTEM_LABELS.has(labelId)) {
    return errorResponse(`Cannot delete system label: ${labelId}`, { code: "INVALID_INPUT" });
  }

  await gmail.users.labels.delete({
    userId: "me",
    id: labelId,
  });

  log("Deleted label", { labelId });

  return successResponse(`Label ${labelId} deleted successfully.`);
}

export async function handleListLabels(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ListLabelsSchema, args);
  if (!validation.success) return validation.response;
  const { includeSystemLabels } = validation.data;

  const response = await gmail.users.labels.list({
    userId: "me",
  });

  let labels = response.data.labels || [];

  // Separate system and user labels
  const systemLabels = labels.filter((l) => l.type === "system");
  const userLabels = labels.filter((l) => l.type === "user");

  if (!includeSystemLabels) {
    labels = userLabels;
  }

  const formattedLabels = labels.map((l) => `- ${l.name} [${l.id}] (${l.type})`).join("\n");

  log("Listed labels", {
    total: labels.length,
    system: systemLabels.length,
    user: userLabels.length,
  });

  return structuredResponse(`Found ${labels.length} label(s):\n\n${formattedLabels}`, {
    labels: labels.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      messageListVisibility: l.messageListVisibility,
      labelListVisibility: l.labelListVisibility,
      color: l.color,
      messagesTotal: l.messagesTotal,
      messagesUnread: l.messagesUnread,
    })),
    systemLabelCount: systemLabels.length,
    userLabelCount: userLabels.length,
  });
}

export async function handleGetOrCreateLabel(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetOrCreateLabelSchema, args);
  if (!validation.success) return validation.response;
  const { name, messageListVisibility, labelListVisibility, backgroundColor, textColor } =
    validation.data;

  // First try to find existing label
  const listResponse = await gmail.users.labels.list({
    userId: "me",
  });

  const existingLabel = listResponse.data.labels?.find(
    (l) => l.name?.toLowerCase() === name.toLowerCase(),
  );

  if (existingLabel) {
    return structuredResponse(`Label "${name}" already exists.\nID: ${existingLabel.id}`, {
      id: existingLabel.id,
      name: existingLabel.name,
      type: existingLabel.type,
      created: false,
    });
  }

  // Create new label
  const createResponse = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name,
      messageListVisibility,
      labelListVisibility,
      color:
        backgroundColor || textColor
          ? {
              backgroundColor,
              textColor,
            }
          : undefined,
    },
  });

  log("Created label (get_or_create)", { labelId: createResponse.data.id, name });

  return structuredResponse(
    `Label "${name}" created successfully.\nID: ${createResponse.data.id}`,
    {
      id: createResponse.data.id,
      name: createResponse.data.name,
      type: createResponse.data.type,
      created: true,
    },
  );
}

// ============================================================================
// Filter Management
// ============================================================================

// Helper to build filter criteria from template
function buildFilterFromTemplate(data: {
  template: string;
  labelIds: string[];
  archive?: boolean;
  email?: string;
  subject?: string;
  sizeBytes?: number;
  listAddress?: string;
}): { criteria: gmail_v1.Schema$FilterCriteria; action: gmail_v1.Schema$FilterAction } {
  const action: gmail_v1.Schema$FilterAction = {
    addLabelIds: data.labelIds,
    removeLabelIds: data.archive ? ["INBOX"] : undefined,
  };

  let criteria: gmail_v1.Schema$FilterCriteria;

  switch (data.template) {
    case "fromSender":
      criteria = { from: data.email };
      break;
    case "withSubject":
      criteria = { subject: data.subject };
      break;
    case "withAttachments":
      criteria = { hasAttachment: true };
      break;
    case "largeEmails":
      criteria = { size: data.sizeBytes, sizeComparison: "larger" };
      break;
    case "mailingList":
      criteria = { query: `list:${data.listAddress || data.email}` };
      break;
    default:
      criteria = {};
  }

  return { criteria, action };
}

export async function handleCreateFilter(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateFilterSchema, args);
  if (!validation.success) return validation.response;
  const data = validation.data;

  let filterCriteria: gmail_v1.Schema$FilterCriteria;
  let filterAction: gmail_v1.Schema$FilterAction;

  if (data.template) {
    // Template mode
    const built = buildFilterFromTemplate({
      template: data.template,
      labelIds: data.labelIds!,
      archive: data.archive,
      email: data.email,
      subject: data.subject,
      sizeBytes: data.sizeBytes,
      listAddress: data.listAddress,
    });
    filterCriteria = built.criteria;
    filterAction = built.action;
  } else {
    // Direct mode
    const criteria = data.criteria!;
    const action = data.action!;
    filterCriteria = {
      from: criteria.from,
      to: criteria.to,
      subject: criteria.subject,
      query: criteria.query,
      hasAttachment: criteria.hasAttachment,
      excludeChats: criteria.excludeChats,
      size: criteria.size,
      sizeComparison: criteria.sizeComparison,
    };
    filterAction = {
      addLabelIds: action.addLabelIds,
      removeLabelIds: action.removeLabelIds,
      forward: action.forward,
    };
  }

  const response = await gmail.users.settings.filters.create({
    userId: "me",
    requestBody: {
      criteria: filterCriteria,
      action: filterAction,
    },
  });

  log("Created filter", { filterId: response.data.id, template: data.template });

  return structuredResponse(
    `Filter created successfully.${data.template ? ` (template: ${data.template})` : ""}\nID: ${response.data.id}`,
    {
      id: response.data.id,
      template: data.template,
      criteria: response.data.criteria,
      action: response.data.action,
    },
  );
}

export async function handleListFilters(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ListFiltersSchema, args);
  if (!validation.success) return validation.response;
  const { filterId } = validation.data;

  // If filterId provided, get that specific filter
  if (filterId) {
    const response = await gmail.users.settings.filters.get({
      userId: "me",
      id: filterId,
    });

    const filter = response.data;
    const criteriaStr = [
      filter.criteria?.from ? `From: ${filter.criteria.from}` : null,
      filter.criteria?.to ? `To: ${filter.criteria.to}` : null,
      filter.criteria?.subject ? `Subject: ${filter.criteria.subject}` : null,
      filter.criteria?.query ? `Query: ${filter.criteria.query}` : null,
      filter.criteria?.hasAttachment ? "Has attachment" : null,
    ]
      .filter(Boolean)
      .join("\n");

    const actionStr = [
      filter.action?.addLabelIds ? `Add labels: ${filter.action.addLabelIds.join(", ")}` : null,
      filter.action?.removeLabelIds
        ? `Remove labels: ${filter.action.removeLabelIds.join(", ")}`
        : null,
      filter.action?.forward ? `Forward to: ${filter.action.forward}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    log("Retrieved filter", { filterId });

    return structuredResponse(
      `Filter: ${filterId}\n\nCriteria:\n${criteriaStr || "None"}\n\nActions:\n${actionStr || "None"}`,
      {
        id: filter.id,
        criteria: filter.criteria,
        action: filter.action,
      },
    );
  }

  // List all filters
  const response = await gmail.users.settings.filters.list({
    userId: "me",
  });

  const filters = response.data.filter || [];

  if (filters.length === 0) {
    return structuredResponse("No filters found.", { filters: [] });
  }

  const formattedFilters = filters
    .map((f) => {
      const criteria = f.criteria || {};
      const criteriaStr = [
        criteria.from ? `from:${criteria.from}` : null,
        criteria.to ? `to:${criteria.to}` : null,
        criteria.subject ? `subject:${criteria.subject}` : null,
        criteria.query ? `query:${criteria.query}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `- [${f.id}] ${criteriaStr || "(no criteria)"}`;
    })
    .join("\n");

  log("Listed filters", { count: filters.length });

  return structuredResponse(`Found ${filters.length} filter(s):\n\n${formattedFilters}`, {
    filters: filters.map((f) => ({
      id: f.id,
      criteria: f.criteria,
      action: f.action,
    })),
  });
}

export async function handleDeleteFilter(
  gmail: gmail_v1.Gmail,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(DeleteFilterSchema, args);
  if (!validation.success) return validation.response;
  const { filterId } = validation.data;

  await gmail.users.settings.filters.delete({
    userId: "me",
    id: filterId,
  });

  log("Deleted filter", { filterId });

  return successResponse(`Filter ${filterId} deleted successfully.`);
}
