import { google, docs_v1, sheets_v4, slides_v1, calendar_v3, gmail_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

// Cached service instances
let docsService: docs_v1.Docs | null = null;
let sheetsService: sheets_v4.Sheets | null = null;
let slidesService: slides_v1.Slides | null = null;
let calendarService: calendar_v3.Calendar | null = null;
let gmailService: gmail_v1.Gmail | null = null;
let lastAuthClient: OAuth2Client | null = null;

/**
 * Clear cached services. Should be called when auth changes.
 */
export function clearServiceCache(): void {
  docsService = null;
  sheetsService = null;
  slidesService = null;
  calendarService = null;
  gmailService = null;
  lastAuthClient = null;
}

/**
 * Check if auth client has changed and clear cache if needed.
 */
function checkAuthClient(authClient: OAuth2Client): void {
  if (lastAuthClient !== authClient) {
    clearServiceCache();
    lastAuthClient = authClient;
  }
}

/**
 * Get or create a cached Google Docs service instance.
 */
export function getDocsService(authClient: OAuth2Client): docs_v1.Docs {
  checkAuthClient(authClient);
  if (!docsService) {
    docsService = google.docs({ version: "v1", auth: authClient });
  }
  return docsService;
}

/**
 * Get or create a cached Google Sheets service instance.
 */
export function getSheetsService(authClient: OAuth2Client): sheets_v4.Sheets {
  checkAuthClient(authClient);
  if (!sheetsService) {
    sheetsService = google.sheets({ version: "v4", auth: authClient });
  }
  return sheetsService;
}

/**
 * Get or create a cached Google Slides service instance.
 */
export function getSlidesService(authClient: OAuth2Client): slides_v1.Slides {
  checkAuthClient(authClient);
  if (!slidesService) {
    slidesService = google.slides({ version: "v1", auth: authClient });
  }
  return slidesService;
}

/**
 * Get or create a cached Google Calendar service instance.
 */
export function getCalendarService(authClient: OAuth2Client): calendar_v3.Calendar {
  checkAuthClient(authClient);
  if (!calendarService) {
    calendarService = google.calendar({ version: "v3", auth: authClient });
  }
  return calendarService;
}

/**
 * Get or create a cached Gmail service instance.
 */
export function getGmailService(authClient: OAuth2Client): gmail_v1.Gmail {
  checkAuthClient(authClient);
  if (!gmailService) {
    gmailService = google.gmail({ version: "v1", auth: authClient });
  }
  return gmailService;
}
