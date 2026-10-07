export const APP_ENVIRONMENTS = [
  "local",
  "preview",
  "staging",
  "production",
] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];
export type ChainFamily = "local" | "monad";

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export type ConfigurationErrorCode =
  | "ADDRESS_OUTSIDE_MANIFEST"
  | "ENVIRONMENT_MISMATCH"
  | "INVALID_FORMAT"
  | "INVALID_MANIFEST"
  | "INVALID_URL"
  | "MISSING_VALUE"
  | "NETWORK_MISMATCH"
  | "PUBLIC_ENV_FORBIDDEN";

export class ConfigurationError extends Error {
  readonly code: ConfigurationErrorCode;
  readonly field: string;

  constructor(code: ConfigurationErrorCode, field: string) {
    super(`Configuration rejected: ${field} (${code}).`);
    this.name = "ConfigurationError";
    this.code = code;
    this.field = field;
  }
}

export interface DeploymentContract {
  readonly address: string;
  readonly deploymentBlock: number;
  readonly transactionHash: string;
  readonly abiHash: string;
  readonly verifiedSourceUrl: string | null;
}

export interface DeploymentToken {
  readonly address: string;
  readonly decimals: number;
}

export interface DeploymentManifest {
  readonly schemaVersion: 1;
  readonly environment: AppEnvironment;
  readonly sourceCommit: string;
  readonly chainFamily: ChainFamily;
  readonly chainId: number;
  readonly deployer: string;
  readonly deployedAt: string;
  readonly contracts: {
    readonly ClarioRegistry: DeploymentContract;
  };
  readonly tokens: {
    readonly USDC: DeploymentToken;
  };
}

export interface ChainConfiguration {
  readonly family: ChainFamily;
  readonly chainId: number;
  readonly rpcUrl: string;
  readonly rpcFallbackUrl: string | null;
  readonly explorerUrl: string | null;
}

export interface ServerConfiguration {
  readonly environment: AppEnvironment;
  readonly sourceCommit: string | null;
  readonly chain: ChainConfiguration;
  readonly deployment: DeploymentManifest | null;
}

export interface PublicConfiguration {
  readonly environment: AppEnvironment;
  readonly chain: {
    readonly family: ChainFamily;
    readonly chainId: number;
    readonly explorerUrl: string | null;
  };
  readonly deployment: {
    readonly registryAddress: string;
    readonly settlementToken: {
      readonly address: string;
      readonly decimals: number;
    };
  } | null;
}

const APP_ENVIRONMENT_SET = new Set<string>(APP_ENVIRONMENTS);
const CHAIN_FAMILY_SET = new Set<string>(["local", "monad"]);
const DIRECT_ADDRESS_FIELDS = ["CLARIO_REGISTRY_ADDRESS", "USDC_ADDRESS"];
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const EVM_HASH = /^0x[0-9a-fA-F]{64}$/;
const SOURCE_COMMIT = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

function reject(field: string, code: ConfigurationErrorCode): never {
  throw new ConfigurationError(code, field);
}

function requiredEnvironmentValue(
  environment: EnvironmentSource,
  field: string,
): string {
  const value = optionalEnvironmentValue(environment, field);
  return value ?? reject(field, "MISSING_VALUE");
}

function optionalEnvironmentValue(
  environment: EnvironmentSource,
  field: string,
): string | null {
  const value = environment[field]?.trim();
  return value ? value : null;
}

function parseAppEnvironment(value: unknown, field: string): AppEnvironment {
  if (typeof value !== "string" || !APP_ENVIRONMENT_SET.has(value)) {
    reject(field, "INVALID_FORMAT");
  }
  return value as AppEnvironment;
}

function parseChainFamily(value: unknown, field: string): ChainFamily {
  if (typeof value !== "string" || !CHAIN_FAMILY_SET.has(value)) {
    reject(field, "INVALID_FORMAT");
  }
  return value as ChainFamily;
}

function parseInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const normalized =
    typeof value === "string" && /^[0-9]+$/.test(value) ? Number(value) : value;

  if (
    typeof normalized !== "number" ||
    !Number.isSafeInteger(normalized) ||
    normalized < minimum ||
    normalized > maximum
  ) {
    reject(field, "INVALID_FORMAT");
  }

  return normalized;
}

function parseUrl(
  value: unknown,
  field: string,
  requireHttps: boolean,
): string {
  if (typeof value !== "string") {
    reject(field, "INVALID_URL");
  }

  try {
    const parsed = new URL(value);
    const protocolAllowed = requireHttps
      ? parsed.protocol === "https:"
      : parsed.protocol === "http:" || parsed.protocol === "https:";

    if (!protocolAllowed || parsed.username || parsed.password) {
      reject(field, "INVALID_URL");
    }

    return parsed.toString();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    reject(field, "INVALID_URL");
  }
}

function parseNullableUrl(
  value: unknown,
  field: string,
  requireHttps: boolean,
): string | null {
  if (value === null) {
    return null;
  }
  return parseUrl(value, field, requireHttps);
}

function parsePattern(value: unknown, field: string, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) {
    reject(field, "INVALID_FORMAT");
  }
  return value;
}

function parseObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    reject(field, "INVALID_MANIFEST");
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  field: string,
  expectedKeys: readonly string[],
): void {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    reject(field, "INVALID_MANIFEST");
  }
}

function parseDeploymentContract(
  value: unknown,
  field: string,
  requireHttps: boolean,
): DeploymentContract {
  const contract = parseObject(value, field);
  assertExactKeys(contract, field, [
    "address",
    "deploymentBlock",
    "transactionHash",
    "abiHash",
    "verifiedSourceUrl",
  ]);

  return {
    address: parsePattern(contract.address, `${field}.address`, EVM_ADDRESS),
    deploymentBlock: parseInteger(
      contract.deploymentBlock,
      `${field}.deploymentBlock`,
      0,
    ),
    transactionHash: parsePattern(
      contract.transactionHash,
      `${field}.transactionHash`,
      EVM_HASH,
    ),
    abiHash: parsePattern(contract.abiHash, `${field}.abiHash`, EVM_HASH),
    verifiedSourceUrl: parseNullableUrl(
      contract.verifiedSourceUrl,
      `${field}.verifiedSourceUrl`,
      requireHttps,
    ),
  };
}

function parseDeploymentToken(value: unknown, field: string): DeploymentToken {
  const token = parseObject(value, field);
  assertExactKeys(token, field, ["address", "decimals"]);

  return {
    address: parsePattern(token.address, `${field}.address`, EVM_ADDRESS),
    decimals: parseInteger(token.decimals, `${field}.decimals`, 0, 255),
  };
}

