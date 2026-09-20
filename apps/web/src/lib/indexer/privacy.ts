/**
 * Automated Privacy Scanner for Event Projections.
 *
 * Enforces Founder Invariant R-001:
 * "Private evidence remains offchain and public projections contain zero private fields."
 */

const FORBIDDEN_PRIVATE_KEYS = new Set([
  "merchant",
  "merchant_name",
  "description",
  "purpose",
  "notes",
  "category",
  "receipt",
  "receipt_url",
  "receipt_bytes",
  "ciphertext",
  "salt",
  "salt_ciphertext",
  "record_ciphertext",
  "rules_ciphertext",
  "suggested_fields_ciphertext",
  "key_reference",
  "encryption_metadata",
  "email",
  "private_amount",
  "dek",
  "kek",
]);

export class ProjectionPrivacyViolationError extends Error {
  readonly forbiddenKey: string;

  constructor(forbiddenKey: string, path: string) {
    super(
      `Privacy violation in public projection at path '${path}': '${forbiddenKey}' is a private Clario field and must never appear in public event projections.`,
    );
    this.name = "ProjectionPrivacyViolationError";
    this.forbiddenKey = forbiddenKey;
  }
}

/**
 * Recursively scans an object, record, or projection to guarantee that no
 * private fields, plaintext evidence attributes, or encryption keys are present.
 */
export function assertPublicProjectionPrivacy(obj: unknown, path = "$"): void {
  if (obj === null || obj === undefined) {
    return;
  }

  if (
    typeof obj === "string" ||
    typeof obj === "number" ||
    typeof obj === "boolean" ||
    typeof obj === "bigint"
  ) {
    return;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertPublicProjectionPrivacy(obj[i], `${path}[${i}]`);
    }
    return;
  }

  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_PRIVATE_KEYS.has(lowerKey)) {
        throw new ProjectionPrivacyViolationError(key, `${path}.${key}`);
      }
      assertPublicProjectionPrivacy(value, `${path}.${key}`);
    }
  }
}
