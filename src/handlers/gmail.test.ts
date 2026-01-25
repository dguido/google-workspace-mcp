import { describe, it, expect, vi, beforeEach } from "vitest";
import type { gmail_v1 } from "googleapis";
import { handleModifyEmail } from "./gmail.js";

vi.mock("../utils/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/index.js")>();
  return {
    ...actual,
    log: vi.fn(),
  };
});

function createMockGmail(): gmail_v1.Gmail {
  return {
    users: {
      threads: {
        modify: vi.fn(),
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
