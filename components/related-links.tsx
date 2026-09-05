import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type RelatedLink = {
  href: string;
  title: string;
  description: string;
};

export function RelatedLinks({ links }: { links: RelatedLink[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {links.map((link) => (
        <Card key={link.href}>
          <CardHeader>
            <CardTitle>{link.title}</CardTitle>
            <CardDescription>{link.description}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href={link.href}>Read more</Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
