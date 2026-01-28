import { describe, it, expect, vi, beforeEach } from "vitest";
import type { people_v1 } from "googleapis";
import {
  handleListContacts,
  handleGetContact,
  handleSearchContacts,
  handleCreateContact,
  handleUpdateContact,
  handleDeleteContact,
} from "./contacts.js";

vi.mock("../utils/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/index.js")>();
  return {
    ...actual,
    log: vi.fn(),
    withTimeout: <T>(promise: Promise<T>) => promise,
  };
});

function createMockPeople(): people_v1.People {
  return {
    people: {
      connections: {
        list: vi.fn(),
      },
      get: vi.fn(),
      searchContacts: vi.fn(),
      createContact: vi.fn(),
      updateContact: vi.fn(),
      deleteContact: vi.fn(),
    },
  } as unknown as people_v1.People;
}

describe("handleListContacts", () => {
  let mockPeople: people_v1.People;

  beforeEach(() => {
    mockPeople = createMockPeople();
  });

  it("lists contacts successfully", async () => {
    vi.mocked(mockPeople.people.connections.list).mockResolvedValue({
      data: {
        connections: [
          {
            resourceName: "people/c1234",
            names: [{ displayName: "John Doe", givenName: "John", familyName: "Doe" }],
            emailAddresses: [{ value: "john@example.com", type: "work" }],
          },
          {
            resourceName: "people/c5678",
            names: [{ displayName: "Jane Smith", givenName: "Jane", familyName: "Smith" }],
            phoneNumbers: [{ value: "+1234567890", type: "mobile" }],
          },
        ],
        totalPeople: 2,
      },
    } as never);

    const result = await handleListContacts(mockPeople, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("2 contact(s)");
    const structured = result.structuredContent as { contacts: unknown[] };
    expect(structured.contacts).toHaveLength(2);
  });

  it("handles empty contact list", async () => {
    vi.mocked(mockPeople.people.connections.list).mockResolvedValue({
      data: { connections: [] },
    } as never);

    const result = await handleListContacts(mockPeople, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No contacts found");
  });

  it("includes nextPageToken in response", async () => {
    vi.mocked(mockPeople.people.connections.list).mockResolvedValue({
      data: {
        connections: [{ resourceName: "people/c1234", names: [{ displayName: "Test" }] }],
        nextPageToken: "token123",
      },
    } as never);

    const result = await handleListContacts(mockPeople, {});
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("pageToken: token123");
  });

  it("passes pagination and sort options", async () => {
    vi.mocked(mockPeople.people.connections.list).mockResolvedValue({
      data: { connections: [] },
    } as never);

    await handleListContacts(mockPeople, {
      pageSize: 50,
      pageToken: "existingToken",
      sortOrder: "FIRST_NAME_ASCENDING",
    });

    expect(mockPeople.people.connections.list).toHaveBeenCalledWith({
      resourceName: "people/me",
      pageSize: 50,
      pageToken: "existingToken",
      personFields: expect.any(String),
      sortOrder: "FIRST_NAME_ASCENDING",
    });
  });
});

describe("handleGetContact", () => {
  let mockPeople: people_v1.People;

  beforeEach(() => {
    mockPeople = createMockPeople();
  });

  it("gets contact details successfully", async () => {
    vi.mocked(mockPeople.people.get).mockResolvedValue({
      data: {
        resourceName: "people/c1234567890",
        etag: "etag123",
        names: [{ displayName: "John Doe", givenName: "John", familyName: "Doe" }],
        emailAddresses: [
          { value: "john@example.com", type: "work" },
          { value: "john.personal@example.com", type: "home" },
        ],
        phoneNumbers: [{ value: "+1234567890", type: "mobile" }],
        organizations: [{ name: "Acme Corp", title: "Engineer" }],
      },
    } as never);

    const result = await handleGetContact(mockPeople, { resourceName: "people/c1234567890" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("John Doe");
    expect(result.content[0].text).toContain("john@example.com");
    expect(result.content[0].text).toContain("+1234567890");
    expect(result.content[0].text).toContain("Acme Corp");
  });

  it("returns error for missing resourceName", async () => {
    const result = await handleGetContact(mockPeople, { resourceName: "" });
    expect(result.isError).toBe(true);
  });

  it("handles contact without optional fields", async () => {
    vi.mocked(mockPeople.people.get).mockResolvedValue({
      data: {
        resourceName: "people/c1234",
        names: [{ givenName: "John" }],
      },
    } as never);

    const result = await handleGetContact(mockPeople, { resourceName: "people/c1234" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Email Addresses:\n  None");
    expect(result.content[0].text).toContain("Phone Numbers:\n  None");
  });
});

describe("handleSearchContacts", () => {
  let mockPeople: people_v1.People;

  beforeEach(() => {
    mockPeople = createMockPeople();
  });

  it("searches contacts successfully", async () => {
    vi.mocked(mockPeople.people.searchContacts).mockResolvedValue({
      data: {
        results: [
          {
            person: {
              resourceName: "people/c1234",
              names: [{ displayName: "John Doe" }],
              emailAddresses: [{ value: "john@example.com" }],
            },
          },
        ],
      },
    } as never);

    const result = await handleSearchContacts(mockPeople, { query: "John" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("1 contact(s)");
    expect(result.content[0].text).toContain("John Doe");
  });

  it("handles no search results", async () => {
    vi.mocked(mockPeople.people.searchContacts).mockResolvedValue({
      data: { results: [] },
    } as never);

    const result = await handleSearchContacts(mockPeople, { query: "NonexistentPerson" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('No contacts found matching "NonexistentPerson"');
  });

  it("returns error for empty query", async () => {
    const result = await handleSearchContacts(mockPeople, { query: "" });
    expect(result.isError).toBe(true);
  });

  it("passes pageSize option", async () => {
    vi.mocked(mockPeople.people.searchContacts).mockResolvedValue({
      data: { results: [] },
    } as never);

    await handleSearchContacts(mockPeople, { query: "test", pageSize: 20 });

    expect(mockPeople.people.searchContacts).toHaveBeenCalledWith({
      query: "test",
      pageSize: 20,
      readMask: expect.any(String),
    });
  });
});

describe("handleCreateContact", () => {
  let mockPeople: people_v1.People;

  beforeEach(() => {
    mockPeople = createMockPeople();
  });

  it("creates contact with minimal fields", async () => {
    vi.mocked(mockPeople.people.createContact).mockResolvedValue({
      data: {
        resourceName: "people/c9999",
        names: [{ displayName: "John", givenName: "John" }],
      },
    } as never);

    const result = await handleCreateContact(mockPeople, { givenName: "John" });
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Created contact");
    expect(result.content[0].text).toContain("people/c9999");
  });

  it("creates contact with all fields", async () => {
    vi.mocked(mockPeople.people.createContact).mockResolvedValue({
      data: {
        resourceName: "people/c9999",
        names: [{ displayName: "John Doe", givenName: "John", familyName: "Doe" }],
        emailAddresses: [{ value: "john@example.com", type: "work" }],
        phoneNumbers: [{ value: "+1234567890", type: "mobile" }],
        organizations: [{ name: "Acme Corp", title: "Engineer" }],
        addresses: [{ city: "New York", country: "USA" }],
      },
    } as never);

    const result = await handleCreateContact(mockPeople, {
      givenName: "John",
      familyName: "Doe",
      emailAddresses: [{ value: "john@example.com", type: "work" }],
      phoneNumbers: [{ value: "+1234567890", type: "mobile" }],
      organizations: [{ name: "Acme Corp", title: "Engineer" }],
      addresses: [{ city: "New York", country: "USA" }],
    });

    expect(result.isError).toBe(false);
    expect(mockPeople.people.createContact).toHaveBeenCalledWith({
      requestBody: {
        names: [{ givenName: "John", familyName: "Doe" }],
        emailAddresses: [{ value: "john@example.com", type: "work" }],
        phoneNumbers: [{ value: "+1234567890", type: "mobile" }],
        organizations: [{ name: "Acme Corp", title: "Engineer", department: undefined }],
        addresses: [
          {
            streetAddress: undefined,
            city: "New York",
            region: undefined,
            postalCode: undefined,
            country: "USA",
            type: undefined,
          },
        ],
      },
      personFields: expect.any(String),
    });
  });

  it("returns error for missing givenName", async () => {
    const result = await handleCreateContact(mockPeople, { givenName: "" });
    expect(result.isError).toBe(true);
  });

  it("validates email format", async () => {
    const result = await handleCreateContact(mockPeople, {
      givenName: "John",
      emailAddresses: [{ value: "invalid-email" }],
    });
    expect(result.isError).toBe(true);
  });
});

describe("handleUpdateContact", () => {
  let mockPeople: people_v1.People;

  beforeEach(() => {
    mockPeople = createMockPeople();
  });

  it("updates contact name", async () => {
    vi.mocked(mockPeople.people.get).mockResolvedValue({
      data: {
        resourceName: "people/c1234",
        etag: "etag123",
        names: [{ givenName: "John", familyName: "Doe" }],
      },
    } as never);
    vi.mocked(mockPeople.people.updateContact).mockResolvedValue({
      data: {
        resourceName: "people/c1234",
        names: [{ displayName: "Johnny Doe", givenName: "Johnny", familyName: "Doe" }],
      },
    } as never);

    const result = await handleUpdateContact(mockPeople, {
      resourceName: "people/c1234",
      givenName: "Johnny",
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Updated contact");
    expect(mockPeople.people.updateContact).toHaveBeenCalledWith({
      resourceName: "people/c1234",
      updatePersonFields: "names",
      requestBody: {
        etag: "etag123",
        names: [{ givenName: "Johnny", familyName: "Doe" }],
      },
      personFields: expect.any(String),
    });
  });

  it("updates multiple fields", async () => {
    vi.mocked(mockPeople.people.get).mockResolvedValue({
      data: {
        resourceName: "people/c1234",
        etag: "etag123",
        names: [{ givenName: "John" }],
      },
    } as never);
    vi.mocked(mockPeople.people.updateContact).mockResolvedValue({
      data: { resourceName: "people/c1234" },
    } as never);

    await handleUpdateContact(mockPeople, {
      resourceName: "people/c1234",
      emailAddresses: [{ value: "new@example.com" }],
      phoneNumbers: [{ value: "+9999999999", type: "work" }],
    });

    expect(mockPeople.people.updateContact).toHaveBeenCalledWith(
      expect.objectContaining({
        updatePersonFields: expect.stringContaining("emailAddresses"),
      }),
    );
  });

  it("returns success when no fields to update", async () => {
    vi.mocked(mockPeople.people.get).mockResolvedValue({
      data: {
        resourceName: "people/c1234",
        etag: "etag123",
      },
    } as never);

    const result = await handleUpdateContact(mockPeople, {
      resourceName: "people/c1234",
    });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No fields to update");
    expect(mockPeople.people.updateContact).not.toHaveBeenCalled();
  });

  it("returns error for missing resourceName", async () => {
    const result = await handleUpdateContact(mockPeople, { resourceName: "" });
    expect(result.isError).toBe(true);
  });
});

describe("handleDeleteContact", () => {
  let mockPeople: people_v1.People;

  beforeEach(() => {
    mockPeople = createMockPeople();
  });

  it("deletes contact successfully", async () => {
    vi.mocked(mockPeople.people.get).mockResolvedValue({
      data: {
        names: [{ displayName: "John Doe" }],
      },
    } as never);
    vi.mocked(mockPeople.people.deleteContact).mockResolvedValue({} as never);

    const result = await handleDeleteContact(mockPeople, { resourceName: "people/c1234" });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Deleted contact");
    expect(result.content[0].text).toContain("John Doe");
    expect(mockPeople.people.deleteContact).toHaveBeenCalledWith({
      resourceName: "people/c1234",
    });
  });

  it("deletes contact even if name lookup fails", async () => {
    vi.mocked(mockPeople.people.get).mockRejectedValue(new Error("Not found"));
    vi.mocked(mockPeople.people.deleteContact).mockResolvedValue({} as never);

    const result = await handleDeleteContact(mockPeople, { resourceName: "people/c1234" });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Deleted contact");
  });

  it("returns error for missing resourceName", async () => {
    const result = await handleDeleteContact(mockPeople, { resourceName: "" });
    expect(result.isError).toBe(true);
  });
});
