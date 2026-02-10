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

  it("redacts id_token", () => {
    log("tokens", { id_token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.secret" });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts private_key", () => {
    log("service account", { private_key: "-----BEGIN RSA PRIVATE KEY-----\nMIIE..." });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("BEGIN RSA PRIVATE KEY");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts private_key_id", () => {
    log("service account", { private_key_id: "key-id-abc123" });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("key-id-abc123");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts client_email", () => {
    log("service account", { client_email: "sa@project.iam.gserviceaccount.com" });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("sa@project.iam.gserviceaccount.com");
    expect(output).toContain("[REDACTED]");
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

  it("handles circular references without throwing", () => {
    const obj: Record<string, unknown> = { name: "test" };
    obj.self = obj;
    log("circular", obj);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toContain("[object Object]");
  });

  it("handles string data parameter", () => {
    log("info", "plain string value");
    const output = errorSpy.mock.calls[0][0];
    expect(output).toContain('"plain string value"');
  });
});
