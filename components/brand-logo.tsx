import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/trafflabels-logo.png"
      alt="TraffLabels"
      width={741}
      height={150}
      className={cn("h-7 w-auto sm:h-8", className)}
      priority={priority}
    />
  );
}
