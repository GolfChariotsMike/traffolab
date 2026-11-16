import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
} from "@/components/ui/empty";
import { routes, siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: `Page not found | ${siteName}`,
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center px-4">
      <Empty className="border">
        <EmptyHeader>
          <h1 className="font-heading text-sm font-medium tracking-tight">
            Page not found
          </h1>
          <EmptyDescription>
            That URL is not one of the TraffLabels pages. Head back to Perth
            Traffolyte labels or the homepage.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={routes.home}>Home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.hub}>Perth labels</Link>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
