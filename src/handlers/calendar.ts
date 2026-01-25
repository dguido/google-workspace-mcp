import type { calendar_v3 } from "googleapis";
import { log, successResponse, structuredResponse, validateArgs, toToon } from "../utils/index.js";
import type { ToolResponse } from "../utils/index.js";
import {
  ListCalendarsSchema,
  ListEventsSchema,
  GetEventSchema,
  CreateEventSchema,
  UpdateEventSchema,
  DeleteEventSchema,
  FindFreeTimeSchema,
} from "../schemas/index.js";
import { randomUUID } from "crypto";

// Helper to format event datetime for display
function formatEventTime(eventTime: calendar_v3.Schema$EventDateTime | undefined): string {
  if (!eventTime) return "Unknown";
  if (eventTime.date) return eventTime.date;
  if (eventTime.dateTime) {
    const date = new Date(eventTime.dateTime);
    return date.toLocaleString();
  }
  return "Unknown";
}

export async function handleListCalendars(
  calendar: calendar_v3.Calendar,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ListCalendarsSchema, args);
  if (!validation.success) return validation.response;
  const { showHidden, showDeleted } = validation.data;

  const response = await calendar.calendarList.list({
    showHidden,
    showDeleted,
  });

  const calendars = response.data.items || [];

  if (calendars.length === 0) {
    return structuredResponse("No calendars found.", { calendars: [] });
  }

  const calendarData = calendars.map((cal) => ({
    id: cal.id,
    summary: cal.summary,
    description: cal.description,
    primary: cal.primary,
    accessRole: cal.accessRole,
    backgroundColor: cal.backgroundColor,
    foregroundColor: cal.foregroundColor,
    timeZone: cal.timeZone,
  }));

  log("Listed calendars", { count: calendars.length });

  return structuredResponse(
    `Found ${calendars.length} calendar(s):\n\n${toToon({ calendars: calendarData })}`,
    { calendars: calendarData },
  );
}

export async function handleListEvents(
  calendar: calendar_v3.Calendar,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ListEventsSchema, args);
  if (!validation.success) return validation.response;
  const { calendarId, timeMin, timeMax, query, maxResults, pageToken, singleEvents, orderBy } =
    validation.data;

  const response = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    q: query,
    maxResults,
    pageToken,
    singleEvents,
    orderBy,
  });

  const events = response.data.items || [];

  if (events.length === 0) {
    return structuredResponse("No events found.", {
      events: [],
      nextPageToken: null,
    });
  }

  const eventData = events.map((event) => ({
    id: event.id,
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
    status: event.status,
    htmlLink: event.htmlLink,
    hangoutLink: event.hangoutLink,
    attendees: event.attendees?.map((a) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus,
      optional: a.optional,
    })),
    organizer: event.organizer,
    creator: event.creator,
    recurringEventId: event.recurringEventId,
  }));

  let textResponse = `Found ${events.length} event(s):\n\n${toToon({ events: eventData })}`;
  if (response.data.nextPageToken) {
    textResponse += `\n\nMore events available. Use pageToken: ${response.data.nextPageToken}`;
  }

  log("Listed events", { calendarId, count: events.length });

  return structuredResponse(textResponse, {
    events: eventData,
    nextPageToken: response.data.nextPageToken || null,
  });
}

export async function handleGetEvent(
  calendar: calendar_v3.Calendar,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetEventSchema, args);
  if (!validation.success) return validation.response;
  const { calendarId, eventId } = validation.data;

  const response = await calendar.events.get({
    calendarId,
    eventId,
  });

  const event = response.data;

  const attendeeList =
    event.attendees && event.attendees.length > 0
      ? event.attendees.map((a) => `  - ${a.email} (${a.responseStatus || "unknown"})`).join("\n")
      : "  None";

  const meetLink = event.hangoutLink ? `\nGoogle Meet: ${event.hangoutLink}` : "";

  const textResponse = [
    `Event: ${event.summary || "(No title)"}`,
    `ID: ${event.id}`,
    `Status: ${event.status}`,
    `Start: ${formatEventTime(event.start)}`,
    `End: ${formatEventTime(event.end)}`,
    event.location ? `Location: ${event.location}` : null,
    event.description ? `Description: ${event.description}` : null,
    meetLink,
    `\nAttendees:\n${attendeeList}`,
    `\nOrganizer: ${event.organizer?.email || "Unknown"}`,
    `Link: ${event.htmlLink}`,
  ]
    .filter(Boolean)
    .join("\n");

  log("Retrieved event", { calendarId, eventId });

  return structuredResponse(textResponse, {
    id: event.id,
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
    status: event.status,
    htmlLink: event.htmlLink,
    hangoutLink: event.hangoutLink,
    attendees: event.attendees?.map((a) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus,
      optional: a.optional,
      organizer: a.organizer,
      self: a.self,
    })),
    organizer: event.organizer,
    creator: event.creator,
    created: event.created,
    updated: event.updated,
    recurrence: event.recurrence,
    recurringEventId: event.recurringEventId,
    reminders: event.reminders,
    conferenceData: event.conferenceData,
  });
}

