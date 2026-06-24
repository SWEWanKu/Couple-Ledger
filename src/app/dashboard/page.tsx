import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRightLeft,
  BadgeCheck,
  ChartPie,
  CheckCircle2,
  Clock3,
  Home,
  Hourglass,
  PlusCircle,
  ReceiptText,
  ShieldCheck,
  Tags,
  UsersRound,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { NotebookEmptyState } from "@/components/NotebookEmptyState";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import { getDashboardLedgerSummary } from "@/lib/dashboard/ledger-summary";
import {
  getDashboardRecentActivity,
  type DashboardRecentActivityRecord,
  type DashboardRecentActivityResult
} from "@/lib/dashboard/recent-activity";
import {
  getMonthlyLedgerSummary,
  type MonthlyLedgerCategoryBreakdownItem,
  type MonthlyLedgerPayerBreakdownItem,
  type MonthlyLedgerSummaryResult
} from "@/lib/ledger/get-monthly-ledger-summary";
import { getRecordsHref } from "@/lib/ledger/records-query";
import {
  getSettlementSnapshotStatus,
  type GetSettlementSnapshotStatusResult
} from "@/lib/settlement/get-settlement-snapshot-status";
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

const statToneTapeClasses: Record<LedgerStat["tone"], string> = {
  teal: "bg-[#82d5bb]/70",
  coral: "bg-[#f8a6b2]/70",
  amber: "bg-[#f7cd67]/75",
  ink: "bg-white/70"
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
  const monthlyLedgerSummary = await getMonthlyLedgerSummary(supabase, {
    householdId: membership.household_id,
    currentUserId: user.id,
    categories: householdSummary.categories,
    members: householdSummary.members,
    month: ledgerSummary.monthStart.slice(0, 7)
  });
  const settlementStatus = await getSettlementSnapshotStatus(supabase, {
    householdId: membership.household_id,
    month: ledgerSummary.monthStart.slice(0, 7)
  });
  const recentActivity = await getDashboardRecentActivity(supabase, {
    householdId: membership.household_id,
    currentUserId: user.id,
    categories: householdSummary.categories,
    members: householdSummary.members,
    limit: 6
  });
  const ledgerStats = createLedgerStats(ledgerSummary);

  return (
    <AppShell
      title={`${householdSummary.householdName} 小岛月记`}
      subtitle={`已通过 ${householdSummary.householdName} 成员检查，当前角色：${formatMemberRole(membership.role)}。`}
    >
      <div className="mx-auto grid max-w-6xl gap-6">
        <DashboardMonthHero
          householdName={householdSummary.householdName}
          role={membership.role}
          summary={ledgerSummary}
        />

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

        <MonthlyLedgerNotebookCard result={monthlyLedgerSummary} />

        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <CategoryBreakdownCard items={ledgerSummary.categoryBreakdown} />
          <RecentRecordsCard records={ledgerSummary.recentRecords} />
        </section>

        <RecentIslandActivityCard
          activity={recentActivity}
          currentUserId={user.id}
          settlementStatus={settlementStatus}
        />

        <SettlementEntryCard
          currentUserId={user.id}
          settlementStatus={settlementStatus}
          summary={ledgerSummary}
        />
      </div>
    </AppShell>
  );
}

