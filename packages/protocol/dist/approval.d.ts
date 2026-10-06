import { type Bytes32, type ChainId, type CommitmentHash, type EvmAddress, type ExpenseId, type ExpenseVersion, type PolicyVersion, type WorkspaceId } from "./identifiers.js";
import { OnchainDecision } from "./lifecycle.js";
export declare const CLARIO_APPROVAL_PRIMARY_TYPE: "ClarioApproval";
export declare const CLARIO_APPROVAL_DOMAIN_NAME: "ClarioApproval";
export declare const CLARIO_APPROVAL_DOMAIN_VERSION: "1";
export declare const CLARIO_APPROVAL_EIP712_DOMAIN_TYPE: readonly [{
    readonly name: "name";
    readonly type: "string";
}, {
    readonly name: "version";
    readonly type: "string";
}, {
    readonly name: "chainId";
    readonly type: "uint256";
}, {
    readonly name: "verifyingContract";
    readonly type: "address";
}];
export declare const CLARIO_APPROVAL_EIP712_MESSAGE_TYPE: readonly [{
    readonly name: "workspaceId";
    readonly type: "bytes32";
}, {
    readonly name: "expenseId";
    readonly type: "bytes32";
}, {
    readonly name: "version";
    readonly type: "uint32";
}, {
    readonly name: "commitment";
    readonly type: "bytes32";
}, {
    readonly name: "decision";
    readonly type: "uint8";
}, {
    readonly name: "reasonCommitment";
    readonly type: "bytes32";
}, {
    readonly name: "policyVersion";
    readonly type: "uint32";
}, {
    readonly name: "nonce";
    readonly type: "uint256";
}, {
    readonly name: "expiration";
    readonly type: "uint256";
}];
export declare const CLARIO_APPROVAL_EIP712_TYPES: {
    readonly EIP712Domain: readonly [{
        readonly name: "name";
        readonly type: "string";
    }, {
        readonly name: "version";
        readonly type: "string";
    }, {
        readonly name: "chainId";
        readonly type: "uint256";
    }, {
        readonly name: "verifyingContract";
        readonly type: "address";
    }];
    readonly ClarioApproval: readonly [{
        readonly name: "workspaceId";
        readonly type: "bytes32";
    }, {
        readonly name: "expenseId";
        readonly type: "bytes32";
    }, {
        readonly name: "version";
        readonly type: "uint32";
    }, {
        readonly name: "commitment";
        readonly type: "bytes32";
    }, {
        readonly name: "decision";
        readonly type: "uint8";
    }, {
        readonly name: "reasonCommitment";
        readonly type: "bytes32";
    }, {
        readonly name: "policyVersion";
        readonly type: "uint32";
    }, {
        readonly name: "nonce";
        readonly type: "uint256";
    }, {
        readonly name: "expiration";
        readonly type: "uint256";
    }];
};
/**
 * EIP-712 Domain object for Clario approval authorizations.
 */
export interface ClarioApprovalDomain {
    readonly name: typeof CLARIO_APPROVAL_DOMAIN_NAME;
    readonly version: typeof CLARIO_APPROVAL_DOMAIN_VERSION;
    readonly chainId: ChainId;
    readonly verifyingContract: EvmAddress;
}
/**
 * EIP-712 message payload for reviewer approval / rejection / changes request.
 * See architecture.md §7.3.
 */
export interface ClarioApprovalMessage {
    readonly workspaceId: WorkspaceId;
    readonly expenseId: ExpenseId;
    readonly version: ExpenseVersion;
    readonly commitment: CommitmentHash;
    readonly decision: OnchainDecision;
    readonly reasonCommitment: Bytes32;
    readonly policyVersion: PolicyVersion;
    readonly nonce: bigint;
    readonly expiration: bigint;
}
/**
 * Full EIP-712 Typed Data envelope.
 */
export interface ClarioApprovalTypedData {
    readonly domain: ClarioApprovalDomain;
    readonly types: typeof CLARIO_APPROVAL_EIP712_TYPES;
    readonly primaryType: typeof CLARIO_APPROVAL_PRIMARY_TYPE;
    readonly message: ClarioApprovalMessage;
}
/**
 * Parses and validates a Clario approval domain object.
 */
export declare function parseClarioApprovalDomain(input: unknown): ClarioApprovalDomain;
/**
 * Parses and validates a Clario approval message payload.
 */
export declare function parseClarioApprovalMessage(input: unknown): ClarioApprovalMessage;
/**
 * Validates a complete EIP-712 typed data structure.
 */
export declare function validateClarioApprovalTypedData(input: unknown): ClarioApprovalTypedData;
/**
 * Checks whether an approval message has expired against a reference timestamp (in seconds).
 */
export declare function isApprovalExpired(message: ClarioApprovalMessage, currentTimestampSec: bigint | number): boolean;
//# sourceMappingURL=approval.d.ts.map