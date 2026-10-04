"use client";

import {
  usePrivy,
  useWallets,
  useActiveWallet,
  useLogin,
  useLogout,
  useConnectWallet,
  useLinkAccount,
  useUnlinkWallet,
  useSetWalletRecovery,
  useExportWallet,
  getEmbeddedConnectedWallet,
  type ConnectedWallet,
} from "@privy-io/react-auth";
import { useMemo, useCallback } from "react";

export function useClarioAuth() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { wallet: activeConnectedWallet, setActiveWallet } = useActiveWallet();
  const { connectWallet } = useConnectWallet();
  const {
    linkWallet,
    linkEmail,
    linkGoogle,
    linkPasskey,
    linkPhone,
  } = useLinkAccount();
  const { unlink } = useUnlinkWallet();
  const { setWalletRecovery } = useSetWalletRecovery();
  const { exportWallet } = useExportWallet();

  // Find embedded wallet using official Privy helper + fallback to walletClientType === "privy"
  const embeddedWallet: ConnectedWallet | null = useMemo(() => {
    return (
      getEmbeddedConnectedWallet(wallets) ||
      wallets.find((w) => w.walletClientType === "privy") ||
      null
    );
  }, [wallets]);

  // Find embedded wallet address
  const embeddedWalletAddress: string | null = useMemo(() => {
    if (
      embeddedWallet?.address &&
      /^0x[a-fA-F0-9]{40}$/.test(embeddedWallet.address)
    ) {
      return embeddedWallet.address;
    }
    if (
      user?.wallet &&
      user.wallet.walletClientType === "privy" &&
      typeof user.wallet.address === "string" &&
      /^0x[a-fA-F0-9]{40}$/.test(user.wallet.address)
    ) {
      return user.wallet.address;
    }
    if (user?.linkedAccounts) {
      const embeddedAcc = user.linkedAccounts.find((a) => {
        if (a.type !== "wallet") return false;
        const w = a as { walletClientType?: string; address?: string };
        return (
          w.walletClientType === "privy" &&
          typeof w.address === "string" &&
          /^0x[a-fA-F0-9]{40}$/.test(w.address)
        );
      });
      if (embeddedAcc) {
        return (embeddedAcc as { address: string }).address;
      }
    }
    return null;
  }, [embeddedWallet, user]);

  // External EVM wallets (MetaMask, Coinbase, Rainbow, Rabby, etc.)
  const externalEvmWallets = useMemo(() => {
    return wallets.filter((w) => {
      const isNotPrivy = w.walletClientType !== "privy";
      const isEthereum =
        (w as { chainType?: string }).chainType === "ethereum" ||
        w.type === "ethereum" ||
        !w.type;
      return isNotPrivy && isEthereum;
    });
  }, [wallets]);

  const externalEvmWallet: ConnectedWallet | null = useMemo(() => {
    return externalEvmWallets[0] || null;
  }, [externalEvmWallets]);

  // Active wallet: honor useActiveWallet(), fallback to embedded or first external
  const activeWallet: ConnectedWallet | null = useMemo(() => {
    if (activeConnectedWallet && "getEthereumProvider" in activeConnectedWallet) {
      return activeConnectedWallet as ConnectedWallet;
    }
    if (embeddedWallet) return embeddedWallet;
    if (externalEvmWallet) return externalEvmWallet;
    return wallets[0] || null;
  }, [activeConnectedWallet, embeddedWallet, externalEvmWallet, wallets]);

  // Active wallet address (Both embedded and external are valid EVM addresses)
  const activeWalletAddress: string | null = useMemo(() => {
    const addr =
      activeWallet?.address ||
      embeddedWalletAddress ||
      externalEvmWallet?.address ||
      (user?.wallet?.address && /^0x[a-fA-F0-9]{40}$/.test(user.wallet.address)
        ? user.wallet.address
        : null);
    if (addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return addr;
    }
    return null;
  }, [activeWallet, embeddedWalletAddress, externalEvmWallet, user]);

  // Critical fix: connectedEvmAddress returns activeWalletAddress
  const connectedEvmAddress: string | null = activeWalletAddress;
  const primaryWalletAddress: string | null = activeWalletAddress;

  // Has ANY connected EVM wallet (embedded or external)
  const hasConnectedEvmWallet: boolean = Boolean(activeWalletAddress);
  const hasAnyWallet: boolean = Boolean(activeWalletAddress);

  // Is active wallet the embedded one?
  const isActiveWalletEmbedded: boolean = Boolean(
    activeWallet && activeWallet.walletClientType === "privy",
  );

  // Are all wallets embedded? (User has not connected external wallet yet)
  const isEmbeddedWalletOnly: boolean = Boolean(
    embeddedWalletAddress && externalEvmWallets.length === 0,
  );

  // Login hook
  const { login } = useLogin({
    onComplete: (params) => {
      console.log("[Clario Auth] Login completed:", params.loginMethod);
    },
    onError: (err) => {
      console.warn("[Clario Auth] Login error/cancellation:", err);
    },
  });

  // Logout hook with backend session clearance
  const { logout: privyLogout } = useLogout({
    onSuccess: () => {
      console.log("[Clario Auth] Logged out from Privy");
    },
  });

  const logout = useCallback(async () => {
    try {
      // Clear server-side session cookie
      await fetch("/api/auth/logout", {
        credentials: "same-origin",
        method: "POST",
      }).catch(() => {});
    } finally {
      await privyLogout();
    }
  }, [privyLogout]);

  const unlinkWallet = useCallback(
    async (address: string) => {
      await unlink({ address });
    },
    [unlink],
  );

  // Connect or link EVM wallet
  const connectEvmWallet = useCallback(() => {
    if (authenticated) {
      try {
        linkWallet();
      } catch {
        connectWallet();
      }
    } else {
      login();
    }
  }, [authenticated, linkWallet, connectWallet, login]);

  // Helper to switch chain on active wallet
  const switchChain = useCallback(
    async (chainId: number) => {
      if (activeWallet && typeof activeWallet.switchChain === "function") {
        await activeWallet.switchChain(chainId);
      }
    },
    [activeWallet],
  );

  // Primary display identifier
  const displayName: string = useMemo(() => {
    if (!user) return "Guest";
    if (user.google?.name) return user.google.name;
    if (user.email?.address) {
      const prefix = user.email.address.split("@")[0];
      if (prefix) return prefix;
    }
    if (activeWalletAddress) {
      return `${activeWalletAddress.slice(0, 6)}...${activeWalletAddress.slice(-4)}`;
    }
    return `User ${user.id.slice(10, 16)}`;
  }, [user, activeWalletAddress]);

  const primaryEmail = user?.email?.address || user?.google?.email || null;

  return {
    isReady: ready,
    isAuthenticated: authenticated,
    user,
    displayName,
    primaryEmail,
    primaryWalletAddress,
    activeWalletAddress,
    activeWallet,
    embeddedWalletAddress,
    embeddedWallet,
    externalEvmWallet,
    externalEvmWallets,
    hasConnectedEvmWallet,
    connectedEvmAddress,
    isActiveWalletEmbedded,
    isEmbeddedWalletOnly,
    hasAnyWallet,
    wallets,
    login,
    logout,
    connectWallet,
    linkWallet,
    linkEmail,
    linkGoogle,
    linkPasskey,
    linkPhone,
    unlinkWallet,
    setWalletRecovery,
    exportWallet,
    connectEvmWallet,
    setActiveWallet,
    switchChain,
    getAccessToken,
  };
}
