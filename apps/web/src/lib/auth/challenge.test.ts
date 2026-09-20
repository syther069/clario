import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  createAuthChallenge,
  formatEip4361Message,
  MemoryChallengeStore,
  parseEip4361Message,
  verifyAuthChallenge,
} from "./challenge";

describe("Authentication Challenge and SIWE Verification (APP-002)", () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const address = account.address;
  const chainId = 31337;
  const domain = "clario.local";
  const uri = "https://clario.local";

  it("generates a valid EIP-4361 formatted challenge message", async () => {
    const store = new MemoryChallengeStore();
    const challenge = await createAuthChallenge(
      { address, chainId, domain, uri },
      store,
    );

    expect(challenge.address.toLowerCase()).toBe(address.toLowerCase());
    expect(challenge.chainId).toBe(chainId);
    expect(challenge.domain).toBe(domain);
    expect(challenge.uri).toBe(uri);
    expect(challenge.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(challenge.version).toBe("1");
    expect(challenge.message).toContain(
      `${domain} wants you to sign in with your Ethereum account:`,
    );
    expect(challenge.message).toContain(`Chain ID: ${chainId}`);
    expect(challenge.message).toContain(`Nonce: ${challenge.nonce}`);

    // Verify challenge was saved in store
    const stored = store.get(challenge.nonce);
    expect(stored).toBeDefined();
    expect(stored?.consumed).toBe(false);
  });

  it("parses an EIP-4361 formatted message into structured components", () => {
    const nonce = "a1b2c3d4e5f607182930415263748596";
    const issuedAt = "2026-09-17T00:00:00.000Z";
    const expirationTime = "2026-09-17T00:05:00.000Z";

    const msg = formatEip4361Message({
      domain,
      address,
      statement: "Sign in to Clario.",
      uri,
      version: "1",
      chainId,
      nonce,
      issuedAt,
      expirationTime,
    });

    const parsed = parseEip4361Message(msg);
    expect(parsed.domain).toBe(domain);
    expect(parsed.address.toLowerCase()).toBe(address.toLowerCase());
    expect(parsed.chainId).toBe(chainId);
    expect(parsed.nonce).toBe(nonce);
    expect(parsed.issuedAt).toBe(issuedAt);
    expect(parsed.expirationTime).toBe(expirationTime);
  });

  it("successfully verifies a signed challenge with a matching wallet key", async () => {
    const store = new MemoryChallengeStore();
    const challenge = await createAuthChallenge(
      { address, chainId, domain, uri },
      store,
    );

    const signature = await account.signMessage({ message: challenge.message });

    const verified = await verifyAuthChallenge(
      {
        message: challenge.message,
        signature,
        expectedDomain: domain,
        expectedChainId: chainId,
      },
      store,
    );

    expect(verified.address.toLowerCase()).toBe(address.toLowerCase());
    expect(verified.chainId).toBe(chainId);
    expect(verified.domain).toBe(domain);
    expect(verified.nonce).toBe(challenge.nonce);
    expect(typeof verified.verifiedAt).toBe("string");

    // Nonce must be marked consumed
    const stored = store.get(challenge.nonce);
    expect(stored?.consumed).toBe(true);
  });

  it("fails closed on replay: reusing the same challenge signature fails", async () => {
    const store = new MemoryChallengeStore();
    const challenge = await createAuthChallenge(
      { address, chainId, domain, uri },
      store,
    );

    const signature = await account.signMessage({ message: challenge.message });

    // First verification succeeds
    await verifyAuthChallenge({ message: challenge.message, signature }, store);

    // Second verification must fail closed
    await expect(
      verifyAuthChallenge({ message: challenge.message, signature }, store),
    ).rejects.toThrow(/already been used/i);
  });

  it("fails closed when the signature is forged or signed by another wallet", async () => {
    const attacker = privateKeyToAccount(generatePrivateKey());
    const store = new MemoryChallengeStore();

    const challenge = await createAuthChallenge(
      { address, chainId, domain, uri },
      store,
    );

    // Attacker signs challenge that was issued for `address`
    const forgedSignature = await attacker.signMessage({
      message: challenge.message,
    });

    await expect(
      verifyAuthChallenge(
        { message: challenge.message, signature: forgedSignature },
        store,
      ),
    ).rejects.toThrow(/Invalid signature/i);
  });

  it("fails closed if the challenge is expired", async () => {
    const store = new MemoryChallengeStore();
    // Negative TTL creates an immediately expired challenge
    const challenge = await createAuthChallenge(
      { address, chainId, domain, uri, ttlSeconds: -10 },
      store,
    );

    const signature = await account.signMessage({ message: challenge.message });

    await expect(
      verifyAuthChallenge({ message: challenge.message, signature }, store),
    ).rejects.toThrow(/expired/i);
  });

  it("fails closed when domain or chain ID does not match expected server configuration", async () => {
    const store = new MemoryChallengeStore();
    const challenge = await createAuthChallenge(
      { address, chainId, domain, uri },
      store,
    );

    const signature = await account.signMessage({ message: challenge.message });

    // Wrong expected domain
    await expect(
      verifyAuthChallenge(
        {
          message: challenge.message,
          signature,
          expectedDomain: "phishing-site.xyz",
        },
        store,
      ),
    ).rejects.toThrow(/Domain mismatch/i);

    // Wrong expected chain
    await expect(
      verifyAuthChallenge(
        {
          message: challenge.message,
          signature,
          expectedChainId: 1, // Mainnet instead of configured 31337
        },
        store,
      ),
    ).rejects.toThrow(/Chain ID mismatch/i);
  });

  it("proves that a client-supplied address alone grants zero authority", async () => {
    const store = new MemoryChallengeStore();
    const victim = privateKeyToAccount(generatePrivateKey());

    // Attacker claims to be victim
    const challenge = await createAuthChallenge(
      { address: victim.address, chainId, domain, uri },
      store,
    );

    // Attacker tries invalid signature
    const invalidSig =
      "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001b";

    await expect(
      verifyAuthChallenge(
        { message: challenge.message, signature: invalidSig },
        store,
      ),
    ).rejects.toThrow();
  });
});
