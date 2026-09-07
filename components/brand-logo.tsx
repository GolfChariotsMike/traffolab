import Image from "next/image";
import { cn } from "@/lib/utils";

/** Intrinsic size of `public/brand/trafflabels-logo.png`. */
const LOGO_WIDTH = 1976;
const LOGO_HEIGHT = 318;

export function BrandLogo({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 self-start",
        className ?? "h-7 sm:h-8"
      )}
    >
      <Image
        src="/brand/trafflabels-logo.png"
        alt="TraffLabels"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        sizes="200px"
        className="h-full w-auto max-w-none shrink-0 object-contain"
        style={{ width: "auto", height: "100%" }}
        priority={priority}
      />
    </span>
  );
}
