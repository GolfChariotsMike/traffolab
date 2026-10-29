import type { Metadata } from "next";
import { ApplicationForm } from "@/components/account-application/application-form";
import { productName } from "@/lib/site";

export const metadata: Metadata = {
  title: `Trade Account Application | ${productName}`,
  description:
    "Apply for a TraffLabels trade account. TraffLabels is a business of Golf Chariots (Aust) Pty Ltd.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Trade Account Application | TraffLabels",
    description: "Apply for a TraffLabels trade account.",
  },
};

export default function AccountApplicationPage() {
  return <ApplicationForm />;
}
