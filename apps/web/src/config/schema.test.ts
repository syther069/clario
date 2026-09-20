import { describe, expect, it } from "vitest";

import {
  ConfigurationError,
  parseDeploymentManifest,
  parseServerConfiguration,
  toPublicConfiguration,
  type AppEnvironment,
  type EnvironmentSource,
} from "./schema";

const TEST_SOURCE_COMMIT = "a".repeat(40);
const TEST_DEPLOYER_ADDRESS = `0x${"1".repeat(40)}`;
const TEST_REGISTRY_ADDRESS = `0x${"2".repeat(40)}`;
const TEST_USDC_ADDRESS = `0x${"3".repeat(40)}`;
const TEST_TRANSACTION_HASH = `0x${"4".repeat(64)}`;
const TEST_ABI_HASH = `0x${"5".repeat(64)}`;

function localEnvironment(
  overrides: EnvironmentSource = {},
): EnvironmentSource {
  return {
    APP_ENV: "local",
    CHAIN_FAMILY: "local",
    MONAD_CHAIN_ID: "31337",
    MONAD_RPC_URL: "http://127.0.0.1:8545",
    ...overrides,
  };
}

function deploymentManifest(environment: AppEnvironment = "preview") {
  return {
    schemaVersion: 1,
    environment,
    sourceCommit: TEST_SOURCE_COMMIT,
    chainFamily: environment === "local" ? "local" : "monad",
    chainId: 10143,
    deployer: TEST_DEPLOYER_ADDRESS,
    deployedAt: "2026-09-15T12:00:00Z",
    contracts: {
      ClarioRegistry: {
        address: TEST_REGISTRY_ADDRESS,
        deploymentBlock: 42,
        transactionHash: TEST_TRANSACTION_HASH,
        abiHash: TEST_ABI_HASH,
        verifiedSourceUrl: "https://explorer.invalid/address/test",
      },
    },
    tokens: {
      USDC: {
        address: TEST_USDC_ADDRESS,
        decimals: 6,
      },
    },
  };
}

function hostedEnvironment(
  overrides: EnvironmentSource = {},
): EnvironmentSource {
  return {
    APP_ENV: "preview",
    CHAIN_FAMILY: "monad",
    MONAD_CHAIN_ID: "10143",
    MONAD_RPC_URL: "https://rpc.invalid/test",
    MONAD_RPC_FALLBACK_URL: "https://rpc-fallback.invalid/test",
    MONAD_EXPLORER_URL: "https://explorer.invalid/",
    SOURCE_COMMIT: TEST_SOURCE_COMMIT,
    DEPLOYMENT_MANIFEST_JSON: JSON.stringify(deploymentManifest()),
    ...overrides,
  };
}

