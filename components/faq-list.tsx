"use client";

import { Fragment, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { faqSegments, type FaqItem } from "@/lib/faq";
import { cn } from "@/lib/utils";

/**
 * Every answer is in the initial HTML. Closed panels stay mounted and are
 * clipped with CSS, so the accordion does not unmount them the way Radix does.
 */
export function FaqList({ items }: { items: readonly FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="flex w-full flex-col border-t">
      {items.map((item, index) => {
        const open = openIndex === index;
        const panelId = `faq-panel-${index}`;
        const triggerId = `faq-trigger-${index}`;
        return (
          <div
            key={item.question}
            data-state={open ? "open" : "closed"}
            className="not-last:border-b"
          >
            <h3 className="flex">
              <button
                id={triggerId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                className="group/accordion-trigger relative flex flex-1 items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground"
                onClick={() => setOpenIndex(open ? null : index)}
              >
                {item.question}
                <ChevronDownIcon
                  data-slot="accordion-trigger-icon"
                  className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
                />
                <ChevronUpIcon
                  data-slot="accordion-trigger-icon"
                  className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              className={cn(
                "grid text-sm motion-reduce:transition-none transition-[grid-template-rows] duration-200 ease-out",
                open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="pt-0 pb-2.5 text-muted-foreground [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4">
                  <p>
                    {faqSegments(item.answer).map((part, partIndex) =>
                      typeof part === "string" ? (
                        <Fragment key={partIndex}>{part}</Fragment>
                      ) : (
                        <a key={partIndex} href={part.href}>
                          {part.text}
                        </a>
                      ),
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
