export type StatTone = "teal" | "coral" | "amber" | "ink";

export type LedgerStat = {
  label: string;
  value: string;
  helper: string;
  tone: StatTone;
};

export type PendingBill = {
  id: string;
  title: string;
  payer: string;
  amount: string;
  date: string;
};

export type RecentBill = {
  id: string;
  title: string;
  payer: string;
  share: string;
  amount: string;
  date: string;
};
