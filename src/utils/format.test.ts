import { describe, it, expect } from "vitest";
import { formatBytes, formatBytesCompact } from "./format.js";

describe("utils/format", () => {
  describe("formatBytes", () => {
    describe("handles various input types", () => {
      it("formats number input", () => {
        expect(formatBytes(1024)).toBe("1.00 KB");
      });

      it("formats string input", () => {
        expect(formatBytes("1024")).toBe("1.00 KB");
      });

      it("returns N/A for null", () => {
        expect(formatBytes(null)).toBe("N/A");
      });

      it("returns N/A for undefined", () => {
        expect(formatBytes(undefined)).toBe("N/A");
      });

      it("returns N/A for invalid string", () => {
        expect(formatBytes("not a number")).toBe("N/A");
      });

      it("returns N/A for empty string", () => {
        expect(formatBytes("")).toBe("N/A");
      });
    });

    describe("formats different sizes correctly", () => {
      it("formats bytes (< 1KB)", () => {
        expect(formatBytes(500)).toBe("500.00 B");
      });

      it("formats zero bytes", () => {
        expect(formatBytes(0)).toBe("0 B");
      });

      it("formats kilobytes", () => {
        expect(formatBytes(1024)).toBe("1.00 KB");
        expect(formatBytes(1536)).toBe("1.50 KB");
      });

      it("formats megabytes", () => {
        expect(formatBytes(1048576)).toBe("1.00 MB");
        expect(formatBytes(1572864)).toBe("1.50 MB");
      });

      it("formats gigabytes", () => {
        expect(formatBytes(1073741824)).toBe("1.00 GB");
        expect(formatBytes(1610612736)).toBe("1.50 GB");
      });

      it("formats terabytes", () => {
        expect(formatBytes(1099511627776)).toBe("1.00 TB");
      });

      it("handles large TB values without overflow", () => {
        expect(formatBytes(10995116277760)).toBe("10.00 TB");
      });
    });

    describe("precision option", () => {
      it("uses default precision of 2", () => {
        expect(formatBytes(1536)).toBe("1.50 KB");
      });

      it("respects custom precision of 1", () => {
        expect(formatBytes(1536, { precision: 1 })).toBe("1.5 KB");
      });

      it("respects custom precision of 0", () => {
        expect(formatBytes(1536, { precision: 0 })).toBe("2 KB");
      });

      it("respects custom precision of 3", () => {
        expect(formatBytes(1536, { precision: 3 })).toBe("1.500 KB");
      });
    });

    describe("nullValue option", () => {
      it("uses default N/A for null", () => {
        expect(formatBytes(null)).toBe("N/A");
      });

      it("respects custom nullValue", () => {
        expect(formatBytes(null, { nullValue: "Unknown" })).toBe("Unknown");
      });

      it("respects custom nullValue for undefined", () => {
        expect(formatBytes(undefined, { nullValue: "-" })).toBe("-");
      });
    });

    describe("edge cases", () => {
      it("handles exactly 1KB boundary", () => {
        expect(formatBytes(1023)).toBe("1023.00 B");
        expect(formatBytes(1024)).toBe("1.00 KB");
      });

      it("handles exactly 1MB boundary", () => {
        expect(formatBytes(1048575)).toBe("1024.00 KB");
        expect(formatBytes(1048576)).toBe("1.00 MB");
      });

      it("handles negative numbers", () => {
        expect(formatBytes(-1024)).toBe("-1.00 KB");
      });

      it("handles very small positive numbers", () => {
        expect(formatBytes(1)).toBe("1.00 B");
      });
    });
  });

  describe("formatBytesCompact", () => {
    it("uses 1 decimal place", () => {
      expect(formatBytesCompact(1536)).toBe("1.5 KB");
    });

    it("formats megabytes with 1 decimal", () => {
      expect(formatBytesCompact(1572864)).toBe("1.5 MB");
    });

    it("returns N/A for null by default", () => {
      expect(formatBytesCompact(null)).toBe("N/A");
    });

    it("respects custom nullValue", () => {
      expect(formatBytesCompact(null, "-")).toBe("-");
    });

    it("handles string input", () => {
      expect(formatBytesCompact("1048576")).toBe("1.0 MB");
    });
  });
});
