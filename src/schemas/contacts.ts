import { z } from "zod";

// Shared schemas for Contacts

/**
 * Phone number with optional type
 */
export const PhoneNumberSchema = z.object({
  value: z.string().min(1, "Phone number is required"),
  type: z.enum(["home", "work", "mobile", "other"]).optional().describe("Phone number type"),
});

export type PhoneNumberInput = z.infer<typeof PhoneNumberSchema>;

/**
 * Email address with optional type
 */
export const ContactEmailSchema = z.object({
  value: z.string().email("Valid email required"),
  type: z.enum(["home", "work", "other"]).optional().describe("Email address type"),
});

export type ContactEmailInput = z.infer<typeof ContactEmailSchema>;

/**
 * Physical address
 */
export const AddressSchema = z.object({
  streetAddress: z.string().optional().describe("Street address"),
  city: z.string().optional().describe("City"),
  region: z.string().optional().describe("State/Province/Region"),
  postalCode: z.string().optional().describe("Postal/ZIP code"),
  country: z.string().optional().describe("Country"),
  type: z.enum(["home", "work", "other"]).optional().describe("Address type"),
});

export type AddressInput = z.infer<typeof AddressSchema>;

/**
 * Organization/company
 */
export const OrganizationSchema = z.object({
  name: z.string().optional().describe("Company/organization name"),
  title: z.string().optional().describe("Job title"),
  department: z.string().optional().describe("Department"),
});

export type OrganizationInput = z.infer<typeof OrganizationSchema>;

// Tool-specific schemas

// Helper to normalize resource names - accepts both "people/c123" and bare "c123"
const normalizeResourceName = (value: string) =>
  value.startsWith("people/") ? value : `people/${value}`;

export const ListContactsSchema = z.object({
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(100)
    .describe("Number of contacts to return (max 1000)"),
  pageToken: z.string().optional().describe("Token for pagination"),
  sortOrder: z
    .enum([
      "LAST_MODIFIED_ASCENDING",
      "LAST_MODIFIED_DESCENDING",
      "FIRST_NAME_ASCENDING",
      "LAST_NAME_ASCENDING",
    ])
    .optional()
    .describe("Sort order for results"),
});

export type ListContactsInput = z.infer<typeof ListContactsSchema>;

export const GetContactSchema = z.object({
  resourceName: z
    .string()
    .min(1, "Resource name is required")
    .transform(normalizeResourceName)
    .describe("Contact resource name or ID (e.g., people/c1234567890 or c1234567890)"),
});

export type GetContactInput = z.infer<typeof GetContactSchema>;

export const SearchContactsSchema = z.object({
  query: z
    .string()
    .min(1, "Search query is required")
    .describe("Search query (name, email, or phone)"),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .default(10)
    .describe("Number of results to return (max 30)"),
});

export type SearchContactsInput = z.infer<typeof SearchContactsSchema>;

export const CreateContactSchema = z.object({
  givenName: z.string().min(1, "Given name (first name) is required"),
  familyName: z.string().optional().describe("Family name (last name)"),
  emailAddresses: z.array(ContactEmailSchema).optional().describe("Email addresses"),
  phoneNumbers: z.array(PhoneNumberSchema).optional().describe("Phone numbers"),
  organizations: z.array(OrganizationSchema).optional().describe("Organizations/companies"),
  addresses: z.array(AddressSchema).optional().describe("Physical addresses"),
});

export type CreateContactInput = z.infer<typeof CreateContactSchema>;

export const UpdateContactSchema = z.object({
  resourceName: z
    .string()
    .min(1, "Resource name is required")
    .transform(normalizeResourceName)
    .describe("Contact resource name or ID (e.g., people/c1234567890 or c1234567890)"),
  givenName: z.string().optional().describe("Given name (first name)"),
  familyName: z.string().optional().describe("Family name (last name)"),
  emailAddresses: z
    .array(ContactEmailSchema)
    .optional()
    .describe("Email addresses (replaces existing)"),
  phoneNumbers: z.array(PhoneNumberSchema).optional().describe("Phone numbers (replaces existing)"),
  organizations: z
    .array(OrganizationSchema)
    .optional()
    .describe("Organizations (replaces existing)"),
  addresses: z.array(AddressSchema).optional().describe("Addresses (replaces existing)"),
});

export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;

export const DeleteContactSchema = z.object({
  resourceName: z
    .string()
    .min(1, "Resource name is required")
    .transform(normalizeResourceName)
    .describe("Contact resource name or ID (e.g., people/c1234567890 or c1234567890)"),
});

export type DeleteContactInput = z.infer<typeof DeleteContactSchema>;
