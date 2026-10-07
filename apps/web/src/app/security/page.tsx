import type { Metadata } from "next";
import { SECURITY_DATA } from "@/lib/legal/legal-data";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Security Details | Clario",
  description:
    "Cryptographic mechanisms, storage architecture, access controls, and verified boundaries built into Clario.",
  alternates: {
    canonical: "/security",
  },
};

export default function SecurityPage() {
  return <LegalLayout data={SECURITY_DATA} />;
}
