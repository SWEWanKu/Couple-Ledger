import type { LedgerStat } from "@/types/ledger";
import { Card } from "animal-island-ui";

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
    <Card color="default" className={`p-5 ${toneClasses[stat.tone]}`}>
      <p className="text-sm font-black text-[#9f927d]">{stat.label}</p>
      <p className="mt-3 text-2xl font-black tracking-normal text-[#794f27]">{stat.value}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">{stat.helper}</p>
    </Card>
  );
}
