import type { people_v1 } from "googleapis";
import {
  log,
  successResponse,
  structuredResponse,
  validateArgs,
  toToon,
  withTimeout,
} from "../utils/index.js";
import type { ToolResponse } from "../utils/index.js";
import {
  ListContactsSchema,
  GetContactSchema,
  SearchContactsSchema,
  CreateContactSchema,
  UpdateContactSchema,
  DeleteContactSchema,
} from "../schemas/index.js";

// Common field mask for reading contact data
const PERSON_FIELDS = "names,emailAddresses,phoneNumbers,organizations,addresses,metadata";

// Helper to format contact for display
function formatContactSummary(person: people_v1.Schema$Person): string {
  const name = person.names?.[0];
  const displayName = name?.displayName || "(No name)";
  const email = person.emailAddresses?.[0]?.value;
  const phone = person.phoneNumbers?.[0]?.value;

  let summary = displayName;
  if (email) summary += ` <${email}>`;
  if (phone) summary += ` (${phone})`;

  return summary;
}

// Helper to extract contact data for structured response
function extractContactData(person: people_v1.Schema$Person) {
  return {
    resourceName: person.resourceName,
    etag: person.etag,
    names: person.names?.map((n) => ({
      displayName: n.displayName,
      givenName: n.givenName,
      familyName: n.familyName,
    })),
    emailAddresses: person.emailAddresses?.map((e) => ({
      value: e.value,
      type: e.type,
    })),
    phoneNumbers: person.phoneNumbers?.map((p) => ({
      value: p.value,
      type: p.type,
    })),
    organizations: person.organizations?.map((o) => ({
      name: o.name,
      title: o.title,
      department: o.department,
    })),
    addresses: person.addresses?.map((a) => ({
      streetAddress: a.streetAddress,
      city: a.city,
      region: a.region,
      postalCode: a.postalCode,
      country: a.country,
      type: a.type,
    })),
  };
}

export async function handleListContacts(
  people: people_v1.People,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(ListContactsSchema, args);
  if (!validation.success) return validation.response;
  const { pageSize, pageToken, sortOrder } = validation.data;

  const response = await withTimeout(
    people.people.connections.list({
      resourceName: "people/me",
      pageSize,
      pageToken,
      personFields: PERSON_FIELDS,
      sortOrder,
    }),
    30000,
    "List contacts",
  );

  const connections = response.data.connections || [];

  if (connections.length === 0) {
    return structuredResponse("No contacts found.", { contacts: [] });
  }

  const contacts = connections.map(extractContactData);

  let textResponse = `Found ${connections.length} contact(s):\n\n${toToon({ contacts })}`;
  if (response.data.nextPageToken) {
    textResponse += `\n\nMore contacts available. Use pageToken: ${response.data.nextPageToken}`;
  }

  log("Listed contacts", { count: connections.length });

  const responseData: { contacts: typeof contacts; nextPageToken?: string; totalPeople?: number } =
    {
      contacts,
    };
  if (response.data.nextPageToken) {
    responseData.nextPageToken = response.data.nextPageToken;
  }
  if (response.data.totalPeople !== undefined && response.data.totalPeople !== null) {
    responseData.totalPeople = response.data.totalPeople;
  }

  return structuredResponse(textResponse, responseData);
}

export async function handleGetContact(
  people: people_v1.People,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(GetContactSchema, args);
  if (!validation.success) return validation.response;
  const { resourceName } = validation.data;

  const response = await withTimeout(
    people.people.get({
      resourceName,
      personFields: PERSON_FIELDS,
    }),
    30000,
    "Get contact",
  );

  const person = response.data;
  const contactData = extractContactData(person);

  const name = person.names?.[0];
  const displayName = name?.displayName || "(No name)";

  const emailList = person.emailAddresses
    ? person.emailAddresses.map((e) => `  - ${e.value} (${e.type || "other"})`).join("\n")
    : "  None";

  const phoneList = person.phoneNumbers
    ? person.phoneNumbers.map((p) => `  - ${p.value} (${p.type || "other"})`).join("\n")
    : "  None";

  const orgList = person.organizations
    ? person.organizations
        .map((o) => `  - ${o.name || ""}${o.title ? ` (${o.title})` : ""}`)
        .join("\n")
    : "  None";

  const addressList = person.addresses
    ? person.addresses
        .map((a) => {
          const parts = [a.streetAddress, a.city, a.region, a.postalCode, a.country]
            .filter(Boolean)
            .join(", ");
          return `  - ${parts}${a.type ? ` (${a.type})` : ""}`;
        })
        .join("\n")
    : "  None";

  const textResponse = [
    `Contact: ${displayName}`,
    `Resource: ${person.resourceName}`,
    `\nEmail Addresses:\n${emailList}`,
    `\nPhone Numbers:\n${phoneList}`,
    `\nOrganizations:\n${orgList}`,
    `\nAddresses:\n${addressList}`,
  ].join("\n");

  log("Retrieved contact", { resourceName });

  return structuredResponse(textResponse, contactData);
}

