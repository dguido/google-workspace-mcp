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
    expect(errorSpy.mock.calls[0][0]).toContain("[unserializable data]");
  });

  it("handles string data parameter", () => {
    log("info", "plain string value");
    const output = errorSpy.mock.calls[0][0];
    expect(output).toContain('"plain string value"');
  });

  it("sanitizes Error objects to safe fields only", () => {
    const error = new Error("something failed");
    error.name = "GoogleApiError";
    log("api error", error);
    const output = errorSpy.mock.calls[0][0];
    expect(output).toContain('"message":"something failed"');
    expect(output).toContain('"name":"GoogleApiError"');
    expect(output).toContain('"stack":');
  });

  it("preserves code and status on Error objects", () => {
    const error = new Error("not found") as Error & {
      code: number;
      status: number;
    };
    error.code = 404;
    error.status = 404;
    log("api error", error);
    const output = errorSpy.mock.calls[0][0];
    expect(output).toContain('"code":404');
    expect(output).toContain('"status":404');
  });

  it("strips nested credential data from Error objects", () => {
    const error = new Error("auth failed") as Error & {
      response: { config: { data: string } };
    };
    error.response = {
      config: { data: "access_token=ya29.secret-token-here" },
    };
    log("oauth error", error);
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("ya29.secret-token-here");
    expect(output).not.toContain("response");
  });

  it("redacts Google access tokens by value pattern", () => {
    log("debug", {
      url: "https://api.google.com?token=ya29.A0ARrdaM_abcdefghij",
    });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("ya29.A0ARrdaM_abcdefghij");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts Google refresh tokens by value pattern", () => {
    log("debug", {
      data: "1//0abcdefghijklmnopqrstuvwx",
    });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("1//0abcdefghijklmnopqrstuvwx");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts JWT tokens by value pattern", () => {
    log("debug", {
      header: "Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig",
    });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("eyJhbGciOiJSUzI1NiJ9.eyJ");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts GOCSPX client secrets by value pattern", () => {
    log("debug", { config: "GOCSPX-abcdef123456" });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("GOCSPX-abcdef123456");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts PEM private keys by value pattern", () => {
    log("debug", { key: "-----BEGIN PRIVATE KEY-----\nMIIE..." });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("BEGIN PRIVATE KEY");
    expect(output).toContain("[REDACTED]");
  });

  it("preserves reason field on Error objects", () => {
    const error = new Error("Token expired") as Error & {
      code: string;
      reason: string;
    };
    error.code = "INVALID_GRANT";
    error.reason = "Token has been expired or revoked";
    log("auth error", error);
    const output = errorSpy.mock.calls[0][0];
    expect(output).toContain('"reason":"Token has been expired or revoked"');
    expect(output).toContain('"code":"INVALID_GRANT"');
  });

  it("sanitizes nested Error objects within plain objects", () => {
    const error = new Error("inner fail") as Error & {
      response: { config: { headers: { Authorization: string } } };
    };
    error.response = {
      config: { headers: { Authorization: "Bearer ya29.nested_secret_tok" } },
    };
    log("wrapper", { request_id: 123, error });
    const output = errorSpy.mock.calls[0][0];
    expect(output).toContain('"request_id":123');
    expect(output).toContain('"message":"inner fail"');
    expect(output).not.toContain("ya29.nested_secret_tok");
    expect(output).not.toContain("config");
  });

  it("redacts Authorization header by key name", () => {
    log("api error", {
      config: {
        headers: {
          Authorization: "Bearer ya29.A0ARrdaM_abcdefghij",
          "Content-Type": "application/json",
        },
      },
    });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("ya29.A0ARrdaM_abcdefghij");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain('"Content-Type":"application/json"');
  });

  it("redacts entire string when token appears as substring", () => {
    log("debug", {
      detail: "Auth failed for ya29.A0ARrdaM_abcdefghij at /api",
    });
    const output = errorSpy.mock.calls[0][0];
    expect(output).not.toContain("ya29.A0ARrdaM_abcdefghij");
    expect(output).toContain("[REDACTED]");
  });
});
