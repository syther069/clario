import {
  EXPENSE_FIELD_DEFINITIONS_V1,
  type CanonicalExpenseV1,
} from "@clario/protocol";
import type { MaterialDiff, MaterialFieldChange } from "./types";

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  title: "Title",
  businessPurpose: "Business Purpose",
  category: "Category",
  project: "Project Code",
  merchant: "Merchant",
  expenseDate: "Expense Date",
  claimAmount: "Claim Amount (Base Units)",
  claimAsset: "Claim Settlement Token",
  recipient: "Reimbursement Recipient",
  paymentSource: "Payment Source",
  sourceChainId: "Source Chain ID",
  sourceTransactionHash: "Source Transaction Hash",
  evidenceManifestHash: "Evidence Manifest Hash",
  client: "Client / Customer",
  invoiceNumber: "Invoice Number",
  location: "Location",
  notes: "Internal Notes",
  tags: "Tags",
};

/**
 * Determines whether a field change is classified as MATERIAL in Canonical Expense Schema v1.
 * Material edits invalidate predecessor approvals and require re-approval (REAPPROVAL_REQUIRED).
 */
export function isFieldMaterial(fieldName: string): boolean {
  const def = EXPENSE_FIELD_DEFINITIONS_V1.find((f) => f.name === fieldName);
  if (def) {
    return def.materiality === "MATERIAL";
  }
  // Unknown or unspecified fields default to MATERIAL for safety
  return true;
}

/**
 * Compares two Canonical Expense Record v1 objects and detects all field-level differences,
 * classifying each change as MATERIAL or NON_MATERIAL.
 */
export function computeMaterialDiff(
  current: CanonicalExpenseV1,
  predecessor: CanonicalExpenseV1 | null,
  predecessorVersion: number | null,
): MaterialDiff {
  if (!predecessor) {
    return {
      predecessorVersion: null,
      hasChanges: false,
      hasMaterialChanges: false,
      changes: [],
    };
  }

  const changes: MaterialFieldChange[] = [];

  const keysToCheck: Array<keyof CanonicalExpenseV1> = [
    "title",
    "businessPurpose",
    "category",
    "project",
    "merchant",
    "expenseDate",
    "claimAmount",
    "claimAsset",
    "recipient",
    "paymentSource",
    "sourceChainId",
    "sourceTransactionHash",
    "evidenceManifestHash",
    "client",
    "invoiceNumber",
    "location",
    "notes",
    "tags",
  ];

  for (const key of keysToCheck) {
    const oldVal = predecessor[key];
    const newVal = current[key];

    const isDifferent =
      JSON.stringify(oldVal ?? null) !== JSON.stringify(newVal ?? null);

    if (isDifferent) {
      changes.push({
        field: key,
        displayName: FIELD_DISPLAY_NAMES[key] || key,
        oldValue: oldVal,
        newValue: newVal,
        isMaterial: isFieldMaterial(key),
      });
    }
  }

  const hasMaterialChanges = changes.some((c) => c.isMaterial);

  return {
    predecessorVersion,
    hasChanges: changes.length > 0,
    hasMaterialChanges,
    changes,
  };
}