export async function handleSearchContacts(
  people: people_v1.People,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(SearchContactsSchema, args);
  if (!validation.success) return validation.response;
  const { query, pageSize } = validation.data;

  const response = await withTimeout(
    people.people.searchContacts({
      query,
      pageSize,
      readMask: PERSON_FIELDS,
    }),
    30000,
    "Search contacts",
  );

  const results = response.data.results || [];

  if (results.length === 0) {
    return structuredResponse(`No contacts found matching "${query}".`, { contacts: [] });
  }

  const contacts = results.filter((r) => r.person).map((r) => extractContactData(r.person!));

  const summaries = results
    .filter((r) => r.person)
    .map((r) => `- ${formatContactSummary(r.person!)}`)
    .join("\n");

  log("Searched contacts", { query, count: contacts.length });

  return structuredResponse(
    `Found ${contacts.length} contact(s) matching "${query}":\n\n${summaries}\n\n${toToon({ contacts })}`,
    { contacts },
  );
}

export async function handleCreateContact(
  people: people_v1.People,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(CreateContactSchema, args);
  if (!validation.success) return validation.response;
  const { givenName, familyName, emailAddresses, phoneNumbers, organizations, addresses } =
    validation.data;

  const requestBody: people_v1.Schema$Person = {
    names: [
      {
        givenName,
        familyName,
      },
    ],
  };

  if (emailAddresses && emailAddresses.length > 0) {
    requestBody.emailAddresses = emailAddresses.map((e) => ({
      value: e.value,
      type: e.type,
    }));
  }

  if (phoneNumbers && phoneNumbers.length > 0) {
    requestBody.phoneNumbers = phoneNumbers.map((p) => ({
      value: p.value,
      type: p.type,
    }));
  }

  if (organizations && organizations.length > 0) {
    requestBody.organizations = organizations.map((o) => ({
      name: o.name,
      title: o.title,
      department: o.department,
    }));
  }

  if (addresses && addresses.length > 0) {
    requestBody.addresses = addresses.map((a) => ({
      streetAddress: a.streetAddress,
      city: a.city,
      region: a.region,
      postalCode: a.postalCode,
      country: a.country,
      type: a.type,
    }));
  }

  const response = await people.people.createContact({
    requestBody,
    personFields: PERSON_FIELDS,
  });

  const person = response.data;
  const displayName = person.names?.[0]?.displayName || givenName;

  log("Created contact", { resourceName: person.resourceName });

  return structuredResponse(
    `Created contact: ${displayName}\nResource: ${person.resourceName}`,
    extractContactData(person),
  );
}

export async function handleUpdateContact(
  people: people_v1.People,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(UpdateContactSchema, args);
  if (!validation.success) return validation.response;
  const {
    resourceName,
    givenName,
    familyName,
    emailAddresses,
    phoneNumbers,
    organizations,
    addresses,
  } = validation.data;

  // First get the existing contact to preserve etag and unmodified fields
  const existingResponse = await people.people.get({
    resourceName,
    personFields: PERSON_FIELDS,
  });

  const existingPerson = existingResponse.data;

  // Build update request
  const requestBody: people_v1.Schema$Person = {
    etag: existingPerson.etag,
  };

  // Track which fields we're updating
  const updateFields: string[] = [];

  // Update names if provided
  if (givenName !== undefined || familyName !== undefined) {
    const existingName = existingPerson.names?.[0] || {};
    requestBody.names = [
      {
        givenName: givenName ?? existingName.givenName,
        familyName: familyName ?? existingName.familyName,
      },
    ];
    updateFields.push("names");
  }

  if (emailAddresses !== undefined) {
    requestBody.emailAddresses = emailAddresses.map((e) => ({
      value: e.value,
      type: e.type,
    }));
    updateFields.push("emailAddresses");
  }

  if (phoneNumbers !== undefined) {
    requestBody.phoneNumbers = phoneNumbers.map((p) => ({
      value: p.value,
      type: p.type,
    }));
    updateFields.push("phoneNumbers");
  }

  if (organizations !== undefined) {
    requestBody.organizations = organizations.map((o) => ({
      name: o.name,
      title: o.title,
      department: o.department,
    }));
    updateFields.push("organizations");
  }

  if (addresses !== undefined) {
    requestBody.addresses = addresses.map((a) => ({
      streetAddress: a.streetAddress,
      city: a.city,
      region: a.region,
      postalCode: a.postalCode,
      country: a.country,
      type: a.type,
    }));
    updateFields.push("addresses");
  }

  if (updateFields.length === 0) {
    return successResponse(`No fields to update for contact: ${resourceName}`);
  }

  const response = await people.people.updateContact({
    resourceName,
    updatePersonFields: updateFields.join(","),
    requestBody,
    personFields: PERSON_FIELDS,
  });

  const person = response.data;
  const displayName = person.names?.[0]?.displayName || "(No name)";

  log("Updated contact", { resourceName, updatedFields: updateFields });

  return structuredResponse(
    `Updated contact: ${displayName}\nResource: ${resourceName}\nUpdated fields: ${updateFields.join(", ")}`,
    extractContactData(person),
  );
}

export async function handleDeleteContact(
  people: people_v1.People,
  args: unknown,
): Promise<ToolResponse> {
  const validation = validateArgs(DeleteContactSchema, args);
  if (!validation.success) return validation.response;
  const { resourceName } = validation.data;

  // Get contact info before deletion for the response
  let displayName = "(Unknown)";
  try {
    const existingResponse = await people.people.get({
      resourceName,
      personFields: "names",
    });
    displayName = existingResponse.data.names?.[0]?.displayName || "(No name)";
  } catch {
    // Continue with deletion even if we can't get the name
  }

  await people.people.deleteContact({
    resourceName,
  });

  log("Deleted contact", { resourceName });

  return successResponse(`Deleted contact: ${displayName} (${resourceName})`);
}
