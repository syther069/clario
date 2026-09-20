/**
 * Clario Expense Validation
 *
 * Implements strict validation for manual expense drafts and submissions.
 */

import { findTokenAsset, isValidAddress, parseBaseUnits } from "./amount";
import type { ExpenseDraftPayload, ExpenseValidationResult } from "./types";

export const EXPENSE_CATEGORIES = [
  "travel",
  "software",
  "meals",
  "office",
  "equipment",
  "legal",
  "contractor",
  "marketing",
  "hosting",
  "other",
] as const;

export const PAYMENT_SOURCES = [
  "manual",
  "transaction_hash",
  "imported_transaction",
] as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

/**
 * Validates expense draft payload.
 * When isSubmission is true, all required fields must be non-empty and valid.
 * When isSubmission is false, checks format for any present fields (for autosave).
 */
export function validateExpenseDraft(
  payload: Partial<ExpenseDraftPayload>,
  isSubmission = false,
): ExpenseValidationResult {
  const errors: Record<string, string> = {};

  // Title
  if (payload.title !== undefined) {
    const trimmed = payload.title.trim();
    if (isSubmission && !trimmed) {
      errors.title = "Expense title is required.";
    } else if (trimmed.length > 200) {
      errors.title = "Expense title cannot exceed 200 characters.";
    }
  } else if (isSubmission) {
    errors.title = "Expense title is required.";
  }

  // Business purpose
  if (payload.businessPurpose !== undefined) {
    const trimmed = payload.businessPurpose.trim();
    if (isSubmission && !trimmed) {
      errors.businessPurpose = "Business purpose is required.";
    } else if (trimmed.length > 2000) {
      errors.businessPurpose =
        "Business purpose cannot exceed 2000 characters.";
    }
  } else if (isSubmission) {
    errors.businessPurpose = "Business purpose is required.";
  }

  // Category
  if (payload.category !== undefined) {
    const trimmed = payload.category.trim().toLowerCase();
    if (isSubmission && !trimmed) {
      errors.category = "Category is required.";
    } else if (
      trimmed &&
      !(EXPENSE_CATEGORIES as readonly string[]).includes(trimmed)
    ) {
      errors.category = `Invalid category. Must be one of: ${EXPENSE_CATEGORIES.join(", ")}.`;
    }
  } else if (isSubmission) {
    errors.category = "Category is required.";
  }

  // Project
  if (payload.project !== undefined) {
    const trimmed = payload.project.trim();
    if (isSubmission && !trimmed) {
      errors.project = "Project / cost center is required.";
    } else if (trimmed.length > 100) {
      errors.project = "Project name cannot exceed 100 characters.";
    }
  } else if (isSubmission) {
    errors.project = "Project / cost center is required.";
  }

  // Merchant
  if (payload.merchant !== undefined) {
    const trimmed = payload.merchant.trim();
    if (isSubmission && !trimmed) {
      errors.merchant = "Merchant name is required.";
    } else if (trimmed.length > 200) {
      errors.merchant = "Merchant name cannot exceed 200 characters.";
    }
  } else if (isSubmission) {
    errors.merchant = "Merchant name is required.";
  }

  // Expense Date
  if (payload.expenseDate !== undefined) {
    const trimmed = payload.expenseDate.trim();
    if (isSubmission && !trimmed) {
      errors.expenseDate = "Expense date is required.";
    } else if (trimmed) {
      if (!DATE_REGEX.test(trimmed)) {
        errors.expenseDate = "Expense date must be in YYYY-MM-DD format.";
      } else {
        const [yearStr, monthStr, dayStr] = trimmed.split("-");
        const y = Number(yearStr);
        const m = Number(monthStr);
        const d = Number(dayStr);
        const dateObj = new Date(Date.UTC(y, m - 1, d));

        if (
          dateObj.getUTCFullYear() !== y ||
          dateObj.getUTCMonth() !== m - 1 ||
          dateObj.getUTCDate() !== d
        ) {
          errors.expenseDate = "Invalid calendar date.";
        } else {
          // Check future date
          const now = new Date();
          const todayUtc = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
          );
          if (dateObj.getTime() > todayUtc.getTime()) {
            errors.expenseDate = "Expense date cannot be in the future.";
          }
        }
      }
    }
  } else if (isSubmission) {
    errors.expenseDate = "Expense date is required.";
  }

  // Token asset and decimals
  let tokenDecimals = 6;
  if (payload.claimAsset !== undefined) {
    if (!isValidAddress(payload.claimAsset)) {
      errors.claimAsset = "Claim asset must be a valid EVM contract address.";
    } else {
      const assetMeta = findTokenAsset(payload.claimAsset);
      if (assetMeta) {
        tokenDecimals = assetMeta.decimals;
      }
    }
  } else if (isSubmission) {
    errors.claimAsset = "Claim asset address is required.";
  }

  // Claim Amount
  if (payload.claimAmount !== undefined) {
    const trimmed = payload.claimAmount.trim();
    if (isSubmission && !trimmed) {
      errors.claimAmount = "Claim amount is required.";
    } else if (trimmed) {
      try {
        const baseUnits = parseBaseUnits(trimmed, tokenDecimals);
        if (isSubmission && baseUnits <= 0n) {
          errors.claimAmount = "Claim amount must be greater than zero.";
        }
      } catch (err) {
        errors.claimAmount =
          err instanceof Error ? err.message : "Invalid amount format.";
      }
    }
  } else if (isSubmission) {
    errors.claimAmount = "Claim amount is required.";
  }

  // Recipient
  if (payload.recipient !== undefined) {
    if (!isValidAddress(payload.recipient)) {
      errors.recipient = "Recipient must be a valid 0x-prefixed EVM address.";
    }
  } else if (isSubmission) {
    errors.recipient = "Recipient payee address is required.";
  }

  // Payment source
  if (payload.paymentSource !== undefined) {
    if (!PAYMENT_SOURCES.includes(payload.paymentSource)) {
      errors.paymentSource = `Invalid payment source. Must be one of: ${PAYMENT_SOURCES.join(", ")}.`;
    } else if (payload.paymentSource === "transaction_hash") {
      if (
        !payload.sourceTransactionHash ||
        !TX_HASH_REGEX.test(payload.sourceTransactionHash)
      ) {
        errors.sourceTransactionHash =
          "Source transaction hash must be a 0x-prefixed 64-character hex string.";
      }
    }
  } else if (isSubmission) {
    errors.paymentSource = "Payment source is required.";
  }

  // Tags
  if (payload.tags !== undefined) {
    if (!Array.isArray(payload.tags)) {
      errors.tags = "Tags must be an array of strings.";
    } else if (payload.tags.length > 10) {
      errors.tags = "Maximum of 10 tags allowed.";
    } else {
      for (const tag of payload.tags) {
        if (typeof tag !== "string" || tag.trim().length > 30) {
          errors.tags = "Each tag must be a string up to 30 characters.";
          break;
        }
      }
    }
  }

  // Notes
  if (payload.notes !== undefined && payload.notes !== null) {
    if (typeof payload.notes !== "string") {
      errors.notes = "Notes must be a string.";
    } else if (payload.notes.length > 4000) {
      errors.notes = "Notes cannot exceed 4000 characters.";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
