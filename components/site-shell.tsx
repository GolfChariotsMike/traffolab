"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const studio = pathname.startsWith("/admin");

  if (studio) {
    return <div className="min-h-full bg-[#0c0d10] text-paper">{children}</div>;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
