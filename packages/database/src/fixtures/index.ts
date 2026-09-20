/**
 * Deterministic test fixtures for Clario PostgreSQL schema validation.
 * Contains ZERO personal data, live keys, real invoices, or actual production addresses.
 * All addresses and hashes are synthetic 0x test constants.
 */

export const TEST_FIXTURE_USER = {
  userId: "00000000-0000-0000-0000-000000000001",
  primaryAddress: "0x1111111111111111111111111111111111111111",
} as const;

export const TEST_FIXTURE_USER_2 = {
  userId: "00000000-0000-0000-0000-000000000002",
  primaryAddress: "0x2222222222222222222222222222222222222222",
} as const;

export const TEST_FIXTURE_WORKSPACE = {
  workspaceId:
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  name: "Acme Test Workspace",
  createdBy: "0x1111111111111111111111111111111111111111",
} as const;

export const TEST_FIXTURE_WORKSPACE_2 = {
  workspaceId:
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  name: "Beta Test Workspace",
  createdBy: "0x2222222222222222222222222222222222222222",
} as const;

export const TEST_FIXTURE_EXPENSE = {
  expenseId:
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  createdBy: "0x1111111111111111111111111111111111111111",
} as const;

export const TEST_FIXTURE_EXPENSE_VERSION_1 = {
  version: 1,
  commitment:
    "0x1000000000000000000000000000000000000000000000000000000000000001",
  previousCommitment: null,
  saltCiphertext: "enc_salt_v1_synthetic_fixture",
  saltKeyReference: "key_ref_salt_v1",
  recordCiphertext: "enc_record_v1_synthetic_fixture",
  recordKeyReference: "key_ref_record_v1",
  amount: "500000000", // 500.00 USDC in 6 decimals base units
  currency: "USDC",
  recipient: "0x1111111111111111111111111111111111111111",
  status: "current" as const,
} as const;

export const TEST_FIXTURE_EXPENSE_VERSION_2 = {
  version: 2,
  commitment:
    "0x2000000000000000000000000000000000000000000000000000000000000002",
  previousCommitment:
    "0x1000000000000000000000000000000000000000000000000000000000000001",
  saltCiphertext: "enc_salt_v2_synthetic_fixture",
  saltKeyReference: "key_ref_salt_v2",
  recordCiphertext: "enc_record_v2_synthetic_fixture",
  recordKeyReference: "key_ref_record_v2",
  amount: "550000000", // 550.00 USDC base units
  currency: "USDC",
  recipient: "0x1111111111111111111111111111111111111111",
  status: "current" as const,
} as const;

export const TEST_FIXTURE_ROLES = {
  OWNER_ROLE:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  APPROVER_ROLE:
    "0x1111000000000000000000000000000000000000000000000000000000001111",
  TREASURY_ROLE:
    "0x2222000000000000000000000000000000000000000000000000000000002222",
  GLOBAL_SCOPE:
    "0x0000000000000000000000000000000000000000000000000000000000000000",
} as const;
