import type { Metadata } from "next";
import { PRIVACY_POLICY_DATA } from "@/lib/legal/legal-data";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy | Clario",
  description:
    "How Clario processes data across your local device, connected services, and the Monad blockchain.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return <LegalLayout data={PRIVACY_POLICY_DATA} />;
}
