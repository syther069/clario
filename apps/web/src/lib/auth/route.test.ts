import { beforeEach, describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { POST as challengeHandler } from "@/app/api/auth/challenge/route";
import { POST as verifyHandler } from "@/app/api/auth/verify/route";
import { POST as confirmHandler } from "@/app/api/auth/confirm/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";
import { GET as sessionHandler } from "@/app/api/auth/session/route";
import { defaultChallengeStore } from "./challenge";
import { parseSessionCookie } from "./session";

describe("Authentication API Routes Integration (APP-002)", () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const address = account.address;

  beforeEach(() => {
    defaultChallengeStore.clearExpired();
  });

  it("handles the complete sign-in, session inspection, and logout lifecycle", async () => {
    // 1. Request challenge
    const challengeReq = new Request(
      "https://clario.local/api/auth/challenge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", host: "clario.local" },
        body: JSON.stringify({ address, chainId: 31337 }),
      },
    );

    const challengeRes = await challengeHandler(challengeReq);
    expect(challengeRes.status).toBe(200);
    const challengeData = (await challengeRes.json()) as {
      challenge: { message: string; nonce: string };
    };
    expect(challengeData.challenge.message).toBeDefined();

    // 2. Sign challenge
    const signature = await account.signMessage({
      message: challengeData.challenge.message,
    });

    // 3. Verify signature
    const verifyReq = new Request("https://clario.local/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", host: "clario.local" },
      body: JSON.stringify({
        message: challengeData.challenge.message,
        signature,
      }),
    });

    const verifyRes = await verifyHandler(verifyReq);
    expect(verifyRes.status).toBe(200);

    const setCookie = verifyRes.headers.get("Set-Cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("clario_session=");
    expect(setCookie).toContain("HttpOnly");

    const verifyData = (await verifyRes.json()) as {
      user: { address: string; userId: string };
      csrfToken: string;
    };
    expect(verifyData.user.address.toLowerCase()).toBe(address.toLowerCase());
    expect(typeof verifyData.csrfToken).toBe("string");

    // 4. Inspect session
    const token = parseSessionCookie(setCookie);
    const sessionReq = new Request("https://clario.local/api/auth/session", {
      method: "GET",
      headers: {
        cookie: `clario_session=${token}`,
      },
    });

    const sessionRes = await sessionHandler(sessionReq);
    expect(sessionRes.status).toBe(200);
    const sessionData = (await sessionRes.json()) as {
      authenticated: boolean;
      user?: { address: string };
    };
    expect(sessionData.authenticated).toBe(true);
    expect(sessionData.user?.address.toLowerCase()).toBe(address.toLowerCase());

    // 5. Confirm wallet action
    const confirmMsg = "Confirm sensitive action: role update";
    const confirmSig = await account.signMessage({ message: confirmMsg });

    const confirmReq = new Request("https://clario.local/api/auth/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `clario_session=${token}`,
        "x-csrf-token": verifyData.csrfToken,
      },
      body: JSON.stringify({ message: confirmMsg, signature: confirmSig }),
    });

    const confirmRes = await confirmHandler(confirmReq);
    expect(confirmRes.status).toBe(200);
    const confirmData = (await confirmRes.json()) as { ok: boolean };
    expect(confirmData.ok).toBe(true);
    expect(confirmRes.headers.get("Set-Cookie")).toContain("clario_session=");

    // 6. Logout
    const logoutRes = await logoutHandler();
    expect(logoutRes.status).toBe(200);
    const logoutCookie = logoutRes.headers.get("Set-Cookie");
    expect(logoutCookie).toContain("Max-Age=0");
  });

  it("returns 400 when requesting challenge with invalid address", async () => {
    const req = new Request("https://clario.local/api/auth/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "invalid-address" }),
    });

    const res = await challengeHandler(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe("INVALID_IDENTIFIER");
  });

  it("returns 401 when verifying with an invalid signature", async () => {
    const challengeReq = new Request(
      "https://clario.local/api/auth/challenge",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chainId: 31337 }),
      },
    );

    const challengeRes = await challengeHandler(challengeReq);
    const challengeData = (await challengeRes.json()) as {
      challenge: { message: string };
    };

    const attacker = privateKeyToAccount(generatePrivateKey());
    const forgedSig = await attacker.signMessage({
      message: challengeData.challenge.message,
    });

    const verifyReq = new Request("https://clario.local/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: challengeData.challenge.message,
        signature: forgedSig,
      }),
    });

    const verifyRes = await verifyHandler(verifyReq);
    expect(verifyRes.status).toBe(401);
  });

  it("returns authenticated: false when session cookie is absent or invalid", async () => {
    const req = new Request("https://clario.local/api/auth/session", {
      method: "GET",
    });

    const res = await sessionHandler(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { authenticated: boolean };
    expect(data.authenticated).toBe(false);
  });
});