function expectConfigurationError(
  environment: EnvironmentSource,
  field: string,
  code: ConfigurationError["code"],
): void {
  try {
    parseServerConfiguration(environment);
    throw new Error("Expected configuration parsing to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigurationError);
    expect(error).toMatchObject({ field, code });
    expect((error as Error).message).not.toContain(
      environment[field] ?? "value-not-present",
    );
  }
}

describe("parseServerConfiguration", () => {
  it("accepts an isolated local environment without deployment addresses", () => {
    const configuration = parseServerConfiguration(localEnvironment());

    expect(configuration).toMatchObject({
      environment: "local",
      sourceCommit: null,
      chain: {
        family: "local",
        chainId: 31337,
        rpcUrl: "http://127.0.0.1:8545/",
        rpcFallbackUrl: null,
        explorerUrl: null,
      },
      deployment: null,
    });
  });

  it("accepts a complete hosted environment matching its manifest", () => {
    const configuration = parseServerConfiguration(hostedEnvironment());

    expect(configuration.environment).toBe("preview");
    expect(configuration.deployment?.contracts.ClarioRegistry.address).toBe(
      TEST_REGISTRY_ADDRESS,
    );
  });

  it.each(["APP_ENV", "CHAIN_FAMILY", "MONAD_CHAIN_ID", "MONAD_RPC_URL"])(
    "rejects missing required field %s",
    (field) => {
      expectConfigurationError(
        localEnvironment({ [field]: undefined }),
        field,
        "MISSING_VALUE",
      );
    },
  );

  it("does not infer chain configuration from a hostname", () => {
    expectConfigurationError(
      { APP_ENV: "preview", HOSTNAME: "preview.clario.invalid" },
      "CHAIN_FAMILY",
      "MISSING_VALUE",
    );
  });

  it.each([
    ["local", "monad"],
    ["preview", "local"],
    ["staging", "local"],
    ["production", "local"],
  ])("rejects %s with the %s chain family", (appEnvironment, chainFamily) => {
    expectConfigurationError(
      localEnvironment({ APP_ENV: appEnvironment, CHAIN_FAMILY: chainFamily }),
      "CHAIN_FAMILY",
      "NETWORK_MISMATCH",
    );
  });

  it.each(["0", "1.5", "not-a-chain", "9007199254740992"])(
    "rejects malformed chain ID %s",
    (chainId) => {
      expectConfigurationError(
        localEnvironment({ MONAD_CHAIN_ID: chainId }),
        "MONAD_CHAIN_ID",
        "INVALID_FORMAT",
      );
    },
  );

  it("requires HTTPS outside local development", () => {
    expectConfigurationError(
      hostedEnvironment({ MONAD_RPC_URL: "http://rpc.invalid/test" }),
      "MONAD_RPC_URL",
      "INVALID_URL",
    );
  });

  it("rejects a duplicate fallback RPC", () => {
    expectConfigurationError(
      localEnvironment({
        MONAD_RPC_FALLBACK_URL: "http://127.0.0.1:8545",
      }),
      "MONAD_RPC_FALLBACK_URL",
      "NETWORK_MISMATCH",
    );
  });

  it.each(["preview", "staging", "production"])(
    "requires a manifest for %s",
    (appEnvironment) => {
      expectConfigurationError(
        hostedEnvironment({
          APP_ENV: appEnvironment,
          DEPLOYMENT_MANIFEST_JSON: undefined,
        }),
        "DEPLOYMENT_MANIFEST_JSON",
        "MISSING_VALUE",
      );
    },
  );

  it("rejects an environment-mixed deployment manifest", () => {
    expectConfigurationError(
      hostedEnvironment({
        DEPLOYMENT_MANIFEST_JSON: JSON.stringify(deploymentManifest("staging")),
      }),
      "DEPLOYMENT_MANIFEST_JSON.environment",
      "ENVIRONMENT_MISMATCH",
    );
  });

  it("rejects a chain-mixed deployment manifest", () => {
    const manifest = { ...deploymentManifest(), chainId: 1 };
    expectConfigurationError(
      hostedEnvironment({ DEPLOYMENT_MANIFEST_JSON: JSON.stringify(manifest) }),
      "DEPLOYMENT_MANIFEST_JSON.chainId",
      "NETWORK_MISMATCH",
    );
  });

  it("rejects a source-mixed deployment manifest", () => {
    expectConfigurationError(
      hostedEnvironment({ SOURCE_COMMIT: "b".repeat(40) }),
      "DEPLOYMENT_MANIFEST_JSON.sourceCommit",
      "ENVIRONMENT_MISMATCH",
    );
  });

  it.each(["CLARIO_REGISTRY_ADDRESS", "USDC_ADDRESS"])(
    "rejects direct address variable %s",
    (field) => {
      expectConfigurationError(
        localEnvironment({ [field]: TEST_REGISTRY_ADDRESS }),
        field,
        "ADDRESS_OUTSIDE_MANIFEST",
      );
    },
  );

  it.each(["NEXT_PUBLIC_RPC_URL", "NEXT_PUBLIC_API_SECRET"])(
    "rejects frontend environment disclosure %s",
    (field) => {
      expectConfigurationError(
        localEnvironment({ [field]: "must-not-be-public" }),
        field,
        "PUBLIC_ENV_FORBIDDEN",
      );
    },
  );

  it("returns safe errors without rejected values", () => {
    const privateValue = "https://user:private-value@rpc.invalid";
    expectConfigurationError(
      localEnvironment({ MONAD_RPC_URL: privateValue }),
      "MONAD_RPC_URL",
      "INVALID_URL",
    );
  });
});

describe("deployment manifest", () => {
  it("rejects unknown fields and malformed addresses", () => {
    expect(() =>
      parseDeploymentManifest({
        ...deploymentManifest(),
        undocumented: true,
      }),
    ).toThrowError(/INVALID_MANIFEST/);

    const manifest = deploymentManifest();
    expect(() =>
      parseDeploymentManifest({
        ...manifest,
        deployer: "not-an-address",
      }),
    ).toThrowError(/INVALID_FORMAT/);
  });

  it("rejects a chain family that conflicts with its environment", () => {
    const manifest = deploymentManifest("local");
    expect(() =>
      parseDeploymentManifest({ ...manifest, chainFamily: "monad" }),
    ).toThrowError(/NETWORK_MISMATCH/);
  });

  it("is the only source for public addresses and excludes server URLs", () => {
    const serverConfiguration = parseServerConfiguration(hostedEnvironment());
    const publicConfiguration = toPublicConfiguration(serverConfiguration);

    expect(publicConfiguration.deployment).toEqual({
      registryAddress: TEST_REGISTRY_ADDRESS,
      settlementToken: {
        address: TEST_USDC_ADDRESS,
        decimals: 6,
      },
    });
    expect(publicConfiguration).not.toHaveProperty("chain.rpcUrl");
    expect(JSON.stringify(publicConfiguration)).not.toContain("rpc.invalid");
  });
});
