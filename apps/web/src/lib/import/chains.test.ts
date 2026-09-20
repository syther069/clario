import { describe, it, expect } from "vitest";
import {
  SUPPORTED_SOURCE_CHAINS,
  getSupportedChain,
  isChainSupported,
  getExplorerTxUrl,
  getExplorerAddressUrl,
} from "./chains";

describe("Supported Source Chains Registry", () => {
  it("includes Monad, Ethereum, and Base networks", () => {
    const chainIds = SUPPORTED_SOURCE_CHAINS.map((c) => c.chainId);
    expect(chainIds).toContain(10143); // Monad Testnet
    expect(chainIds).toContain(1337); // Monad Local
    expect(chainIds).toContain(1); // Ethereum Mainnet
    expect(chainIds).toContain(11155111); // Sepolia
    expect(chainIds).toContain(8453); // Base Mainnet
    expect(chainIds).toContain(84532); // Base Sepolia
  });

  it("retrieves chain by chainId", () => {
    const monad = getSupportedChain(10143);
    expect(monad).toBeDefined();
    expect(monad?.name).toBe("Monad Testnet");
    expect(monad?.nativeSymbol).toBe("MON");

    const eth = getSupportedChain(1);
    expect(eth).toBeDefined();
    expect(eth?.name).toBe("Ethereum Mainnet");
    expect(eth?.nativeSymbol).toBe("ETH");
  });

  it("returns null for unsupported chain", () => {
    expect(getSupportedChain(999999)).toBeNull();
    expect(isChainSupported(999999)).toBe(false);
  });

  it("generates explorer transaction URLs accurately", () => {
    const hash =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    const monadUrl = getExplorerTxUrl(10143, hash);
    expect(monadUrl).toBe(`https://testnet.monadexplorer.com/tx/${hash}`);

    const ethUrl = getExplorerTxUrl(1, hash);
    expect(ethUrl).toBe(`https://etherscan.io/tx/${hash}`);

    const baseUrl = getExplorerTxUrl(8453, hash);
    expect(baseUrl).toBe(`https://basescan.org/tx/${hash}`);

    // Local devnet has no explorer
    expect(getExplorerTxUrl(1337, hash)).toBeNull();
    expect(getExplorerTxUrl(999999, hash)).toBeNull();
  });

  it("generates explorer address URLs accurately", () => {
    const address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const monadAddrUrl = getExplorerAddressUrl(10143, address);
    expect(monadAddrUrl).toBe(
      `https://testnet.monadexplorer.com/address/${address}`,
    );

    const ethAddrUrl = getExplorerAddressUrl(1, address);
    expect(ethAddrUrl).toBe(`https://etherscan.io/address/${address}`);
  });
});
