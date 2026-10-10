import type { Transaction } from "@/lib/supabase/types";

export type SubFrequency = "weekly" | "monthly" | "yearly";
export type ExpenseDateFilter = "all" | "7d" | "30d" | "month" | "year";
export type ExpenseAmountFilter = "all" | "under50" | "50to200" | "over200";
export type ExpenseReceiptFilter = "all" | "has_receipt" | "no_receipt";
export type ExpenseVerificationFilter = "all" | "verified" | "unverified";

export type DashboardTransaction = Transaction;
