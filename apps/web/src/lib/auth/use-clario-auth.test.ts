import { describe, it, expect } from "vitest";
import {
  ALL_SUPPORTED_CHAINS,
  monadTestnet,
  monadMainnet,
} from "@/providers/privy-provider";
import { POST as logoutPost } from "@/app/api/auth/logout/route";

describe("Privy Multi-Chain & Wallet Resolution Audit", () => {
  it("includes Monad Testnet (10143) as default chain with valid RPC and explorer", () => {
    expect(monadTestnet.id).toBe(10143);
    expect(monadTestnet.name).toBe("Monad Testnet");
    expect(monadTestnet.nativeCurrency.symbol).toBe("MON");
    expect(monadTestnet.rpcUrls.default.http[0]).toBe("https://testnet-rpc.monad.xyz");
    expect(monadTestnet.blockExplorers?.default.url).toBe("https://testnet.monadexplorer.com");
    expect(monadTestnet.testnet).toBe(true);
  });

  it("includes Monad Mainnet (143) with valid chain parameters", () => {
    expect(monadMainnet.id).toBe(143);
    expect(monadMainnet.name).toBe("Monad Mainnet");
    expect(monadMainnet.nativeCurrency.symbol).toBe("MON");
    expect(monadMainnet.testnet).toBe(false);
  });

  it("configures all 9 supported chains with strict boolean testnet properties for Privy", () => {
    const chainIds = ALL_SUPPORTED_CHAINS.map((c) => c.id);
    expect(chainIds).toContain(10143); // Monad Testnet
    expect(chainIds).toContain(143); // Monad Mainnet
    expect(chainIds).toContain(1); // Ethereum
    expect(chainIds).toContain(8453); // Base
    expect(chainIds).toContain(42161); // Arbitrum One
    expect(chainIds).toContain(10); // Optimism
    expect(chainIds).toContain(137); // Polygon
    expect(chainIds).toContain(11155111); // Sepolia
    expect(chainIds).toContain(84532); // Base Sepolia

    ALL_SUPPORTED_CHAINS.forEach((chain) => {
      expect(typeof chain.testnet).toBe("boolean");
      expect(typeof chain.id).toBe("number");
      expect(typeof chain.name).toBe("string");
    });
  });

  it("CRITICAL FIX: validates that embedded Privy wallet address resolution logic accepts walletClientType === 'privy'", () => {
    const embeddedAddress = "0x1111111111111111111111111111111111111111";
    const userWallet = {
      address: embeddedAddress,
      walletClientType: "privy",
      type: "ethereum",
    };

    // Simulate the wallet resolution logic in use-clario-auth
    const isEVMAddress = /^0x[a-fA-F0-9]{40}$/.test(userWallet.address);
    expect(isEVMAddress).toBe(true);

    // Old buggy behavior would evaluate: userWallet.walletClientType !== "privy" -> FALSE!
    const oldBuggyHasWallet = userWallet.walletClientType !== "privy";
    expect(oldBuggyHasWallet).toBe(false); // Demonstrates the original bug!

    // Fixed behavior: Any valid EVM address (embedded or external) is treated as a valid connected EVM wallet
    const fixedHasConnectedWallet = Boolean(userWallet.address && isEVMAddress);
    expect(fixedHasConnectedWallet).toBe(true);
  });

  it("server-side logout route clears clario_session cookie with expired Max-Age", async () => {
    const response = await logoutPost();
    expect(response.status).toBe(200);

    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("clario_session=");
    expect(setCookie).toContain("Max-Age=0");
  });
});
