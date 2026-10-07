import {
  parseServerConfiguration,
  toPublicConfiguration,
  type PublicConfiguration,
  type ServerConfiguration,
} from "./schema";

let cachedServerConfiguration: ServerConfiguration | undefined;

export function getServerConfiguration(): ServerConfiguration {
  if (!cachedServerConfiguration) {
    try {
      cachedServerConfiguration = parseServerConfiguration(process.env);
    } catch {
      // In hosted environments (e.g. Vercel) where full manifest or strict env vars are deferred,
      // provide a safe fallback ServerConfiguration so routes and services continue serving.
      const isLocal = process.env.APP_ENV === "local";
      const chainFamily = isLocal ? "local" : "monad";
      const chainId = Number(
        process.env.MONAD_CHAIN_ID ||
          process.env.NEXT_PUBLIC_MONAD_CHAIN_ID ||
          (isLocal ? 31337 : 10143),
      );
      const rpcUrl =
        process.env.MONAD_RPC_URL ||
        process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC ||
        (isLocal ? "http://127.0.0.1:8545" : "https://testnet-rpc.monad.xyz");
      const explorerUrl =
        process.env.MONAD_EXPLORER_URL ||
        (isLocal ? null : "https://testnet.monadexplorer.com");

      cachedServerConfiguration = {
        environment:
          (process.env.APP_ENV as ServerConfiguration["environment"]) ||
          (isLocal ? "local" : "production"),
        sourceCommit:
          process.env.SOURCE_COMMIT ||
          process.env.VERCEL_GIT_COMMIT_SHA ||
          null,
        chain: {
          family: chainFamily,
          chainId,
          rpcUrl,
          rpcFallbackUrl: process.env.MONAD_RPC_FALLBACK_URL || null,
          explorerUrl,
        },
        deployment: null,
      };
    }
  }
  return cachedServerConfiguration;
}

export function getPublicConfiguration(): PublicConfiguration {
  return toPublicConfiguration(getServerConfiguration());
}
