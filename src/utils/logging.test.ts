import { describe, it, expect, vi, afterEach } from "vitest";
import { log } from "./logging.js";

describe("log", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    errorSpy.mockClear();
  });

  it("logs message without data", () => {
    log("test message");
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toContain("test message");
  });

  it("logs message with data", () => {
    log("test", { key: "value" });
    expect(errorSpy.mock.calls[0][0]).toContain('"key":"value"');
  });

  it("redacts access_token", () => {
    log("token data", { access_token: "ya29.secret-token-value" });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("ya29.secret-token-value");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts refresh_token", () => {
    log("token data", { refresh_token: "1//secret-refresh" });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("1//secret-refresh");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts client_secret", () => {
    log("creds", { client_id: "id.apps.googleusercontent.com", client_secret: "GOCSPX-secret" });
    const output = errorSpy.mock.calls[0][0];
    expect(output).toContain("id.apps.googleusercontent.com");
    expect(output).not.toContain("GOCSPX-secret");
  });

  it("redacts nested sensitive fields", () => {
    log("nested", { credentials: { access_token: "secret", type: "authorized_user" } });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("secret");
    expect(output).toContain('"type":"authorized_user"');
  });

  it("preserves non-sensitive fields", () => {
    log("safe data", { status: 200, message: "ok", hasToken: true });
    const output = errorSpy.mock.calls[0][0];
    expect(output).toContain('"status":200');
    expect(output).toContain('"message":"ok"');
    expect(output).toContain('"hasToken":true');
  });
});
