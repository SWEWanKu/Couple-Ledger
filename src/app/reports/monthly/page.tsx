import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  ChartPie,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Hourglass,
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
import {
  getMonthlyLedgerSummary,
  type MonthlyLedgerCategoryBreakdownItem,
  type MonthlyLedgerPayerBreakdownItem,
  type MonthlyLedgerSummaryResult
} from "@/lib/ledger/get-monthly-ledger-summary";
import {
  formatMoney,
  getLedgerRecords,
  type LedgerRecord,
  type RecordsMonthRange
} from "@/lib/ledger/list-records";
import {
  getCurrentMonthlyReportHref,
  getMonthlyReportHref,
  getRecordDetailHref,
  getRecordsHref
} from "@/lib/ledger/records-query";
import {
  getSettlementSnapshotStatus,
  type GetSettlementSnapshotStatusResult
} from "@/lib/settlement/get-settlement-snapshot-status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "本月小岛月报 | 小岛账本"
};

type MonthlyReportPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
  }>;
};

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

export default async function MonthlyReportPage({ searchParams }: MonthlyReportPageProps) {
  const params = searchParams ? await searchParams : {};
  const requestedMonth = getSingleParam(params.month);
  const { supabase, user, membership } = await requireHouseholdAccess();
  const { summary: householdSummary, warning: householdWarning } =
    await getDashboardHouseholdSummary(supabase, {
      householdId: membership.household_id,
      currentUserId: user.id
    });
  const monthlySummary = await getMonthlyLedgerSummary(supabase, {
    householdId: membership.household_id,
    currentUserId: user.id,
    categories: householdSummary.categories,
    members: householdSummary.members,
    month: requestedMonth
  });
  const range = monthlySummary.summary.range;
  const recordsResult = await getLedgerRecords(supabase, {
    householdId: membership.household_id,
    currentUserId: user.id,
    categories: householdSummary.categories,
    members: householdSummary.members,
    month: range.month
  });
  const settlementStatus = await getSettlementSnapshotStatus(supabase, {
    householdId: membership.household_id,
    month: range.month
  });
  const recentRecords = recordsResult.records.slice(0, 6);

  return (
    <AppShell
      title={`${householdSummary.householdName} 小岛月报`}
      subtitle={`${range.monthLabel} 的只读手账页，只整理真实账本和结算便签。`}
    >
      <div className="mx-auto grid max-w-6xl gap-6" data-monthly-report="true" data-monthly-report-month={range.month}>
        <ReportNav range={range} />

        <ReportHero
          householdName={householdSummary.householdName}
          range={range}
          result={monthlySummary}
        />

        {householdWarning ? <PageNotice message={householdWarning} /> : null}
        {monthlySummary.warning ? <PageNotice message={monthlySummary.warning} /> : null}
        {recordsResult.warning ? <PageNotice message={recordsResult.warning} /> : null}

        <MonthlyOverviewGrid result={monthlySummary} />

        {monthlySummary.summary.entryCount === 0 ? (
          <NotebookEmptyState
            action={{
              href: getRecordsHref(range.month),
              label: "回到流水记录",
              icon: <ReceiptText aria-hidden="true" size={17} />
            }}
            dataAttributes={{ "data-monthly-report-empty": "true" }}
            description={`${range.monthLabel} 还没有真实流水贴进账本。这里不会生成假示例，等有记录后会自动长出月报。`}
            eyebrow="Empty Report"
            iconName="icon-chat"
            title="这个月的小岛还很安静"
            tone="teal"
          />
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <CategoryStickerBoard items={monthlySummary.summary.categoryBreakdown} month={range.month} />
          <MemberLedgerBoard items={monthlySummary.summary.payerBreakdown} month={range.month} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <RecentRecordBoard records={recentRecords} range={range} />
          <SettlementStatusBoard
            currentUserId={user.id}
            range={range}
            status={settlementStatus}
            totalExpense={monthlySummary.summary.expenseTotal}
          />
        </section>
      </div>
    </AppShell>
  );
}

async function requireHouseholdAccess() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !membership) {
    redirect("/not-invited");
  }

  return {
    supabase,
    user,
    membership: membership as HouseholdMembershipRow
  };
}

