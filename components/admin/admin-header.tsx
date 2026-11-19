const LINKS = [
  ["orders", "/admin/orders/", "Orders"],
  ["costs", "/admin/costs/", "Costs"],
  ["stock", "/admin/stock/", "Stock"],
  ["applications", "/admin/account-applications/", "Account applications"],
] as const;

export function AdminHeader({
  signedInEmail,
  current,
}: {
  signedInEmail?: string;
  current: (typeof LINKS)[number][0];
}) {
  return (
    <header className="border-b border-white/10 bg-[#12151a]">
      <div className="h-1 bg-[#fee100]" />
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
        <p className="font-heading text-lg font-semibold tracking-tight">TraffLabels</p>
        <nav className="flex flex-wrap items-center gap-3" aria-label="Dashboard">
          {LINKS.map(([id, href, label]) =>
            id === current ? (
              <span key={id} className="text-sm font-medium text-white" aria-current="page">
                {label}
              </span>
            ) : (
              <a key={id} href={href} className="text-sm text-[#fee100] hover:underline">
                {label}
              </a>
            )
          )}
          {signedInEmail ? <p className="hidden text-sm text-white/55 sm:block">{signedInEmail}</p> : null}
          <form action="/api/admin/logout/" method="post">
            <button
              type="submit"
              className="rounded-full border border-white/25 px-3 py-1 text-sm text-white/90 hover:bg-white/10"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