export function parseDeploymentManifest(value: unknown): DeploymentManifest {
  const manifest = parseObject(value, "DEPLOYMENT_MANIFEST_JSON");
  assertExactKeys(manifest, "DEPLOYMENT_MANIFEST_JSON", [
    "schemaVersion",
    "environment",
    "sourceCommit",
    "chainFamily",
    "chainId",
    "deployer",
    "deployedAt",
    "contracts",
    "tokens",
  ]);

  if (manifest.schemaVersion !== 1) {
    reject("DEPLOYMENT_MANIFEST_JSON.schemaVersion", "INVALID_MANIFEST");
  }

  const environment = parseAppEnvironment(
    manifest.environment,
    "DEPLOYMENT_MANIFEST_JSON.environment",
  );
  const chainFamily = parseChainFamily(
    manifest.chainFamily,
    "DEPLOYMENT_MANIFEST_JSON.chainFamily",
  );
  const expectedFamily: ChainFamily =
    environment === "local" ? "local" : "monad";
  if (chainFamily !== expectedFamily) {
    reject("DEPLOYMENT_MANIFEST_JSON.chainFamily", "NETWORK_MISMATCH");
  }
  const requireHttps = environment !== "local";
  const contracts = parseObject(
    manifest.contracts,
    "DEPLOYMENT_MANIFEST_JSON.contracts",
  );
  const tokens = parseObject(
    manifest.tokens,
    "DEPLOYMENT_MANIFEST_JSON.tokens",
  );
  assertExactKeys(contracts, "DEPLOYMENT_MANIFEST_JSON.contracts", [
    "ClarioRegistry",
  ]);
  assertExactKeys(tokens, "DEPLOYMENT_MANIFEST_JSON.tokens", ["USDC"]);

  const deployedAt = parsePattern(
    manifest.deployedAt,
    "DEPLOYMENT_MANIFEST_JSON.deployedAt",
    ISO_TIMESTAMP,
  );
  if (Number.isNaN(Date.parse(deployedAt))) {
    reject("DEPLOYMENT_MANIFEST_JSON.deployedAt", "INVALID_FORMAT");
  }

  return {
    schemaVersion: 1,
    environment,
    sourceCommit: parsePattern(
      manifest.sourceCommit,
      "DEPLOYMENT_MANIFEST_JSON.sourceCommit",
      SOURCE_COMMIT,
    ),
    chainFamily,
    chainId: parseInteger(
      manifest.chainId,
      "DEPLOYMENT_MANIFEST_JSON.chainId",
      1,
    ),
    deployer: parsePattern(
      manifest.deployer,
      "DEPLOYMENT_MANIFEST_JSON.deployer",
      EVM_ADDRESS,
    ),
    deployedAt,
    contracts: {
      ClarioRegistry: parseDeploymentContract(
        contracts.ClarioRegistry,
        "DEPLOYMENT_MANIFEST_JSON.contracts.ClarioRegistry",
        requireHttps,
      ),
    },
    tokens: {
      USDC: parseDeploymentToken(
        tokens.USDC,
        "DEPLOYMENT_MANIFEST_JSON.tokens.USDC",
      ),
    },
  };
}

function parseManifestEnvironmentValue(
  environment: EnvironmentSource,
): DeploymentManifest | null {
  const encoded = optionalEnvironmentValue(
    environment,
    "DEPLOYMENT_MANIFEST_JSON",
  );
  if (!encoded) {
    return null;
  }

  try {
    return parseDeploymentManifest(JSON.parse(encoded) as unknown);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    reject("DEPLOYMENT_MANIFEST_JSON", "INVALID_MANIFEST");
  }
}

const ALLOWED_CLIENT_PUBLIC_ENV = new Set([
  "NEXT_PUBLIC_PRIVY_APP_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_CLARIO_REGISTRY_ADDRESS",
  "NEXT_PUBLIC_MONAD_CHAIN_ID",
  "NEXT_PUBLIC_MONAD_TESTNET_RPC",
  "NEXT_PUBLIC_VERCEL_URL",
  "NEXT_PUBLIC_VERCEL_ENV",
  "NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL",
  "NEXT_PUBLIC_VERCEL_BRANCH_URL",
]);

function rejectUnsafePublicEnvironment(environment: EnvironmentSource): void {
  for (const [field, value] of Object.entries(environment)) {
    if (ALLOWED_CLIENT_PUBLIC_ENV.has(field)) {
      continue;
    }
    if (field.startsWith("NEXT_PUBLIC_") && value?.trim()) {
      reject(field, "PUBLIC_ENV_FORBIDDEN");
    }
  }

  for (const field of DIRECT_ADDRESS_FIELDS) {
    if (optionalEnvironmentValue(environment, field)) {
      reject(field, "ADDRESS_OUTSIDE_MANIFEST");
    }
  }
}

