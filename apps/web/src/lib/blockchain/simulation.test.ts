import { describe, it, expect, vi, beforeEach } from "vitest";
import { simulateMonadTransaction } from "./simulation";
import * as viem from "viem";

vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof viem>("viem");
  return {
    ...actual,
    createPublicClient: vi.fn(),
  };
});

describe("Alchemy Monad Pre-Flight Transaction Simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success and gas estimates when simulation passes", async () => {
    const mockCall = vi.fn().mockResolvedValue({ data: "0x" });
    const mockEstimateGas = vi.fn().mockResolvedValue(42000n);
    const mockGetGasPrice = vi.fn().mockResolvedValue(50000000000n);

    vi.mocked(viem.createPublicClient).mockReturnValue({
      call: mockCall,
      estimateGas: mockEstimateGas,
      getGasPrice: mockGetGasPrice,
    } as unknown as ReturnType<typeof viem.createPublicClient>);

    const res = await simulateMonadTransaction({
      from: "0x1111111111111111111111111111111111111111",
      to: "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87",
      data: "0x12345678",
    });

    expect(res.success).toBe(true);
    expect(res.gasEstimate).toBe(42000n);
    expect(res.provider).toBe("alchemy");
    expect(res.gasCostGwei).toBeDefined();
    expect(res.simulatedAt).toBeDefined();
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockEstimateGas).toHaveBeenCalledTimes(1);
  });

  it("handles reverts cleanly and returns errorReason without throwing", async () => {
    const mockCall = vi.fn().mockRejectedValue(new Error("ReceiptAlreadyExists"));
    const mockEstimateGas = vi.fn();

    vi.mocked(viem.createPublicClient).mockReturnValue({
      call: mockCall,
      estimateGas: mockEstimateGas,
    } as unknown as ReturnType<typeof viem.createPublicClient>);

    const res = await simulateMonadTransaction({
      to: "0x92f9B76673C1D88c9E3c490A88eB95b08823bA87",
      data: "0x99999999",
    });

    expect(res.success).toBe(false);
    expect(res.gasEstimate).toBe(0n);
    expect(res.errorReason).toContain("ReceiptAlreadyExists");
    expect(res.provider).toBe("alchemy");
  });
});
