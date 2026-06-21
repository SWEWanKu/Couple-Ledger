import { Cloud, ShieldCheck } from "lucide-react";

type TopbarProps = {
  title: string;
  subtitle: string;
};

export function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header className="flex min-h-20 items-center justify-between border-b border-ledger-line bg-ledger-panel px-6 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ledger-muted">小岛账本</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-ledger-ink">{title}</h1>
        <p className="mt-1 text-sm text-ledger-muted">{subtitle}</p>
      </div>
      <div className="hidden items-center gap-3 xl:flex">
        <span className="inline-flex items-center gap-2 rounded-md border border-ledger-line bg-ledger-paper px-3 py-2 text-xs font-medium text-ledger-muted">
          <Cloud aria-hidden="true" size={15} />
          Supabase Auth/RLS
        </span>
        <span className="inline-flex items-center gap-2 rounded-md bg-ledger-teal px-3 py-2 text-xs font-semibold text-white">
          <ShieldCheck aria-hidden="true" size={15} />
          RLS 保护
        </span>
      </div>
    </header>
  );
}
