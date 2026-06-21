import { redirect } from "next/navigation";
import {
  AlertCircle,
  ChartPie,
  Clock3,
  Home,
  PlusCircle,
  ReceiptText,
  Tags,
  UsersRound,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/StatCard";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import { getDashboardLedgerSummary } from "@/lib/dashboard/ledger-summary";
import { createClient } from "@/lib/supabase/server";
import type {
  DashboardCategory,
  DashboardCategoryBreakdownItem,
  DashboardHouseholdMember,
  DashboardLedgerSummary,
  DashboardRecentRecord
} from "@/types/dashboard";
import type { LedgerStat } from "@/types/ledger";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    redirect("/not-invited");
  }

  const { summary: householdSummary, warning: householdSummaryWarning } =
    await getDashboardHouseholdSummary(supabase, {
      householdId: membership.household_id,
      currentUserId: user.id
    });
  const { summary: ledgerSummary, warning: ledgerSummaryWarning } =
    await getDashboardLedgerSummary(supabase, {
      householdId: membership.household_id,
      categories: householdSummary.categories
    });
  const ledgerStats = createLedgerStats(ledgerSummary);

  return (
    <AppShell
      title={`${householdSummary.householdName} 账本看板`}
      subtitle={`已通过 ${householdSummary.householdName} 成员检查，当前角色：${formatMemberRole(membership.role)}。`}
    >
      <div className="grid gap-6">
        <section className="rounded-md border border-ledger-line bg-ledger-panel px-4 py-3 text-sm text-ledger-muted">
          <div className="flex items-center gap-2">
            <WalletCards aria-hidden="true" size={17} className="text-ledger-teal" />
            <span>账本流水已连接 Supabase，本页只读取本月流水；新增记录和结算会在后续开启。</span>
          </div>
        </section>

        <DashboardLedgerActions />

        <DashboardHouseholdSummaryCard summary={householdSummary} warning={householdSummaryWarning} />

        {ledgerSummaryWarning ? (
          <div className="flex items-center gap-2 rounded-md border border-ledger-line bg-ledger-panel px-4 py-3 text-sm text-ledger-muted">
            <AlertCircle aria-hidden="true" size={17} className="shrink-0 text-ledger-amber" />
            <span>{ledgerSummaryWarning}</span>
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
          {ledgerStats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <CategoryBreakdownCard items={ledgerSummary.categoryBreakdown} />
          <RecentRecordsCard records={ledgerSummary.recentRecords} />
        </section>

        <SettlementPlaceholder />
      </div>
    </AppShell>
  );
}

function DashboardLedgerActions() {
  return (
    <section className="rounded-md border border-ledger-line bg-ledger-panel p-5 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-ledger-teal">小岛流水</p>
          <h2 className="mt-2 text-lg font-semibold text-ledger-ink">从这里继续整理账本</h2>
          <p className="mt-1 text-sm leading-6 text-ledger-muted">
            看看这个月已经记下的流水，或者把刚发生的一笔账放进同一本小账本。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
          <IslandLink
            href="/records"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-[#fffdf3] px-5 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
          >
            <ReceiptText aria-hidden="true" size={18} />
            查看流水
          </IslandLink>
          <IslandLink
            href="/records/new"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
          >
            <PlusCircle aria-hidden="true" size={18} />
            记一笔账
          </IslandLink>
        </div>
      </div>
    </section>
  );
}

function DashboardHouseholdSummaryCard({
  summary,
  warning
}: {
  summary: Awaited<ReturnType<typeof getDashboardHouseholdSummary>>["summary"];
  warning: string | null;
}) {
  return (
    <section className="rounded-md border border-ledger-line bg-ledger-panel p-5 shadow-panel">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-ledger-teal">小岛资料已连接</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-ledger-ink">
            {summary.householdName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ledger-muted">
            小岛身份资料来自 Supabase；本月流水会按真实账本记录汇总。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
          <SummaryMetric icon={Home} label="共同小岛" value={summary.householdName} />
          <SummaryMetric icon={UsersRound} label="成员" value={`${summary.members.length} 人`} />
          <SummaryMetric icon={Tags} label="分类" value={`${summary.categories.length} 个`} />
        </div>
      </div>

      {warning ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-ledger-line bg-ledger-paper px-4 py-3 text-sm text-ledger-muted">
          <AlertCircle aria-hidden="true" size={17} className="shrink-0 text-ledger-amber" />
          <span>{warning}</span>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-md border border-ledger-line bg-ledger-paper p-4">
          <p className="text-sm font-semibold text-ledger-ink">岛民</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.members.length > 0 ? (
              summary.members.map((member, index) => (
                <span
                  key={member.userId}
                  className="rounded-full border border-ledger-line bg-ledger-panel px-3 py-1 text-xs font-semibold text-ledger-muted"
                >
                  {formatMemberLabel(member, index)}
                </span>
              ))
            ) : (
              <span className="text-sm text-ledger-muted">暂时没有读取到成员资料。</span>
            )}
          </div>
        </div>

        <div className="rounded-md border border-ledger-line bg-ledger-paper p-4">
          <p className="text-sm font-semibold text-ledger-ink">分类</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.categories.length > 0 ? (
              summary.categories.map((category) => (
                <CategoryChip key={category.id} category={category} />
              ))
            ) : (
              <span className="text-sm text-ledger-muted">还没有分类，后续可以再整理小岛账本。</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoryBreakdownCard({ items }: { items: DashboardCategoryBreakdownItem[] }) {
  return (
    <section className="rounded-md border border-ledger-line bg-ledger-panel p-5 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ledger-ink">分类复盘</h2>
          <p className="mt-1 text-sm text-ledger-muted">只统计本月真实支出流水。</p>
        </div>
        <ChartPie aria-hidden="true" className="text-ledger-teal" size={20} />
      </div>

      {items.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {items.map((item) => (
            <article
              key={item.categoryId ?? "uncategorized"}
              className="grid grid-cols-[1fr_auto] gap-4 rounded-md border border-ledger-line bg-ledger-paper p-4"
            >
              <div>
                <p className="font-semibold text-ledger-ink">
                  {item.categoryIcon ? `${item.categoryIcon} ` : ""}
                  {item.categoryName}
                </p>
                <p className="mt-1 text-sm text-ledger-muted">{item.recordCount} 条支出记录</p>
              </div>
              <p className="text-right text-base font-semibold text-ledger-ink">
                {formatMoney(item.expenseTotal)}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyLedgerState title="这个月还没有分类支出" />
      )}
    </section>
  );
}

function RecentRecordsCard({ records }: { records: DashboardRecentRecord[] }) {
  return (
    <section className="rounded-md border border-ledger-line bg-ledger-panel p-5 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ledger-ink">最近账单</h2>
          <p className="mt-1 text-sm text-ledger-muted">按本月真实流水日期展示最近 5 条。</p>
        </div>
        <Clock3 aria-hidden="true" className="text-ledger-teal" size={20} />
      </div>

      {records.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-md border border-ledger-line">
          <div className="grid grid-cols-[1.3fr_0.7fr_0.8fr_0.8fr_0.6fr] bg-ledger-paper px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ledger-muted">
            <span>项目</span>
            <span>类型</span>
            <span>分类</span>
            <span className="text-right">金额</span>
            <span className="text-right">日期</span>
          </div>
          {records.map((record) => (
            <div
              key={record.id}
              className="grid grid-cols-[1.3fr_0.7fr_0.8fr_0.8fr_0.6fr] border-t border-ledger-line px-4 py-3 text-sm text-ledger-ink"
            >
              <span className="font-medium">{record.note?.trim() || "未命名账单"}</span>
              <span className="text-ledger-muted">{formatEntryType(record.entryType)}</span>
              <span className="text-ledger-muted">
                {record.categoryIcon ? `${record.categoryIcon} ` : ""}
                {record.categoryName}
              </span>
              <span className="text-right font-semibold">{formatMoney(record.amount)}</span>
              <span className="text-right text-ledger-muted">{formatShortDate(record.occurredOn)}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyLedgerState title="这个月还没有记录" />
      )}
    </section>
  );
}

function SettlementPlaceholder() {
  return (
    <section className="rounded-md border border-ledger-line bg-ledger-panel p-5 shadow-panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-ledger-teal">结算预览</p>
          <h2 className="mt-2 text-lg font-semibold text-ledger-ink">本轮暂不计算谁该还谁</h2>
          <p className="mt-1 text-sm leading-6 text-ledger-muted">
            这次只验证本月账本流水的只读汇总；结算需要分摊明细，后续单独接入。
          </p>
        </div>
        <span className="w-fit rounded-md bg-ledger-paper px-3 py-1 text-sm font-semibold text-ledger-muted">
          暂未开启
        </span>
      </div>
    </section>
  );
}

function EmptyLedgerState({ title }: { title: string }) {
  return (
    <div className="mt-5 rounded-md border border-dashed border-ledger-line bg-ledger-paper px-4 py-6 text-sm text-ledger-muted">
      <p className="font-semibold text-ledger-ink">{title}</p>
      <p className="mt-2 leading-6">
        下一步可以从新增记录开始，把第一笔小岛流水记下来。
      </p>
    </div>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-ledger-line bg-ledger-paper p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-ledger-muted">
        <Icon aria-hidden="true" size={17} className="text-ledger-teal" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold tracking-normal text-ledger-ink">{value}</p>
    </div>
  );
}

function CategoryChip({ category }: { category: DashboardCategory }) {
  return (
    <span className="rounded-full border border-ledger-line bg-ledger-panel px-3 py-1 text-xs font-semibold text-ledger-muted">
      {category.icon ? `${category.icon} ` : ""}
      {category.name}
    </span>
  );
}

function createLedgerStats(summary: DashboardLedgerSummary): LedgerStat[] {
  return [
    {
      label: "本月支出",
      value: formatMoney(summary.expenseTotal),
      helper: "来自本月真实支出流水",
      tone: "teal"
    },
    {
      label: "本月收入",
      value: formatMoney(summary.incomeTotal),
      helper: "来自本月真实收入流水",
      tone: "coral"
    },
    {
      label: "本月结余",
      value: formatSignedMoney(summary.balance),
      helper: "收入减支出，未含结算预览",
      tone: "amber"
    },
    {
      label: "本月记录",
      value: `${summary.entryCount} 条`,
      helper: `${summary.monthStart} 至 ${summary.nextMonthStart}`,
      tone: "ink"
    }
  ];
}

function formatMemberLabel(member: DashboardHouseholdMember, index: number) {
  const role = formatMemberRole(member.role);
  const name = member.isCurrentUser ? "你" : `成员 ${index + 1}`;

  return `${role} · ${name}`;
}

function formatMemberRole(role: string) {
  return role === "owner" ? "岛主" : "伙伴";
}

function formatEntryType(entryType: string) {
  return entryType === "income" ? "收入" : "支出";
}

function formatMoney(amount: number) {
  return `¥${amount.toFixed(2)}`;
}

function formatSignedMoney(amount: number) {
  if (amount === 0) {
    return formatMoney(0);
  }

  return `${amount > 0 ? "+" : "-"}${formatMoney(Math.abs(amount))}`;
}

function formatShortDate(date: string) {
  const [, month, day] = date.split("-");
  return month && day ? `${month}-${day}` : date;
}
