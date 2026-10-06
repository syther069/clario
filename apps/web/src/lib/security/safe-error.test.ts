import { describe, it, expect } from "vitest";
import { handleSafeApiError } from "./safe-error";
import { ProtocolError } from "@clario/protocol";

describe("Safe API Error Handler", () => {
  it("sanitizes unexpected database errors without leaking internal details", async () => {
    const rawDbError = new Error("relation 'users' does not exist at character 14 (postgres internal)");
    const response = handleSafeApiError(rawDbError, "Failed to load resource.");
    
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
    expect(json.error.message).toBe("Failed to load resource.");
    expect(JSON.stringify(json)).not.toContain("postgres internal");
  });

  it("preserves safe ProtocolError instances with accurate status codes", async () => {
    const protocolErr = new ProtocolError("UNAUTHORIZED", {
      message: "Active session required.",
    });
    const response = handleSafeApiError(protocolErr);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(json.error.message).toBe("Active session required.");
  });
});
