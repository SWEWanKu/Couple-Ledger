import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  BadgeCheck,
  ChartPie,
  CheckCircle2,
  FileUp,
  Hourglass,
  PlusCircle,
  ReceiptText,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { PrivateIslandTrail, islandTrailLabels } from "@/components/PrivateIslandTrail";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import {
  getDashboardRecentActivity,
  type DashboardRecentActivityRecord,
  type DashboardRecentActivityResult
} from "@/lib/dashboard/recent-activity";
import { getDashboardLedgerSummary } from "@/lib/dashboard/ledger-summary";
import {
  getImportReviewContinueSummary,
  type ImportReviewContinueSummary
} from "@/lib/import-review/batches";
import {
  getMonthlyLedgerSummary,
  type MonthlyLedgerSummaryResult
} from "@/lib/ledger/get-monthly-ledger-summary";
import { getMonthlyReportHref, getRecordsHref } from "@/lib/ledger/records-query";
import {
  getSettlementSnapshotStatus,
  type GetSettlementSnapshotStatusResult
} from "@/lib/settlement/get-settlement-snapshot-status";
import { createClient } from "@/lib/supabase/server";
import type { DashboardLedgerSummary } from "@/types/dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const currentUserId = user.id;

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", currentUserId)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    redirect("/not-invited");
  }

  const { summary: householdSummary, warning: householdSummaryWarning } =
    await getDashboardHouseholdSummary(supabase, {
      householdId: membership.household_id,
      currentUserId
    });
  const { summary: ledgerSummary, warning: ledgerSummaryWarning } =
    await getDashboardLedgerSummary(supabase, {
      householdId: membership.household_id,
      categories: householdSummary.categories
    });
  const monthlyLedgerSummary = await getMonthlyLedgerSummary(supabase, {
    householdId: membership.household_id,
    currentUserId,
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
    currentUserId,
    categories: householdSummary.categories,
    members: householdSummary.members,
    limit: 6
  });
  const importReviewOverview = await getImportReviewContinueSummary(supabase, {
    householdId: membership.household_id,
    limit: 50
  });

  const currentMonth = ledgerSummary.monthStart.slice(0, 7);
  const reportHref = getMonthlyReportHref(currentMonth);
  const recordsHref = getRecordsHref(currentMonth);
  const settlementHref = `/settlement?month=${currentMonth}`;
  const importReviewHasTodo = hasImportReviewTodo(importReviewOverview);
  const readWarning = householdSummaryWarning ?? ledgerSummaryWarning;

  return (
    <AppShell
      compact
      title="小岛首页"
      subtitle="今天先看看本月账本、继续对账，或记一笔新账。"
    >
      <div className="mx-auto grid max-w-6xl gap-5">
        {readWarning ? <WarningNotice message={readWarning} /> : null}

        <DashboardIntroCard
          currentMonth={currentMonth}
          householdName={householdSummary.householdName}
          recordsHref={recordsHref}
          reportHref={reportHref}
          settlementHref={settlementHref}
        />

        <PrivateIslandTrail
          className="py-2"
          items={[
            { label: islandTrailLabels.home, current: true },
            { label: islandTrailLabels.records, href: recordsHref },
            { label: "共同对账", href: "/imports" },
            { label: islandTrailLabels.settlement, href: settlementHref },
            { label: islandTrailLabels.monthlyReport, href: reportHref }
          ]}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px] xl:items-start">
          <section className="grid min-w-0 gap-5 xl:order-1">
            <MonthSummaryCard ledgerSummary={ledgerSummary} monthlySummary={monthlyLedgerSummary} />
            <RecentActivityCard activity={recentActivity} recordsHref={recordsHref} />
          </section>

          <aside className={`grid min-w-0 gap-5 xl:order-2 ${importReviewHasTodo ? "order-first" : ""}`}>
            <ImportReviewTodoCard overview={importReviewOverview} />
            <SettlementStatusCard
              currentUserId={currentUserId}
              settlementHref={settlementHref}
              status={settlementStatus}
              summary={ledgerSummary}
            />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function DashboardIntroCard({
  currentMonth,
  householdName,
  recordsHref,
  reportHref,
  settlementHref
}: {
  currentMonth: string;
  householdName: string;
  recordsHref: string;
  reportHref: string;
  settlementHref: string;
}) {
  return (
    <Card color="default" pattern="app-yellow" className="relative overflow-visible p-4 sm:p-5">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-8 h-7 w-24 -rotate-2 rounded-[10px] bg-[#f7cd67]/75 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
            <Icon name="icon-map" size={18} bounce />
            Next Step
          </p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-[#794f27]">
            下一步做什么
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-[#725d42]">
            {householdName} 的本月手账在这里先摊开：看看花费、接着对账，或者补上一张新的生活小票。
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-2 text-xs font-black text-[#8a7556] shadow-[0_4px_0_rgba(121,79,39,0.08)]">
          <WalletCards aria-hidden="true" size={16} />
          {currentMonth} 账本
        </div>
      </div>

      <Divider type="wave-yellow" className="my-4" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DashboardActionLink href={`/records/new?month=${currentMonth}`} tone="primary">
          <PlusCircle aria-hidden="true" size={18} />
          记一笔账
        </DashboardActionLink>
        <DashboardActionLink href={recordsHref} tone="paper">
          <ReceiptText aria-hidden="true" size={18} />
          查看流水
        </DashboardActionLink>
        <DashboardActionLink href="/imports" tone="mint">
          <ArrowRight aria-hidden="true" size={18} />
          共同对账
        </DashboardActionLink>
        <DashboardActionLink href={reportHref} tone="paper" dataMonthlyReport>
          <ChartPie aria-hidden="true" size={18} />
          打开月报
        </DashboardActionLink>
        <DashboardActionLink href={settlementHref} tone="mint">
          <ArrowRightLeft aria-hidden="true" size={18} />
          去结算
        </DashboardActionLink>
      </div>
    </Card>
  );
}

function DashboardActionLink({
  children,
  dataMonthlyReport = false,
  href,
  tone
}: {
  children: React.ReactNode;
  dataMonthlyReport?: boolean;
  href: string;
  tone: "primary" | "mint" | "paper";
}) {
  const toneClassName = {
    primary: "bg-[#f7cd67] text-[#794f27] shadow-[0_5px_0_#d9a43e] hover:shadow-[0_7px_0_#d9a43e]",
    mint: "bg-[#82d5bb] text-white shadow-[0_5px_0_#5fb89f] hover:shadow-[0_7px_0_#5fb89f]",
    paper:
      "border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] hover:bg-white hover:shadow-[0_7px_0_rgba(121,79,39,0.12)]"
  }[tone];

  return (
    <IslandLink
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25 ${toneClassName}`}
      data-dashboard-monthly-report-link={dataMonthlyReport ? "true" : undefined}
    >
      {children}
    </IslandLink>
  );
}

function MonthSummaryCard({
  ledgerSummary,
  monthlySummary
}: {
  ledgerSummary: DashboardLedgerSummary;
  monthlySummary: MonthlyLedgerSummaryResult;
}) {
  const summary = monthlySummary.summary;
  const topCategory = summary.categoryBreakdown[0] ?? null;
  const topPayer = summary.payerBreakdown[0] ?? null;

  return (
    <Card color="default" pattern="app-teal" className="relative overflow-visible p-4 sm:p-5">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-10 h-7 w-24 -rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
            <Icon name="icon-shopping" size={18} bounce />
            Month Note
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              本月小结
            </Title>
          </div>
          <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-[#725d42]">
            {summary.mood.title}。{summary.mood.body}
          </p>
        </div>
      </div>

      {monthlySummary.warning ? <WarningNotice className="mt-4" message={monthlySummary.warning} /> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <SummaryMetric label="本月支出" value={formatMoney(ledgerSummary.expenseTotal)} helper="真实支出流水" tone="teal" />
        <SummaryMetric label="流水数" value={`${ledgerSummary.entryCount} 条`} helper="本月已记录" tone="yellow" />
        <SummaryMetric
          label="月份范围"
          value={formatMonthRange(ledgerSummary.monthStart, ledgerSummary.nextMonthStart)}
          helper="当前账本月份"
          tone="paper"
        />
      </div>

      <Divider type="dashed-brown" className="my-4" />

      <div className="grid gap-3 md:grid-cols-2">
        <SmallNotebookNote
          iconName="icon-critterpedia"
          label="花得最多"
          value={
            topCategory
              ? `${topCategory.categoryIcon ? `${topCategory.categoryIcon} ` : ""}${topCategory.categoryName}`
              : "还没有分类小票"
          }
          helper={topCategory ? `${formatMoney(topCategory.expenseTotal)} · ${topCategory.recordCount} 条` : "记账后自动出现"}
        />
        <SmallNotebookNote
          iconName="icon-miles"
          label="经手最多"
          value={topPayer?.userLabel ?? "还没有经手记录"}
          helper={topPayer ? `${formatMoney(topPayer.totalHandled)} · ${topPayer.recordCount} 条` : "记账后自动出现"}
        />
      </div>
    </Card>
  );
}

function SummaryMetric({
  helper,
  label,
  tone,
  value
}: {
  helper: string;
  label: string;
  tone: "teal" | "yellow" | "paper";
  value: string;
}) {
  const toneClassName = {
    teal: "bg-[#82d5bb] text-white shadow-[0_5px_0_#5fb89f]",
    yellow: "bg-[#fff8da] text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.08)]",
    paper: "bg-[#fffdf3] text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.08)]"
  }[tone];

  return (
    <div className={`rounded-[24px] px-4 py-4 ${toneClassName}`}>
      <p className="text-xs font-black uppercase tracking-[0.12em] opacity-75">{label}</p>
      <p className="mt-2 break-words text-2xl font-black leading-tight">{value}</p>
      <p className="mt-1 text-xs font-bold opacity-80">{helper}</p>
    </div>
  );
}

function SmallNotebookNote({
  helper,
  iconName,
  label,
  value
}: {
  helper: string;
  iconName: "icon-critterpedia" | "icon-miles";
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-3 shadow-[0_4px_0_rgba(121,79,39,0.08)]">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">
        <Icon name={iconName} size={17} bounce />
        {label}
      </p>
      <p className="mt-2 truncate text-sm font-black text-[#794f27]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#725d42]">{helper}</p>
    </div>
  );
}

function ImportReviewTodoCard({ overview }: { overview: ImportReviewContinueSummary }) {
  const hasTodo = hasImportReviewTodo(overview);
  const continueHref = hasTodo ? overview.continueHref : null;

  return (
    <Card
      color="default"
      pattern={hasTodo ? "app-teal" : "app-yellow"}
      className="relative overflow-visible p-4"
      data-import-review-entry="dashboard"
    >
      <span
        aria-hidden="true"
        className="absolute -top-3 right-8 h-7 w-24 rotate-2 rounded-[10px] bg-[#f7cd67]/70 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
        <Icon name="icon-chat" size={18} bounce />
        共同对账
      </p>
      <div className="mt-3">
        <Title size="small" color={hasTodo ? "app-teal" : "app-yellow"}>
          {hasTodo ? "继续对账" : "对账池"}
        </Title>
      </div>

      <div
        className="mt-4 grid gap-2"
        data-import-review-entry-overview="true"
        data-import-review-entry-continue-href={overview.continueHref ?? undefined}
        data-import-review-entry-continue-state={hasTodo ? "unfinished" : "empty"}
      >
        <CompactCount label="未完成批次" value={`${overview.unfinishedBatchCount} 批`} />
        <CompactCount label="待对账" value={`${overview.totalPendingItemCount} 条`} />
        <CompactCount label="待讨论" value={`${overview.totalNeedDiscussionCount} 条`} />
      </div>

      {overview.warning ? <WarningNotice className="mt-4" message={overview.warning} /> : null}

      <div className="mt-4 grid gap-3">
        {continueHref ? (
          <IslandLink
            href={continueHref}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            data-import-review-entry-continue-link="true"
          >
            <ArrowRight aria-hidden="true" size={17} />
            继续对账
          </IslandLink>
        ) : (
          <IslandLink
            href="/imports"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#82d5bb] px-5 py-2 text-sm font-black text-white shadow-[0_5px_0_#5fb89f] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#5fb89f] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            data-import-review-entry-imports-link="true"
          >
            <ArrowRight aria-hidden="true" size={17} />
            打开对账池
          </IslandLink>
        )}
        <IslandLink
          href="/imports/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
          data-import-review-entry-new-link="true"
        >
          <FileUp aria-hidden="true" size={17} />
          导入新账单
        </IslandLink>
      </div>
    </Card>
  );
}

function CompactCount({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] bg-[#fffdf3] px-3 py-2 text-sm shadow-[inset_0_0_0_2px_rgba(217,196,155,0.55)]">
      <span className="font-black text-[#8a7556]">{label}</span>
      <span className="font-black text-[#794f27]">{value}</span>
    </div>
  );
}

function SettlementStatusCard({
  currentUserId,
  settlementHref,
  status,
  summary
}: {
  currentUserId: string;
  settlementHref: string;
  status: GetSettlementSnapshotStatusResult;
  summary: DashboardLedgerSummary;
}) {
  const copy = getSettlementStatusCopy(status, currentUserId);
  const StatusIcon = copy.icon;

  return (
    <Card type="dashed" color="default" className="relative overflow-visible p-4">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-8 h-7 w-24 -rotate-2 rounded-[10px] bg-[#82d5bb]/60 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
        <Icon name="icon-diy" size={18} bounce />
        结算
      </p>
      <div className="mt-3">
        <Title size="small" color="app-yellow">
          本月结算
        </Title>
      </div>

      <div className={`mt-4 rounded-[24px] border-2 border-dashed px-4 py-3 shadow-[0_5px_0_rgba(121,79,39,0.08)] ${copy.className}`}>
        <p className="flex items-center gap-2 text-sm font-black text-[#794f27]">
          <StatusIcon aria-hidden="true" size={17} />
          {copy.title}
        </p>
        <p className="mt-2 text-xs font-bold leading-5 text-[#725d42]">{copy.body}</p>
      </div>

      <p className="mt-3 rounded-[20px] bg-[#fffdf3] px-3 py-2 text-xs font-black leading-5 text-[#8a7556] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.55)]">
        {summary.monthStart.slice(0, 7)} · 本月支出 {formatMoney(summary.expenseTotal)}
      </p>

      <IslandLink
        href={settlementHref}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#82d5bb] px-5 py-2 text-sm font-black text-white shadow-[0_5px_0_#5fb89f] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#5fb89f] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
      >
        <ArrowRightLeft aria-hidden="true" size={17} />
        去结算
      </IslandLink>
    </Card>
  );
}

function RecentActivityCard({
  activity,
  recordsHref
}: {
  activity: DashboardRecentActivityResult;
  recordsHref: string;
}) {
  const records = activity.records.slice(0, 5);

  return (
    <Card type="dashed" color="default" pattern="app-green" className="relative overflow-visible p-4 sm:p-5" data-dashboard-recent-activity="true">
      <span
        aria-hidden="true"
        className="absolute -top-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#fff1a8]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
            <Icon name="icon-critterpedia" size={18} bounce />
            Recent Notes
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              最近流水
            </Title>
          </div>
        </div>
        <IslandLink
          href={recordsHref}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-2 text-xs font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          查看全部
          <ArrowRight aria-hidden="true" size={15} />
        </IslandLink>
      </div>

      {activity.warning ? <WarningNotice className="mt-4" message={activity.warning} /> : null}

      {records.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {records.map((record) => (
            <RecentActivityItem key={record.id} record={record} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-5 text-center shadow-[0_5px_0_rgba(121,79,39,0.08)]">
          <Icon name="icon-chat" size={34} bounce />
          <p className="mt-3 text-base font-black text-[#794f27]">还没有最近流水</p>
          <p className="mt-1 text-sm font-bold text-[#725d42]">记下第一笔账后，这里会贴出最新的小纸条。</p>
        </div>
      )}
    </Card>
  );
}

function RecentActivityItem({ record }: { record: DashboardRecentActivityRecord }) {
  const amountClassName = record.entryType === "income" ? "text-[#1f7a70]" : "text-[#b66a2c]";
  const title = record.note?.trim() || record.categoryName;

  return (
    <IslandLink
      href={record.detailHref}
      ariaLabel={`打开 ${record.typeLabel} 记录`}
      className="group grid gap-2 rounded-[22px] border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-3 shadow-[0_4px_0_rgba(121,79,39,0.08)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      data-dashboard-recent-activity-link="true"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-[#794f27]">{title}</span>
        <span className="mt-1 block truncate text-xs font-bold text-[#9f927d]">
          {record.categoryIcon ? `${record.categoryIcon} ` : ""}
          {record.categoryName} · {formatShortDate(record.occurredOn)}
        </span>
      </span>
      <span className="flex items-center justify-between gap-3 sm:justify-end">
        <span className={`text-sm font-black ${amountClassName}`}>{record.amountLabel}</span>
        <ArrowRight aria-hidden="true" size={15} className="text-[#9f927d] transition group-hover:text-[#1f7a70]" />
      </span>
    </IslandLink>
  );
}

function WarningNotice({ className = "", message }: { className?: string; message: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-[22px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-3 text-sm font-black leading-6 text-[#8a6420] ${className}`}>
      <AlertCircle aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function hasImportReviewTodo(overview: ImportReviewContinueSummary) {
  return Boolean(overview.latestUnfinishedBatch && overview.continueHref);
}

function getSettlementStatusCopy(
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
      title: "结算状态暂时读不到",
      body: "先看本月账本就好，稍后再回来翻结算便签。",
      icon: AlertCircle,
      className: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  if (status.pendingReplacement) {
    const progress = `${status.pendingReplacement.confirmedCount}/${status.pendingReplacement.requiredConfirmationCount}`;

    return {
      title: "有新版结算待确认",
      body: `新版便签进度 ${progress}，需要时打开结算页继续确认。`,
      icon: Hourglass,
      className: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  if (status.status === "no_snapshot") {
    return {
      title: "还没有结算便签",
      body: "可以去结算页看成员支付、分摊和净额。",
      icon: ArrowRightLeft,
      className: "border-[#d9c49b] bg-[#fffdf3]"
    };
  }

  const confirmedUserIds = new Set(status.confirmations.map((confirmation) => confirmation.confirmed_by));
  const progress = `${confirmedUserIds.size}/${status.requiredConfirmationCount}`;

  if (status.status === "fully_confirmed") {
    return {
      title: "本月已经对齐",
      body: `确认进度 ${progress}，存档可以在结算页查看。`,
      icon: CheckCircle2,
      className: "border-[#82d5bb] bg-[#e9fbf4]"
    };
  }

  if (confirmedUserIds.has(currentUserId)) {
    return {
      title: "你已确认，等对方",
      body: `确认进度 ${progress}，再等另一位小岛成员盖章。`,
      icon: BadgeCheck,
      className: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  return {
    title: "等待你的确认",
    body: `确认进度 ${progress}，打开结算页可以盖章。`,
    icon: Hourglass,
    className: "border-[#f7cd67] bg-[#fff8da]"
  };
}

function formatMoney(amount: number) {
  return `¥${amount.toFixed(2)}`;
}

function formatMonthRange(monthStart: string, nextMonthStart: string) {
  return `${monthStart} 至 ${nextMonthStart} 前`;
}

function formatShortDate(date: string) {
  const [, month, day] = date.split("-");
  return month && day ? `${month}-${day}` : date;
}
