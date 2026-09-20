/**
 * Clario Settlement Configuration & Provenance (SET-001)
 *
 * Resolves runtime token, registry contract, and chain configuration
 * exclusively from validated deployment configuration / manifest (RULES §5.1, §10.4, §14).
 *
 * Official Monad Provenance (see docs/MONAD_PROVENANCE.md):
 * - Monad Testnet: Chain ID 10143 (family: monad)
 * - Supported Settlement Asset: USDC (standard 6 decimals, address: 0x754704Bc059F8C67012fEd69BC8A327a5aafb603)
 * - Monad Local / Anvil: Chain ID 31337 / 1337 (family: local)
 *
 * Invariants:
 * - Contract and token addresses MUST come from a validated deployment manifest.
 * - Direct hardcoded addresses, fake zero addresses, and raw NEXT_PUBLIC_* variables
 *   are strictly prohibited (RULES §5.1, §5.3, §10.4, §14).
 * - Fails closed with SettlementConfigError if manifest is missing or invalid.
 * - Unit and integration tests can set an isolated test configuration via
 *   `setSettlementConfigForTesting(...)` (RULES §5.2).
 */

import { getServerConfiguration } from "@/config/server";
import type { SettlementTokenConfig } from "./service";

export interface ResolvedSettlementConfig {
  readonly token: SettlementTokenConfig;
  readonly registryAddress: string;
  readonly chainId: number;
  readonly rpcUrl?: string | undefined;
  readonly isFromManifest: boolean;
}

export class SettlementConfigError extends Error {
  readonly code = "UNCONFIGURED_SETTLEMENT_ASSET";
  readonly status = 422;

  constructor(message: string) {
    super(message);
    this.name = "SettlementConfigError";
  }
}

let testSettlementConfig: ResolvedSettlementConfig | null = null;

/**
 * Sets an isolated settlement configuration for testing (RULES §5.2).
 * Pass `null` to clear test override.
 */
export function setSettlementConfigForTesting(
  config: ResolvedSettlementConfig | null,
): void {
  testSettlementConfig = config;
}

/**
 * Returns the resolved settlement configuration for the active environment.
 * Requires a validated deployment manifest with USDC token and ClarioRegistry contract.
 *
 * Throws SettlementConfigError if no valid deployment manifest is configured.
 */
export function getSettlementConfig(): ResolvedSettlementConfig {
  if (testSettlementConfig !== null) {
    return testSettlementConfig;
  }

  let serverConfig;
  try {
    serverConfig = getServerConfiguration();
  } catch (err) {
    throw new SettlementConfigError(
      `Cannot resolve settlement configuration: server configuration error (${err instanceof Error ? err.message : String(err)}).`,
    );
  }

  const deployment = serverConfig.deployment;
  if (
    !deployment ||
    !deployment.tokens?.USDC ||
    !deployment.contracts?.ClarioRegistry
  ) {
    throw new SettlementConfigError(
      "Settlement requires a validated deployment manifest with official USDC token and ClarioRegistry contract configuration (RULES §5.1, §10.4, §14).",
    );
  }

  return {
    token: {
      address: deployment.tokens.USDC.address,
      decimals: deployment.tokens.USDC.decimals,
      symbol: "USDC",
    },
    registryAddress: deployment.contracts.ClarioRegistry.address,
    chainId: serverConfig.chain.chainId,
    rpcUrl: serverConfig.chain.rpcUrl,
    isFromManifest: true,
  };
}

/**
 * Returns the resolved settlement configuration if available, or null if unconfigured.
 * Safe for read-only queue views and status queries.
 */
export function tryGetSettlementConfig(): ResolvedSettlementConfig | null {
  try {
    return getSettlementConfig();
  } catch {
    return null;
  }
}