export async function handleCreateEvent(
  calendar: calendar_v3.Calendar,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateEventSchema, args);
  if (!validation.success) return validation.response;
  const {
    calendarId,
    summary,
    description,
    location,
    start,
    end,
    attendees,
    addGoogleMeet,
    reminders,
    colorId,
    recurrence,
    sendUpdates,
  } = validation.data;

  // Build the event request body
  const eventBody: calendar_v3.Schema$Event = {
    summary,
    description,
    location,
    start: {
      dateTime: start.dateTime,
      date: start.date,
      timeZone: start.timeZone,
    },
    end: {
      dateTime: end.dateTime,
      date: end.date,
      timeZone: end.timeZone,
    },
    colorId,
    recurrence,
  };

  // Add attendees if provided
  if (attendees && attendees.length > 0) {
    eventBody.attendees = attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName,
      optional: a.optional,
    }));
  }

  // Add Google Meet conference if requested
  if (addGoogleMeet) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  // Add custom reminders if provided
  if (reminders && reminders.length > 0) {
    eventBody.reminders = {
      useDefault: false,
      overrides: reminders.map((r) => ({
        method: r.method,
        minutes: r.minutes,
      })),
    };
  }

  const response = await calendar.events.insert({
    calendarId,
    requestBody: eventBody,
    conferenceDataVersion: addGoogleMeet ? 1 : undefined,
    sendUpdates,
  });

  const event = response.data;
  const meetLink = event.hangoutLink ? `\nGoogle Meet: ${event.hangoutLink}` : "";

  log("Created event", { calendarId, eventId: event.id });

  return structuredResponse(
    `Created event: ${event.summary}\nID: ${event.id}\nLink: ${event.htmlLink}${meetLink}`,
    {
      id: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end,
      htmlLink: event.htmlLink,
      hangoutLink: event.hangoutLink,
      status: event.status,
    },
  );
}

export async function handleUpdateEvent(
  calendar: calendar_v3.Calendar,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(UpdateEventSchema, args);
  if (!validation.success) return validation.response;
  const {
    calendarId,
    eventId,
    summary,
    description,
    location,
    start,
    end,
    attendees,
    addGoogleMeet,
    reminders,
    colorId,
    sendUpdates,
  } = validation.data;

  // First get the existing event
  const existingEvent = await calendar.events.get({
    calendarId,
    eventId,
  });

  // Build update body, preserving existing values for unspecified fields
  const eventBody: calendar_v3.Schema$Event = {
    ...existingEvent.data,
    summary: summary ?? existingEvent.data.summary,
    description: description ?? existingEvent.data.description,
    location: location ?? existingEvent.data.location,
    colorId: colorId ?? existingEvent.data.colorId,
  };

  // Update start/end if provided
  if (start) {
    eventBody.start = {
      dateTime: start.dateTime,
      date: start.date,
      timeZone: start.timeZone,
    };
  }
  if (end) {
    eventBody.end = {
      dateTime: end.dateTime,
      date: end.date,
      timeZone: end.timeZone,
    };
  }

  // Update attendees if provided
  if (attendees !== undefined) {
    eventBody.attendees = attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName,
      optional: a.optional,
    }));
  }

  // Add Google Meet if requested and not already present
  let conferenceDataVersion: number | undefined;
  if (addGoogleMeet && !existingEvent.data.hangoutLink) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
    conferenceDataVersion = 1;
  }

  // Update reminders if provided
  if (reminders !== undefined) {
    eventBody.reminders = {
      useDefault: false,
      overrides: reminders.map((r) => ({
        method: r.method,
        minutes: r.minutes,
      })),
    };
  }

  const response = await calendar.events.update({
    calendarId,
    eventId,
    requestBody: eventBody,
    conferenceDataVersion,
    sendUpdates,
  });

  const event = response.data;
  const meetLink = event.hangoutLink ? `\nGoogle Meet: ${event.hangoutLink}` : "";

  log("Updated event", { calendarId, eventId });

  return structuredResponse(
    `Updated event: ${event.summary}\nID: ${event.id}\nLink: ${event.htmlLink}${meetLink}`,
    {
      id: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end,
      htmlLink: event.htmlLink,
      hangoutLink: event.hangoutLink,
      status: event.status,
    },
  );
}

