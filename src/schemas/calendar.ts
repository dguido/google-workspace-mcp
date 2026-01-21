import { z } from "zod";

// Shared schemas for Calendar

/**
 * EventDateTime - for specifying timed or all-day events.
 * Must have either dateTime (for timed events) or date (for all-day events), not both.
 */
export const EventDateTimeSchema = z
  .object({
    dateTime: z
      .string()
      .optional()
      .describe("RFC3339 timestamp with timezone offset (e.g., 2024-01-15T09:00:00-05:00)"),
    date: z
      .string()
      .optional()
      .describe("Date for all-day events (YYYY-MM-DD format, e.g., 2024-01-15)"),
    timeZone: z.string().optional().describe("IANA timezone (e.g., America/New_York)"),
  })
  .refine((data) => data.dateTime || data.date, {
    message: "Either dateTime or date is required",
  })
  .refine((data) => !(data.dateTime && data.date), {
    message: "Cannot have both dateTime and date - use dateTime for timed events, date for all-day",
  });

export type EventDateTimeInput = z.infer<typeof EventDateTimeSchema>;

/**
 * Attendee schema for event invites
 */
export const AttendeeSchema = z.object({
  email: z.string().email("Valid email required"),
  displayName: z.string().optional(),
  optional: z.boolean().optional().describe("Whether attendance is optional"),
  responseStatus: z
    .enum(["needsAction", "declined", "tentative", "accepted"])
    .optional()
    .describe("Attendee's response status"),
});

export type AttendeeInput = z.infer<typeof AttendeeSchema>;

/**
 * Reminder schema for event notifications
 */
export const ReminderSchema = z.object({
  method: z.enum(["email", "popup"]).describe("Reminder delivery method"),
  minutes: z.number().min(0).max(40320).describe("Minutes before event (max 4 weeks)"),
});

export type ReminderInput = z.infer<typeof ReminderSchema>;

// Tool-specific schemas

export const ListCalendarsSchema = z.object({
  showHidden: z.boolean().optional().default(false).describe("Include hidden calendars"),
  showDeleted: z.boolean().optional().default(false).describe("Include deleted calendars"),
});

export type ListCalendarsInput = z.infer<typeof ListCalendarsSchema>;

export const ListEventsSchema = z.object({
  calendarId: z
    .string()
    .optional()
    .default("primary")
    .describe("Calendar ID (defaults to primary calendar)"),
  timeMin: z.string().optional().describe("Lower bound for event start time (RFC3339 timestamp)"),
  timeMax: z.string().optional().describe("Upper bound for event start time (RFC3339 timestamp)"),
  query: z.string().optional().describe("Free text search terms"),
  maxResults: z.number().int().min(1).max(2500).optional().default(250).describe("Max events"),
  pageToken: z.string().optional().describe("Token for pagination"),
  singleEvents: z
    .boolean()
    .optional()
    .default(true)
    .describe("Expand recurring events into instances"),
  orderBy: z
    .enum(["startTime", "updated"])
    .optional()
    .default("startTime")
    .describe("Sort order (startTime requires singleEvents=true)"),
});

export type ListEventsInput = z.infer<typeof ListEventsSchema>;

export const GetEventSchema = z.object({
  calendarId: z.string().optional().default("primary").describe("Calendar ID"),
  eventId: z.string().min(1, "Event ID is required"),
});

export type GetEventInput = z.infer<typeof GetEventSchema>;

export const CreateEventSchema = z.object({
  calendarId: z.string().optional().default("primary").describe("Calendar ID"),
  summary: z.string().min(1, "Event title is required"),
  description: z.string().optional().describe("Event description"),
  location: z.string().optional().describe("Event location"),
  start: EventDateTimeSchema.describe("Event start time"),
  end: EventDateTimeSchema.describe("Event end time"),
  attendees: z.array(AttendeeSchema).optional().describe("List of attendees"),
  addGoogleMeet: z.boolean().optional().default(false).describe("Add Google Meet video conference"),
  reminders: z.array(ReminderSchema).optional().describe("Custom reminders (overrides defaults)"),
  colorId: z
    .string()
    .optional()
    .describe("Event color ID (1-11, see Google Calendar color palette)"),
  recurrence: z
    .array(z.string())
    .optional()
    .describe("RRULE strings for recurring events (e.g., RRULE:FREQ=WEEKLY;COUNT=10)"),
  sendUpdates: z
    .enum(["all", "externalOnly", "none"])
    .optional()
    .default("all")
    .describe("Who to send notifications to"),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = z.object({
  calendarId: z.string().optional().default("primary").describe("Calendar ID"),
  eventId: z.string().min(1, "Event ID is required"),
  summary: z.string().optional().describe("Event title"),
  description: z.string().optional().describe("Event description"),
  location: z.string().optional().describe("Event location"),
  start: EventDateTimeSchema.optional().describe("Event start time"),
  end: EventDateTimeSchema.optional().describe("Event end time"),
  attendees: z.array(AttendeeSchema).optional().describe("Replace attendee list"),
  addGoogleMeet: z.boolean().optional().describe("Add Google Meet video conference"),
  reminders: z.array(ReminderSchema).optional().describe("Custom reminders"),
  colorId: z.string().optional().describe("Event color ID (1-11)"),
  sendUpdates: z
    .enum(["all", "externalOnly", "none"])
    .optional()
    .default("all")
    .describe("Who to send notifications to"),
});

export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

export const DeleteEventSchema = z.object({
  calendarId: z.string().optional().default("primary").describe("Calendar ID"),
  eventId: z.string().min(1, "Event ID is required"),
  sendUpdates: z
    .enum(["all", "externalOnly", "none"])
    .optional()
    .default("all")
    .describe("Who to send cancellation notices to"),
});

export type DeleteEventInput = z.infer<typeof DeleteEventSchema>;

export const FindFreeTimeSchema = z.object({
  calendarIds: z
    .array(z.string())
    .min(1, "At least one calendar ID required")
    .max(50, "Maximum 50 calendars")
    .describe("Calendar IDs to check for availability"),
  timeMin: z.string().describe("Start of search range (RFC3339 timestamp)"),
  timeMax: z.string().describe("End of search range (RFC3339 timestamp)"),
  duration: z.number().int().min(1).describe("Required slot duration in minutes"),
  timeZone: z.string().optional().default("UTC").describe("Timezone for results"),
});

export type FindFreeTimeInput = z.infer<typeof FindFreeTimeSchema>;
