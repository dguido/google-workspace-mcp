import { describe, it, expect, vi, beforeEach } from "vitest";
import type { calendar_v3 } from "googleapis";
import {
  handleListCalendars,
  handleListEvents,
  handleGetEvent,
  handleCreateEvent,
  handleUpdateEvent,
  handleDeleteEvent,
  handleFindFreeTime,
} from "./calendar.js";

vi.mock("../utils/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/index.js")>();
  return {
    ...actual,
    log: vi.fn(),
    withTimeout: <T>(promise: Promise<T>) => promise,
  };
});

function createMockCalendar(): calendar_v3.Calendar {
  return {
    calendarList: {
      list: vi.fn(),
    },
    events: {
      list: vi.fn(),
      get: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    freebusy: {
      query: vi.fn(),
    },
  } as unknown as calendar_v3.Calendar;
}

describe("handleListCalendars", () => {
  let mockCalendar: calendar_v3.Calendar;

  beforeEach(() => {
    mockCalendar = createMockCalendar();
  });

  it("lists calendars successfully", async () => {
    vi.mocked(mockCalendar.calendarList.list).mockResolvedValue({
      data: {
        items: [
          { id: "primary", summary: "Primary Calendar", primary: true, accessRole: "owner" },
          { id: "work@example.com", summary: "Work", primary: false, accessRole: "reader" },
        ],
      },
    } as never);

    const result = await handleListCalendars(mockCalendar, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("2 calendar(s)");
    expect(result.content[0].text).toContain("Primary Calendar");
    // structuredContent contains the data in a consistent format
    const structured = result.structuredContent as { calendars: Array<{ primary: boolean }> };
    expect(structured.calendars).toHaveLength(2);
    expect(structured.calendars[0].primary).toBe(true);
  });

  it("handles empty calendar list", async () => {
    vi.mocked(mockCalendar.calendarList.list).mockResolvedValue({
      data: { items: [] },
    } as never);

    const result = await handleListCalendars(mockCalendar, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No calendars found");
  });

  it("passes showHidden and showDeleted options", async () => {
    vi.mocked(mockCalendar.calendarList.list).mockResolvedValue({
      data: { items: [] },
    } as never);

    await handleListCalendars(mockCalendar, { showHidden: true, showDeleted: true });

    expect(mockCalendar.calendarList.list).toHaveBeenCalledWith({
      showHidden: true,
      showDeleted: true,
    });
  });
});

describe("handleListEvents", () => {
  let mockCalendar: calendar_v3.Calendar;

  beforeEach(() => {
    mockCalendar = createMockCalendar();
  });

  it("lists events successfully", async () => {
    vi.mocked(mockCalendar.events.list).mockResolvedValue({
      data: {
        items: [
          {
            id: "event1",
            summary: "Team Meeting",
            start: { dateTime: "2024-01-15T10:00:00-05:00" },
            end: { dateTime: "2024-01-15T11:00:00-05:00" },
            status: "confirmed",
          },
          {
            id: "event2",
            summary: "All Day Event",
            start: { date: "2024-01-16" },
            end: { date: "2024-01-17" },
            status: "confirmed",
          },
        ],
      },
    } as never);

    const result = await handleListEvents(mockCalendar, { calendarId: "primary" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("2 event(s)");
    expect(result.content[0].text).toContain("Team Meeting");
    expect(result.content[0].text).toContain("All Day Event");
  });

  it("handles empty event list", async () => {
    vi.mocked(mockCalendar.events.list).mockResolvedValue({
      data: { items: [] },
    } as never);

    const result = await handleListEvents(mockCalendar, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No events found");
  });

  it("includes nextPageToken in response", async () => {
    vi.mocked(mockCalendar.events.list).mockResolvedValue({
      data: {
        items: [{ id: "event1", summary: "Event" }],
        nextPageToken: "token123",
      },
    } as never);

    const result = await handleListEvents(mockCalendar, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("pageToken: token123");
  });

  it("passes all query parameters", async () => {
    vi.mocked(mockCalendar.events.list).mockResolvedValue({
      data: { items: [] },
    } as never);

    await handleListEvents(mockCalendar, {
      calendarId: "work@example.com",
      timeMin: "2024-01-01T00:00:00Z",
      timeMax: "2024-01-31T23:59:59Z",
      query: "meeting",
      maxResults: 50,
      singleEvents: true,
      orderBy: "startTime",
    });

    expect(mockCalendar.events.list).toHaveBeenCalledWith({
      calendarId: "work@example.com",
      timeMin: "2024-01-01T00:00:00Z",
      timeMax: "2024-01-31T23:59:59Z",
      q: "meeting",
      maxResults: 50,
      pageToken: undefined,
      singleEvents: true,
      orderBy: "startTime",
    });
  });
});

describe("handleGetEvent", () => {
  let mockCalendar: calendar_v3.Calendar;

  beforeEach(() => {
    mockCalendar = createMockCalendar();
  });

  it("gets event details successfully", async () => {
    vi.mocked(mockCalendar.events.get).mockResolvedValue({
      data: {
        id: "event123",
        summary: "Team Meeting",
        description: "Weekly sync",
        location: "Conference Room A",
        start: { dateTime: "2024-01-15T10:00:00-05:00" },
        end: { dateTime: "2024-01-15T11:00:00-05:00" },
        status: "confirmed",
        htmlLink: "https://calendar.google.com/event?eid=xxx",
        hangoutLink: "https://meet.google.com/xxx",
        attendees: [
          { email: "user@example.com", responseStatus: "accepted" },
          { email: "guest@example.com", responseStatus: "needsAction" },
        ],
        organizer: { email: "organizer@example.com" },
      },
    } as never);

    const result = await handleGetEvent(mockCalendar, { eventId: "event123" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Team Meeting");
    expect(result.content[0].text).toContain("Conference Room A");
    expect(result.content[0].text).toContain("Google Meet:");
    expect(result.content[0].text).toContain("user@example.com");
  });

  it("returns error for missing eventId", async () => {
    const result = await handleGetEvent(mockCalendar, { eventId: "" });
    expect(result.isError).toBe(true);
  });

  it("handles event without optional fields", async () => {
    vi.mocked(mockCalendar.events.get).mockResolvedValue({
      data: {
        id: "event123",
        start: { date: "2024-01-15" },
        end: { date: "2024-01-16" },
        status: "confirmed",
        htmlLink: "https://calendar.google.com/event?eid=xxx",
        organizer: { email: "organizer@example.com" },
      },
    } as never);

    const result = await handleGetEvent(mockCalendar, { eventId: "event123" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("(No title)");
    expect(result.content[0].text).toContain("Attendees:\n  None");
  });
});

describe("handleCreateEvent", () => {
  let mockCalendar: calendar_v3.Calendar;

  beforeEach(() => {
    mockCalendar = createMockCalendar();
  });

  it("creates event successfully", async () => {
    vi.mocked(mockCalendar.events.insert).mockResolvedValue({
      data: {
        id: "new-event-123",
        summary: "New Meeting",
        start: { dateTime: "2024-01-15T10:00:00-05:00" },
        end: { dateTime: "2024-01-15T11:00:00-05:00" },
        htmlLink: "https://calendar.google.com/event?eid=xxx",
        status: "confirmed",
      },
    } as never);

    const result = await handleCreateEvent(mockCalendar, {
      summary: "New Meeting",
      start: { dateTime: "2024-01-15T10:00:00-05:00" },
      end: { dateTime: "2024-01-15T11:00:00-05:00" },
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created event");
    expect(result.content[0].text).toContain("new-event-123");
  });

  it("creates event with Google Meet", async () => {
    vi.mocked(mockCalendar.events.insert).mockResolvedValue({
      data: {
        id: "new-event-123",
        summary: "Meeting with Meet",
        htmlLink: "https://calendar.google.com/event?eid=xxx",
        hangoutLink: "https://meet.google.com/xxx-yyy-zzz",
      },
    } as never);

    const result = await handleCreateEvent(mockCalendar, {
      summary: "Meeting with Meet",
      start: { dateTime: "2024-01-15T10:00:00-05:00" },
      end: { dateTime: "2024-01-15T11:00:00-05:00" },
      addGoogleMeet: true,
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Google Meet:");
    expect(result.content[0].text).toContain("meet.google.com");
    expect(mockCalendar.events.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conferenceDataVersion: 1,
      }),
    );
  });

  it("creates event with attendees", async () => {
    vi.mocked(mockCalendar.events.insert).mockResolvedValue({
      data: { id: "new-event-123", summary: "Team Meeting", htmlLink: "https://example.com" },
    } as never);

    await handleCreateEvent(mockCalendar, {
      summary: "Team Meeting",
      start: { dateTime: "2024-01-15T10:00:00-05:00" },
      end: { dateTime: "2024-01-15T11:00:00-05:00" },
      attendees: [{ email: "user1@example.com" }, { email: "user2@example.com", optional: true }],
    });

    expect(mockCalendar.events.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          attendees: [
            { email: "user1@example.com", displayName: undefined, optional: undefined },
            { email: "user2@example.com", displayName: undefined, optional: true },
          ],
        }),
      }),
    );
  });

  it("creates all-day event", async () => {
    vi.mocked(mockCalendar.events.insert).mockResolvedValue({
      data: { id: "new-event-123", summary: "All Day", htmlLink: "https://example.com" },
    } as never);

    await handleCreateEvent(mockCalendar, {
      summary: "All Day",
      start: { date: "2024-01-15" },
      end: { date: "2024-01-16" },
    });

    expect(mockCalendar.events.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          start: { date: "2024-01-15", dateTime: undefined, timeZone: undefined },
          end: { date: "2024-01-16", dateTime: undefined, timeZone: undefined },
        }),
      }),
    );
  });

  it("returns error for missing summary", async () => {
    const result = await handleCreateEvent(mockCalendar, {
      summary: "",
      start: { dateTime: "2024-01-15T10:00:00-05:00" },
      end: { dateTime: "2024-01-15T11:00:00-05:00" },
    });
    expect(result.isError).toBe(true);
  });

  it("returns error when start has both dateTime and date", async () => {
    const result = await handleCreateEvent(mockCalendar, {
      summary: "Test",
      start: { dateTime: "2024-01-15T10:00:00-05:00", date: "2024-01-15" },
      end: { dateTime: "2024-01-15T11:00:00-05:00" },
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleUpdateEvent", () => {
  let mockCalendar: calendar_v3.Calendar;

  beforeEach(() => {
    mockCalendar = createMockCalendar();
  });

  it("updates event successfully", async () => {
    vi.mocked(mockCalendar.events.get).mockResolvedValue({
      data: {
        id: "event123",
        summary: "Original Title",
        start: { dateTime: "2024-01-15T10:00:00-05:00" },
        end: { dateTime: "2024-01-15T11:00:00-05:00" },
      },
    } as never);
    vi.mocked(mockCalendar.events.update).mockResolvedValue({
      data: {
        id: "event123",
        summary: "Updated Title",
        htmlLink: "https://example.com",
      },
    } as never);

    const result = await handleUpdateEvent(mockCalendar, {
      eventId: "event123",
      summary: "Updated Title",
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Updated event");
    expect(result.content[0].text).toContain("Updated Title");
  });

  it("adds Google Meet to existing event", async () => {
    vi.mocked(mockCalendar.events.get).mockResolvedValue({
      data: { id: "event123", summary: "Meeting" },
    } as never);
    vi.mocked(mockCalendar.events.update).mockResolvedValue({
      data: { id: "event123", summary: "Meeting", hangoutLink: "https://meet.google.com/xxx" },
    } as never);

    const result = await handleUpdateEvent(mockCalendar, {
      eventId: "event123",
      addGoogleMeet: true,
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Google Meet");
    expect(mockCalendar.events.update).toHaveBeenCalledWith(
      expect.objectContaining({
        conferenceDataVersion: 1,
      }),
    );
  });

  it("preserves existing values for unspecified fields", async () => {
    vi.mocked(mockCalendar.events.get).mockResolvedValue({
      data: {
        id: "event123",
        summary: "Original Title",
        description: "Original Description",
        location: "Original Location",
      },
    } as never);
    vi.mocked(mockCalendar.events.update).mockResolvedValue({
      data: { id: "event123" },
    } as never);

    await handleUpdateEvent(mockCalendar, {
      eventId: "event123",
      summary: "New Title",
    });

    expect(mockCalendar.events.update).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          summary: "New Title",
          description: "Original Description",
          location: "Original Location",
        }),
      }),
    );
  });

  it("returns error for missing eventId", async () => {
    const result = await handleUpdateEvent(mockCalendar, { eventId: "" });
    expect(result.isError).toBe(true);
  });
});

describe("handleDeleteEvent", () => {
  let mockCalendar: calendar_v3.Calendar;

  beforeEach(() => {
    mockCalendar = createMockCalendar();
  });

  it("deletes event successfully", async () => {
    vi.mocked(mockCalendar.events.get).mockResolvedValue({
      data: { id: "event123", summary: "Event to Delete" },
    } as never);
    vi.mocked(mockCalendar.events.delete).mockResolvedValue({} as never);

    const result = await handleDeleteEvent(mockCalendar, { eventId: "event123" });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Deleted event");
    expect(result.content[0].text).toContain("Event to Delete");
  });

  it("passes sendUpdates option", async () => {
    vi.mocked(mockCalendar.events.get).mockResolvedValue({
      data: { id: "event123" },
    } as never);
    vi.mocked(mockCalendar.events.delete).mockResolvedValue({} as never);

    await handleDeleteEvent(mockCalendar, {
      eventId: "event123",
      sendUpdates: "none",
    });

    expect(mockCalendar.events.delete).toHaveBeenCalledWith({
      calendarId: "primary",
      eventId: "event123",
      sendUpdates: "none",
    });
  });

  it("returns error for missing eventId", async () => {
    const result = await handleDeleteEvent(mockCalendar, { eventId: "" });
    expect(result.isError).toBe(true);
  });
});

describe("handleFindFreeTime", () => {
  let mockCalendar: calendar_v3.Calendar;

  beforeEach(() => {
    mockCalendar = createMockCalendar();
  });

  it("finds free time slots", async () => {
    vi.mocked(mockCalendar.freebusy.query).mockResolvedValue({
      data: {
        calendars: {
          primary: {
            busy: [
              { start: "2024-01-15T10:00:00Z", end: "2024-01-15T11:00:00Z" },
              { start: "2024-01-15T14:00:00Z", end: "2024-01-15T15:00:00Z" },
            ],
          },
        },
      },
    } as never);

    const result = await handleFindFreeTime(mockCalendar, {
      calendarIds: ["primary"],
      timeMin: "2024-01-15T09:00:00Z",
      timeMax: "2024-01-15T17:00:00Z",
      duration: 30,
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("free slot(s)");
  });

  it("returns no slots when fully booked", async () => {
    vi.mocked(mockCalendar.freebusy.query).mockResolvedValue({
      data: {
        calendars: {
          primary: {
            busy: [{ start: "2024-01-15T09:00:00Z", end: "2024-01-15T17:00:00Z" }],
          },
        },
      },
    } as never);

    const result = await handleFindFreeTime(mockCalendar, {
      calendarIds: ["primary"],
      timeMin: "2024-01-15T09:00:00Z",
      timeMax: "2024-01-15T17:00:00Z",
      duration: 60,
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No free slots");
  });

  it("merges overlapping busy periods from multiple calendars", async () => {
    vi.mocked(mockCalendar.freebusy.query).mockResolvedValue({
      data: {
        calendars: {
          primary: {
            busy: [{ start: "2024-01-15T10:00:00Z", end: "2024-01-15T12:00:00Z" }],
          },
          "work@example.com": {
            busy: [{ start: "2024-01-15T11:00:00Z", end: "2024-01-15T13:00:00Z" }],
          },
        },
      },
    } as never);

    const result = await handleFindFreeTime(mockCalendar, {
      calendarIds: ["primary", "work@example.com"],
      timeMin: "2024-01-15T09:00:00Z",
      timeMax: "2024-01-15T17:00:00Z",
      duration: 30,
    });

    expect(result.isError).toBe(false);
    // Should merge 10:00-12:00 and 11:00-13:00 into 10:00-13:00
  });

  it("returns error for empty calendarIds", async () => {
    const result = await handleFindFreeTime(mockCalendar, {
      calendarIds: [],
      timeMin: "2024-01-15T09:00:00Z",
      timeMax: "2024-01-15T17:00:00Z",
      duration: 30,
    });
    expect(result.isError).toBe(true);
  });

  it("returns error for invalid duration", async () => {
    const result = await handleFindFreeTime(mockCalendar, {
      calendarIds: ["primary"],
      timeMin: "2024-01-15T09:00:00Z",
      timeMax: "2024-01-15T17:00:00Z",
      duration: 0,
    });
    expect(result.isError).toBe(true);
  });
});