export async function handleDeleteEvent(
  calendar: calendar_v3.Calendar,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(DeleteEventSchema, args);
  if (!validation.success) return validation.response;
  const { calendarId, eventId, sendUpdates } = validation.data;

  // Get event info before deletion for the response
  const existingEvent = await calendar.events.get({
    calendarId,
    eventId,
  });

  const eventSummary = existingEvent.data.summary || "(No title)";

  await calendar.events.delete({
    calendarId,
    eventId,
    sendUpdates,
  });

  log("Deleted event", { calendarId, eventId });

  return successResponse(`Deleted event: ${eventSummary} (ID: ${eventId})`);
}

export async function handleFindFreeTime(
  calendar: calendar_v3.Calendar,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(FindFreeTimeSchema, args);
  if (!validation.success) return validation.response;
  const { calendarIds, timeMin, timeMax, duration, timeZone } = validation.data;

  // Use the freebusy API to get busy times
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone,
      items: calendarIds.map((id) => ({ id })),
    },
  });

  const calendarsData = response.data.calendars || {};

  // Collect all busy periods across all calendars
  const busyPeriods: Array<{ start: Date; end: Date }> = [];

  for (const calId of calendarIds) {
    const calData = calendarsData[calId];
    if (calData?.busy) {
      for (const busy of calData.busy) {
        if (busy.start && busy.end) {
          busyPeriods.push({
            start: new Date(busy.start),
            end: new Date(busy.end),
          });
        }
      }
    }
  }

  // Sort busy periods by start time
  busyPeriods.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlapping busy periods
  const mergedBusy: Array<{ start: Date; end: Date }> = [];
  for (const period of busyPeriods) {
    if (mergedBusy.length === 0) {
      mergedBusy.push(period);
    } else {
      const last = mergedBusy[mergedBusy.length - 1];
      if (period.start <= last.end) {
        // Overlapping or adjacent, extend the end
        last.end = new Date(Math.max(last.end.getTime(), period.end.getTime()));
      } else {
        mergedBusy.push(period);
      }
    }
  }

  // Find free slots
  const freeSlots: Array<{ start: string; end: string; durationMinutes: number }> = [];
  const rangeStart = new Date(timeMin);
  const rangeEnd = new Date(timeMax);
  const durationMs = duration * 60 * 1000;

  let currentTime = rangeStart;

  for (const busy of mergedBusy) {
    // Check if there's a gap before this busy period
    if (busy.start > currentTime) {
      const gapDuration = busy.start.getTime() - currentTime.getTime();
      if (gapDuration >= durationMs) {
        freeSlots.push({
          start: currentTime.toISOString(),
          end: busy.start.toISOString(),
          durationMinutes: Math.floor(gapDuration / 60000),
        });
      }
    }
    // Move current time to end of busy period
    currentTime = new Date(Math.max(currentTime.getTime(), busy.end.getTime()));
  }

  // Check for free time after last busy period
  if (currentTime < rangeEnd) {
    const gapDuration = rangeEnd.getTime() - currentTime.getTime();
    if (gapDuration >= durationMs) {
      freeSlots.push({
        start: currentTime.toISOString(),
        end: rangeEnd.toISOString(),
        durationMinutes: Math.floor(gapDuration / 60000),
      });
    }
  }

  if (freeSlots.length === 0) {
    return structuredResponse(
      `No free slots of ${duration} minutes found in the specified range.`,
      {
        freeSlots: [],
        busyPeriods: mergedBusy.map((p) => ({
          start: p.start.toISOString(),
          end: p.end.toISOString(),
        })),
      },
    );
  }

  const formattedSlots = freeSlots
    .map((slot) => {
      const start = new Date(slot.start);
      const end = new Date(slot.end);
      return `- ${start.toLocaleString()} to ${end.toLocaleString()} (${slot.durationMinutes} min)`;
    })
    .join("\n");

  log("Found free time slots", { count: freeSlots.length });

  return structuredResponse(
    `Found ${freeSlots.length} free slot(s) of at least ${duration} minutes:\n\n${formattedSlots}`,
    {
      freeSlots,
      busyPeriods: mergedBusy.map((p) => ({
        start: p.start.toISOString(),
        end: p.end.toISOString(),
      })),
    },
  );
}
