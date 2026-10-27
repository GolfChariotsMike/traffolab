import { BrandLogo } from "@/components/brand-logo";

export default function ProofNotFound() {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="h-1 bg-[#fee100]" />
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <BrandLogo className="h-8" priority />
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-16">
        <h1 className="font-heading text-2xl font-semibold">Proof link not found</h1>
        <p className="max-w-md text-sm leading-relaxed text-neutral-600">
          This TraffLabels proof link is not valid. Ask the person who sent it for a new one.
        </p>
      </main>
    </div>
  );
}
