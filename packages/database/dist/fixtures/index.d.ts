/**
 * Deterministic test fixtures for Clario PostgreSQL schema validation.
 * Contains ZERO personal data, live keys, real invoices, or actual production addresses.
 * All addresses and hashes are synthetic 0x test constants.
 */
export declare const TEST_FIXTURE_USER: {
    readonly userId: "00000000-0000-0000-0000-000000000001";
    readonly primaryAddress: "0x1111111111111111111111111111111111111111";
};
export declare const TEST_FIXTURE_USER_2: {
    readonly userId: "00000000-0000-0000-0000-000000000002";
    readonly primaryAddress: "0x2222222222222222222222222222222222222222";
};
export declare const TEST_FIXTURE_WORKSPACE: {
    readonly workspaceId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    readonly name: "Acme Test Workspace";
    readonly createdBy: "0x1111111111111111111111111111111111111111";
};
export declare const TEST_FIXTURE_WORKSPACE_2: {
    readonly workspaceId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    readonly name: "Beta Test Workspace";
    readonly createdBy: "0x2222222222222222222222222222222222222222";
};
export declare const TEST_FIXTURE_EXPENSE: {
    readonly expenseId: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    readonly createdBy: "0x1111111111111111111111111111111111111111";
};
export declare const TEST_FIXTURE_EXPENSE_VERSION_1: {
    readonly version: 1;
    readonly commitment: "0x1000000000000000000000000000000000000000000000000000000000000001";
    readonly previousCommitment: null;
    readonly saltCiphertext: "enc_salt_v1_synthetic_fixture";
    readonly saltKeyReference: "key_ref_salt_v1";
    readonly recordCiphertext: "enc_record_v1_synthetic_fixture";
    readonly recordKeyReference: "key_ref_record_v1";
    readonly amount: "500000000";
    readonly currency: "USDC";
    readonly recipient: "0x1111111111111111111111111111111111111111";
    readonly status: "current";
};
export declare const TEST_FIXTURE_EXPENSE_VERSION_2: {
    readonly version: 2;
    readonly commitment: "0x2000000000000000000000000000000000000000000000000000000000000002";
    readonly previousCommitment: "0x1000000000000000000000000000000000000000000000000000000000000001";
    readonly saltCiphertext: "enc_salt_v2_synthetic_fixture";
    readonly saltKeyReference: "key_ref_salt_v2";
    readonly recordCiphertext: "enc_record_v2_synthetic_fixture";
    readonly recordKeyReference: "key_ref_record_v2";
    readonly amount: "550000000";
    readonly currency: "USDC";
    readonly recipient: "0x1111111111111111111111111111111111111111";
    readonly status: "current";
};
export declare const TEST_FIXTURE_ROLES: {
    readonly OWNER_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000";
    readonly APPROVER_ROLE: "0x1111000000000000000000000000000000000000000000000000000000001111";
    readonly TREASURY_ROLE: "0x2222000000000000000000000000000000000000000000000000000000002222";
    readonly GLOBAL_SCOPE: "0x0000000000000000000000000000000000000000000000000000000000000000";
};
//# sourceMappingURL=index.d.ts.map