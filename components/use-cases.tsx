import { useCases } from "@/lib/engraving";

export function UseCases() {
  return (
    <section
      id="use-cases"
      className="border-t border-steel bg-charcoal text-paper"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 md:py-16">
        <div className="flex max-w-3xl flex-col gap-3">
          <p className="font-mono text-[11px] tracking-[0.18em] text-laser uppercase">
            Use cases
          </p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Plates for plant, boards, and field gear
          </h2>
          <p className="text-base leading-relaxed text-haze">
            Same engraved Traffolyte, specified for the job on the board or in
            the plant room.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-px bg-steel sm:grid-cols-3">
          {useCases.map((label) => (
            <li
              key={label}
              className="bg-charcoal px-4 py-4 text-sm font-medium tracking-tight md:text-base"
            >
              <span className="font-mono text-[10px] tracking-[0.16em] text-laser">
                /
              </span>{" "}
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
