import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateArgs } from "./validation.js";

describe("validateArgs", () => {
  const TestSchema = z.object({
    name: z.string().min(1, "Name is required"),
    age: z.number().int().positive("Age must be positive"),
    email: z.string().email("Invalid email format").optional(),
  });

  describe("successful validation", () => {
    it("returns success with valid required fields", () => {
      const result = validateArgs(TestSchema, { name: "John", age: 25 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: "John", age: 25 });
      }
    });

    it("returns success with all fields including optional", () => {
      const result = validateArgs(TestSchema, {
        name: "Jane",
        age: 30,
        email: "jane@example.com",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          name: "Jane",
          age: 30,
          email: "jane@example.com",
        });
      }
    });

    it("strips unknown fields", () => {
      const result = validateArgs(TestSchema, {
        name: "Test",
        age: 20,
        unknown: "should be stripped",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: "Test", age: 20 });
        expect(result.data).not.toHaveProperty("unknown");
      }
    });
  });

  describe("failed validation", () => {
    it("returns error response for missing required field", () => {
      const result = validateArgs(TestSchema, { age: 25 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.content).toBeDefined();
        expect(result.response.isError).toBe(true);
      }
    });

    it("returns error response for invalid type", () => {
      const result = validateArgs(TestSchema, {
        name: "John",
        age: "not a number",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.isError).toBe(true);
      }
    });

    it("returns error response for failed constraint", () => {
      const result = validateArgs(TestSchema, { name: "John", age: -5 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.isError).toBe(true);
        // Check that the error message contains our custom message
        const textContent = result.response.content.find((c) => c.type === "text");
        expect(textContent?.text).toContain("Age must be positive");
      }
    });

    it("returns error response for invalid email format", () => {
      const result = validateArgs(TestSchema, {
        name: "John",
        age: 25,
        email: "not-an-email",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.isError).toBe(true);
        const textContent = result.response.content.find((c) => c.type === "text");
        expect(textContent?.text).toContain("Invalid email format");
      }
    });

    it("returns error response for empty string when min length required", () => {
      const result = validateArgs(TestSchema, { name: "", age: 25 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.isError).toBe(true);
        const textContent = result.response.content.find((c) => c.type === "text");
        expect(textContent?.text).toContain("Name is required");
      }
    });

    it("returns error response for null input", () => {
      const result = validateArgs(TestSchema, null);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.isError).toBe(true);
      }
    });

    it("returns error response for undefined input", () => {
      const result = validateArgs(TestSchema, undefined);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.isError).toBe(true);
      }
    });
  });

  describe("type narrowing", () => {
    it("correctly narrows type on success", () => {
      const result = validateArgs(TestSchema, { name: "Test", age: 20 });

      if (result.success) {
        // TypeScript should know data.name is string
        const name: string = result.data.name;
        const age: number = result.data.age;
        expect(name).toBe("Test");
        expect(age).toBe(20);
      } else {
        expect.fail("Expected success");
      }
    });

    it("correctly narrows type on failure", () => {
      const result = validateArgs(TestSchema, {});

      if (!result.success) {
        // TypeScript should know response exists
        expect(result.response).toBeDefined();
        expect(result.response.content).toBeDefined();
      } else {
        expect.fail("Expected failure");
      }
    });
  });

  describe("edge cases", () => {
    it("handles array schemas", () => {
      const ArraySchema = z.array(z.string());
      const result = validateArgs(ArraySchema, ["a", "b", "c"]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(["a", "b", "c"]);
      }
    });

    it("handles primitive schemas", () => {
      const StringSchema = z.string();
      const result = validateArgs(StringSchema, "hello");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("hello");
      }
    });

    it("handles union schemas", () => {
      const UnionSchema = z.union([z.string(), z.number()]);

      const stringResult = validateArgs(UnionSchema, "test");
      expect(stringResult.success).toBe(true);

      const numberResult = validateArgs(UnionSchema, 42);
      expect(numberResult.success).toBe(true);

      const boolResult = validateArgs(UnionSchema, true);
      expect(boolResult.success).toBe(false);
    });
  });
});
