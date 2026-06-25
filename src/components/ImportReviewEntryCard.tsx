import type { ReactNode } from "react";
import { ArrowRight, FileUp, HelpCircle, Inbox, ReceiptText, Sparkles } from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";

type ImportReviewEntryContext = "dashboard" | "records" | "monthly";

export type ImportReviewEntryOverview = {
  recentBatchCount: number;
  pendingItemCount: number;
  needDiscussionCount: number;
  warning?: string | null;
};

type ImportReviewEntryCardProps = {
  context: ImportReviewEntryContext;
  className?: string;
  overview?: ImportReviewEntryOverview | null;
  monthLabel?: string;
};

const entryCopy: Record<
  ImportReviewEntryContext,
  {
    eyebrow: string;
    title: string;
    body: ReactNode;
    color: "app-yellow" | "app-teal" | "app-green";
    icon: ReactNode;
  }
> = {
  dashboard: {
    eyebrow: "Import Review",
    title: "共同对账模式",
    body: "先把微信/支付宝账单放进待对账池，再一条条确认入账。",
    color: "app-yellow",
    icon: <Inbox aria-hidden="true" size={26} />
  },
  records: {
    eyebrow: "Bill Pocket",
    title: "有微信/支付宝流水？先去共同对账",
    body: "外部账单可以先变成待确认的小纸条，确认后才会出现在正式流水里。",
    color: "app-teal",
    icon: <ReceiptText aria-hidden="true" size={24} />
  },
  monthly: {
    eyebrow: "Month Patch",
    title: "想补齐这个月的流水？去共同对账",
    body: "把遗漏的账单先放进待对账池，确认入账后这张月报会自然更新。",
    color: "app-green",
    icon: <Sparkles aria-hidden="true" size={24} />
  }
};

export function ImportReviewEntryCard({
  className = "",
  context,
  monthLabel,
  overview
}: ImportReviewEntryCardProps) {
  const copy = entryCopy[context];
  const isDashboard = context === "dashboard";

  return (
    <Card
      color="default"
      pattern={isDashboard ? "app-teal" : "app-yellow"}
      className={`relative overflow-visible p-5 sm:p-6 ${className}`}
      data-import-review-entry={context}
    >
      <span
        aria-hidden="true"
        className="absolute -top-3 left-8 h-7 w-24 -rotate-2 rounded-[10px] bg-[#f7cd67]/75 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#82d5bb]/55 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className={isDashboard ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center" : "grid gap-4"}>
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
            <Icon name="icon-shopping" size={20} bounce />
            {copy.eyebrow}
          </p>
          <div className="mt-4">
            <Title size={isDashboard ? "large" : "middle"} color={copy.color}>
              {copy.title}
            </Title>
          </div>
          <p className="mt-4 max-w-3xl text-sm font-bold leading-7 text-[#725d42]">
            {copy.body}
            {context === "monthly" && monthLabel ? (
              <span className="ml-1 text-[#1f7a70]">正在整理 {monthLabel}。</span>
            ) : null}
          </p>

          <Divider type="wave-yellow" className="my-5" />

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <EntryLink href="/imports" dataKey="imports">
              <ArrowRight aria-hidden="true" size={17} />
              去共同对账
            </EntryLink>
            <EntryLink href="/imports/new" dataKey="new" secondary>
              <FileUp aria-hidden="true" size={17} />
              导入新账单
            </EntryLink>
          </div>
        </div>

        {isDashboard ? <OverviewNote overview={overview} /> : <MiniReadOnlyNote icon={copy.icon} />}
      </div>
    </Card>
  );
}

function EntryLink({
  children,
  dataKey,
  href,
  secondary = false
}: {
  children: ReactNode;
  dataKey: "imports" | "new";
  href: string;
  secondary?: boolean;
}) {
  const className = secondary
    ? "border-2 border-dashed border-[#d9c49b] bg-white/85 text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] hover:bg-[#e9fbf4]"
    : "bg-[#f7cd67] text-[#794f27] shadow-[0_5px_0_#d9a43e] hover:shadow-[0_7px_0_#d9a43e]";

  return (
    <IslandLink
      href={href}
      data-import-review-entry-imports-link={dataKey === "imports" ? "true" : undefined}
      data-import-review-entry-new-link={dataKey === "new" ? "true" : undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-black transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25 ${className}`}
    >
      {children}
    </IslandLink>
  );
}

function OverviewNote({ overview }: { overview?: ImportReviewEntryOverview | null }) {
  if (!overview) {
    return <MiniReadOnlyNote icon={<Inbox aria-hidden="true" size={26} />} />;
  }

  return (
    <div
      data-import-review-entry-overview="true"
      className="rounded-[30px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-4 shadow-[0_7px_0_rgba(121,79,39,0.09)]"
    >
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
        <HelpCircle aria-hidden="true" size={16} />
        对账小便签
      </p>
      <div className="mt-4 grid gap-2">
        <OverviewMetric label="最近批次" value={`${overview.recentBatchCount} 批`} />
        <OverviewMetric label="待确认" value={`${overview.pendingItemCount} 条`} />
        <OverviewMetric label="待讨论" value={`${overview.needDiscussionCount} 条`} />
      </div>
      {overview.warning ? (
        <p className="mt-3 rounded-[18px] bg-[#fff8da] px-3 py-2 text-xs font-black leading-5 text-[#8a6420] shadow-[inset_0_0_0_2px_rgba(247,205,103,0.45)]">
          {overview.warning}
        </p>
      ) : (
        <p className="mt-3 text-xs font-bold leading-5 text-[#725d42]">
          这里只读看看待对账池，不会改变账本或结算。
        </p>
      )}
    </div>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] bg-white/80 px-3 py-2 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.45)]">
      <span className="text-xs font-black text-[#8a7556]">{label}</span>
      <span className="text-sm font-black text-[#794f27]">{value}</span>
    </div>
  );
}

function MiniReadOnlyNote({ icon }: { icon: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[24px] border-2 border-dashed border-[#82d5bb] bg-[#e9fbf4] px-4 py-3 text-sm font-black leading-6 text-[#1f7a70]">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_4px_0_#5fb89f]">
        {icon}
      </span>
      <span>只读入口：打开对账池或上传页，本卡片不会写入数据库。</span>
    </div>
  );
}
