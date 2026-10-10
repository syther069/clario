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
  useUnlinkEmail,
  useUnlinkOAuth,
  useUnlinkPasskey,
  useSetWalletRecovery,
  useExportWallet,
  useDelegatedActions,
  useFundWallet,
  getEmbeddedConnectedWallet,
  type ConnectedWallet,
} from "@privy-io/react-auth";
import { useMemo, useCallback, useState, useEffect } from "react";
import {
  getWalletNickname,
  setWalletNickname as setWalletNicknameStorage,
  subscribeNicknameUpdates,
  getAllNicknames,
} from "./nickname-storage";

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
  const { unlink: unlinkWalletRaw } = useUnlinkWallet();
  const { unlink: unlinkEmailRaw } = useUnlinkEmail();
  const { unlink: unlinkOAuthRaw } = useUnlinkOAuth();
  const { unlink: unlinkPasskeyRaw } = useUnlinkPasskey();
  const { setWalletRecovery } = useSetWalletRecovery();
  const { exportWallet } = useExportWallet();
  const { delegateWallet, revokeWallets } = useDelegatedActions();
  const { fundWallet } = useFundWallet();

  // Reactive nickname state
  const [nicknames, setNicknames] = useState<Record<string, string>>(() =>
    getAllNicknames(),
  );

  useEffect(() => {
    return subscribeNicknameUpdates(() => {
      setNicknames(getAllNicknames());
    });
  }, []);

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

  // Has ANY connected EVM wallet (MetaMask, Coinbase, Rabby, or Embedded Privy wallet)
  const hasConnectedEvmWallet: boolean = useMemo(() => {
    if (externalEvmWallets.length > 0) return true;
    if (activeConnectedWallet) return true;
    if (embeddedWallet) return true;
    return false;
  }, [externalEvmWallets, activeConnectedWallet, embeddedWallet]);

  const hasAnyWallet: boolean = hasConnectedEvmWallet;

  // Active wallet: prioritize active connected wallet, then first external wallet, then embedded wallet
  const activeWallet: ConnectedWallet | null = useMemo(() => {
    if (
      activeConnectedWallet &&
      "getEthereumProvider" in activeConnectedWallet
    ) {
      return activeConnectedWallet as ConnectedWallet;
    }
    if (externalEvmWallet) return externalEvmWallet;
    if (embeddedWallet) return embeddedWallet;
    return null;
  }, [activeConnectedWallet, externalEvmWallet, embeddedWallet]);

  // Active connected EVM wallet address - strictly null for email-only users without any wallet
  const connectedEvmAddress: string | null = useMemo(() => {
    if (!hasConnectedEvmWallet) return null;
    const addr =
      activeWallet?.address ||
      externalEvmWallet?.address ||
      embeddedWalletAddress ||
      (activeConnectedWallet ? activeConnectedWallet.address : null);
    if (addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return addr;
    }
    return null;
  }, [hasConnectedEvmWallet, activeWallet, externalEvmWallet, embeddedWalletAddress, activeConnectedWallet]);

  const activeWalletAddress: string | null = connectedEvmAddress;
  const primaryWalletAddress: string | null = connectedEvmAddress;

  // True if user is signed in to Clario account (email/google) but has NO wallet connected
  const isEmailOnlyUser: boolean = Boolean(
    authenticated && !hasConnectedEvmWallet,
  );

  // Is active wallet the embedded one?
  const isActiveWalletEmbedded: boolean = useMemo(() => {
    return Boolean(
      activeWallet &&
        (activeWallet.walletClientType === "privy" ||
          (embeddedWalletAddress &&
            activeWallet.address.toLowerCase() === embeddedWalletAddress.toLowerCase())),
    );
  }, [activeWallet, embeddedWalletAddress]);

  // Are all wallets embedded? (User has not connected external wallet yet)
  const isEmbeddedWalletOnly: boolean = Boolean(
    embeddedWalletAddress && externalEvmWallets.length === 0,
  );

  // Account identity type
  const accountType: "email" | "google" | "wallet" | "passkey" | "anonymous" = useMemo(() => {
    if (!user) return "anonymous";
    if (user.google) return "google";
    if (user.email?.address) return "email";
    if (hasConnectedEvmWallet) return "wallet";
    if (user.linkedAccounts?.some((a) => a.type === "passkey")) return "passkey";
    return "email";
  }, [user, hasConnectedEvmWallet]);

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
      await unlinkWalletRaw({ address });
    },
    [unlinkWalletRaw],
  );

  const unlinkEmail = useCallback(
    async (address: string) => {
      await unlinkEmailRaw({ address });
    },
    [unlinkEmailRaw],
  );

  const unlinkGoogle = useCallback(
    async (subject?: string) => {
      const targetSubject =
        subject ||
        user?.google?.subject ||
        (
          user?.linkedAccounts?.find((a) => a.type === "google_oauth") as
            | { subject?: string }
            | undefined
        )?.subject;
      if (!targetSubject) return;
      await unlinkOAuthRaw({ provider: "google", subject: targetSubject });
    },
    [unlinkOAuthRaw, user],
  );

  // 1-Click Session Signing (Privy Delegated Actions)
  const isSessionDelegated = useMemo(() => {
    if (!user?.linkedAccounts) return false;
    return user.linkedAccounts.some(
      (a) =>
        a.type === "wallet" && (a as { delegated?: boolean }).delegated === true,
    );
  }, [user]);

  const canDelegate = Boolean(embeddedWalletAddress);

  const enableSessionSigning = useCallback(async () => {
    if (!embeddedWalletAddress) {
      throw new Error(
        "No embedded wallet found. Please sign in or create an embedded wallet.",
      );
    }
    await delegateWallet({
      address: embeddedWalletAddress,
      chainType: "ethereum",
    });
  }, [embeddedWalletAddress, delegateWallet]);

  const revokeSessionSigning = useCallback(async () => {
    await revokeWallets();
  }, [revokeWallets]);

  const unlinkPasskey = useCallback(
    async (credentialId?: string) => {
      const passkeyAcc = user?.linkedAccounts?.find((a) => a.type === "passkey") as
        | { credentialId?: string; id?: string }
        | undefined;
      const targetCredId = credentialId || passkeyAcc?.credentialId || passkeyAcc?.id;
      if (!targetCredId) return;
      await unlinkPasskeyRaw({ credentialId: targetCredId });
    },
    [unlinkPasskeyRaw, user],
  );

  // Connect or link EVM wallet
  const connectEvmWallet = useCallback(() => {
    if (authenticated) {
      try {
        connectWallet();
      } catch {
        linkWallet();
      }
    } else {
      login();
    }
  }, [authenticated, connectWallet, linkWallet, login]);

  // Disconnect EVM wallet
  const disconnectWallet = useCallback(
    async (address?: string) => {
      const targetAddress = address || connectedEvmAddress;
      const targetWallet = wallets.find(
        (w) => w.address.toLowerCase() === targetAddress?.toLowerCase(),
      );
      if (targetWallet && typeof targetWallet.disconnect === "function") {
        try {
          await targetWallet.disconnect();
        } catch (err) {
          console.warn("[Clario Auth] Wallet disconnect:", err);
        }
      }
      if (targetAddress) {
        try {
          await unlinkWalletRaw({ address: targetAddress });
        } catch {
          // May only be connected for this session rather than permanently linked
        }
      }
    },
    [connectedEvmAddress, wallets, unlinkWalletRaw],
  );

  // Helper to switch chain on active wallet
  const switchChain = useCallback(
    async (chainId: number) => {
      if (activeWallet && typeof activeWallet.switchChain === "function") {
        await activeWallet.switchChain(chainId);
      }
    },
    [activeWallet],
  );

  // Custom nickname for the current active wallet / user
  const activeNickname: string | null = useMemo(() => {
    if (activeWalletAddress) {
      const byAddr =
        nicknames[activeWalletAddress.toLowerCase()] ||
        nicknames[activeWalletAddress];
      if (byAddr) return byAddr;
    }
    if (user?.id && nicknames[`user_${user.id}`]) {
      return nicknames[`user_${user.id}`]!;
    }
    return getWalletNickname(activeWalletAddress);
  }, [activeWalletAddress, nicknames, user]);

  // Primary display identifier (Nickname > Google Name > Email Prefix > Wallet Address > User ID)
  const displayName: string = useMemo(() => {
    if (activeNickname) return activeNickname;
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
  }, [activeNickname, user, activeWalletAddress]);

  const setNickname = useCallback(
    (name: string, targetAddress?: string) => {
      const addr = targetAddress || activeWalletAddress;
      if (addr) {
        setWalletNicknameStorage(addr, name, user?.id);
      } else if (user?.id) {
        setWalletNicknameStorage(`user_${user.id}`, name, user.id);
      }
    },
    [activeWalletAddress, user],
  );

  const getNickname = useCallback(
    (address?: string) => {
      const addr = address || activeWalletAddress;
      if (!addr) return null;
      return (
        nicknames[addr.toLowerCase()] ||
        nicknames[addr] ||
        getWalletNickname(addr)
      );
    },
    [activeWalletAddress, nicknames],
  );

  const primaryEmail = user?.email?.address || user?.google?.email || null;

  return {
    isReady: ready,
    isAuthenticated: authenticated,
    user,
    accountType,
    isEmailOnlyUser,
    displayName,
    nickname: activeNickname,
    walletNicknames: nicknames,
    setNickname,
    getNickname,
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
    unlinkEmail,
    unlinkGoogle,
    unlinkPasskey,
    setWalletRecovery,
    exportWallet,
    connectEvmWallet,
    disconnectWallet,
    setActiveWallet,
    switchChain,
    getAccessToken,
    isSessionDelegated,
    canDelegate,
    enableSessionSigning,
    revokeSessionSigning,
    fundWallet,
  };
}
