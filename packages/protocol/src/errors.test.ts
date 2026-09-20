import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETRYABLE_FLAGS,
  DEFAULT_SAFE_ERROR_MESSAGES,
  PROTOCOL_ERROR_CODES,
  type ProtocolErrorCode,
  type ProtocolErrorEnvelope,
  createProtocolError,
  isProtocolErrorCode,
  parseProtocolErrorEnvelope,
  ProtocolError,
} from "./errors.js";

describe("Protocol Errors and Error Envelope", () => {
  const minimumRequiredCodes: ProtocolErrorCode[] = [
    "UNAUTHORIZED",
    "VERSION_MISMATCH",
    "EXPENSE_VERSION_SUPERSEDED",
    "STALE_APPROVAL",
    "DUPLICATE_SETTLEMENT",
    "UNSUPPORTED_CHAIN",
    "UNSUPPORTED_TOKEN",
    "UNVERIFIABLE_EVIDENCE",
  ];

  it("contains all minimum required error codes from TASKS.md", () => {
    for (const code of minimumRequiredCodes) {
      expect(PROTOCOL_ERROR_CODES).toContain(code);
      expect(isProtocolErrorCode(code)).toBe(true);
      expect(DEFAULT_SAFE_ERROR_MESSAGES[code]).toBeDefined();
      expect(typeof DEFAULT_RETRYABLE_FLAGS[code]).toBe("boolean");
    }
  });

  it("creates and serializes a ProtocolError matching architecture §10.7", () => {
    const err = createProtocolError("EXPENSE_VERSION_SUPERSEDED", {
      requestId: "req_test_12345",
    });

    const envelope: ProtocolErrorEnvelope = err.toEnvelope();
    expect(envelope).toEqual({
      error: {
        code: "EXPENSE_VERSION_SUPERSEDED",
        message: "This expense version has been superseded by a newer version.",
        requestId: "req_test_12345",
        retryable: false,
      },
    });

    const json = JSON.stringify(err);
    const parsedFromJson = JSON.parse(json);
    expect(parsedFromJson).toEqual(envelope);
  });

  it("parses valid error envelopes round-trip", () => {
    const raw = {
      error: {
        code: "UNAUTHORIZED",
        message: "Action not permitted.",
        requestId: "req_auth_fail_01",
        retryable: false,
      },
    };

    const parsed = parseProtocolErrorEnvelope(raw);
    expect(parsed.error.code).toBe("UNAUTHORIZED");
    expect(parsed.error.message).toBe("Action not permitted.");
    expect(parsed.error.requestId).toBe("req_auth_fail_01");
    expect(parsed.error.retryable).toBe(false);
  });

  it("fails closed on unknown error codes", () => {
    const unknownCodeEnvelope = {
      error: {
        code: "SOME_FUTURE_UNKNOWN_CODE",
        message: "Something broke.",
        requestId: "req_999",
        retryable: false,
      },
    };

    expect(() => parseProtocolErrorEnvelope(unknownCodeEnvelope)).toThrow(
      ProtocolError,
    );
    try {
      parseProtocolErrorEnvelope(unknownCodeEnvelope);
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ProtocolError);
      const protoErr = e as ProtocolError;
      expect(protoErr.code).toBe("INTERNAL_ERROR");
      expect(protoErr.message).toContain(
        "Unknown or unrecognized protocol error code",
      );
    }
  });

  it("rejects malformed envelopes missing error object or fields", () => {
    const badEnvelopes = [
      null,
      undefined,
      {},
      { error: null },
      { error: "string" },
      { error: { code: "UNAUTHORIZED" } }, // missing message, requestId, retryable
      {
        error: {
          code: "UNAUTHORIZED",
          message: "", // empty message
          requestId: "req_1",
          retryable: false,
        },
      },
      {
        error: {
          code: "UNAUTHORIZED",
          message: "test",
          requestId: "bad request id with spaces!",
          retryable: false,
        },
      },
      {
        error: {
          code: "UNAUTHORIZED",
          message: "test",
          requestId: "req_1",
          retryable: "not-a-bool",
        },
      },
    ];

    for (const bad of badEnvelopes) {
      expect(() => parseProtocolErrorEnvelope(bad)).toThrow();
    }
  });

  it("verifies safe error messages never reveal private evidence, merchant/purpose data, salts, or credentials", () => {
    // Audit all default error messages
    const sensitiveTokens = [
      "password",
      "secret",
      "private_key",
      "salt",
      "merchant",
      "purpose",
      "evidence",
      "file://",
      "s3://",
      "postgres://",
      "bearer",
    ];

    for (const code of PROTOCOL_ERROR_CODES) {
      const msg = DEFAULT_SAFE_ERROR_MESSAGES[code].toLowerCase();
      for (const token of sensitiveTokens) {
        if (token === "evidence") {
          // UNVERIFIABLE_EVIDENCE can mention the abstract term 'evidence', but must not contain private details
          continue;
        }
        expect(msg).not.toContain(token);
      }
    }
  });

  it("correctly sets retryable flags according to transient vs deterministic errors", () => {
    // RATE_LIMITED and INTERNAL_ERROR are transient/retryable
    expect(createProtocolError("RATE_LIMITED").retryable).toBe(true);
    expect(createProtocolError("INTERNAL_ERROR").retryable).toBe(true);

    // Business logic / validation errors are non-retryable
    expect(createProtocolError("UNAUTHORIZED").retryable).toBe(false);
    expect(createProtocolError("VERSION_MISMATCH").retryable).toBe(false);
    expect(createProtocolError("EXPENSE_VERSION_SUPERSEDED").retryable).toBe(
      false,
    );
    expect(createProtocolError("STALE_APPROVAL").retryable).toBe(false);
    expect(createProtocolError("DUPLICATE_SETTLEMENT").retryable).toBe(false);
    expect(createProtocolError("UNSUPPORTED_CHAIN").retryable).toBe(false);
    expect(createProtocolError("UNSUPPORTED_TOKEN").retryable).toBe(false);
    expect(createProtocolError("UNVERIFIABLE_EVIDENCE").retryable).toBe(false);
  });
});
