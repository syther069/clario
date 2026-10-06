import { createPublicClient, decodeEventLog, http, } from "viem";
import { ROLE_IDENTIFIERS } from "../lifecycle.js";
const ROOT_ABI = [
    {
        type: "function",
        name: "workspaceRegistry",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "address" }],
    },
    {
        type: "function",
        name: "expenseRegistry",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "address" }],
    },
    {
        type: "function",
        name: "decisionRegistry",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "address" }],
    },
    {
        type: "function",
        name: "settlementRegistry",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "address" }],
    },
    {
        type: "function",
        name: "getCurrentVersion",
        stateMutability: "view",
        inputs: [{ type: "bytes32" }, { type: "bytes32" }],
        outputs: [{ type: "uint32" }],
    },
];
const EXPENSE_ABI = [
    {
        type: "function",
        name: "getCommitment",
        stateMutability: "view",
        inputs: [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint32" }],
        outputs: [{ type: "bytes32" }],
    },
    {
        type: "function",
        name: "getSubmitter",
        stateMutability: "view",
        inputs: [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint32" }],
        outputs: [{ type: "address" }],
    },
    {
        type: "function",
        name: "getSubmittedAtBlock",
        stateMutability: "view",
        inputs: [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint32" }],
        outputs: [{ type: "uint64" }],
    },
    {
        type: "function",
        name: "isVersionSuperseded",
        stateMutability: "view",
        inputs: [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint32" }],
        outputs: [{ type: "bool" }],
    },
];
const DECISION_ABI = [
    {
        type: "function",
        name: "getDecisionRecord",
        stateMutability: "view",
        inputs: [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint32" }],
        outputs: [
            {
                type: "tuple",
                components: [
                    { name: "decision", type: "uint8" },
                    { name: "commitment", type: "bytes32" },
                    { name: "reviewer", type: "address" },
                    { name: "reasonCommitment", type: "bytes32" },
                    { name: "policyVersion", type: "uint32" },
                    { name: "decidedAtBlock", type: "uint64" },
                    { name: "decidedAtTimestamp", type: "uint64" },
                ],
            },
        ],
    },
    {
        type: "function",
        name: "isApprovalValid",
        stateMutability: "view",
        inputs: [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint32" }],
        outputs: [{ type: "bool" }],
    },
    {
        type: "event",
        name: "DecisionRecorded",
        anonymous: false,
        inputs: [
            { name: "workspaceId", type: "bytes32", indexed: true },
            { name: "expenseId", type: "bytes32", indexed: true },
            { name: "version", type: "uint32", indexed: true },
            { name: "commitment", type: "bytes32", indexed: false },
            { name: "reviewer", type: "address", indexed: false },
            { name: "decision", type: "uint8", indexed: false },
            { name: "reasonCommitment", type: "bytes32", indexed: false },
        ],
    },
];
const WORKSPACE_ABI = [
    {
        type: "function",
        name: "wasRoleAuthorizedAtBlock",
        stateMutability: "view",
        inputs: [
            { type: "bytes32" },
            { type: "address" },
            { type: "bytes32" },
            { type: "bytes32" },
            { type: "uint64" },
        ],
        outputs: [{ type: "bool" }],
    },
];
const SETTLEMENT_ABI = [
    {
        type: "function",
        name: "getSettlementRecord",
        stateMutability: "view",
        inputs: [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint32" }],
        outputs: [
            {
                type: "tuple",
                components: [
                    { name: "settled", type: "bool" },
                    { name: "token", type: "address" },
                    { name: "recipient", type: "address" },
                    { name: "amount", type: "uint256" },
                    { name: "paymentReference", type: "bytes32" },
                    { name: "executor", type: "address" },
                    { name: "settledAtBlock", type: "uint64" },
                    { name: "settledAtTimestamp", type: "uint64" },
                ],
            },
        ],
    },
    {
        type: "event",
        name: "SettlementRecorded",
        anonymous: false,
        inputs: [
            { name: "workspaceId", type: "bytes32", indexed: true },
            { name: "expenseId", type: "bytes32", indexed: true },
            { name: "version", type: "uint32", indexed: true },
            { name: "commitment", type: "bytes32", indexed: false },
            { name: "token", type: "address", indexed: false },
            { name: "recipient", type: "address", indexed: false },
            { name: "amount", type: "uint256", indexed: false },
            { name: "paymentReference", type: "bytes32", indexed: false },
        ],
    },
];
const TRANSFER_ABI = [
    {
        type: "event",
        name: "Transfer",
        anonymous: false,
        inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "value", type: "uint256", indexed: false },
        ],
    },
];
const ZERO_SCOPE = `0x${"00".repeat(32)}`;
function asAddress(value) {
    return value;
}
function asBytes32(value) {
    return value;
}
/** Creates a public-RPC chain source; it has no Clario API or session dependency. */
export function createRpcVerifierChainSource(rpcUrl) {
    const parsed = new URL(rpcUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("RPC URL must use http or https.");
    }
    if (parsed.username || parsed.password) {
        throw new Error("RPC URL credentials are not accepted by the verifier.");
    }
    const client = createPublicClient({ transport: http(parsed.toString()) });
    const directories = new Map();
    function directory(root) {
        const key = root.toLowerCase();
        const existing = directories.get(key);
        if (existing)
            return existing;
        const pending = Promise.all([
            client.readContract({
                address: asAddress(root),
                abi: ROOT_ABI,
                functionName: "workspaceRegistry",
            }),
            client.readContract({
                address: asAddress(root),
                abi: ROOT_ABI,
                functionName: "expenseRegistry",
            }),
            client.readContract({
                address: asAddress(root),
                abi: ROOT_ABI,
                functionName: "decisionRegistry",
            }),
            client.readContract({
                address: asAddress(root),
                abi: ROOT_ABI,
                functionName: "settlementRegistry",
            }),
        ]).then(([workspace, expense, decision, settlement]) => ({
            workspace,
            expense,
            decision,
            settlement,
        }));
        directories.set(key, pending);
        return pending;
    }
    return {
        async getChainId() {
            return client.getChainId();
        },
        async isRegistry(root) {
            const bytecode = await client.getBytecode({ address: asAddress(root) });
            if (!bytecode || bytecode === "0x")
                return false;
            try {
                await directory(root);
                return true;
            }
            catch {
                return false;
            }
        },
        async getCurrentVersion(root, workspaceId, expenseId) {
            return client.readContract({
                address: asAddress(root),
                abi: ROOT_ABI,
                functionName: "getCurrentVersion",
                args: [asBytes32(workspaceId), asBytes32(expenseId)],
            });
        },
        async getExpenseVersion(root, workspaceId, expenseId, version) {
            const registries = await directory(root);
            try {
                const [commitment, submitter, submittedAtBlock, isSuperseded] = await Promise.all([
                    client.readContract({
                        address: registries.expense,
                        abi: EXPENSE_ABI,
                        functionName: "getCommitment",
                        args: [asBytes32(workspaceId), asBytes32(expenseId), version],
                    }),
                    client.readContract({
                        address: registries.expense,
                        abi: EXPENSE_ABI,
                        functionName: "getSubmitter",
                        args: [asBytes32(workspaceId), asBytes32(expenseId), version],
                    }),
                    client.readContract({
                        address: registries.expense,
                        abi: EXPENSE_ABI,
                        functionName: "getSubmittedAtBlock",
                        args: [asBytes32(workspaceId), asBytes32(expenseId), version],
                    }),
                    client.readContract({
                        address: registries.expense,
                        abi: EXPENSE_ABI,
                        functionName: "isVersionSuperseded",
                        args: [asBytes32(workspaceId), asBytes32(expenseId), version],
                    }),
                ]);
                return {
                    registryAddress: registries.expense,
                    commitment,
                    submitter,
                    submittedAtBlock,
                    isSuperseded,
                };
            }
            catch {
                return null;
            }
        },
        async getDecision(root, workspaceId, expenseId, version) {
            const registries = await directory(root);
            let record;
            try {
                record = await client.readContract({
                    address: registries.decision,
                    abi: DECISION_ABI,
                    functionName: "getDecisionRecord",
                    args: [asBytes32(workspaceId), asBytes32(expenseId), version],
                });
            }
            catch {
                return null;
            }
            if (record.decision === 0)
                return null;
            const [isCurrentApprovalValid, reviewerWasAuthorized, logs] = await Promise.all([
                client.readContract({
                    address: registries.decision,
                    abi: DECISION_ABI,
                    functionName: "isApprovalValid",
                    args: [asBytes32(workspaceId), asBytes32(expenseId), version],
                }),
                client.readContract({
                    address: registries.workspace,
                    abi: WORKSPACE_ABI,
                    functionName: "wasRoleAuthorizedAtBlock",
                    args: [
                        asBytes32(workspaceId),
                        record.reviewer,
                        ROLE_IDENTIFIERS.APPROVER_ROLE,
                        ZERO_SCOPE,
                        record.decidedAtBlock,
                    ],
                }),
                client.getContractEvents({
                    address: registries.decision,
                    abi: DECISION_ABI,
                    eventName: "DecisionRecorded",
                    args: {
                        workspaceId: asBytes32(workspaceId),
                        expenseId: asBytes32(expenseId),
                        version,
                    },
                    fromBlock: record.decidedAtBlock,
                    toBlock: record.decidedAtBlock,
                    strict: true,
                }),
            ]);
            const decision = record.decision === 1
                ? "APPROVE"
                : record.decision === 2
                    ? "REJECT"
                    : "REQUEST_CHANGES";
            return {
                decision,
                commitment: record.commitment,
                reviewer: record.reviewer,
                policyVersion: record.policyVersion,
                decidedAtBlock: record.decidedAtBlock,
                transactionHash: logs[0]?.transactionHash ?? null,
                reviewerWasAuthorized,
                isCurrentApprovalValid,
            };
        },
        async getSettlement(root, workspaceId, expenseId, version) {
            const registries = await directory(root);
            let record;
            try {
                record = await client.readContract({
                    address: registries.settlement,
                    abi: SETTLEMENT_ABI,
                    functionName: "getSettlementRecord",
                    args: [asBytes32(workspaceId), asBytes32(expenseId), version],
                });
            }
            catch {
                return null;
            }
            if (!record.settled)
                return null;
            const logs = await client.getContractEvents({
                address: registries.settlement,
                abi: SETTLEMENT_ABI,
                eventName: "SettlementRecorded",
                args: {
                    workspaceId: asBytes32(workspaceId),
                    expenseId: asBytes32(expenseId),
                    version,
                },
                fromBlock: record.settledAtBlock,
                toBlock: record.settledAtBlock,
                strict: true,
            });
            const transactionHash = logs[0]?.transactionHash ?? null;
            let hasMatchingTokenTransfer = false;
            if (transactionHash) {
                const receipt = await client.getTransactionReceipt({
                    hash: transactionHash,
                });
                for (const log of receipt.logs) {
                    if (log.address.toLowerCase() !== record.token.toLowerCase())
                        continue;
                    try {
                        const decoded = decodeEventLog({
                            abi: TRANSFER_ABI,
                            data: log.data,
                            topics: log.topics,
                            strict: true,
                        });
                        if (decoded.eventName === "Transfer" &&
                            decoded.args.from.toLowerCase() ===
                                record.executor.toLowerCase() &&
                            decoded.args.to.toLowerCase() ===
                                record.recipient.toLowerCase() &&
                            decoded.args.value === record.amount) {
                            hasMatchingTokenTransfer = true;
                        }
                    }
                    catch {
                        // Non-Transfer logs from the token or receipt are irrelevant.
                    }
                }
            }
            return {
                commitment: logs[0]?.args.commitment ?? asBytes32(`0x${"00".repeat(32)}`),
                token: record.token,
                recipient: record.recipient,
                amount: record.amount,
                paymentReference: record.paymentReference,
                executor: record.executor,
                settledAtBlock: record.settledAtBlock,
                transactionHash,
                hasMatchingTokenTransfer,
                conflictingSettlementCount: Math.max(0, logs.length - 1),
            };
        },
    };
}
//# sourceMappingURL=rpc.js.map