"use client";

import { getSupabaseClient } from "@/lib/supabase/client";

const NICKNAME_MAP_KEY = "clario_wallet_nicknames";
const NICKNAME_EVENT_NAME = "clario_nickname_updated";

/**
 * Normalizes an EVM address for consistent keying
 */
function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Gets all saved wallet nicknames from localStorage
 */
export function getAllNicknames(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(NICKNAME_MAP_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Gets the custom nickname for a specific wallet address
 */
export function getWalletNickname(address?: string | null): string | null {
  if (!address || typeof window === "undefined") return null;
  const map = getAllNicknames();
  const normalized = normalizeAddress(address);
  return map[normalized] || map[address] || null;
}

/**
 * Sets a custom nickname for a wallet address and persists to localStorage and Supabase
 */
export function setWalletNickname(
  address: string,
  nickname: string,
  userId?: string | null,
): void {
  if (!address || typeof window === "undefined") return;
  const trimmed = nickname.trim();
  const normalized = normalizeAddress(address);
  const map = getAllNicknames();

  if (trimmed) {
    map[normalized] = trimmed;
    map[address] = trimmed;
  } else {
    delete map[normalized];
    delete map[address];
  }

  try {
    localStorage.setItem(NICKNAME_MAP_KEY, JSON.stringify(map));
    if (userId) {
      localStorage.setItem(`clario_user_nickname_${userId}`, trimmed);
    }
    // Also save global active nickname fallback
    localStorage.setItem("clario_active_nickname", trimmed);

    // Sync with Supabase profile if possible
    if (userId || address) {
      const targetId = userId || address;
      try {
        const supabase = getSupabaseClient(targetId);
        Promise.resolve(
          supabase.from("profiles").upsert({
            id: targetId,
            display_name: trimmed || null,
            updated_at: new Date().toISOString(),
          }),
        ).catch(() => {});
      } catch {
        // Ignore offline sync errors
      }
    }
  } catch (err) {
    console.warn("Could not save wallet nickname:", err);
  }

  // Broadcast event for all reactive subscribers
  window.dispatchEvent(
    new CustomEvent(NICKNAME_EVENT_NAME, {
      detail: { address, normalized, nickname: trimmed },
    }),
  );
}

/**
 * Removes a custom nickname for a wallet address
 */
export function removeWalletNickname(
  address: string,
  userId?: string | null,
): void {
  setWalletNickname(address, "", userId);
}

/**
 * Subscribes to nickname updates across components and browser tabs
 */
export function subscribeNicknameUpdates(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleCustomEvent = () => callback();
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === NICKNAME_MAP_KEY || e.key?.startsWith("clario_")) {
      callback();
    }
  };

  window.addEventListener(NICKNAME_EVENT_NAME, handleCustomEvent);
  window.addEventListener("storage", handleStorageEvent);

  return () => {
    window.removeEventListener(NICKNAME_EVENT_NAME, handleCustomEvent);
    window.removeEventListener("storage", handleStorageEvent);
  };
}
