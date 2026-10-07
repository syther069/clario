import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clario — Cryptographic Expense Ledger on Monad",
  description:
    "Private offchain evidence with cryptographic commitment verification on Monad testnet. Seamless dual-ledger tracking for personal, freelancer, family, and business finances.",
  openGraph: {
    title: "Clario — Cryptographic Expense Ledger on Monad",
    description:
      "Private offchain evidence with cryptographic commitment verification on Monad testnet. 10,000+ TPS parallel settlement and anti-duplicate nullifier protection.",
    type: "website",
    url: "https://clario.finance/landing",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clario — Cryptographic Expense Ledger on Monad",
    description:
      "Private offchain evidence with cryptographic commitment verification on Monad testnet.",
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
