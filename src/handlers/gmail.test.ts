import { describe, it, expect, vi, beforeEach } from "vitest";
import type { gmail_v1 } from "googleapis";
import {
  handleDeleteEmail,
  handleModifyEmail,
  handleSearchEmails,
  buildSearchQuery,
  buildSearchHints,
} from "./gmail.js";

vi.mock("../utils/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/index.js")>();
  return {
    ...actual,
    log: vi.fn(),
    withTimeout: <T>(promise: Promise<T>) => promise,
  };
});

function createMockGmail(): gmail_v1.Gmail {
  return {
    users: {
      threads: {
        modify: vi.fn(),
      },
      messages: {
        list: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        batchDelete: vi.fn(),
      },
    },
  } as unknown as gmail_v1.Gmail;
}

describe("handleModifyEmail", () => {
  let mockGmail: gmail_v1.Gmail;

  beforeEach(() => {
    mockGmail = createMockGmail();
  });

  it("modifies single thread labels", async () => {
    vi.mocked(mockGmail.users.threads.modify).mockResolvedValue({
      data: {
        id: "thread123",
        historyId: "12345",
        messages: [
          { id: "msg1", labelIds: ["STARRED"] },
          { id: "msg2", labelIds: ["STARRED"] },
        ],
      },
    } as never);

    const result = await handleModifyEmail(mockGmail, {
      threadId: "thread123",
      addLabelIds: ["STARRED"],
      removeLabelIds: ["INBOX"],
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("thread123");
    expect(result.content[0].text).toContain("2 message(s) affected");
    expect(mockGmail.users.threads.modify).toHaveBeenCalledWith({
      userId: "me",
      id: "thread123",
      requestBody: {
        addLabelIds: ["STARRED"],
        removeLabelIds: ["INBOX"],
      },
    });
  });

  it("batch modifies multiple thread labels", async () => {
    // Use valid 16-char hex thread IDs
    vi.mocked(mockGmail.users.threads.modify).mockResolvedValue({
      data: { id: "1234567890abcdef", messages: [{ id: "msg1" }] },
    } as never);

    const result = await handleModifyEmail(mockGmail, {
      threadId: ["1234567890abcdef", "abcdef1234567890", "fedcba0987654321"],
      removeLabelIds: ["INBOX"],
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("3 thread(s)");
    expect(mockGmail.users.threads.modify).toHaveBeenCalledTimes(3);
  });

  it("handles partial failure in batch modify with categorized errors", async () => {
    // Use valid 16-char hex thread IDs
    vi.mocked(mockGmail.users.threads.modify)
      .mockResolvedValueOnce({ data: { id: "1234567890abcdef" } } as never)
      .mockRejectedValueOnce(new Error("Requested entity was not found"))
      .mockResolvedValueOnce({ data: { id: "fedcba0987654321" } } as never);

    const result = await handleModifyEmail(mockGmail, {
      threadId: ["1234567890abcdef", "abcdef1234567890", "fedcba0987654321"],
      removeLabelIds: ["INBOX"],
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("2 thread(s) modified");
    expect(result.content[0].text).toContain("1 failed");
    expect(result.content[0].text).toContain("NOT_FOUND");
    expect(result.content[0].text).toContain("search_emails");
  });

  it("pre-validates thread ID format before API calls", async () => {
    // Mix of valid and invalid format IDs
    vi.mocked(mockGmail.users.threads.modify).mockResolvedValue({
      data: { id: "1234567890abcdef" },
    } as never);

    const result = await handleModifyEmail(mockGmail, {
      threadId: ["1234567890abcdef", "BAD_ID", "not-a-hex-id", "abcdef1234567890"],
      removeLabelIds: ["INBOX"],
    });

    // Should only call API for valid format IDs
    expect(mockGmail.users.threads.modify).toHaveBeenCalledTimes(2);
    expect(result.content[0].text).toContain("INVALID_FORMAT");
    expect(result.content[0].text).toContain("BAD_ID");
    expect(result.content[0].text).toContain("not-a-hex-id");
  });

  it("categorizes errors correctly in structured response", async () => {
    vi.mocked(mockGmail.users.threads.modify)
      .mockResolvedValueOnce({ data: { id: "1234567890abcdef" } } as never)
      .mockRejectedValueOnce(new Error("Requested entity was not found"))
      .mockRejectedValueOnce(new Error("Permission denied"));

    const result = await handleModifyEmail(mockGmail, {
      threadId: ["1234567890abcdef", "abcdef1234567890", "fedcba0987654321", "BAD_FORMAT_ID"],
      removeLabelIds: ["INBOX"],
    });

    const structured = result.structuredContent as {
      succeeded: number;
      failed: number;
      total: number;
      failuresByCategory: Record<string, string[]>;
    };

    expect(structured.succeeded).toBe(1);
    expect(structured.failed).toBe(3);
    expect(structured.total).toBe(4);
    expect(structured.failuresByCategory.NOT_FOUND).toContain("abcdef1234567890");
    expect(structured.failuresByCategory.PERMISSION_DENIED).toContain("fedcba0987654321");
    expect(structured.failuresByCategory.INVALID_FORMAT).toContain("BAD_FORMAT_ID");
  });

  it("groups multiple failures of same category together", async () => {
    vi.mocked(mockGmail.users.threads.modify)
      .mockRejectedValueOnce(new Error("not found"))
      .mockRejectedValueOnce(new Error("entity was not found"));

    const result = await handleModifyEmail(mockGmail, {
      threadId: ["1234567890abcdef", "abcdef1234567890"],
      removeLabelIds: ["INBOX"],
    });

    expect(result.content[0].text).toContain("NOT_FOUND (2)");

    const structured = result.structuredContent as {
      failuresByCategory: Record<string, string[]>;
    };
    expect(structured.failuresByCategory.NOT_FOUND).toHaveLength(2);
  });

  it("returns error for empty threadId", async () => {
    const result = await handleModifyEmail(mockGmail, {
      threadId: "",
      addLabelIds: ["STARRED"],
    });

    expect(result.isError).toBe(true);
  });

  it("returns error for empty array threadId", async () => {
    const result = await handleModifyEmail(mockGmail, {
      threadId: [],
      addLabelIds: ["STARRED"],
    });

    expect(result.isError).toBe(true);
  });
});

describe("buildSearchQuery", () => {
  it("builds query from 'from' only", () => {
    expect(buildSearchQuery({ from: "alice@example.com" })).toBe("from:alice@example.com");
  });

  it("builds query from multiple params", () => {
    const result = buildSearchQuery({
      from: "alice@example.com",
      subject: "hello",
      after: "2024/01/01",
    });
    expect(result).toBe("from:alice@example.com subject:hello after:2024/01/01");
  });

  it("adds has:attachment when hasAttachment is true", () => {
    expect(buildSearchQuery({ hasAttachment: true })).toBe("has:attachment");
  });

  it("omits has:attachment when hasAttachment is false", () => {
    expect(buildSearchQuery({ hasAttachment: false })).toBe("");
  });

  it("passes through raw query as-is", () => {
    expect(buildSearchQuery({ query: "is:unread larger:5M" })).toBe("is:unread larger:5M");
  });

  it("merges structured params with raw query", () => {
    const result = buildSearchQuery({
      from: "bob@example.com",
      query: "is:unread",
    });
    expect(result).toBe("from:bob@example.com is:unread");
  });

  it("builds query with all params", () => {
    const result = buildSearchQuery({
      from: "alice@example.com",
      to: "bob@example.com",
      subject: "meeting",
      after: "2024/01/01",
      before: "2024/12/31",
      hasAttachment: true,
      label: "work",
      query: "is:starred",
    });
    expect(result).toBe(
      "from:alice@example.com to:bob@example.com " +
        "subject:meeting after:2024/01/01 before:2024/12/31 " +
        "has:attachment label:work is:starred",
    );
  });

  it("builds query with label only", () => {
    expect(buildSearchQuery({ label: "important" })).toBe("label:important");
  });
});

describe("buildSearchHints", () => {
  it("returns hint when query contains special characters", () => {
    const hints = buildSearchHints({ query: "invoice $5,149" });
    expect(hints).toEqual(
      expect.arrayContaining([expect.stringContaining("Gmail ignores special characters")]),
    );
  });

  it("returns empty array for clean query", () => {
    const hints = buildSearchHints({ query: "invoice from john" });
    expect(hints).toEqual([]);
  });

  it("returns hint for invalid after date format", () => {
    const hints = buildSearchHints({ after: "2024-01-01" });
    expect(hints).toEqual(
      expect.arrayContaining([expect.stringContaining("Date format for 'after'")]),
    );
    expect(hints[0]).toContain("2024-01-01");
  });

  it("returns hint for invalid before date format", () => {
    const hints = buildSearchHints({ before: "01/15/2024" });
    expect(hints).toEqual(
      expect.arrayContaining([expect.stringContaining("Date format for 'before'")]),
    );
    expect(hints[0]).toContain("01/15/2024");
  });

  it("returns no hint for valid date formats", () => {
    const hints = buildSearchHints({
      after: "2024/01/01",
      before: "2024/12/31",
    });
    expect(hints).toEqual([]);
  });

  it("returns hint for date in raw query without operator", () => {
    const hints = buildSearchHints({
      query: "meeting 2024-06-15",
    });
    expect(hints).toEqual(
      expect.arrayContaining([expect.stringContaining("Dates in query need operators")]),
    );
  });

  it("returns no hint for date in query with operator", () => {
    const hints = buildSearchHints({
      query: "after:2024/06/15 meeting",
    });
    expect(hints).toEqual([]);
  });

  it("returns hint for very long query", () => {
    const hints = buildSearchHints({ query: "a".repeat(201) });
    expect(hints).toEqual(expect.arrayContaining([expect.stringContaining("Try simplifying")]));
  });

  it("returns multiple hints for multiple issues", () => {
    const hints = buildSearchHints({
      query: "$" + "a".repeat(201),
      after: "2024-01-01",
    });
    expect(hints.length).toBeGreaterThanOrEqual(3);
  });
});

describe("handleSearchEmails", () => {
  let mockGmail: gmail_v1.Gmail;

  beforeEach(() => {
    mockGmail = createMockGmail();
  });

  it("searches with query only (backward compat)", async () => {
    vi.mocked(mockGmail.users.messages.list).mockResolvedValue({
      data: {
        messages: [{ id: "msg1", threadId: "t1" }],
        resultSizeEstimate: 1,
      },
    } as never);
    vi.mocked(mockGmail.users.messages.get).mockResolvedValue({
      data: {
        id: "msg1",
        threadId: "t1",
        snippet: "Hello",
        payload: {
          headers: [
            { name: "From", value: "alice@example.com" },
            { name: "Subject", value: "Test" },
            { name: "Date", value: "2024-01-01" },
          ],
        },
      },
    } as never);

    const result = await handleSearchEmails(mockGmail, {
      query: "from:alice@example.com",
    });

    expect(result.isError).toBe(false);
    expect(mockGmail.users.messages.list).toHaveBeenCalledWith(
      expect.objectContaining({ q: "from:alice@example.com" }),
    );
  });

  it("searches with structured params", async () => {
    vi.mocked(mockGmail.users.messages.list).mockResolvedValue({
      data: {
        messages: [{ id: "msg1", threadId: "t1" }],
        resultSizeEstimate: 1,
      },
    } as never);
    vi.mocked(mockGmail.users.messages.get).mockResolvedValue({
      data: {
        id: "msg1",
        threadId: "t1",
        snippet: "Hello",
        payload: {
          headers: [
            { name: "From", value: "alice@example.com" },
            { name: "Subject", value: "Test" },
            { name: "Date", value: "2024-01-01" },
          ],
        },
      },
    } as never);

    const result = await handleSearchEmails(mockGmail, {
      from: "alice@example.com",
      subject: "Test",
    });

    expect(result.isError).toBe(false);
    expect(mockGmail.users.messages.list).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "from:alice@example.com subject:Test",
      }),
    );
  });

  it("returns empty messages for no results", async () => {
    vi.mocked(mockGmail.users.messages.list).mockResolvedValue({
      data: { messages: [], resultSizeEstimate: 0 },
    } as never);

    const result = await handleSearchEmails(mockGmail, {
      from: "nobody@example.com",
    });

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({ messages: [] });
  });

  it("includes hints in text when empty result has special chars", async () => {
    vi.mocked(mockGmail.users.messages.list).mockResolvedValue({
      data: { messages: [], resultSizeEstimate: 0 },
    } as never);

    const result = await handleSearchEmails(mockGmail, {
      query: "invoice $5,149",
    });

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({ messages: [] });
    expect(result.content[0].text).toContain("Hints:");
    expect(result.content[0].text).toContain("Gmail ignores");
  });

  it("does not include hints for clean empty result", async () => {
    vi.mocked(mockGmail.users.messages.list).mockResolvedValue({
      data: { messages: [], resultSizeEstimate: 0 },
    } as never);

    const result = await handleSearchEmails(mockGmail, {
      from: "nobody@example.com",
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).not.toContain("Hints:");
  });

  it("returns validation error when no params provided", async () => {
    const result = await handleSearchEmails(mockGmail, {});

    expect(result.isError).toBe(true);
  });
});

describe("handleDeleteEmail", () => {
  let mockGmail: gmail_v1.Gmail;

  beforeEach(() => {
    mockGmail = createMockGmail();
  });

  it("deletes a single email by id", async () => {
    vi.mocked(mockGmail.users.messages.delete).mockResolvedValue({} as never);

    const result = await handleDeleteEmail(mockGmail, { id: "msg123" });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("msg123");
    expect(result.content[0].text).toContain("permanently deleted");
    expect(mockGmail.users.messages.delete).toHaveBeenCalledWith({
      userId: "me",
      id: "msg123",
    });

    const data = result.structuredContent as {
      deleted: number;
      ids: string[];
    };
    expect(data.deleted).toBe(1);
    expect(data.ids).toEqual(["msg123"]);
  });

  it("batch deletes multiple emails", async () => {
    vi.mocked(mockGmail.users.messages.batchDelete).mockResolvedValue({} as never);

    const ids = ["msg1", "msg2", "msg3"];
    const result = await handleDeleteEmail(mockGmail, { id: ids });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("3 email(s)");

    const data = result.structuredContent as {
      deleted: number;
      ids: string[];
    };
    expect(data.deleted).toBe(3);
    expect(data.ids).toEqual(ids);
  });

  it("falls back to individual deletes when batch fails", async () => {
    vi.mocked(mockGmail.users.messages.batchDelete).mockRejectedValue(
      new Error("Batch API unavailable"),
    );
    vi.mocked(mockGmail.users.messages.delete).mockResolvedValue({} as never);

    const ids = ["msg1", "msg2"];
    const result = await handleDeleteEmail(mockGmail, { id: ids });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("2 email(s)");
    expect(mockGmail.users.messages.delete).toHaveBeenCalledTimes(2);
  });

  it("re-throws auth errors from batch delete", async () => {
    const authError = new Error("Unauthorized") as Error & {
      response: { status: number };
    };
    authError.response = { status: 401 };
    vi.mocked(mockGmail.users.messages.batchDelete).mockRejectedValue(authError);

    await expect(handleDeleteEmail(mockGmail, { id: ["msg1", "msg2"] })).rejects.toThrow(
      "Unauthorized",
    );
    expect(mockGmail.users.messages.delete).not.toHaveBeenCalled();
  });

  it("reports partial failures with categorized errors", async () => {
    vi.mocked(mockGmail.users.messages.batchDelete).mockRejectedValue(
      new Error("Batch unavailable"),
    );
    vi.mocked(mockGmail.users.messages.delete)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("Requested entity was not found"))
      .mockRejectedValueOnce(new Error("Permission denied"));

    const result = await handleDeleteEmail(mockGmail, {
      id: ["msg1", "msg2", "msg3"],
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("1 deleted");
    expect(result.content[0].text).toContain("2 failed");
    expect(result.content[0].text).toContain("NOT_FOUND");
    expect(result.content[0].text).toContain("PERMISSION_DENIED");

    const data = result.structuredContent as {
      deleted: number;
      ids: string[];
    };
    expect(data.deleted).toBe(1);
    expect(data.ids).toEqual(["msg1"]);
  });

  it("returns schema-compliant response on full fallback failure", async () => {
    vi.mocked(mockGmail.users.messages.batchDelete).mockRejectedValue(
      new Error("Batch unavailable"),
    );
    vi.mocked(mockGmail.users.messages.delete)
      .mockRejectedValueOnce(new Error("not found"))
      .mockRejectedValueOnce(new Error("not found"));

    const result = await handleDeleteEmail(mockGmail, {
      id: ["msg1", "msg2"],
    });

    const data = result.structuredContent as {
      deleted: number;
      ids: string[];
    };
    expect(data.deleted).toBe(0);
    expect(data.ids).toEqual([]);
    expect(result.content[0].text).toContain("NOT_FOUND (2)");
  });

  it("returns validation error for empty id", async () => {
    const result = await handleDeleteEmail(mockGmail, { id: "" });
    expect(result.isError).toBe(true);
  });

  it("returns validation error for empty array", async () => {
    const result = await handleDeleteEmail(mockGmail, { id: [] });
    expect(result.isError).toBe(true);
  });
});
