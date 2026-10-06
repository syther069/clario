const BYTES32_REGEX = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-.]{1,64}$/;
function parseHex32(val, fieldName) {
    if (typeof val !== "string" || !BYTES32_REGEX.test(val)) {
        throw new Error(`Invalid ${fieldName}: must be a 0x-prefixed 64-character hexadecimal string.`);
    }
    return val.toLowerCase();
}
function parsePositiveInt(val, fieldName) {
    if (typeof val !== "number" || !Number.isInteger(val) || val < 1) {
        throw new Error(`Invalid ${fieldName}: must be a positive integer >= 1.`);
    }
    return val;
}
export function parseWorkspaceId(val) {
    return parseHex32(val, "workspaceId");
}
export function parseExpenseId(val) {
    return parseHex32(val, "expenseId");
}
export function parseExpenseVersion(val) {
    return parsePositiveInt(val, "version");
}
export function parseCommitmentHash(val) {
    return parseHex32(val, "commitment");
}
export function parseDecisionId(val) {
    return parseHex32(val, "decisionId");
}
export function parsePolicyVersion(val) {
    return parsePositiveInt(val, "policyVersion");
}
export function parsePolicyCommitment(val) {
    return parseHex32(val, "policyCommitment");
}
export function parsePaymentReference(val) {
    return parseHex32(val, "paymentReference");
}
export function parseBytes32(val) {
    return parseHex32(val, "bytes32");
}
export function parseEvmAddress(val) {
    if (typeof val !== "string" || !ADDRESS_REGEX.test(val)) {
        throw new Error("Invalid address: must be a 0x-prefixed 40-character hexadecimal address.");
    }
    return val.toLowerCase();
}
export function parseChainId(val) {
    return parsePositiveInt(val, "chainId");
}
export function parseRequestId(val) {
    if (typeof val !== "string" || !REQUEST_ID_REGEX.test(val)) {
        throw new Error("Invalid requestId: must be an ASCII string between 1 and 64 characters.");
    }
    return val;
}
//# sourceMappingURL=identifiers.js.map