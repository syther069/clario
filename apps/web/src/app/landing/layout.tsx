import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clario — Private Receipt and Expense Tracking on Monad",
  description:
    "Keep your receipts private on your own device while getting verified proof on Monad testnet. Built for personal budgeting, freelancers, families, and businesses.",
  openGraph: {
    title: "Clario — Private Receipt and Expense Tracking on Monad",
    description:
      "Keep your receipts private on your own device while getting verified proof on Monad testnet. Instant settlement and duplicate protection.",
    type: "website",
    url: "https://clario.finance/landing",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clario — Private Receipt and Expense Tracking on Monad",
    description:
      "Keep your receipts private on your own device while getting verified proof on Monad testnet.",
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
