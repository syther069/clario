import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { ClarioPrivyProvider } from "@/providers/privy-provider";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Clario | Verifiable Expense Ledger on Monad",
  description: "Verifiable expense workflows and cryptographic receipts on Monad.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/clario-logo.png", type: "image/png", sizes: "1024x1024" },
      { url: "/clario-logo.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="light" className="antialiased">
      <body className="bg-grid min-h-screen text-[#121212] antialiased">
        <ClarioPrivyProvider>
          <ToastProvider>{children}</ToastProvider>
        </ClarioPrivyProvider>
      </body>
    </html>
  );
}
