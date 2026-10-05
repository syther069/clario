/**
 * Supported Source Chain Registry for Clario Attributable Transaction Import
 * Source: PRD §9.3; Architecture §4
 *
 * Rule 2: Mainnets only for live ingestion.
 * Rule 3: Strict Chain order: Monad, Ethereum, Base, Hyperliquid, then other supported EVM chains.
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
  // 1. Monad Mainnet (Chain ID 143)
  {
    chainId: 143,
    name: "Monad Mainnet",
    shortName: "Monad",
    nativeSymbol: "MON",
    isTestnet: false,
    explorerTxUrlTemplate: "https://monadexplorer.com/tx/{hash}",
    explorerAddressUrlTemplate: "https://monadexplorer.com/address/{address}",
    defaultRpcUrl: "https://rpc.monad.xyz",
  },
  // 2. Ethereum Mainnet (Chain ID 1)
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
  // 3. Base Mainnet (Chain ID 8453)
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
  // 4. Hyperliquid EVM Mainnet (Chain ID 999)
  {
    chainId: 999,
    name: "Hyperliquid EVM",
    shortName: "Hyperliquid",
    nativeSymbol: "HYPE",
    isTestnet: false,
    explorerTxUrlTemplate: "https://hypurrscan.io/tx/{hash}",
    explorerAddressUrlTemplate: "https://hypurrscan.io/address/{address}",
    defaultRpcUrl: "https://hyperliquid-mainnet.g.alchemy.com/v2/",
  },
  // 5. Arbitrum One Mainnet (Chain ID 42161)
  {
    chainId: 42161,
    name: "Arbitrum One",
    shortName: "Arbitrum",
    nativeSymbol: "ETH",
    isTestnet: false,
    explorerTxUrlTemplate: "https://arbiscan.io/tx/{hash}",
    explorerAddressUrlTemplate: "https://arbiscan.io/address/{address}",
    defaultRpcUrl: "https://arb1.arbitrum.io/rpc",
  },
  // 6. Optimism Mainnet (Chain ID 10)
  {
    chainId: 10,
    name: "Optimism Mainnet",
    shortName: "Optimism",
    nativeSymbol: "ETH",
    isTestnet: false,
    explorerTxUrlTemplate: "https://optimistic.etherscan.io/tx/{hash}",
    explorerAddressUrlTemplate:
      "https://optimistic.etherscan.io/address/{address}",
    defaultRpcUrl: "https://mainnet.optimism.io",
  },
  // 7. Polygon Mainnet (Chain ID 137)
  {
    chainId: 137,
    name: "Polygon Mainnet",
    shortName: "Polygon",
    nativeSymbol: "POL",
    isTestnet: false,
    explorerTxUrlTemplate: "https://polygonscan.com/tx/{hash}",
    explorerAddressUrlTemplate: "https://polygonscan.com/address/{address}",
    defaultRpcUrl: "https://polygon-rpc.com",
  },
  // Testnets and devnets (Flagged isTestnet: true, excluded from live mainnet ingestion)
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

/**
 * Filtered list of Mainnets in exact priority order (Rule 3)
 */
export const SUPPORTED_MAINNET_CHAINS: readonly SourceChainConfig[] =
  SUPPORTED_SOURCE_CHAINS.filter((c) => !c.isTestnet);

/**
 * Supported chains for user transaction import dialog and hash lookups.
 * Priority: Monad Testnet (hackathon live network), Monad Mainnet, Ethereum, Base, Hyperliquid, then other EVMs.
 */
export const SUPPORTED_IMPORT_CHAINS: readonly SourceChainConfig[] = [
  SUPPORTED_SOURCE_CHAINS.find((c) => c.chainId === 10143)!,
  ...SUPPORTED_MAINNET_CHAINS,
  SUPPORTED_SOURCE_CHAINS.find((c) => c.chainId === 11155111)!,
  SUPPORTED_SOURCE_CHAINS.find((c) => c.chainId === 84532)!,
].filter(Boolean);

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
