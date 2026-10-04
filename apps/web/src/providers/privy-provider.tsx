"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { defineChain } from "viem";
import {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  sepolia,
  baseSepolia,
} from "viem/chains";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "MonadExplorer",
      url: "https://testnet.monadexplorer.com",
    },
  },
  testnet: true,
});

export const monadMainnet = defineChain({
  id: 143,
  name: "Monad Mainnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "MonadExplorer",
      url: "https://monadexplorer.com",
    },
  },
  testnet: false,
});

export const ethereumMainnet = defineChain({
  ...mainnet,
  testnet: false,
});

export const baseMainnet = defineChain({
  ...base,
  testnet: false,
});

export const arbitrumMainnet = defineChain({
  ...arbitrum,
  testnet: false,
});

export const optimismMainnet = defineChain({
  ...optimism,
  testnet: false,
});

export const polygonMainnet = defineChain({
  ...polygon,
  testnet: false,
});

export const sepoliaTestnet = defineChain({
  ...sepolia,
  testnet: true,
});

export const baseSepoliaTestnet = defineChain({
  ...baseSepolia,
  testnet: true,
});

export const ALL_SUPPORTED_CHAINS = [
  monadTestnet,
  monadMainnet,
  ethereumMainnet,
  baseMainnet,
  arbitrumMainnet,
  optimismMainnet,
  polygonMainnet,
  sepoliaTestnet,
  baseSepoliaTestnet,
] as const;

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const firstArg = typeof args[0] === "string" ? args[0] : "";
    if (
      firstArg.includes(
        'Each child in a list should have a unique "key" prop',
      ) &&
      args.some(
        (arg) =>
          typeof arg === "string" &&
          (arg.includes("xe") ||
            arg.includes("ClarioPrivyProvider") ||
            arg.includes("PrivyProvider")),
      )
    ) {
      return;
    }
    originalError(...args);
  };
}

export function ClarioPrivyProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#836EF9",
          showWalletLoginFirst: true,
          landingHeader: "Connect to Clario",
          loginMessage: "Verifiable Expense & Identity Protocol on Monad",
          walletList: [
            "detected_wallets",
            "metamask",
            "coinbase_wallet",
            "rainbow",
            "rabby_wallet",
            "wallet_connect",
          ],
        },
        defaultChain: monadTestnet,
        supportedChains: [
          monadTestnet,
          monadMainnet,
          ethereumMainnet,
          baseMainnet,
          arbitrumMainnet,
          optimismMainnet,
          polygonMainnet,
          sepoliaTestnet,
          baseSepoliaTestnet,
        ],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        loginMethods: ["wallet", "email", "google", "passkey"],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
