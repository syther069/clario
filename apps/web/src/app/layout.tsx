import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { ClarioPrivyProvider } from "@/providers/privy-provider";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Clario | Verifiable Expense Ledger on Monad",
  description: "Verifiable expense workflows and cryptographic receipts on Monad.",
  icons: {
    icon: "/clario-logo.svg",
    shortcut: "/clario-logo.svg",
    apple: "/clario-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="light">
      <body className="bg-grid min-h-screen text-[#121212] antialiased">
        <ClarioPrivyProvider>
          <ToastProvider>{children}</ToastProvider>
        </ClarioPrivyProvider>
      </body>
    </html>
  );
}
