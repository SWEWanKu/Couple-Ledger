import type { LedgerStat } from "@/types/ledger";

const toneClasses: Record<LedgerStat["tone"], string> = {
  teal: "border-l-ledger-teal",
  coral: "border-l-ledger-coral",
  amber: "border-l-ledger-amber",
  ink: "border-l-ledger-ink"
};

type StatCardProps = {
  stat: LedgerStat;
};

export function StatCard({ stat }: StatCardProps) {
  return (
    <article className={`rounded-md border border-ledger-line border-l-4 bg-ledger-panel p-5 shadow-panel ${toneClasses[stat.tone]}`}>
      <p className="text-sm font-medium text-ledger-muted">{stat.label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-normal text-ledger-ink">{stat.value}</p>
      <p className="mt-2 text-sm text-ledger-muted">{stat.helper}</p>
    </article>
  );
}
