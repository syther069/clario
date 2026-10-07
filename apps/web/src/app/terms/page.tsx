import type { Metadata } from "next";
import { TERMS_OF_SERVICE_DATA } from "@/lib/legal/legal-data";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Terms of Service | Clario",
  description:
    "Terms and conditions governing use of the Clario application, protocol contracts, and verification tools.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return <LegalLayout data={TERMS_OF_SERVICE_DATA} />;
}