export function parseServerConfiguration(
  environment: EnvironmentSource,
): ServerConfiguration {
  rejectUnsafePublicEnvironment(environment);

  const appEnvironment = parseAppEnvironment(
    requiredEnvironmentValue(environment, "APP_ENV"),
    "APP_ENV",
  );
  const chainFamily = parseChainFamily(
    requiredEnvironmentValue(environment, "CHAIN_FAMILY"),
    "CHAIN_FAMILY",
  );
  const expectedFamily: ChainFamily =
    appEnvironment === "local" ? "local" : "monad";
  if (chainFamily !== expectedFamily) {
    reject("CHAIN_FAMILY", "NETWORK_MISMATCH");
  }

  const requireHttps = appEnvironment !== "local";
  const chainId = parseInteger(
    requiredEnvironmentValue(environment, "MONAD_CHAIN_ID"),
    "MONAD_CHAIN_ID",
    1,
  );
  const rpcUrl = parseUrl(
    requiredEnvironmentValue(environment, "MONAD_RPC_URL"),
    "MONAD_RPC_URL",
    requireHttps,
  );
  const fallbackValue = optionalEnvironmentValue(
    environment,
    "MONAD_RPC_FALLBACK_URL",
  );
  const rpcFallbackUrl = fallbackValue
    ? parseUrl(fallbackValue, "MONAD_RPC_FALLBACK_URL", requireHttps)
    : null;
  if (rpcFallbackUrl === rpcUrl) {
    reject("MONAD_RPC_FALLBACK_URL", "NETWORK_MISMATCH");
  }

  const explorerValue = optionalEnvironmentValue(
    environment,
    "MONAD_EXPLORER_URL",
  );
  if (requireHttps && !explorerValue) {
    reject("MONAD_EXPLORER_URL", "MISSING_VALUE");
  }
  const explorerUrl = explorerValue
    ? parseUrl(explorerValue, "MONAD_EXPLORER_URL", requireHttps)
    : null;

  const sourceCommit = optionalEnvironmentValue(environment, "SOURCE_COMMIT");
  if (requireHttps && !sourceCommit) {
    reject("SOURCE_COMMIT", "MISSING_VALUE");
  }
  if (sourceCommit) {
    parsePattern(sourceCommit, "SOURCE_COMMIT", SOURCE_COMMIT);
  }

  const deployment = parseManifestEnvironmentValue(environment);
  if (requireHttps && !deployment) {
    reject("DEPLOYMENT_MANIFEST_JSON", "MISSING_VALUE");
  }

  if (deployment) {
    if (deployment.environment !== appEnvironment) {
      reject("DEPLOYMENT_MANIFEST_JSON.environment", "ENVIRONMENT_MISMATCH");
    }
    if (
      deployment.chainFamily !== chainFamily ||
      deployment.chainId !== chainId
    ) {
      reject("DEPLOYMENT_MANIFEST_JSON.chainId", "NETWORK_MISMATCH");
    }
    if (sourceCommit && deployment.sourceCommit !== sourceCommit) {
      reject("DEPLOYMENT_MANIFEST_JSON.sourceCommit", "ENVIRONMENT_MISMATCH");
    }
  }

  return {
    environment: appEnvironment,
    sourceCommit,
    chain: {
      family: chainFamily,
      chainId,
      rpcUrl,
      rpcFallbackUrl,
      explorerUrl,
    },
    deployment,
  };
}

export function toPublicConfiguration(
  configuration: ServerConfiguration,
): PublicConfiguration {
  const deployment = configuration.deployment;
  return {
    environment: configuration.environment,
    chain: {
      family: configuration.chain.family,
      chainId: configuration.chain.chainId,
      explorerUrl: configuration.chain.explorerUrl,
    },
    deployment: deployment
      ? {
          registryAddress: deployment.contracts.ClarioRegistry.address,
          settlementToken: {
            address: deployment.tokens.USDC.address,
            decimals: deployment.tokens.USDC.decimals,
          },
        }
      : null,
  };
}
