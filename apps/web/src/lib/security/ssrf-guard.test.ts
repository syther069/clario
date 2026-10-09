import { describe, it, expect } from "vitest";
import {
  assertSafeUrl,
  isSafeUrl,
  validateSafeRpcUrl,
} from "./ssrf-guard";

describe("SSRF Protection Guard (SEC-07)", () => {
  it("allows legitimate public HTTPS endpoints", () => {
    expect(isSafeUrl("https://testnet-rpc.monad.xyz")).toBe(true);
    expect(isSafeUrl("https://rpc.monad.xyz")).toBe(true);
    expect(isSafeUrl("https://eth.llamarpc.com")).toBe(true);
    expect(isSafeUrl("https://coins.llama.fi/prices")).toBe(true);
  });

  it("blocks cloud metadata service endpoints (AWS / GCP / Azure)", () => {
    expect(() => assertSafeUrl("http://169.254.169.254/latest/meta-data")).toThrow(
      /SSRF_BLOCKED/,
    );
    expect(() => assertSafeUrl("http://metadata.google.internal/computeMetadata")).toThrow(
      /SSRF_BLOCKED/,
    );
    expect(() => assertSafeUrl("http://169.254.169.253")).toThrow(/SSRF_BLOCKED/);
    expect(() => assertSafeUrl("http://instance-data")).toThrow(/SSRF_BLOCKED/);
  });

  it("blocks private IPv4 addresses (RFC 1918)", () => {
    // 10.0.0.0/8
    expect(() => assertSafeUrl("http://10.0.0.1:8545")).toThrow(/SSRF_BLOCKED/);
    expect(() => assertSafeUrl("http://10.255.255.255")).toThrow(/SSRF_BLOCKED/);

    // 172.16.0.0/12
    expect(() => assertSafeUrl("http://172.16.0.1:8545")).toThrow(/SSRF_BLOCKED/);
    expect(() => assertSafeUrl("http://172.31.255.255")).toThrow(/SSRF_BLOCKED/);

    // 192.168.0.0/16
    expect(() => assertSafeUrl("http://192.168.1.1:8080")).toThrow(/SSRF_BLOCKED/);
    expect(() => assertSafeUrl("http://192.168.0.100")).toThrow(/SSRF_BLOCKED/);
  });

  it("blocks loopback addresses when allowLocalhost is false", () => {
    expect(() => assertSafeUrl("http://127.0.0.1:8545")).toThrow(/SSRF_BLOCKED/);
    expect(() => assertSafeUrl("http://localhost:3000")).toThrow(/SSRF_BLOCKED/);
    expect(() => assertSafeUrl("http://127.1.2.3:80")).toThrow(/SSRF_BLOCKED/);
  });

  it("blocks IPv6 loopback and link-local addresses", () => {
    expect(() => assertSafeUrl("http://[::1]:8545")).toThrow(/SSRF_BLOCKED/);
    expect(() => assertSafeUrl("http://[fe80::1]:80")).toThrow(/SSRF_BLOCKED/);
    expect(() => assertSafeUrl("http://[fd00::1]:80")).toThrow(/SSRF_BLOCKED/);
  });

  it("blocks dangerous and non-http protocols", () => {
    expect(() => assertSafeUrl("file:///etc/passwd")).toThrow(/SSRF_BLOCKED/);
    expect(() => assertSafeUrl("ftp://evil.com/dump")).toThrow(/SSRF_BLOCKED/);
    expect(() => assertSafeUrl("gopher://127.0.0.1:70")).toThrow(/SSRF_BLOCKED/);
    expect(() => assertSafeUrl("javascript:alert(1)")).toThrow(/SSRF_BLOCKED/);
  });

  it("validates RPC URLs with validateSafeRpcUrl", () => {
    // Valid public RPC
    const validated = validateSafeRpcUrl("https://testnet-rpc.monad.xyz");
    expect(validated).toBe("https://testnet-rpc.monad.xyz/");

    // Cloud metadata injection
    expect(() => validateSafeRpcUrl("http://169.254.169.254/rpc")).toThrow(
      /SSRF_BLOCKED/,
    );
  });
});
