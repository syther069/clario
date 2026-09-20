/**
 * Settlement Receipt Validation Tests (SET-002)
 *
 * Tests onchain receipt and event decoding against expected parameters:
 * status, destination contract, SettlementRecorded event, and ERC-20 Transfer event.
 */

import { describe, expect, it } from "vitest";
import { encodeEventTopics, encodeAbiParameters } from "viem";
import {
  validateSettlementReceipt,
  type MinimalTransactionReceipt,
  type ExpectedSettlementParams,
  ERC20_TRANSFER_EVENT_ABI,
} from "./receipt";
import { SETTLEMENT_REGISTRY_ABI } from "./calldata";

const WS_ID = "0x" + "11".repeat(32);
const EXP_ID = "0x" + "22".repeat(32);
const COMMITMENT = "0x" + "33".repeat(32);
const REGISTRY_ADDR = "0x1234567890123456789012345678901234567890";
const TOKEN_ADDR = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const RECIPIENT_ADDR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const TREASURY_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const TX_HASH = "0x" + "aa".repeat(32);
const BLOCK_HASH = "0x" + "bb".repeat(32);
const PAYMENT_REF = "0x" + "44".repeat(32);
const AMOUNT = 1000000n; // 1.00 USDC

const EXPECTED: ExpectedSettlementParams = {
  workspaceId: WS_ID,
  expenseId: EXP_ID,
  version: 1,
  commitment: COMMITMENT,
  tokenAddress: TOKEN_ADDR,
  recipientAddress: RECIPIENT_ADDR,
  amountBaseUnits: AMOUNT,
  registryAddress: REGISTRY_ADDR,
  chainId: 10143,
};

function buildValidReceipt(
  overrides: Partial<MinimalTransactionReceipt> = {},
): MinimalTransactionReceipt {
  // Encode SettlementRecorded topics & data
  const settlementTopics = encodeEventTopics({
    abi: SETTLEMENT_REGISTRY_ABI,
    eventName: "SettlementRecorded",
    args: {
      workspaceId: WS_ID as `0x${string}`,
      expenseId: EXP_ID as `0x${string}`,
      version: 1,
    },
  }) as [`0x${string}`, ...`0x${string}`[]];

  const settlementData = encodeAbiParameters(
    [
      { name: "commitment", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paymentReference", type: "bytes32" },
    ],
    [
      COMMITMENT as `0x${string}`,
      TOKEN_ADDR as `0x${string}`,
      RECIPIENT_ADDR as `0x${string}`,
      AMOUNT,
      PAYMENT_REF as `0x${string}`,
    ],
  );

  // Encode ERC-20 Transfer topics & data
  const transferTopics = encodeEventTopics({
    abi: ERC20_TRANSFER_EVENT_ABI,
    eventName: "Transfer",
    args: {
      from: TREASURY_ADDR as `0x${string}`,
      to: RECIPIENT_ADDR as `0x${string}`,
    },
  }) as [`0x${string}`, ...`0x${string}`[]];

  const transferData = encodeAbiParameters(
    [{ name: "value", type: "uint256" }],
    [AMOUNT],
  );

  return {
    status: "success",
    blockNumber: 12345n,
    blockHash: BLOCK_HASH,
    transactionHash: TX_HASH,
    to: REGISTRY_ADDR,
    from: TREASURY_ADDR,
    logs: [
      {
        address: REGISTRY_ADDR,
        topics: settlementTopics,
        data: settlementData,
      },
      {
        address: TOKEN_ADDR,
        topics: transferTopics,
        data: transferData,
      },
    ],
    ...overrides,
  };
}

describe("validateSettlementReceipt (SET-002)", () => {
  it("validates valid settlement receipt and decodes proof", () => {
    const receipt = buildValidReceipt();
    const result = validateSettlementReceipt(receipt, EXPECTED);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.blockNumber).toBe(12345n);
      expect(result.blockHash).toBe(BLOCK_HASH);
      expect(result.transactionHash).toBe(TX_HASH);
      expect(result.paymentReference).toBe(PAYMENT_REF);
      expect(result.amountBaseUnits).toBe(AMOUNT);
    }
  });

  it("rejects reverted receipt with isReverted true", () => {
    const receipt = buildValidReceipt({ status: "reverted" });
    const result = validateSettlementReceipt(receipt, EXPECTED);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("TRANSACTION_REVERTED");
      expect(result.isReverted).toBe(true);
    }
  });

  it("rejects receipt with numeric status 0", () => {
    const receipt = buildValidReceipt({ status: 0 });
    const result = validateSettlementReceipt(receipt, EXPECTED);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("TRANSACTION_REVERTED");
      expect(result.isReverted).toBe(true);
    }
  });

  it("rejects receipt sent to wrong contract", () => {
    const receipt = buildValidReceipt({
      to: "0x9999999999999999999999999999999999999999",
    });
    const result = validateSettlementReceipt(receipt, EXPECTED);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("WRONG_DESTINATION_CONTRACT");
    }
  });

  it("rejects receipt missing SettlementRecorded event", () => {
    const valid = buildValidReceipt();
    const receipt = {
      ...valid,
      logs: [valid.logs[1]!], // only transfer log
    };
    const result = validateSettlementReceipt(receipt, EXPECTED);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("SETTLEMENT_EVENT_NOT_FOUND");
    }
  });

  it("rejects receipt missing Transfer event", () => {
    const valid = buildValidReceipt();
    const receipt = {
      ...valid,
      logs: [valid.logs[0]!], // only settlement log
    };
    const result = validateSettlementReceipt(receipt, EXPECTED);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("TRANSFER_EVENT_NOT_FOUND");
    }
  });

  it("rejects receipt with amount mismatch", () => {
    const receipt = buildValidReceipt();
    const result = validateSettlementReceipt(receipt, {
      ...EXPECTED,
      amountBaseUnits: 5000000n, // expected 5 USDC instead of 1 USDC
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("AMOUNT_MISMATCH");
    }
  });

  it("rejects receipt with recipient mismatch", () => {
    const receipt = buildValidReceipt();
    const result = validateSettlementReceipt(receipt, {
      ...EXPECTED,
      recipientAddress: "0x1111111111111111111111111111111111111111",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("RECIPIENT_MISMATCH");
    }
  });

  it("rejects receipt with token mismatch", () => {
    const receipt = buildValidReceipt();
    const result = validateSettlementReceipt(receipt, {
      ...EXPECTED,
      tokenAddress: "0x2222222222222222222222222222222222222222",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("TOKEN_MISMATCH");
    }
  });

  it("rejects receipt with commitment mismatch", () => {
    const receipt = buildValidReceipt();
    const result = validateSettlementReceipt(receipt, {
      ...EXPECTED,
      commitment: "0x" + "ff".repeat(32),
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("COMMITMENT_MISMATCH");
    }
  });

  it("rejects receipt with version mismatch", () => {
    const receipt = buildValidReceipt();
    const result = validateSettlementReceipt(receipt, {
      ...EXPECTED,
      version: 2,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe("VERSION_MISMATCH");
    }
  });
});
