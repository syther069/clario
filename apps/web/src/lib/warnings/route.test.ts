import { describe, expect, it } from "vitest";
import {
  GET as getWarnings,
  POST as postDisposition,
} from "@/app/api/workspaces/[workspaceId]/expenses/[expenseId]/warnings/route";
import { getSessionSecret } from "../auth/context";
import {
  createSessionPayload,
  serializeSessionCookie,
  signSessionToken,
} from "../auth/session";

const params = Promise.resolve({
  workspaceId: "workspace-1",
  expenseId: "expense-1",
});

describe("warning routes authorization", () => {
  it("rejects unauthenticated warning reads before database access", async () => {
    const response = await getWarnings(
      new Request(
        "http://localhost/api/workspaces/workspace-1/expenses/expense-1/warnings",
      ),
      { params },
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("requires CSRF verification for human dispositions", async () => {
    const session = createSessionPayload({
      userId: "user-1",
      address: "0x0000000000000000000000000000000000000001",
    });
    const token = signSessionToken(session, getSessionSecret());
    const response = await postDisposition(
      new Request(
        "http://localhost/api/workspaces/workspace-1/expenses/expense-1/warnings",
        {
          method: "POST",
          headers: {
            cookie: serializeSessionCookie(token, { secure: false }),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            warningId: "warn_fixture",
            disposition: "acknowledged",
          }),
        },
      ),
      { params },
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });
});
