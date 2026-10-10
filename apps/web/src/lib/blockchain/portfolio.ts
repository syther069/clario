import { type Address, formatUnits } from "viem";
import { getMonadPublicClient } from "./registry";
import { getHistoricalUsdPrice } from "@/lib/import/pricing";

export interface TreasuryTokenBalance {
  readonly chainId: number;
  readonly chainName: string;
  readonly symbol: string;
  readonly tokenAddress?: Address;
  readonly rawBalance: string;
  readonly formattedBalance: string;
  readonly usdValue: number;
  readonly usdValueFormatted: string;
}

export interface TreasuryPortfolioSummary {
  readonly address: Address;
  readonly totalUsdValue: number;
  readonly totalUsdFormatted: string;
  readonly tokens: readonly TreasuryTokenBalance[];
  readonly fetchedAt: string;
}

// Official Monad Testnet USDC
const MONAD_TESTNET_USDC: Address =
  "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

/**
 * Fetches real-time multi-asset treasury runway and balances for an address on Monad Testnet.
 * Uses Alchemy Monad RPC and Alchemy Prices API for live USD valuation.
 */
export async function getTreasuryPortfolio(
  walletAddress: Address,
): Promise<TreasuryPortfolioSummary> {
  const client = getMonadPublicClient();
  const tokens: TreasuryTokenBalance[] = [];

  // 1. Fetch Native MON balance on Monad Testnet via Alchemy RPC
  try {
    const monBalanceWei = await client.getBalance({ address: walletAddress });
    const formattedMon = formatUnits(monBalanceWei, 18);
    const monNum = parseFloat(formattedMon);

    // Get live price for MON / ETH benchmark
    const priceResult = await getHistoricalUsdPrice({
      chainId: 10143,
      symbol: "MON",
      formattedAmount: formattedMon,
    });

    const usdVal = priceResult ? priceResult.usdValue : monNum * 4.5; // Demo benchmark fallback
    tokens.push({
      chainId: 10143,
      chainName: "Monad Testnet",
      symbol: "MON",
      rawBalance: monBalanceWei.toString(),
      formattedBalance: Number(monNum.toFixed(4)).toString(),
      usdValue: usdVal,
      usdValueFormatted: `$${usdVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    });
  } catch {
    // Continue if native balance lookup fails
  }

  // 2. Fetch Monad Testnet USDC balance via Alchemy RPC
  try {
    const usdcBalanceRaw = (await client.readContract({
      address: MONAD_TESTNET_USDC,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [walletAddress],
    })) as bigint;

    const formattedUsdc = formatUnits(usdcBalanceRaw, 6);
    const usdcNum = parseFloat(formattedUsdc);
    const usdVal = usdcNum * 1.0; // Guaranteed $1.00 pegged

    tokens.push({
      chainId: 10143,
      chainName: "Monad Testnet",
      symbol: "USDC",
      tokenAddress: MONAD_TESTNET_USDC,
      rawBalance: usdcBalanceRaw.toString(),
      formattedBalance: Number(usdcNum.toFixed(2)).toString(),
      usdValue: usdVal,
      usdValueFormatted: `$${usdVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    });
  } catch {
    // Continue if token lookup fails
  }

  const totalUsdValue = tokens.reduce((acc, t) => acc + t.usdValue, 0);

  return {
    address: walletAddress,
    totalUsdValue,
    totalUsdFormatted: `$${totalUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    tokens,
    fetchedAt: new Date().toISOString(),
  };
}
