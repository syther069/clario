"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "./client";
import type {
  Profile,
  FinancialAccount,
  Transaction,
  Subscription,
  Budget,
  FinancialGoal,
  PlatformMode,
} from "./types";
import { useClarioAuth } from "../auth/use-clario-auth";

export function useSupabaseData() {
  const {
    isAuthenticated,
    user,
    displayName,
    primaryEmail,
    primaryWalletAddress,
  } = useClarioAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSchemaReady, setIsSchemaReady] = useState<boolean | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const activeUserId = user?.id || primaryWalletAddress || null;

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      if (!isAuthenticated || !activeUserId) return;

      try {
        setLoading(true);
        setError(null);

        const supabase = getSupabaseClient(activeUserId);

        // Attempt to query profile
        const { data: existingProfile, error: fetchErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", activeUserId)
          .maybeSingle();

        if (ignore) return;

        if (fetchErr) {
          if (fetchErr.code === "PGRST205") {
            setIsSchemaReady(false);
            setError(
              "Supabase schema tables not found. Run 001_universal_financial_schema.sql in your Supabase SQL Editor.",
            );
            return;
          }
          throw fetchErr;
        }

        setIsSchemaReady(true);

        if (existingProfile) {
          setProfile(existingProfile as Profile);
        } else {
          const newProfile: Partial<Profile> = {
            id: activeUserId,
            email: primaryEmail,
            display_name: displayName,
            active_mode: "personal",
            primary_currency: "USD",
          };
          const { data: created, error: insertErr } = await supabase
            .from("profiles")
            .insert(newProfile)
            .select()
            .single();

          if (!insertErr && created && !ignore) {
            setProfile(created as Profile);
          }
        }

        // Fetch financial entities for user
        const [txRes, subRes, budRes, goalRes, accRes] = await Promise.all([
          supabase
            .from("transactions")
            .select("*, category:categories(*)")
            .eq("user_id", activeUserId)
            .order("timestamp", { ascending: false }),
          supabase
            .from("subscriptions")
            .select("*")
            .eq("user_id", activeUserId),
          supabase.from("budgets").select("*").eq("user_id", activeUserId),
          supabase
            .from("financial_goals")
            .select("*")
            .eq("user_id", activeUserId),
          supabase
            .from("financial_accounts")
            .select("*")
            .eq("user_id", activeUserId),
        ]);

        if (ignore) return;

        if (txRes.data) setTransactions(txRes.data as Transaction[]);
        if (subRes.data) setSubscriptions(subRes.data as Subscription[]);
        if (budRes.data) setBudgets(budRes.data as Budget[]);
        if (goalRes.data) setGoals(goalRes.data as FinancialGoal[]);
        if (accRes.data) setAccounts(accRes.data as FinancialAccount[]);
      } catch (err: unknown) {
        if (!ignore) {
          console.warn("Supabase fetch notice:", err);
          setError(
            err instanceof Error ? err.message : "Error connecting to Supabase",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [isAuthenticated, activeUserId, displayName, primaryEmail, refreshToken]);

  const updateMode = async (mode: PlatformMode) => {
    if (!activeUserId) return;
    try {
      if (isSchemaReady) {
        const supabase = getSupabaseClient(activeUserId);
        await supabase
          .from("profiles")
          .update({ active_mode: mode, updated_at: new Date().toISOString() })
          .eq("id", activeUserId);
      }
      setProfile((prev) => (prev ? { ...prev, active_mode: mode } : null));
    } catch (err) {
      console.warn("Error updating mode:", err);
    }
  };

  return {
    profile,
    accounts,
    transactions,
    subscriptions,
    budgets,
    goals,
    loading,
    error,
    isSchemaReady,
    refreshData: () => setRefreshToken((t) => t + 1),
    updateMode,
  };
}
