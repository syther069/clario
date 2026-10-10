import type { Transaction } from "@/lib/supabase/types";

export type CashFlowPeriod = "7D" | "30D" | "3M" | "6M" | "1Y";

export interface CashFlowBucket {
  name: string;
  income: number;
  expenses: number;
}

/**
 * Transforms transactions into time-series buckets based on the requested period.
 * Pure calculation with no DOM or React dependencies.
 */
export function calculateCashFlowSeries(
  transactions: Transaction[],
  period: CashFlowPeriod,
  referenceDate: Date = new Date(),
): CashFlowBucket[] {
  const now = new Date(referenceDate);
  now.setHours(23, 59, 59, 999);
  const startDate = new Date(referenceDate);
  startDate.setHours(0, 0, 0, 0);

  let numBuckets = 7;
  let formatLabel = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short" });

  if (period === "7D") {
    startDate.setDate(now.getDate() - 7);
    numBuckets = 7;
    formatLabel = (d: Date) =>
      d.toLocaleDateString("en-US", { weekday: "short" });
  } else if (period === "30D") {
    startDate.setDate(now.getDate() - 30);
    numBuckets = 6;
    formatLabel = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  } else if (period === "3M") {
    startDate.setMonth(now.getMonth() - 3);
    numBuckets = 6;
    formatLabel = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else if (period === "6M") {
    startDate.setMonth(now.getMonth() - 6);
    numBuckets = 6;
    formatLabel = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short" });
  } else if (period === "1Y") {
    startDate.setFullYear(now.getFullYear() - 1);
    numBuckets = 12;
    formatLabel = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short" });
  }

  const startTime = startDate.getTime();
  const totalTime = Math.max(1, now.getTime() - startTime);
  const step = totalTime / numBuckets;

  const buckets = Array.from({ length: numBuckets }, (_, i) => {
    const bucketStart = startTime + i * step;
    const bucketEnd = startTime + (i + 1) * step;
    const date = new Date(bucketStart);
    return {
      name: formatLabel(date),
      start: bucketStart,
      end: bucketEnd,
      income: 0,
      expenses: 0,
    };
  });

  for (const tx of transactions) {
    const txTime = new Date(
      tx.date || tx.timestamp || tx.created_at || 0,
    ).getTime();
    if (txTime >= startTime && txTime <= now.getTime()) {
      const bucket =
        buckets.find((b) => txTime >= b.start && txTime <= b.end) ||
        buckets[buckets.length - 1];
      if (bucket) {
        if (tx.type === "income") {
          bucket.income += Number(tx.amount || 0);
        } else {
          bucket.expenses += Number(tx.amount || 0);
        }
      }
    }
  }

  return buckets.map((b) => ({
    name: b.name,
    income: Number(b.income.toFixed(2)),
    expenses: Number(b.expenses.toFixed(2)),
  }));
}
