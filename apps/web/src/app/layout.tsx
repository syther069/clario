import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { ClarioPrivyProvider } from "@/providers/privy-provider";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Clario",
  description: "Verifiable expense workflows for crypto-native teams.",
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