function ReportNav({ range }: { range: RecordsMonthRange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <IslandLink
        href="/dashboard"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        回到看板
      </IslandLink>

      <div
        data-monthly-report-month-navigation="true"
        className="flex flex-wrap items-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-2 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      >
        <IslandLink
          href={getMonthlyReportHref(range.previousMonth)}
          data-monthly-report-previous-link="true"
          data-monthly-report-month-nav="previous"
          className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-[#794f27] shadow-[0_3px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          <ChevronLeft aria-hidden="true" size={15} />
          上个月
        </IslandLink>
        <IslandLink
          href={getCurrentMonthlyReportHref()}
          data-monthly-report-current-link="true"
          data-monthly-report-month-nav="current"
          data-monthly-report-month-selected="true"
          className="inline-flex min-h-9 items-center justify-center rounded-full bg-[#f7cd67] px-4 py-2 text-xs font-black text-[#794f27] shadow-[0_3px_0_#d9a43e] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
        >
          {"\u672c\u6708"}
        </IslandLink>
        <IslandLink
          href={getMonthlyReportHref(range.nextMonth)}
          data-monthly-report-next-link="true"
          data-monthly-report-month-nav="next"
          className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-[#794f27] shadow-[0_3px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          下个月
          <ChevronRight aria-hidden="true" size={15} />
        </IslandLink>
      </div>
    </div>
  );
}

function ReportHero({
  householdName,
  range,
  result
}: {
  householdName: string;
  range: RecordsMonthRange;
  result: MonthlyLedgerSummaryResult;
}) {
  const summary = result.summary;

  return (
    <Card color="default" pattern="app-teal" className="relative overflow-visible p-5 sm:p-7">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-10 h-7 w-24 -rotate-2 rounded-[10px] bg-[#82d5bb]/70 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#fff1a8]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-stretch">
        <div className="min-w-0">
          <p className="inline-flex max-w-full items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
            <Icon name="icon-map" size={22} bounce />
            <span className="truncate">Monthly Island Report</span>
          </p>

          <div className="mt-5">
            <span className="hidden sm:inline-block">
              <Title size="large" color="app-yellow">
                本月小岛月报
              </Title>
            </span>
            <span className="inline-block sm:hidden">
              <Title size="middle" color="app-yellow">
                本月小岛月报
              </Title>
            </span>
          </div>

          <p className="mt-5 max-w-3xl text-base font-bold leading-8 text-[#725d42] sm:text-lg">
            {householdName} 在 {range.monthLabel} 的只读手账页。这里汇总真实流水、分类贴纸、成员经手和结算便签，不会改写账本。
          </p>

          <Divider type="wave-yellow" className="my-6" />

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <IslandLink
              href={getRecordsHref(range.month)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
              data-monthly-report-records-link="true"
            >
              <ReceiptText aria-hidden="true" size={18} />
              查看本月流水
            </IslandLink>
            <IslandLink
              href={getSettlementHref(range.month)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
              data-monthly-report-settlement-link="true"
            >
              <ArrowRightLeft aria-hidden="true" size={18} />
              打开结算便签
            </IslandLink>
          </div>
        </div>

        <aside className="relative rounded-[32px] border-2 border-[#d9c49b] bg-[#fffdf3] p-4 shadow-[0_8px_0_rgba(121,79,39,0.1)]">
          <span className="absolute -top-3 right-8 rotate-3 rounded-full border-2 border-[#d9c49b] bg-[#fff1ed] px-4 py-1 text-xs font-black text-[#9b6c48] shadow-[0_4px_0_rgba(121,79,39,0.08)]">
            只读
          </span>

          <div className="rounded-[26px] bg-[#82d5bb] px-5 py-5 text-white shadow-[0_6px_0_#5fb89f]">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] opacity-90">
              <WalletCards aria-hidden="true" size={16} />
              Month Total
            </p>
            <p className="mt-3 text-3xl font-black leading-tight">{formatMoney(summary.expenseTotal)}</p>
            <p className="mt-2 text-sm font-bold leading-6 text-white/90">本月真实支出</p>
          </div>

          <div className="mt-4 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fff8da] px-4 py-3 text-sm font-bold leading-7 text-[#725d42]">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
              <Icon name="icon-chat" size={18} bounce />
              Island Mood
            </p>
            <p className="mt-2 text-base font-black text-[#794f27]">{summary.mood.title}</p>
            <p className="mt-1">{summary.mood.body}</p>
          </div>
        </aside>
      </div>
    </Card>
  );
}

function MonthlyOverviewGrid({ result }: { result: MonthlyLedgerSummaryResult }) {
  const summary = result.summary;
  const metrics = [
    {
      label: "本月支出",
      value: formatMoney(summary.expenseTotal),
      helper: `${summary.expenseCount} 张支出小票`,
      icon: WalletCards,
      tone: "teal"
    },
    {
      label: "本月收入",
      value: formatMoney(summary.incomeTotal),
      helper: `${summary.incomeCount} 张收入便签`,
      icon: ReceiptText,
      tone: "coral"
    },
    {
      label: "本月净额",
      value: formatSignedMoney(summary.netAmount),
      helper: "收入减支出，只读计算",
      icon: ChartPie,
      tone: "amber"
    },
    {
      label: "总流水",
      value: `${summary.entryCount} 条`,
      helper: `${summary.range.monthStart} 至 ${summary.range.nextMonthStart}`,
      icon: Clock3,
      tone: "ink"
    }
  ] as const;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-monthly-report-overview="true">
      {metrics.map((metric) => {
        const MetricIcon = metric.icon;

        return (
          <article
            key={metric.label}
            className={`relative min-h-[154px] rounded-[30px] border-2 border-dashed p-5 shadow-[0_8px_0_rgba(121,79,39,0.08)] ${getMetricToneClass(metric.tone)}`}
          >
            <span
              aria-hidden="true"
              className={`absolute -top-3 right-5 h-6 w-16 rotate-2 rounded-[8px] shadow-[0_4px_0_rgba(121,79,39,0.08)] ${getMetricTapeClass(metric.tone)}`}
            />
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">{metric.label}</p>
              <MetricIcon aria-hidden="true" size={22} className="text-[#1f7a70]" />
            </div>
            <p className="mt-4 text-3xl font-black tracking-normal text-[#794f27]">{metric.value}</p>
            <p className="mt-3 text-sm font-bold leading-6 text-[#725d42]">{metric.helper}</p>
          </article>
        );
      })}
    </section>
  );
}

function CategoryStickerBoard({
  items,
  month
}: {
  items: MonthlyLedgerCategoryBreakdownItem[];
  month: string;
}) {
  return (
    <Card color="default" pattern="app-orange" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-10 h-7 w-24 -rotate-2 rounded-[10px] bg-[#fff1a8]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <SectionHeader
        eyebrow="Category Stickers"
        icon={<Tags aria-hidden="true" size={23} />}
        title="分类贴纸"
        body="按本月真实流水整理分类，不做图表后台，只像把贴纸贴在月报页上。"
      />

      <Divider type="dashed-brown" className="my-5" />

      {items.length > 0 ? (
        <div className="grid gap-3">
          {items.slice(0, 8).map((item) => (
            <IslandLink
              key={item.categoryId ?? "uncategorized"}
              href={getRecordsHref(month, { categoryId: item.categoryId })}
              className="relative block rounded-[24px] border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-3 shadow-[0_5px_0_rgba(121,79,39,0.08)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              <span
                aria-hidden="true"
                className="absolute -top-2 right-5 h-4 w-14 rotate-2 rounded-[7px] bg-[#f7cd67]/60"
              />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-[#794f27]">
                    {item.categoryIcon ? `${item.categoryIcon} ` : ""}
                    {item.categoryName}
                  </p>
                  <p className="mt-1 text-sm font-bold leading-6 text-[#9f927d]">
                    支出 {item.expenseCount} 条 · 收入 {item.incomeCount} 条
                  </p>
                </div>
                <p className="shrink-0 text-right text-base font-black text-[#794f27]">
                  {formatMoney(item.totalAmount)}
                </p>
              </div>
            </IslandLink>
          ))}
        </div>
      ) : (
        <MiniEmpty text="这个月还没有分类贴纸。" />
      )}
    </Card>
  );
}

function MemberLedgerBoard({
  items,
  month
}: {
  items: MonthlyLedgerPayerBreakdownItem[];
  month: string;
}) {
  return (
    <Card color="default" pattern="app-green" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <SectionHeader
        eyebrow="Member Notes"
        icon={<UsersRound aria-hidden="true" size={23} />}
        title="经手成员"
        body="谁经手了多少，只按真实流水做只读整理，不代表结算确认。"
      />

      <Divider type="dashed-brown" className="my-5" />

      {items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <IslandLink
              key={item.userId}
              href={getRecordsHref(month, { paidBy: item.userId })}
              className="relative block rounded-[24px] border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-4 shadow-[0_5px_0_rgba(121,79,39,0.08)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              <span
                aria-hidden="true"
                className="absolute -top-2 right-5 h-4 w-14 -rotate-2 rounded-[7px] bg-[#82d5bb]/55"
              />
              <p className="font-black text-[#794f27]">{item.userLabel}</p>
              <p className="mt-2 text-2xl font-black text-[#794f27]">{formatMoney(item.totalHandled)}</p>
              <p className="mt-2 text-sm font-bold leading-6 text-[#9f927d]">
                支出 {formatMoney(item.expenseTotal)} · 收入 {formatMoney(item.incomeTotal)} · {item.recordCount} 条
              </p>
            </IslandLink>
          ))}
        </div>
      ) : (
        <MiniEmpty text="这个月还没有成员经手流水。" />
      )}
    </Card>
  );
}

function RecentRecordBoard({
  records,
  range
}: {
  records: LedgerRecord[];
  range: RecordsMonthRange;
}) {
  return (
    <Card color="default" pattern="app-yellow" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-10 h-7 w-24 -rotate-2 rounded-[10px] bg-[#f7cd67]/70 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <SectionHeader
        eyebrow="Recent Memos"
        icon={<ReceiptText aria-hidden="true" size={23} />}
        title="最近便签"
        body={`从 ${range.monthLabel} 的真实流水里取最近 6 条，点开能回到原始账单详情。`}
      />

      <Divider type="wave-yellow" className="my-5" />

      {records.length > 0 ? (
        <div className="grid gap-3">
          {records.map((record) => (
            <IslandLink
              key={record.id}
              href={getRecordDetailHref(record.id, range.month, {})}
              className="group relative block rounded-[26px] border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-4 shadow-[0_5px_0_rgba(121,79,39,0.08)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
              data-monthly-report-record-link="true"
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
                    {getEntryTypeLabel(record.entryType)} · {formatShortDate(record.occurredOn)}
                  </p>
                </div>
                <p className={`shrink-0 text-base font-black ${record.entryType === "income" ? "text-[#1f7a70]" : "text-[#b66a2c]"}`}>
                  {formatSignedRecordAmount(record)}
                </p>
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
            </IslandLink>
          ))}
        </div>
      ) : (
        <MiniEmpty text="这个月还没有可以贴到月报里的便签。" />
      )}
    </Card>
  );
}

function SettlementStatusBoard({
  currentUserId,
  range,
  status,
  totalExpense
}: {
  currentUserId: string;
  range: RecordsMonthRange;
  status: GetSettlementSnapshotStatusResult;
  totalExpense: number;
}) {
  const memo = getSettlementMemo(status, currentUserId);
  const MemoIcon = memo.icon;

  return (
    <Card type="dashed" color="default" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#fff1ed]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <SectionHeader
        eyebrow="Settlement Status"
        icon={<ArrowRightLeft aria-hidden="true" size={23} />}
        title="结算状态"
        body="这里只读展示当月结算便签状态，不会盖章、确认或生成新结算。"
      />

      <Divider type="wave-yellow" className="my-5" />

      <div className={`rounded-[28px] border-2 border-dashed px-4 py-4 shadow-[0_5px_0_rgba(121,79,39,0.08)] ${memo.className}`}>
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
          <MemoIcon aria-hidden="true" size={16} />
          {range.month}
        </p>
        <p className="mt-2 text-lg font-black text-[#794f27]">{memo.title}</p>
        <p className="mt-1 text-sm font-bold leading-6 text-[#725d42]">{memo.body}</p>
        <p className="mt-3 rounded-[20px] bg-white/70 px-3 py-2 text-xs font-black leading-5 text-[#8a7556] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.55)]">
          本月支出 {formatMoney(totalExpense)} · 结算页仍是唯一处理入口
        </p>
      </div>

      <IslandLink
        href={getSettlementHref(range.month)}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#82d5bb] px-5 py-3 text-sm font-black text-white shadow-[0_5px_0_#5fb89f] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#5fb89f] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        data-monthly-report-settlement-link="true"
      >
        <ShieldCheck aria-hidden="true" size={18} />
        去结算页查看
      </IslandLink>
    </Card>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body,
  icon
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
          <Icon name="icon-chat" size={18} bounce />
          {eyebrow}
        </p>
        <div className="mt-3">
          <Title size="small" color="app-yellow">
            {title}
          </Title>
        </div>
        <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">{body}</p>
      </div>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27] shadow-[0_5px_0_#d9a43e]">
        {icon}
      </span>
    </div>
  );
}

function PageNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[24px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-3 text-sm font-black leading-6 text-[#8a6420]">
      <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function MiniEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fff8da] px-4 py-4 text-sm font-bold leading-7 text-[#725d42] shadow-[0_4px_0_rgba(121,79,39,0.08)]">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
        <Icon name="icon-chat" size={18} bounce />
        Empty Memo
      </p>
      <p className="mt-2">{text}</p>
    </div>
  );
}

function getSettlementMemo(
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
      title: "结算便签暂时读不到",
      body: `${status.month.monthLabel} 的月报仍可查看，结算状态稍后再刷新。`,
      icon: AlertCircle,
      className: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  if (status.pendingReplacement) {
    const progress = `${status.pendingReplacement.confirmedCount}/${status.pendingReplacement.requiredConfirmationCount}`;

    return {
      title: "有一张新版结算便签",
      body: `${status.month.monthLabel} 的新版便签等待盖章中，当前进度 ${progress}。`,
      icon: Hourglass,
      className: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  if (status.status === "no_snapshot") {
    return {
      title: "本月还没有结算便签",
      body: `${status.month.monthLabel} 暂时只有实时账本月报，还没有保存结算快照。`,
      icon: ArrowRightLeft,
      className: "border-[#d9c49b] bg-[#fffdf3]"
    };
  }

  const confirmedUserIds = new Set(status.confirmations.map((confirmation) => confirmation.confirmed_by));
  const progress = `${confirmedUserIds.size}/${status.requiredConfirmationCount}`;

  if (status.status === "fully_confirmed") {
    return {
      title: "本月结算已经对齐",
      body: `${status.month.monthLabel} 已经 ${progress} 盖章完成，月报只做只读回看。`,
      icon: CheckCircle2,
      className: "border-[#82d5bb] bg-[#e9fbf4]"
    };
  }

  if (confirmedUserIds.has(currentUserId)) {
    return {
      title: "你已确认，等对方盖章",
      body: `${status.month.monthLabel} 的结算进度是 ${progress}，月报页不会提供新的确认按钮。`,
      icon: BadgeCheck,
      className: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  return {
    title: "结算便签等待确认",
    body: `${status.month.monthLabel} 的结算进度是 ${progress}，需要处理时请打开结算页。`,
    icon: Hourglass,
    className: "border-[#f7cd67] bg-[#fff8da]"
  };
}

function getMetricToneClass(tone: "teal" | "coral" | "amber" | "ink") {
  if (tone === "teal") {
    return "border-[#82d5bb] bg-[#e9fbf4]";
  }

  if (tone === "coral") {
    return "border-[#f8a6b2] bg-[#fff1ed]";
  }

  if (tone === "amber") {
    return "border-[#f7cd67] bg-[#fff8da]";
  }

  return "border-[#d9c49b] bg-[#fffdf3]";
}

function getMetricTapeClass(tone: "teal" | "coral" | "amber" | "ink") {
  if (tone === "teal") {
    return "bg-[#82d5bb]/70";
  }

  if (tone === "coral") {
    return "bg-[#f8a6b2]/70";
  }

  if (tone === "amber") {
    return "bg-[#f7cd67]/75";
  }

  return "bg-white/70";
}

function getEntryTypeLabel(entryType: string) {
  return entryType === "income" ? "收入" : "支出";
}

function formatSignedMoney(amount: number) {
  if (amount === 0) {
    return formatMoney(0);
  }

  return `${amount > 0 ? "+" : "-"}${formatMoney(Math.abs(amount))}`;
}

function formatSignedRecordAmount(record: LedgerRecord) {
  const prefix = record.entryType === "income" ? "+" : "-";

  return `${prefix}${formatMoney(Math.abs(record.amount))}`;
}

function formatShortDate(date: string) {
  const [, month, day] = date.split("-");
  return month && day ? `${month}-${day}` : date;
}

function getSettlementHref(month: string) {
  return `/settlement?month=${encodeURIComponent(month)}`;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
