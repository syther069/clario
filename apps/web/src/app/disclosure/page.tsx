import type { Metadata } from "next";
import { DISCLOSURE_DATA } from "@/lib/legal/legal-data";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Disclosure | Clario",
  description:
    "Risk disclosures, experimental software notice, technical limitations, and affiliation statements.",
  alternates: {
    canonical: "/disclosure",
  },
};

export default function DisclosurePage() {
  return <LegalLayout data={DISCLOSURE_DATA} />;
}
