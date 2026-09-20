/**
 * Supported Source Chain Registry for Clario Attributable Transaction Import
 * Source: PRD §9.3
 */

export interface SourceChainConfig {
  readonly chainId: number;
  readonly name: string;
  readonly shortName: string;
  readonly nativeSymbol: string;
  readonly isTestnet: boolean;
  readonly explorerTxUrlTemplate: string | null;
  readonly explorerAddressUrlTemplate: string | null;
  readonly defaultRpcUrl: string | null;
}

export const SUPPORTED_SOURCE_CHAINS: readonly SourceChainConfig[] = [
  {
    chainId: 10143,
    name: "Monad Testnet",
    shortName: "Monad Testnet",
    nativeSymbol: "MON",
    isTestnet: true,
    explorerTxUrlTemplate: "https://testnet.monadexplorer.com/tx/{hash}",
    explorerAddressUrlTemplate:
      "https://testnet.monadexplorer.com/address/{address}",
    defaultRpcUrl: "https://testnet-rpc.monad.xyz",
  },
  {
    chainId: 1337,
    name: "Monad Local Devnet",
    shortName: "Monad Local",
    nativeSymbol: "MON",
    isTestnet: true,
    explorerTxUrlTemplate: null,
    explorerAddressUrlTemplate: null,
    defaultRpcUrl: "http://127.0.0.1:8545",
  },
  {
    chainId: 31337,
    name: "Anvil Local Devnet",
    shortName: "Anvil Local",
    nativeSymbol: "ETH",
    isTestnet: true,
    explorerTxUrlTemplate: null,
    explorerAddressUrlTemplate: null,
    defaultRpcUrl: "http://127.0.0.1:8545",
  },
  {
    chainId: 1,
    name: "Ethereum Mainnet",
    shortName: "Ethereum",
    nativeSymbol: "ETH",
    isTestnet: false,
    explorerTxUrlTemplate: "https://etherscan.io/tx/{hash}",
    explorerAddressUrlTemplate: "https://etherscan.io/address/{address}",
    defaultRpcUrl: "https://eth.llamarpc.com",
  },
  {
    chainId: 11155111,
    name: "Sepolia Testnet",
    shortName: "Sepolia",
    nativeSymbol: "ETH",
    isTestnet: true,
    explorerTxUrlTemplate: "https://sepolia.etherscan.io/tx/{hash}",
    explorerAddressUrlTemplate:
      "https://sepolia.etherscan.io/address/{address}",
    defaultRpcUrl: "https://rpc.sepolia.org",
  },
  {
    chainId: 8453,
    name: "Base Mainnet",
    shortName: "Base",
    nativeSymbol: "ETH",
    isTestnet: false,
    explorerTxUrlTemplate: "https://basescan.org/tx/{hash}",
    explorerAddressUrlTemplate: "https://basescan.org/address/{address}",
    defaultRpcUrl: "https://mainnet.base.org",
  },
  {
    chainId: 84532,
    name: "Base Sepolia Testnet",
    shortName: "Base Sepolia",
    nativeSymbol: "ETH",
    isTestnet: true,
    explorerTxUrlTemplate: "https://sepolia.basescan.org/tx/{hash}",
    explorerAddressUrlTemplate:
      "https://sepolia.basescan.org/address/{address}",
    defaultRpcUrl: "https://sepolia.base.org",
  },
];

const CHAIN_MAP = new Map<number, SourceChainConfig>(
  SUPPORTED_SOURCE_CHAINS.map((c) => [c.chainId, c]),
);

export function getSupportedChain(chainId: number): SourceChainConfig | null {
  return CHAIN_MAP.get(chainId) ?? null;
}

export function isChainSupported(chainId: number): boolean {
  return CHAIN_MAP.has(chainId);
}

export function getExplorerTxUrl(chainId: number, hash: string): string | null {
  const chain = getSupportedChain(chainId);
  if (!chain?.explorerTxUrlTemplate) return null;
  return chain.explorerTxUrlTemplate.replace("{hash}", hash);
}

export function getExplorerAddressUrl(
  chainId: number,
  address: string,
): string | null {
  const chain = getSupportedChain(chainId);
  if (!chain?.explorerAddressUrlTemplate) return null;
  return chain.explorerAddressUrlTemplate.replace("{address}", address);
}
