/**
 * MIME message construction utilities for Gmail API.
 * Gmail requires raw email content to be base64url encoded.
 */

export interface EmailOptions {
  to: string[];
  subject: string;
  body: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 encoded
    mimeType?: string;
  }>;
  inReplyTo?: string;
  references?: string;
}

/**
 * Generate a random boundary for multipart messages
 */
function generateBoundary(): string {
  return `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

/**
 * Detect MIME type from filename extension
 */
function detectMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    txt: "text/plain",
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    xml: "application/xml",
    pdf: "application/pdf",
    zip: "application/zip",
    gz: "application/gzip",
    tar: "application/x-tar",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    ico: "image/x-icon",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
    webm: "video/webm",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
    csv: "text/csv",
    md: "text/markdown",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}

/**
 * Build a MIME message for Gmail API.
 * Returns a base64url-encoded string ready for the Gmail API.
 */
export function buildMimeMessage(options: EmailOptions): string {
  const { to, subject, body, html, cc, bcc, replyTo, attachments, inReplyTo, references } = options;

  const hasHtml = !!html;
  const hasAttachments = attachments && attachments.length > 0;

  // Build headers
  const headers: string[] = [
    `To: ${to.join(", ")}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
  ];

  if (cc && cc.length > 0) {
    headers.push(`Cc: ${cc.join(", ")}`);
  }

  if (bcc && bcc.length > 0) {
    headers.push(`Bcc: ${bcc.join(", ")}`);
  }

  if (replyTo) {
    headers.push(`Reply-To: ${replyTo}`);
  }

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }

  if (references) {
    headers.push(`References: ${references}`);
  }

  let messageBody: string;

  if (hasAttachments) {
    // Multipart mixed for attachments
    const mixedBoundary = generateBoundary();
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);

    const parts: string[] = [];

    // Text/HTML part
    if (hasHtml) {
      const altBoundary = generateBoundary();
      parts.push(`--${mixedBoundary}`);
      parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      parts.push("");
      parts.push(`--${altBoundary}`);
      parts.push("Content-Type: text/plain; charset=UTF-8");
      parts.push("Content-Transfer-Encoding: base64");
      parts.push("");
      parts.push(Buffer.from(body).toString("base64"));
      parts.push(`--${altBoundary}`);
      parts.push("Content-Type: text/html; charset=UTF-8");
      parts.push("Content-Transfer-Encoding: base64");
      parts.push("");
      parts.push(Buffer.from(html).toString("base64"));
      parts.push(`--${altBoundary}--`);
    } else {
      parts.push(`--${mixedBoundary}`);
      parts.push("Content-Type: text/plain; charset=UTF-8");
      parts.push("Content-Transfer-Encoding: base64");
      parts.push("");
      parts.push(Buffer.from(body).toString("base64"));
    }

    // Attachments
    for (const attachment of attachments!) {
      const mimeType = attachment.mimeType || detectMimeType(attachment.filename);
      parts.push(`--${mixedBoundary}`);
      parts.push(`Content-Type: ${mimeType}; name="${attachment.filename}"`);
      parts.push("Content-Transfer-Encoding: base64");
      parts.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      parts.push("");
      parts.push(attachment.content);
    }

    parts.push(`--${mixedBoundary}--`);
    messageBody = parts.join("\r\n");
  } else if (hasHtml) {
    // Multipart alternative for HTML + plain text
    const altBoundary = generateBoundary();
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);

    messageBody = [
      `--${altBoundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body).toString("base64"),
      `--${altBoundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(html).toString("base64"),
      `--${altBoundary}--`,
    ].join("\r\n");
  } else {
    // Simple plain text
    headers.push("Content-Type: text/plain; charset=UTF-8");
    headers.push("Content-Transfer-Encoding: base64");
    messageBody = Buffer.from(body).toString("base64");
  }

  const fullMessage = headers.join("\r\n") + "\r\n\r\n" + messageBody;

  // Gmail API requires base64url encoding (not standard base64)
  return Buffer.from(fullMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Parse email headers from a Gmail message payload
 */
export function parseEmailHeaders(
  headers: Array<{ name?: string | null; value?: string | null }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const header of headers) {
    if (header.name && header.value) {
      result[header.name.toLowerCase()] = header.value;
    }
  }
  return result;
}

/**
 * Decode base64url-encoded content (as used by Gmail API)
 */
export function decodeBase64Url(data: string): string {
  // Convert base64url to standard base64
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}
