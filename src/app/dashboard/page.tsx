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
import { Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
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

const statToneClasses: Record<LedgerStat["tone"], string> = {
  teal: "border-[#82d5bb] bg-[#e9fbf4]",
  coral: "border-[#f8a6b2] bg-[#fff1ed]",
  amber: "border-[#f7cd67] bg-[#fff8da]",
  ink: "border-[#d9c49b] bg-[#fffdf3]"
};

const statToneIcons: Record<LedgerStat["tone"], "icon-miles" | "icon-shopping" | "icon-chat" | "icon-diy"> = {
  teal: "icon-shopping",
  coral: "icon-miles",
  amber: "icon-chat",
  ink: "icon-diy"
};

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
      <div className="mx-auto grid max-w-6xl gap-6">
        <Card type="dashed" color="default" className="p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm font-bold leading-6 text-[#725d42]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_5px_0_#5fb89f]">
              <WalletCards aria-hidden="true" size={20} />
            </span>
            <span>账本流水已连接 Supabase，本页只读取本月流水；新增记录和结算会在后续开启。</span>
          </div>
        </Card>

        <DashboardLedgerActions />

        <DashboardHouseholdSummaryCard summary={householdSummary} warning={householdSummaryWarning} />

        {ledgerSummaryWarning ? (
          <div className="flex items-start gap-3 rounded-[24px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-3 text-sm font-black leading-6 text-[#8a6420]">
            <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
            <span>{ledgerSummaryWarning}</span>
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ledgerStats.map((stat) => (
            <LedgerStatSticker key={stat.label} stat={stat} />
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
    <Card color="default" pattern="app-teal" className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            <Icon name="icon-chat" size={18} bounce />
            Island Memo
          </p>
          <div className="mt-3">
            <Title size="middle" color="app-yellow" style={{ fontSize: 22 }}>
              从这里继续整理账本
            </Title>
          </div>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-[#725d42]">
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
    </Card>
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
    <Card color="default" pattern="app-yellow" className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            <Icon name="icon-map" size={18} bounce />
            Current Island
          </p>
          <div className="mt-3">
            <Title size="middle" color="app-yellow" style={{ fontSize: 24 }}>
              {summary.householdName}
            </Title>
          </div>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-[#725d42]">
            小岛身份资料来自 Supabase，本月流水会按真实账本记录汇总。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
          <SummaryMetric icon={Home} label="共同小岛" value={summary.householdName} />
          <SummaryMetric icon={UsersRound} label="成员" value={`${summary.members.length} 人`} />
          <SummaryMetric icon={Tags} label="分类" value={`${summary.categories.length} 个`} />
        </div>
      </div>

      {warning ? (
        <div className="mt-4 flex items-start gap-3 rounded-[24px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-3 text-sm font-black leading-6 text-[#8a6420]">
          <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          <span>{warning}</span>
        </div>
      ) : null}

      <Divider type="dashed-brown" className="my-5" />

      <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-[26px] bg-[#fffdf3] p-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
          <p className="text-sm font-black text-[#794f27]">岛民</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.members.length > 0 ? (
              summary.members.map((member, index) => (
                <span
                  key={member.userId}
                  className="rounded-full border border-[#d9c49b] bg-white px-3 py-1 text-xs font-black text-[#725d42]"
                >
                  {formatMemberLabel(member, index)}
                </span>
              ))
            ) : (
              <span className="text-sm font-bold text-[#9f927d]">暂时没有读取到成员资料。</span>
            )}
          </div>
        </div>

        <div className="rounded-[26px] bg-[#fffdf3] p-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
          <p className="text-sm font-black text-[#794f27]">分类</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.categories.length > 0 ? (
              summary.categories.map((category) => (
                <CategoryChip key={category.id} category={category} />
              ))
            ) : (
              <span className="text-sm font-bold text-[#9f927d]">还没有分类，后续可以再整理小岛账本。</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function CategoryBreakdownCard({ items }: { items: DashboardCategoryBreakdownItem[] }) {
  return (
    <Card color="default" pattern="app-orange" className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            Category Notes
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow" style={{ fontSize: 20 }}>
              分类复盘
            </Title>
          </div>
          <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">只统计本月真实支出流水。</p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_5px_0_#5fb89f]">
          <ChartPie aria-hidden="true" size={23} />
        </span>
      </div>

      <Divider type="dashed-brown" className="my-5" />

      {items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <article
              key={item.categoryId ?? "uncategorized"}
              className="grid grid-cols-[1fr_auto] gap-4 rounded-[24px] bg-[#fffdf3] px-4 py-3 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]"
            >
              <div>
                <p className="font-black text-[#794f27]">
                  {item.categoryIcon ? `${item.categoryIcon} ` : ""}
                  {item.categoryName}
                </p>
                <p className="mt-1 text-sm font-bold text-[#9f927d]">{item.recordCount} 条支出记录</p>
              </div>
              <p className="text-right text-base font-black text-[#794f27]">
                {formatMoney(item.expenseTotal)}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyLedgerState title="这个月还没有分类支出" />
      )}
    </Card>
  );
}

function RecentRecordsCard({ records }: { records: DashboardRecentRecord[] }) {
  return (
    <Card color="default" pattern="app-teal" className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            Receipt Stickers
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow" style={{ fontSize: 20 }}>
              最近账单
            </Title>
          </div>
          <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">按本月真实流水日期展示最近 5 条。</p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27] shadow-[0_5px_0_#d9a43e]">
          <Clock3 aria-hidden="true" size={23} />
        </span>
      </div>

      <Divider type="dashed-brown" className="my-5" />

      {records.length > 0 ? (
        <div className="grid gap-3">
          {records.map((record) => (
            <article
              key={record.id}
              className="rounded-[24px] bg-[#fffdf3] px-4 py-3 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-[#794f27]">
                    {record.note?.trim() || "未命名账单"}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#9f927d]">
                    {formatEntryType(record.entryType)} · {record.categoryIcon ? `${record.categoryIcon} ` : ""}
                    {record.categoryName} · {formatShortDate(record.occurredOn)}
                  </p>
                </div>
                <p className="shrink-0 text-base font-black text-[#794f27]">{formatMoney(record.amount)}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyLedgerState title="这个月还没有记录" />
      )}
    </Card>
  );
}

function SettlementPlaceholder() {
  return (
    <Card type="dashed" color="default" className="p-5 sm:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            <Icon name="icon-diy" size={18} bounce />
            Settlement Preview
          </p>
          <h2 className="mt-2 text-lg font-black text-[#794f27]">本轮暂不计算谁该还谁</h2>
          <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
            这次只验证本月账本流水的只读汇总；结算需要分摊明细，后续单独接入。
          </p>
        </div>
        <span className="w-fit rounded-full bg-[#fffdf3] px-4 py-2 text-sm font-black text-[#9f927d] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
          暂未开启
        </span>
      </div>
    </Card>
  );
}

function EmptyLedgerState({ title }: { title: string }) {
  return (
    <div className="mt-5 rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-6 text-sm font-bold leading-7 text-[#725d42]">
      <p className="font-black text-[#794f27]">{title}</p>
      <p className="mt-2">下一步可以从新增记录开始，把第一笔小岛流水记下来。</p>
    </div>
  );
}

function SummaryMetric({
  icon: MetricIcon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] bg-[#fffdf3] p-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
      <div className="flex items-center gap-2 text-sm font-black text-[#9f927d]">
        <MetricIcon aria-hidden="true" size={17} className="text-[#1f7a70]" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-lg font-black tracking-normal text-[#794f27]">{value}</p>
    </div>
  );
}

function CategoryChip({ category }: { category: DashboardCategory }) {
  return (
    <span className="rounded-full border border-[#d9c49b] bg-white px-3 py-1 text-xs font-black text-[#725d42]">
      {category.icon ? `${category.icon} ` : ""}
      {category.name}
    </span>
  );
}

function LedgerStatSticker({ stat }: { stat: LedgerStat }) {
  return (
    <article
      className={`relative min-h-[156px] rounded-[28px] border-2 p-5 shadow-[0_8px_0_rgba(121,79,39,0.08)] ${statToneClasses[stat.tone]}`}
    >
      <span className="absolute -top-3 right-5 h-6 w-16 rotate-2 rounded-[8px] bg-[#f7cd67]/75 shadow-[0_4px_0_rgba(121,79,39,0.08)]" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">{stat.label}</p>
        <Icon name={statToneIcons[stat.tone]} size={24} bounce />
      </div>
      <p className="mt-4 text-3xl font-black tracking-normal text-[#794f27]">{stat.value}</p>
      <p className="mt-3 text-sm font-bold leading-6 text-[#725d42]">{stat.helper}</p>
    </article>
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
