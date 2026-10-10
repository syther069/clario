import { describe, it, expect } from "vitest";
import {
  isTxOnChain,
  filterExpenses,
  filterIncome,
} from "./transaction-filter";
import type { Transaction } from "@/lib/supabase/types";

describe("Domain: Transaction Filter Engine", () => {
  const refDate = new Date("2026-10-10T12:00:00Z");

  const sampleTransactions: Transaction[] = [
    {
      id: "tx-fiat",
      type: "expense",
      merchant: "Trader Joe's",
      description: "Groceries",
      payment_method: "Credit Card",
      amount: 45,
      date: "2026-10-09",
      category_id: "food_dining",
    } as Transaction,
    {
      id: "tx-onchain",
      type: "expense",
      merchant: "Monad Gas",
      description: "Gas Fee",
      payment_method: "onchain_monad",
      blockchain_tx_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      monad_tx_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      amount: 150,
      date: "2026-10-08",
      category_id: "crypto_ops",
      verification_status: "verified",
    } as Transaction,
    {
      id: "tx-inc",
      type: "income",
      merchant: "Client Acme",
      description: "Consulting Retainer",
      amount: 5000,
      date: "2026-10-01",
    } as Transaction,
  ];

  it("classifies transactions as onchain vs fiat correctly", () => {
    expect(isTxOnChain(sampleTransactions[0]!)).toBe(false);
    expect(isTxOnChain(sampleTransactions[1]!)).toBe(true);
  });

  it("filters expenses by search query", () => {
    const results = filterExpenses(sampleTransactions, { search: "Trader" }, refDate);
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("tx-fiat");
  });

  it("filters expenses by amount criteria", () => {
    const under50 = filterExpenses(sampleTransactions, { amount: "under50" }, refDate);
    expect(under50).toHaveLength(1);
    expect(under50[0]?.id).toBe("tx-fiat");

    const mid = filterExpenses(sampleTransactions, { amount: "50to200" }, refDate);
    expect(mid).toHaveLength(1);
    expect(mid[0]?.id).toBe("tx-onchain");
  });

  it("filters expenses by verification status", () => {
    const verified = filterExpenses(sampleTransactions, { verification: "verified" }, refDate);
    expect(verified).toHaveLength(1);
    expect(verified[0]?.id).toBe("tx-onchain");

    const unverified = filterExpenses(sampleTransactions, { verification: "unverified" }, refDate);
    expect(unverified).toHaveLength(1);
    expect(unverified[0]?.id).toBe("tx-fiat");
  });

  it("filters income transactions by query", () => {
    const results = filterIncome(sampleTransactions, "Acme");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("tx-inc");

    const none = filterIncome(sampleTransactions, "Unknown");
    expect(none).toHaveLength(0);
  });
});