function DashboardMonthHero({
  householdName,
  role,
  summary
}: {
  householdName: string;
  role: string;
  summary: DashboardLedgerSummary;
}) {
  const hasNoRecords = summary.entryCount === 0;
  const isLowData = summary.entryCount > 0 && summary.entryCount < 3;
  const memoTitle = hasNoRecords
    ? "这个月还没有记录"
    : isLowData
      ? "这个月刚刚长出账本贴纸"
      : "这个月的小岛账本正在慢慢成形";
  const memoBody = hasNoRecords
    ? "从一笔小小的日常开始，给小岛留下今天的生活痕迹。"
    : "这些数字只来自本月真实流水，后面继续记账时会自动更新这张月记。";

  return (
    <Card color="default" pattern="app-teal" className="relative overflow-visible px-4 py-6 sm:px-7 sm:py-8">
      <span
        aria-hidden="true"
        className="absolute -top-4 left-8 h-8 w-28 -rotate-2 rounded-[10px] bg-[#f7cd67]/75 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-stretch">
        <div className="min-w-0">
          <p className="inline-flex max-w-full items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
            <Icon name="icon-map" size={22} bounce />
            <span className="truncate">小岛月报</span>
          </p>

          <div className="mt-5">
            <span className="hidden sm:inline-block">
              <Title size="large" color="app-yellow">
                小岛月记
              </Title>
            </span>
            <span className="inline-block sm:hidden">
              <Title size="middle" color="app-yellow">
                小岛月记
              </Title>
            </span>
          </div>

          <p className="mt-5 max-w-3xl text-base font-bold leading-8 text-[#725d42] sm:text-lg">
            {householdName} 的本月账本已经接上 Supabase，只展示真实读取到的流水和小岛资料。
          </p>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
            <div className="relative rounded-[30px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3]/95 px-4 py-4 text-sm font-bold leading-7 text-[#725d42] shadow-[0_6px_0_rgba(121,79,39,0.08)]">
              <span
                aria-hidden="true"
                className="absolute -top-2 right-8 h-5 w-16 rotate-2 rounded-[8px] bg-[#f8a6b2]/60"
              />
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
                <Icon name="icon-chat" size={18} bounce />
                Month Memo
              </p>
              <p className="mt-2 text-base font-black text-[#794f27]">{memoTitle}</p>
              <p className="mt-1">{memoBody}</p>
            </div>

            <div className="rounded-[30px] border-2 border-[#d9c49b] bg-[#fff8da] px-4 py-4 text-sm font-bold leading-7 text-[#725d42] shadow-[0_6px_0_rgba(121,79,39,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">Notebook Status</p>
              <p className="mt-2 text-2xl font-black text-[#794f27]">{summary.entryCount} 条</p>
              <p className="mt-1">
                {hasNoRecords ? "等第一张小票贴上来。" : isLowData ? "低数据月，先轻轻记录。" : "本月资料正在变丰富。"}
              </p>
            </div>
          </div>

          <Divider type="wave-yellow" className="my-6" />

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <IslandLink
              href="/records/new"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
            >
              <PlusCircle aria-hidden="true" size={18} />
              记一笔账
            </IslandLink>
            <IslandLink
              href="/records"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              <ReceiptText aria-hidden="true" size={18} />
              查看流水
            </IslandLink>
          </div>
        </div>

        <aside className="relative rounded-[32px] border-2 border-[#d9c49b] bg-[#fffdf3] p-4 shadow-[0_8px_0_rgba(121,79,39,0.1)]">
          <span className="absolute -top-3 right-8 rotate-3 rounded-full border-2 border-[#d9c49b] bg-[#fff1ed] px-4 py-1 text-xs font-black text-[#9b6c48] shadow-[0_4px_0_rgba(121,79,39,0.08)]">
            {formatMemberRole(role)}
          </span>

          <div className="rounded-[26px] bg-[#82d5bb] px-4 py-4 text-white shadow-[0_5px_0_#5fb89f]">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] opacity-90">
              <WalletCards aria-hidden="true" size={16} />
              Real Ledger
            </p>
            <p className="mt-3 text-3xl font-black leading-tight">{formatMoney(summary.expenseTotal)}</p>
            <p className="mt-1 text-sm font-bold leading-6 text-white/90">本月真实支出流水</p>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-[22px] bg-[#f8f8f0] px-4 py-3 shadow-[0_3px_0_rgba(121,79,39,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">Records</p>
              <p className="mt-1 text-lg font-black text-[#794f27]">{summary.entryCount} 条</p>
            </div>
            <div className="rounded-[22px] bg-[#fff8da] px-4 py-3 shadow-[0_3px_0_rgba(121,79,39,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">Month Range</p>
              <p className="mt-1 text-sm font-black leading-6 text-[#794f27]">
                {summary.monthStart} 至 {summary.nextMonthStart}
              </p>
            </div>
          </div>
        </aside>
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
    <Card color="default" pattern="app-yellow" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -right-3 top-8 hidden h-20 w-9 rotate-3 rounded-r-[18px] border-2 border-l-0 border-[#d9c49b] bg-[#fff1ed] shadow-[0_8px_0_rgba(121,79,39,0.08)] lg:block"
      />
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            <Icon name="icon-map" size={18} bounce />
            Island Roster
          </p>
          <div className="mt-3">
            <Title size="middle" color="app-yellow">
              岛民名册
            </Title>
          </div>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-[#725d42]">
            {summary.householdName} 的成员、分类贴纸都来自 Supabase；这里不展示假账本，只整理当前能安全读到的小岛资料。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
          <SummaryMetric icon={Home} label="共同小岛" value={summary.householdName} accent="bg-[#e9fbf4]" />
          <SummaryMetric icon={UsersRound} label="岛民" value={`${summary.members.length} 人`} accent="bg-[#fff8da]" />
          <SummaryMetric icon={Tags} label="分类贴纸" value={`${summary.categories.length} 个`} accent="bg-[#fff1ed]" />
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
        <div className="relative rounded-[26px] bg-[#fffdf3] p-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
          <span
            aria-hidden="true"
            className="absolute -top-2 left-6 h-5 w-16 -rotate-2 rounded-[8px] bg-[#82d5bb]/70 shadow-[0_4px_0_rgba(121,79,39,0.08)]"
          />
          <p className="text-sm font-black text-[#794f27]">岛民便签</p>
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

        <div className="relative rounded-[26px] bg-[#fffdf3] p-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
          <span
            aria-hidden="true"
            className="absolute -top-2 left-6 h-5 w-16 rotate-2 rounded-[8px] bg-[#f7cd67]/70 shadow-[0_4px_0_rgba(121,79,39,0.08)]"
          />
          <p className="text-sm font-black text-[#794f27]">分类贴纸</p>
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

function MonthlyLedgerNotebookCard({ result }: { result: MonthlyLedgerSummaryResult }) {
  const summary = result.summary;
  const month = summary.range.month;
  const topCategories = summary.categoryBreakdown.slice(0, 4);
  const payerBreakdown = summary.payerBreakdown.slice(0, 2);

  return (
    <Card color="default" pattern="app-green" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-10 h-7 w-24 -rotate-2 rounded-[10px] bg-[#82d5bb]/70 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-12 h-7 w-24 rotate-2 rounded-[10px] bg-[#fff1ed]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="relative grid gap-5 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            <Icon name="icon-diy" size={18} bounce />
            Monthly Ledger Note
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              本月小岛账本小结
            </Title>
          </div>
          <p className="mt-3 text-sm font-bold leading-7 text-[#725d42]">
            这张便签只整理 {summary.range.monthLabel} 的真实流水，不会改动账本、结算便签或任何写入流程。
          </p>

          {result.warning ? (
            <div className="mt-4 flex items-start gap-3 rounded-[24px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-3 text-sm font-black leading-6 text-[#8a6420]">
              <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
              <span>{result.warning}</span>
            </div>
          ) : null}

          <div className="mt-4 rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-4 shadow-[0_5px_0_rgba(121,79,39,0.08)]">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
              <Icon name="icon-chat" size={18} bounce />
              Island Mood
            </p>
            <p className="mt-2 text-lg font-black text-[#794f27]">{summary.mood.title}</p>
            <p className="mt-1 text-sm font-bold leading-7 text-[#725d42]">{summary.mood.body}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniLedgerMetric
              href={getRecordsHref(month, { type: "expense" })}
              label="支出小票"
              value={formatMoney(summary.expenseTotal)}
              helper={`${summary.expenseCount} 笔`}
              tone="coral"
            />
            <MiniLedgerMetric
              href={getRecordsHref(month, { type: "income" })}
              label="收入便签"
              value={formatMoney(summary.incomeTotal)}
              helper={`${summary.incomeCount} 笔`}
              tone="teal"
            />
            <MiniLedgerMetric label="本月净额" value={formatSignedMoney(summary.netAmount)} helper="收入减支出" tone="amber" />
            <MiniLedgerMetric label="总流水" value={`${summary.entryCount} 条`} helper="只读统计" tone="ink" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[28px] bg-[#fffdf3] p-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
              <p className="flex items-center gap-2 text-sm font-black text-[#794f27]">
                <ChartPie aria-hidden="true" size={18} className="text-[#9f927d]" />
                分类贴纸
              </p>
              <div className="mt-3 grid gap-2">
                {topCategories.length > 0 ? (
                  topCategories.map((category) => (
                    <MonthlyCategoryRow key={category.categoryId ?? "uncategorized"} category={category} month={month} />
                  ))
                ) : (
                  <p className="rounded-[22px] border-2 border-dashed border-[#d9c49b] bg-white/70 px-4 py-3 text-sm font-bold leading-6 text-[#725d42]">
                    这个月还没有可展示的分类流水。
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[28px] bg-[#fffdf3] p-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
              <p className="flex items-center gap-2 text-sm font-black text-[#794f27]">
                <UsersRound aria-hidden="true" size={18} className="text-[#9f927d]" />
                经手便签
              </p>
              <div className="mt-3 grid gap-2">
                {payerBreakdown.length > 0 ? (
                  payerBreakdown.map((payer) => (
                    <MonthlyPayerRow key={payer.userId} month={month} payer={payer} />
                  ))
                ) : (
                  <p className="rounded-[22px] border-2 border-dashed border-[#d9c49b] bg-white/70 px-4 py-3 text-sm font-bold leading-6 text-[#725d42]">
                    这个月还没有可展示的成员经手流水。
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MiniLedgerMetric({
  href,
  label,
  value,
  helper,
  tone
}: {
  href?: string;
  label: string;
  value: string;
  helper: string;
  tone: LedgerStat["tone"];
}) {
  const className = `relative block rounded-[24px] p-4 shadow-[0_5px_0_rgba(121,79,39,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.1)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25 ${statToneClasses[tone]}`;
  const content = (
    <>
      <span
        aria-hidden="true"
        className={`absolute -top-2 right-5 h-4 w-12 rotate-2 rounded-[7px] ${statToneTapeClasses[tone]}`}
      />
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">{label}</p>
      <p className="mt-2 break-words text-xl font-black text-[#794f27]">{value}</p>
      <p className="mt-1 text-xs font-bold leading-5 text-[#725d42]">{helper}</p>
    </>
  );

  if (href) {
    return (
      <IslandLink href={href} ariaLabel={`${label} records filter`} className={className}>
        {content}
      </IslandLink>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

function MonthlyCategoryRow({
  category,
  month
}: {
  category: MonthlyLedgerCategoryBreakdownItem;
  month: string;
}) {
  const href = category.categoryId ? getRecordsHref(month, { categoryId: category.categoryId }) : null;
  const className =
    "block rounded-[22px] border-2 border-[#ead9b8] bg-white/75 px-4 py-3 shadow-[0_4px_0_rgba(121,79,39,0.06)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25";
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-black text-[#794f27]">
          {category.categoryIcon ? `${category.categoryIcon} ` : ""}
          {category.categoryName}
        </p>
        <p className="shrink-0 text-sm font-black text-[#794f27]">{formatMoney(category.totalAmount)}</p>
      </div>
      <p className="mt-1 text-xs font-bold leading-5 text-[#9f927d]">
        支出 {formatMoney(category.expenseTotal)} · 收入 {formatMoney(category.incomeTotal)} · {category.recordCount} 条
      </p>
    </>
  );

  if (href) {
    return (
      <IslandLink href={href} ariaLabel={`${category.categoryName} records filter`} className={className}>
        {content}
      </IslandLink>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

function MonthlyPayerRow({
  month,
  payer
}: {
  month: string;
  payer: MonthlyLedgerPayerBreakdownItem;
}) {
  const href = getRecordsHref(month, { paidBy: payer.userId });
  const className =
    "block rounded-[22px] border-2 border-[#ead9b8] bg-white/75 px-4 py-3 shadow-[0_4px_0_rgba(121,79,39,0.06)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25";

  return (
    <IslandLink href={href} ariaLabel={`${payer.userLabel} records filter`} className={className}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-black text-[#794f27]">{payer.userLabel}</p>
        <p className="shrink-0 text-sm font-black text-[#794f27]">{formatMoney(payer.totalHandled)}</p>
      </div>
      <p className="mt-1 text-xs font-bold leading-5 text-[#9f927d]">
        支出经手 {formatMoney(payer.expenseTotal)} · 收入经手 {formatMoney(payer.incomeTotal)} · {payer.recordCount} 条
      </p>
    </IslandLink>
  );
}

function CategoryBreakdownCard({ items }: { items: DashboardCategoryBreakdownItem[] }) {
  return (
    <Card color="default" pattern="app-orange" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-10 h-7 w-24 -rotate-2 rounded-[10px] bg-[#fff1a8]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            Category Stickers
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              消费贴纸
            </Title>
          </div>
          <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">
            只统计本月真实支出流水，看看钱都落在哪些小岛生活角落。
          </p>
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
              className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-[24px] border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-3 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
            >
              <span
                aria-hidden="true"
                className="absolute -top-2 right-5 h-4 w-14 rotate-2 rounded-[7px] bg-[#f7cd67]/60"
              />
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
        <EmptyLedgerState
          eyebrow="Empty Sticker"
          title="还没有分类支出"
          body="记下第一笔支出后，这里会长出你们的小岛消费贴纸。"
          actionHref="/records/new"
          actionLabel="记一笔账"
          iconName="icon-shopping"
        />
      )}
    </Card>
  );
}

function RecentRecordsCard({ records }: { records: DashboardRecentRecord[] }) {
  const isLowData = records.length > 0 && records.length < 3;

  return (
    <Card color="default" pattern="app-teal" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            Receipt Stickers
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              流水便签
            </Title>
          </div>
          <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">
            按本月真实流水日期展示最近 5 条，像贴在月记右侧的小票。
          </p>
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
              className="relative rounded-[24px] border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-3 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
            >
              <span
                aria-hidden="true"
                className="absolute -top-2 right-5 h-4 w-14 -rotate-2 rounded-[7px] bg-[#82d5bb]/55"
              />
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

          {isLowData ? (
            <div className="rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fff8da] px-4 py-3 text-sm font-bold leading-7 text-[#725d42] shadow-[0_4px_0_rgba(121,79,39,0.08)]">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
                <Icon name="icon-chat" size={18} bounce />
                Low Data Memo
              </p>
              <p className="mt-2">
                本月流水还很少，先把它当成刚贴上的小票墙；继续记账后，这里会自然变成完整的月记。
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyLedgerState
          eyebrow="Empty Memo"
          title="这个月还没有记录"
          body="从一笔小小的日常开始，给小岛留下今天的生活痕迹。"
          actionHref="/records/new"
          actionLabel="记一笔账"
          iconName="icon-chat"
        />
      )}
    </Card>
  );
}

function RecentIslandActivityCard({
  activity,
  currentUserId,
  settlementStatus
}: {
  activity: DashboardRecentActivityResult;
  currentUserId: string;
  settlementStatus: GetSettlementSnapshotStatusResult;
}) {
  const memo = getRecentActivitySettlementMemo(settlementStatus, currentUserId);
  const MemoIcon = memo.icon;

  return (
    <Card
      type="dashed"
      color="default"
      pattern="app-yellow"
      className="relative overflow-visible p-5 sm:p-6"
      data-dashboard-recent-activity="true"
    >
      <span
        aria-hidden="true"
        className="absolute -top-3 left-10 h-7 w-24 -rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-12 h-7 w-24 rotate-2 rounded-[10px] bg-[#fff1a8]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            <Icon name="icon-chat" size={18} bounce />
            Island Activity
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              最近小岛动态
            </Title>
          </div>
          <p className="mt-3 text-sm font-bold leading-7 text-[#725d42]">
            把最近写进账本的小纸条贴在这里，快速回到每一张真实记录。
          </p>
        </div>

        <div
          className={`rounded-[28px] border-2 border-dashed px-4 py-4 shadow-[0_5px_0_rgba(121,79,39,0.08)] ${memo.className}`}
          data-dashboard-recent-activity-settlement="true"
        >
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
            <MemoIcon aria-hidden="true" size={16} />
            Settlement Note
          </p>
          <p className="mt-2 text-base font-black text-[#794f27]">{memo.title}</p>
          <p className="mt-1 text-sm font-bold leading-6 text-[#725d42]">{memo.body}</p>
        </div>
      </div>

      <Divider type="wave-yellow" className="my-5" />

      {activity.warning ? (
        <div className="mb-4 flex items-start gap-3 rounded-[24px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-3 text-sm font-black leading-6 text-[#8a6420]">
          <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          <span>{activity.warning}</span>
        </div>
      ) : null}

      {activity.records.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {activity.records.map((record) => (
            <RecentIslandActivityItem key={record.id} record={record} />
          ))}
        </div>
      ) : (
        <NotebookEmptyState
          action={{
            href: "/records/new",
            label: "记一张新便签",
            icon: <PlusCircle aria-hidden="true" size={17} />
          }}
          className="mt-5"
          dataAttributes={{ "data-dashboard-recent-activity-empty": "true" }}
          description="记下第一笔账后，这里会贴出刚刚写进账本的小纸条。"
          eyebrow="Empty Activity"
          iconName="icon-chat"
          title="还没有最近小岛动态"
          tone="teal"
        />
      )}
    </Card>
  );
}

function RecentIslandActivityItem({ record }: { record: DashboardRecentActivityRecord }) {
  const amountClassName = record.entryType === "income" ? "text-[#1f7a70]" : "text-[#b66a2c]";

  return (
    <IslandLink
      href={record.detailHref}
      ariaLabel={`打开 ${record.typeLabel} 记录`}
      className="group relative block rounded-[26px] border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-4 shadow-[0_5px_0_rgba(121,79,39,0.08)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
      data-dashboard-recent-activity-link="true"
    >
      <span
        aria-hidden="true"
        className="absolute -top-2 right-5 h-4 w-14 rotate-2 rounded-[7px] bg-[#82d5bb]/55"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-[#794f27]">
            {record.note?.trim() || "未命名账单"}
          </p>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">
            {record.typeLabel} · {formatShortDate(record.occurredOn)}
          </p>
        </div>
        <p className={`shrink-0 text-base font-black ${amountClassName}`}>{record.amountLabel}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border-2 border-[#d9c49b] bg-white/85 px-3 py-1 text-xs font-black text-[#725d42] shadow-[0_3px_0_rgba(121,79,39,0.08)]">
          {record.categoryIcon ? `${record.categoryIcon} ` : ""}
          {record.categoryName}
        </span>
        <span className="rounded-full border-2 border-[#d9c49b] bg-[#e9fbf4] px-3 py-1 text-xs font-black text-[#1f7a70] shadow-[0_3px_0_rgba(121,79,39,0.08)]">
          {record.paidByLabel}
        </span>
      </div>

      <p className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[#8a7556] transition group-hover:text-[#1f7a70]">
        <ReceiptText aria-hidden="true" size={15} />
        打开这张账单
      </p>
    </IslandLink>
  );
}

function getRecentActivitySettlementMemo(
  status: GetSettlementSnapshotStatusResult,
  currentUserId: string
): {
  title: string;
  body: string;
  icon: LucideIcon;
  className: string;
} {
  if (status.status === "error") {
    return {
      title: "结算便签暂时没翻到",
      body: `${status.month.monthLabel} 的账本动态仍可查看，结算状态稍后再刷新。`,
      icon: AlertCircle,
      className: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  if (status.pendingReplacement) {
    const progress = `${status.pendingReplacement.confirmedCount}/${status.pendingReplacement.requiredConfirmationCount}`;

    return {
      title: "有一张新版结算便签",
      body: `${status.month.monthLabel} 的新版便签正在等待盖章，当前进度 ${progress}。`,
      icon: Hourglass,
      className: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  if (status.status === "no_snapshot") {
    return {
      title: "本月还没有结算便签",
      body: `${status.month.monthLabel} 暂时只有实时账本动态，还没有生成结算存档。`,
      icon: ArrowRightLeft,
      className: "border-[#d9c49b] bg-[#fffdf3]"
    };
  }

  const confirmedUserIds = new Set(status.confirmations.map((confirmation) => confirmation.confirmed_by));
  const progress = `${confirmedUserIds.size}/${status.requiredConfirmationCount}`;

  if (status.status === "fully_confirmed") {
    return {
      title: "本月结算已经对齐",
      body: `${status.month.monthLabel} 已经 ${progress} 盖章完成，动态列表只负责带你回看账单。`,
      icon: CheckCircle2,
      className: "border-[#82d5bb] bg-[#e9fbf4]"
    };
  }

  if (confirmedUserIds.has(currentUserId)) {
    return {
      title: "你已确认，等对方盖章",
      body: `${status.month.monthLabel} 的结算进度是 ${progress}，这里不提供新的确认操作。`,
      icon: BadgeCheck,
      className: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  return {
    title: "结算便签等待确认",
    body: `${status.month.monthLabel} 的结算进度是 ${progress}，需要处理时再去结算页。`,
    icon: Hourglass,
    className: "border-[#f7cd67] bg-[#fff8da]"
  };
}

function SettlementEntryCard({
  currentUserId,
  settlementStatus,
  summary
}: {
  currentUserId: string;
  settlementStatus: GetSettlementSnapshotStatusResult;
  summary: DashboardLedgerSummary;
}) {
  const settlementHref = `/settlement?month=${summary.monthStart.slice(0, 7)}`;
  const teaser = getDashboardSettlementTeaser(settlementStatus, currentUserId);
  const TeaserIcon = teaser.icon;

  return (
    <Card type="dashed" color="default" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-8 h-7 w-24 -rotate-2 rounded-[10px] bg-[#fff1ed]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            <Icon name="icon-diy" size={18} bounce />
            Settlement Notebook
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              小岛结算
            </Title>
          </div>
          <p className="mt-3 text-sm font-bold leading-7 text-[#725d42]">
            看看这个月怎么结算。这里先给一张只读状态贴纸，真正盖章仍然要去结算页。
          </p>
          <Divider type="wave-yellow" className="my-5" />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <IslandLink
              href={settlementHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#82d5bb] px-5 py-3 text-sm font-black text-white shadow-[0_5px_0_#5fb89f] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#5fb89f] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              <ArrowRightLeft aria-hidden="true" size={18} />
              打开结算便签
            </IslandLink>
            <IslandLink
              href="/settlement/history"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              <ReceiptText aria-hidden="true" size={18} />
              翻翻结算手账
            </IslandLink>
            <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-3 text-sm font-black text-[#725d42] shadow-[0_5px_0_rgba(121,79,39,0.12)]">
              <ShieldCheck aria-hidden="true" size={18} />
              看板不盖章，只做提醒
            </span>
          </div>
        </div>
        <div className={`rounded-[28px] border-2 border-dashed px-4 py-4 shadow-[0_5px_0_rgba(121,79,39,0.08)] ${teaser.className}`}>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
            <TeaserIcon aria-hidden="true" size={16} />
            Settlement Status
          </p>
          <p className="mt-2 text-lg font-black text-[#794f27]">{teaser.title}</p>
          <p className="mt-1 text-sm font-bold leading-6 text-[#725d42]">
            {teaser.body}
          </p>
          <p className="mt-3 rounded-[20px] bg-white/70 px-3 py-2 text-xs font-black leading-5 text-[#8a7556] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.55)]">
            当前月份 {summary.monthStart.slice(0, 7)} · 本月支出 {formatMoney(summary.expenseTotal)}
          </p>
        </div>
      </div>
    </Card>
  );
}

function getDashboardSettlementTeaser(
  status: GetSettlementSnapshotStatusResult,
  currentUserId: string
) {
  if (status.status === "error") {
    return {
      title: "结算便签暂时读不到",
      body: "实时账本仍然可以看，结算状态稍后再翻这页。",
      icon: AlertCircle,
      className: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  if (status.status === "no_snapshot") {
    return {
      title: "本月结算便签还没提出",
      body: "可以先去结算页看看成员支付、分摊和净额；看板这里不会创建便签。",
      icon: ArrowRightLeft,
      className: "border-[#d9c49b] bg-[#fffdf3]"
    };
  }

  const confirmedUserIds = new Set(status.confirmations.map((confirmation) => confirmation.confirmed_by));
  const progress = `${confirmedUserIds.size}/${status.requiredConfirmationCount}`;

  if (status.status === "fully_confirmed") {
    return {
      title: "本月结算已经对齐",
      body: `这张便签已经 ${progress} 盖章完成，去结算页可以看存档快照。`,
      icon: CheckCircle2,
      className: "border-[#82d5bb] bg-[#e9fbf4]"
    };
  }

  if (confirmedUserIds.has(currentUserId)) {
    return {
      title: "你已确认，等对方盖章",
      body: `这张便签现在是 ${progress}，再等另一位小岛成员确认。`,
      icon: BadgeCheck,
      className: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  return {
    title: "结算便签等待确认",
    body: `这张便签现在是 ${progress}，打开结算页可以盖你自己的确认章。`,
    icon: Hourglass,
    className: "border-[#f7cd67] bg-[#fff8da]"
  };
}

function EmptyLedgerState({
  eyebrow,
  title,
  body,
  actionHref,
  actionLabel,
  iconName
}: {
  eyebrow: string;
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
  iconName: "icon-chat" | "icon-diy" | "icon-shopping";
}) {
  return (
    <NotebookEmptyState
      action={{
        href: actionHref,
        label: actionLabel,
        icon: <PlusCircle aria-hidden="true" size={17} />
      }}
      className="mt-5"
      dataAttributes={{ "data-dashboard-empty-state": title }}
      description={body}
      eyebrow={eyebrow}
      iconName={iconName}
      title={title}
      tone={iconName === "icon-shopping" ? "yellow" : "teal"}
    />
  );
}

function SummaryMetric({
  icon: MetricIcon,
  label,
  value,
  accent
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className={`relative rounded-[24px] p-4 shadow-[0_5px_0_rgba(121,79,39,0.08)] ${accent}`}>
      <span
        aria-hidden="true"
        className="absolute -top-2 right-5 h-4 w-12 rotate-2 rounded-[7px] bg-white/65"
      />
      <div className="flex items-center gap-2 text-sm font-black text-[#9f927d]">
        <MetricIcon aria-hidden="true" size={17} className="text-[#1f7a70]" />
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-lg font-black tracking-normal text-[#794f27]">{value}</p>
    </div>
  );
}

function CategoryChip({ category }: { category: DashboardCategory }) {
  return (
    <span className="rounded-full border-2 border-[#d9c49b] bg-white px-3 py-1 text-xs font-black text-[#725d42] shadow-[0_3px_0_rgba(121,79,39,0.08)]">
      {category.icon ? `${category.icon} ` : ""}
      {category.name}
    </span>
  );
}

function LedgerStatSticker({ stat }: { stat: LedgerStat }) {
  return (
    <article
      className={`relative min-h-[158px] rounded-[30px] border-2 border-dashed p-5 shadow-[0_8px_0_rgba(121,79,39,0.08)] ${statToneClasses[stat.tone]}`}
    >
      <span
        aria-hidden="true"
        className={`absolute -top-3 right-5 h-6 w-16 rotate-2 rounded-[8px] shadow-[0_4px_0_rgba(121,79,39,0.08)] ${statToneTapeClasses[stat.tone]}`}
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-2 left-8 h-5 w-14 -rotate-2 rounded-[8px] bg-white/55 shadow-[0_3px_0_rgba(121,79,39,0.06)]"
      />
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
      helper: "只来自本月真实支出流水",
      tone: "teal"
    },
    {
      label: "本月收入",
      value: formatMoney(summary.incomeTotal),
      helper: "只来自本月真实收入流水",
      tone: "coral"
    },
    {
      label: "本月结余",
      value: formatSignedMoney(summary.balance),
      helper: "收入减支出，暂不含分摊结算",
      tone: "amber"
    },
    {
      label: "本月记录",
      value: `${summary.entryCount} 条`,
      helper: `${summary.monthStart} 至 ${summary.nextMonthStart} 的月记范围`,
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
