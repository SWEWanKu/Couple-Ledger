import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  ChartPie,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ListFilter,
  Plus,
  ReceiptText,
  Search,
  XCircle,
  UserRound
} from "lucide-react";
import { Button, Card, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { NotebookEmptyState } from "@/components/NotebookEmptyState";
import { RecordsSettlementAwareness } from "@/components/settlement/RecordsSettlementAwareness";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import {
  getMonthlyLedgerSummary,
  type MonthlyLedgerSummaryResult
} from "@/lib/ledger/get-monthly-ledger-summary";
import {
  formatMoney,
  getLedgerRecords,
  getRecordsMonthRange,
  type LedgerRecordFilters,
  type LedgerRecordTypeFilter,
  type LedgerRecord,
  type RecordsMonthRange
} from "@/lib/ledger/list-records";
import {
  getCurrentRecordsHref,
  getMonthlyReportHref,
  getNewRecordHref,
  getRecordDetailHref,
  getRecordsHref
} from "@/lib/ledger/records-query";
import { getSettlementSnapshotStatus } from "@/lib/settlement/get-settlement-snapshot-status";
import { createClient } from "@/lib/supabase/server";
import type { DashboardCategory, DashboardHouseholdMember, DashboardHouseholdSummary } from "@/types/dashboard";

type RecordsPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
    type?: string | string[];
    category?: string | string[];
    member?: string | string[];
    q?: string | string[];
    created?: string | string[];
    voided?: string | string[];
  }>;
};

type RecordsVoidFeedback = {
  tone: "success" | "warning" | "error";
  message: string;
  actionLabel: string;
};

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  const params = searchParams ? await searchParams : {};
  const selectedMonth = getSingleParam(params.month);
  const { supabase, user, membership } = await requireHouseholdAccess();
  const { summary: householdSummary, warning: householdWarning } =
    await getDashboardHouseholdSummary(supabase, {
      householdId: membership.household_id,
      currentUserId: user.id
    });
  const recordsFilters = createRecordsFilters(params, householdSummary);
  const range = getRecordsMonthRange(selectedMonth);
  const [recordsResult, monthlyLedgerSummary, settlementStatus] = await Promise.all([
    getLedgerRecords(supabase, {
      householdId: membership.household_id,
      currentUserId: user.id,
      categories: householdSummary.categories,
      members: householdSummary.members,
      month: range.month,
      filters: recordsFilters
    }),
    getMonthlyLedgerSummary(supabase, {
      householdId: membership.household_id,
      currentUserId: user.id,
      categories: householdSummary.categories,
      members: householdSummary.members,
      month: range.month
    }),
    getSettlementSnapshotStatus(supabase, {
      householdId: membership.household_id,
      month: range.month
    })
  ]);
  const { records, totalRecordCount, filteredRecordCount, warning: recordsWarning } = recordsResult;
  const showCreateSuccess = getSingleParam(params.created) === "1";
  const voidFeedback = getRecordsVoidFeedback(getSingleParam(params.voided));

  return (
    <AppShell
      compact
      hideTopbar
      title={`${householdSummary.householdName} 小岛流水`}
      subtitle="看看这个月一起记下的账"
    >
        <div className="mx-auto grid max-w-6xl gap-5">
          <RecordsTopNav month={range.month} />

          <RecordsPageSummary
            filters={recordsFilters}
            range={range}
            summary={monthlyLedgerSummary}
          />

          <Card color="default" pattern="app-teal" className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
                  <Icon name="icon-critterpedia" size={18} bounce />
                  流水列表
                </p>
                <p className="mt-1 text-sm font-bold text-[#725d42]">
                  {filteredRecordCount}/{totalRecordCount} 条匹配，最多显示 50 条
                </p>
              </div>
              <IslandLink
                href={getMonthlyReportHref(range.month)}
                data-records-monthly-report-link="true"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
              >
                <ChartPie aria-hidden="true" size={17} />
                月报
              </IslandLink>
            </div>

            <MonthNavigator filters={recordsFilters} range={range} />

            <RecordsFilterPanel
              filters={recordsFilters}
              range={range}
              categories={householdSummary.categories}
              members={householdSummary.members}
              totalRecordCount={totalRecordCount}
              filteredRecordCount={filteredRecordCount}
              displayedRecordCount={records.length}
            />

            <CompactImportReviewEntry />

            {householdWarning ? <PageNotice message={householdWarning} /> : null}
            {recordsWarning ? <PageNotice message={recordsWarning} /> : null}
            {showCreateSuccess ? (
              <RecordsCreatedSuccessSticker cleanHref={getRecordsHref(range.month, recordsFilters)} />
            ) : null}
            {voidFeedback ? (
              <RecordsVoidFeedbackSticker
                cleanHref={getRecordsHref(range.month, recordsFilters)}
                feedback={voidFeedback}
              />
            ) : null}
            <RecordsSettlementAwareness
              statusResult={settlementStatus}
              context="list"
              className="mt-5"
            />

            <div className="mt-6">
              {records.length > 0 ? (
                <RecordsList filters={recordsFilters} records={records} returnMonth={range.month} />
              ) : (
                <EmptyRecordsState
                  clearHref={getRecordsHref(range.month)}
                  hasActiveFilters={hasActiveRecordsFilters(recordsFilters)}
                  monthLabel={range.monthLabel}
                  newRecordHref={getNewRecordHref(range.month, recordsFilters)}
                />
              )}
            </div>
          </Card>
        </div>
    </AppShell>
  );
}

function RecordsTopNav({ month }: { month: string }) {
  const navItems = [
    { key: "home", href: "/dashboard", label: "小岛首页", iconName: "icon-map" },
    { key: "records", href: "/records", label: "账本", iconName: "icon-critterpedia" },
    { key: "imports", href: "/imports", label: "共同对账", iconName: "icon-chat" },
    { key: "settlement", href: `/settlement?month=${month}`, label: "结算", iconName: "icon-diy" },
    { key: "monthly", href: getMonthlyReportHref(month), label: "月报", iconName: "icon-camera" }
  ] as const;

  return (
    <Card color="default" pattern="app-yellow" className="relative overflow-visible p-3 sm:p-4">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-1/2 h-7 w-28 -translate-x-1/2 -rotate-1 rounded-[10px] bg-[#82d5bb]/70 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_4px_0_rgba(121,79,39,0.08)]">
          <Icon name="icon-critterpedia" size={18} bounce />
          {month} 流水记录
        </div>

        <nav aria-label="小岛手账页面导航" className="flex w-full flex-wrap justify-center gap-2 sm:gap-3">
          {navItems.map((item) => (
            <IslandLink
              key={item.key}
              href={item.href}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-black shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.14)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25 sm:px-5 sm:text-base ${
                item.key === "records"
                  ? "border-[#5fb89f] bg-[#82d5bb] text-white"
                  : "border-[#d9c49b] bg-[#fffdf3] text-[#794f27] hover:bg-white"
              }`}
              data-records-top-nav={item.key}
              data-records-monthly-report-link={item.key === "monthly" ? "true" : undefined}
            >
              <Icon name={item.iconName} size={18} bounce />
              {item.label}
            </IslandLink>
          ))}
        </nav>
      </div>
    </Card>
  );
}

function RecordsPageSummary({
  filters,
  range,
  summary
}: {
  filters: LedgerRecordFilters;
  range: RecordsMonthRange;
  summary: MonthlyLedgerSummaryResult;
}) {
  const data = summary.summary;

  return (
    <Card color="default" pattern="app-teal" className="relative overflow-visible p-4 sm:p-5">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-8 h-7 w-24 -rotate-2 rounded-[10px] bg-[#f7cd67]/75 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
            <ReceiptText aria-hidden="true" size={17} />
            当前月份
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              流水记录
            </Title>
          </div>
          <p className="mt-3 text-sm font-bold text-[#725d42]">{range.monthLabel}</p>
        </div>

        <IslandLink
          href={getNewRecordHref(range.month, filters)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
        >
          <Plus aria-hidden="true" size={18} />
          记一笔
        </IslandLink>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryNotePill
          href={getRecordsHref(range.month, { ...filters, type: "expense" })}
          label="本月支出"
          value={formatMoney(data.expenseTotal)}
          helper={`${data.expenseCount} 笔`}
        />
        <SummaryNotePill
          href={getRecordsHref(range.month, { ...filters, type: "income" })}
          label="本月收入"
          value={formatMoney(data.incomeTotal)}
          helper={`${data.incomeCount} 笔`}
        />
        <SummaryNotePill label="净额" value={formatSignedMoney(data.netAmount)} helper="收入减支出" />
        <SummaryNotePill label="流水" value={`${data.entryCount} 条`} helper="本月记录" />
      </div>

      {summary.warning ? <PageNotice message={summary.warning} /> : null}
    </Card>
  );
}

function CompactImportReviewEntry() {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-[22px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-3 shadow-[0_4px_0_rgba(121,79,39,0.08)] sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm font-black text-[#794f27]">
        <Icon name="icon-chat" size={18} bounce />
        外部账单先去共同对账
      </p>
      <div className="flex flex-wrap gap-2">
        <IslandLink
          href="/imports"
          data-import-review-entry-imports-link="true"
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-[#82d5bb] px-4 py-1.5 text-xs font-black text-white shadow-[0_4px_0_#5fb89f] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          共同对账
        </IslandLink>
        <IslandLink
          href="/imports/new"
          data-import-review-entry-new-link="true"
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-white px-4 py-1.5 text-xs font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:bg-[#e9fbf4] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          导入账单
        </IslandLink>
      </div>
    </div>
  );
}

function MonthNavigator({ filters, range }: { filters: LedgerRecordFilters; range: RecordsMonthRange }) {
  const currentMonthHref = getCurrentRecordsHref(filters);

  return (
    <div
      data-records-month-navigation="true"
      data-records-month-current={range.month}
      className="mb-4 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-3 shadow-[0_4px_0_rgba(121,79,39,0.08)]"
    >
      <div className="grid gap-2 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center">
        <RecordsQueryLink
          href={getRecordsHref(range.previousMonth, filters)}
          ariaLabel={`上个月 ${range.previousMonth}`}
          dataMonthNav="previous"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          <ChevronLeft aria-hidden="true" size={17} />
          上个月
        </RecordsQueryLink>
        <div
          data-records-month-selected="true"
          className="rounded-full bg-white px-4 py-2 text-center shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]"
        >
          <p className="text-base font-black text-[#794f27]">{range.monthLabel}</p>
        </div>
        <RecordsQueryLink
          href={getRecordsHref(range.nextMonth, filters)}
          ariaLabel={`下个月 ${range.nextMonth}`}
          dataMonthNav="next"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_4px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
        >
          下个月
          <ChevronRight aria-hidden="true" size={17} />
        </RecordsQueryLink>
        <RecordsQueryLink
          href={currentMonthHref}
          ariaLabel="本月"
          dataMonthNav="current"
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          本月
        </RecordsQueryLink>
      </div>
      <div className="mt-2 rounded-[20px] bg-white px-3 py-2 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.58)]">
        <form action="/records" method="get" className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <label className="sr-only" htmlFor="records-month">
            按月份查看
          </label>
          <input
            id="records-month"
            name="month"
            type="month"
            defaultValue={range.month}
            className="min-h-10 min-w-0 rounded-full border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-1.5 text-sm font-black text-[#794f27] shadow-[inset_0_2px_0_rgba(121,79,39,0.08)] outline-none focus:border-[#19c8b9] focus:ring-4 focus:ring-[#19c8b9]/20"
          />
          <FilterHiddenInputs filters={filters} />
          <Button type="primary" htmlType="submit" size="small">
            查看月份
          </Button>
        </form>
      </div>
    </div>
  );
}

function RecordsFilterPanel({
  filters,
  range,
  categories,
  members,
  totalRecordCount,
  filteredRecordCount,
  displayedRecordCount
}: {
  filters: LedgerRecordFilters;
  range: RecordsMonthRange;
  categories: DashboardCategory[];
  members: DashboardHouseholdMember[];
  totalRecordCount: number;
  filteredRecordCount: number;
  displayedRecordCount: number;
}) {
  const activeFilters = getActiveFilterChips({
    filters,
    range,
    categories,
    members
  });
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div
      data-records-filter-panel="true"
      className="mb-4 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-3 shadow-[0_4px_0_rgba(121,79,39,0.08)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-black text-[#794f27]">
          <ListFilter aria-hidden="true" size={16} />
          筛选
        </p>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black text-[#8a7556] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.66)]">
          {filteredRecordCount}/{totalRecordCount} 条匹配，显示 {displayedRecordCount} 条
        </span>
      </div>

      <form action="/records" method="get" className="mt-3 grid gap-3 lg:grid-cols-3">
        <input type="hidden" name="month" value={range.month} />

        <FilterField label="类型" htmlFor="records-type-filter">
          <select
            id="records-type-filter"
            name="type"
            defaultValue={filters.type ?? "all"}
            className={filterInputClassName}
          >
            <option value="all">全部小票</option>
            <option value="expense">只看支出</option>
            <option value="income">只看收入</option>
          </select>
        </FilterField>

        <FilterField label="分类" htmlFor="records-category-filter">
          <select
            id="records-category-filter"
            name="category"
            defaultValue={filters.categoryId ?? ""}
            className={filterInputClassName}
          >
            <option value="">全部分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {formatCategoryOption(category)}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="经手人" htmlFor="records-member-filter">
          <select
            id="records-member-filter"
            name="member"
            defaultValue={filters.paidBy ?? ""}
            className={filterInputClassName}
          >
            <option value="">全部成员</option>
            {members.map((member, index) => (
              <option key={member.userId} value={member.userId}>
                {formatMemberFilterLabel(member, index)}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="关键词" htmlFor="records-keyword-filter" className="lg:col-span-2">
          <div className="relative">
            <Search
              aria-hidden="true"
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9f927d]"
            />
            <input
              id="records-keyword-filter"
              name="q"
              type="search"
              maxLength={80}
              defaultValue={filters.keyword ?? ""}
              placeholder="备注 / 分类 / 经手人"
              className={`${filterInputClassName} pl-10`}
            />
          </div>
        </FilterField>

        <div className="flex gap-2 lg:self-end">
          <Button type="primary" htmlType="submit" size="middle">
            筛选
          </Button>
          <RecordsQueryLink
            href={getRecordsHref(range.month)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fff8da] px-4 py-2 text-sm font-black text-[#8a6420] shadow-[0_3px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
          >
            清空
          </RecordsQueryLink>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasActiveFilters ? (
          activeFilters.map((filter) => (
            <RecordsQueryLink
              key={filter.key}
              href={filter.href}
              className="inline-flex min-h-9 items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white px-3 py-1 text-xs font-black text-[#794f27] shadow-[0_3px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 hover:shadow-[0_5px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              <XCircle aria-hidden="true" size={14} />
              {filter.label}
            </RecordsQueryLink>
          ))
        ) : (
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black text-[#9f927d] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.58)]">
            <Icon name="icon-chat" size={16} bounce />
            还没有贴筛选纸
          </span>
        )}

      </div>
    </div>
  );
}

function FilterField({
  label,
  htmlFor,
  children,
  className = ""
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-1.5 text-xs font-black text-[#8a7556] ${className}`} htmlFor={htmlFor}>
      {label}
      {children}
    </label>
  );
}

function FilterHiddenInputs({ filters }: { filters: LedgerRecordFilters }) {
  return (
    <>
      {filters.type && filters.type !== "all" ? <input type="hidden" name="type" value={filters.type} /> : null}
      {filters.categoryId ? <input type="hidden" name="category" value={filters.categoryId} /> : null}
      {filters.paidBy ? <input type="hidden" name="member" value={filters.paidBy} /> : null}
      {filters.keyword ? <input type="hidden" name="q" value={filters.keyword} /> : null}
    </>
  );
}

function RecordsQueryLink({
  href,
  children,
  className,
  ariaLabel,
  dataMonthNav
}: {
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  dataMonthNav?: "previous" | "current" | "next";
}) {
  return (
    <Link href={href} aria-label={ariaLabel} className={className} data-records-month-nav={dataMonthNav}>
      {children}
    </Link>
  );
}

function SummaryNotePill({
  href,
  label,
  value,
  helper
}: {
  href?: string;
  label: string;
  value: string;
  helper: string;
}) {
  const className =
    "block rounded-[22px] bg-white px-4 py-3 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)] transition hover:-translate-y-0.5 hover:bg-[#fff8da] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25";
  const content = (
    <>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">{label}</p>
      <p className="mt-1 break-words text-base font-black text-[#794f27]">{value}</p>
      <p className="mt-0.5 text-xs font-bold text-[#9f927d]">{helper}</p>
    </>
  );

  if (href) {
    return (
      <RecordsQueryLink href={href} className={className} ariaLabel={`${label} records filter`}>
        {content}
      </RecordsQueryLink>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

async function requireHouseholdAccess() {
  const supabase = await createClient();
  const currentUserId = (await headers()).get("x-couple-ledger-user-id");

  if (!currentUserId) {
    redirect("/login");
  }

  const { data: membership, error } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", currentUserId)
    .limit(1)
    .maybeSingle();

  if (error || !membership) {
    redirect("/not-invited");
  }

  return {
    supabase,
    user: { id: currentUserId },
    membership: membership as HouseholdMembershipRow
  };
}

type RecordsDayGroup = {
  date: string;
  records: LedgerRecord[];
  expenseTotal: number;
  incomeTotal: number;
  recordCount: number;
  netAmount: number;
};

function RecordsList({
  filters,
  records,
  returnMonth
}: {
  filters: LedgerRecordFilters;
  records: LedgerRecord[];
  returnMonth: string;
}) {
  const dayGroups = groupRecordsByDate(records);

  return (
    <div data-records-day-timeline="true" className="grid gap-4">
      {dayGroups.map((group) => (
        <section
          key={group.date}
          data-record-day-group="true"
          data-record-day={group.date}
          className="relative grid gap-2 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3]/80 p-3 shadow-[0_4px_0_rgba(121,79,39,0.06)]"
        >
          <span
            aria-hidden="true"
            className="absolute -top-2 left-8 h-5 w-20 -rotate-2 rounded-[8px] bg-[#82d5bb]/65 shadow-[0_4px_0_rgba(121,79,39,0.08)]"
          />
          <div className="rounded-[20px] bg-white/85 px-4 py-3 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.55)]">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <h2 className="flex min-w-0 items-center gap-2 truncate text-base font-black text-[#794f27]">
                <CalendarDays aria-hidden="true" size={18} className="shrink-0 text-[#9f927d]" />
                {formatLongDate(group.date)}
              </h2>
              <div className="grid gap-2 sm:grid-cols-4 xl:min-w-[520px]">
                <DaySummaryPill metric="expense" label="支出" value={formatMoney(group.expenseTotal)} tone="coral" />
                <DaySummaryPill metric="income" label="收入" value={formatMoney(group.incomeTotal)} tone="teal" />
                <DaySummaryPill metric="net" label="净额" value={formatSignedMoney(group.netAmount)} tone="amber" />
                <DaySummaryPill metric="count" label="记录" value={`${group.recordCount} 条`} tone="ink" />
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {group.records.map((record) => (
              <IslandLink
                key={record.id}
                href={getRecordDetailHref(record.id, returnMonth, filters)}
                ariaLabel={`查看账单 ${record.note?.trim() || record.categoryName}`}
                className="group block rounded-[22px] border-2 border-[#ead9b8] bg-[#fffdf3] px-4 py-3 shadow-[0_4px_0_rgba(121,79,39,0.07)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#794f27] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.72)] transition group-hover:-translate-y-0.5">
                        {record.entryType === "income" ? (
                          <CircleDollarSign aria-hidden="true" size={18} />
                        ) : (
                          <ReceiptText aria-hidden="true" size={18} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-black text-[#794f27]">
                          {record.note?.trim() || record.categoryName || "未命名账单"}
                        </h2>
                        <p className="mt-1 truncate text-xs font-bold text-[#9f927d]">
                          {formatEntryType(record.entryType)} · {record.paidByLabel} · {record.splitModeLabel}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <CategoryPill record={record} />
                      <MetaPill icon={<UserRound aria-hidden="true" size={14} />} label={record.paidByLabel} />
                    </div>
                  </div>

                  <p
                    className={`text-left text-lg font-black sm:text-right ${
                      record.entryType === "income" ? "text-[#1f7a70]" : "text-[#d46a5b]"
                    }`}
                  >
                    {formatRecordAmount(record)}
                  </p>
                </div>
              </IslandLink>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DaySummaryPill({
  label,
  metric,
  tone,
  value
}: {
  label: string;
  metric: "expense" | "income" | "net" | "count";
  tone: "coral" | "teal" | "amber" | "ink";
  value: string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    coral: "bg-[#fff1ed] text-[#b14c46]",
    teal: "bg-[#e9fbf4] text-[#1f7a70]",
    amber: "bg-[#fff8da] text-[#8a6420]",
    ink: "bg-[#fffdf3] text-[#794f27]"
  };

  return (
    <div
      data-record-day-metric={metric}
      className={`rounded-[20px] px-3 py-2 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.58)] ${toneClasses[tone]}`}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-75">{label}</p>
      <p className="mt-1 break-words text-sm font-black tracking-normal">{value}</p>
    </div>
  );
}

function groupRecordsByDate(records: LedgerRecord[]): RecordsDayGroup[] {
  const dayGroups: RecordsDayGroup[] = [];
  const groupsByDate = new Map<string, RecordsDayGroup>();

  records.forEach((record) => {
    let group = groupsByDate.get(record.occurredOn);

    if (!group) {
      group = {
        date: record.occurredOn,
        records: [],
        expenseTotal: 0,
        incomeTotal: 0,
        recordCount: 0,
        netAmount: 0
      };
      groupsByDate.set(record.occurredOn, group);
      dayGroups.push(group);
    }

    group.records.push(record);
    group.recordCount += 1;

    if (record.entryType === "income") {
      group.incomeTotal += record.amount;
    } else {
      group.expenseTotal += record.amount;
    }

    group.netAmount = group.incomeTotal - group.expenseTotal;
  });

  return dayGroups;
}

function EmptyRecordsState({
  clearHref,
  hasActiveFilters,
  monthLabel,
  newRecordHref
}: {
  clearHref: string;
  hasActiveFilters: boolean;
  monthLabel: string;
  newRecordHref: string;
}) {
  const title = hasActiveFilters ? "这张筛选贴纸下还没有账单" : "这个月小岛账本还空空的";
  const description = hasActiveFilters
    ? `${monthLabel} 里有些筛选条件没有匹配到账单，可以撕掉这张筛选贴纸重新看看。`
    : `${monthLabel} 还没有账单流水。等有记录写入后，这里会按日期把最近的记录贴出来。`;

  return (
    <NotebookEmptyState
      dataAttributes={{
        "data-records-empty-state": "true",
        "data-records-empty-filtered": String(hasActiveFilters)
      }}
      description={description}
      eyebrow={hasActiveFilters ? "Filtered Sticker" : "Empty Month"}
      iconName={hasActiveFilters ? "icon-diy" : "icon-chat"}
      title={title}
      tone={hasActiveFilters ? "yellow" : "teal"}
      action={
        hasActiveFilters
          ? {
              href: clearHref,
              label: "撕掉筛选贴纸",
              icon: <XCircle aria-hidden="true" size={17} />
            }
          : {
              href: newRecordHref,
              label: "记第一笔账",
              icon: <Plus aria-hidden="true" size={18} />
            }
      }
      secondaryAction={
        hasActiveFilters
          ? {
              href: newRecordHref,
              label: "记第一笔账",
              icon: <Plus aria-hidden="true" size={18} />
            }
          : undefined
      }
    />
  );
}

function CategoryPill({ record }: { record: LedgerRecord }) {
  const displayIcon = getCategoryDisplayIcon(record.categoryIcon);

  return (
    <span
      className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black text-[#794f27]"
      style={{
        backgroundColor: record.categoryColor ? `${record.categoryColor}24` : "#ffffff",
        borderColor: record.categoryColor ?? "#d9c49b"
      }}
    >
      {displayIcon ? <span aria-hidden="true">{displayIcon}</span> : null}
      <span className="truncate">{record.categoryName}</span>
    </span>
  );
}

function MetaPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#725d42] shadow-[inset_0_0_0_1px_rgba(217,196,155,0.7)]">
      <span className="text-[#9f927d]">{icon}</span>
      {label}
    </span>
  );
}

function PageNotice({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-[24px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-3 text-sm font-black leading-6 text-[#8a6420]">
      <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function RecordsCreatedSuccessSticker({ cleanHref }: { cleanHref: string }) {
  return (
    <div
      role="status"
      data-records-create-success="true"
      className="mt-4 rounded-[26px] border-2 border-dashed border-[#82d5bb] bg-[#e9fbf4] px-4 py-3 text-sm font-black leading-6 text-[#1f7a70] shadow-[0_5px_0_rgba(31,122,112,0.1)]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-3">
          <BadgeCheck aria-hidden="true" size={19} className="mt-0.5 shrink-0" />
          <span>
            <span className="sr-only">Success Sticker: </span>
            新账单已经贴回这个月的小岛账本啦。
          </span>
        </p>
        <RecordsQueryLink
          href={cleanHref}
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-[#82d5bb] bg-white px-4 py-1.5 text-xs font-black text-[#1f7a70] shadow-[0_3px_0_rgba(31,122,112,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_5px_0_rgba(31,122,112,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/20"
        >
          收好这张贴纸
        </RecordsQueryLink>
      </div>
    </div>
  );
}

function RecordsVoidFeedbackSticker({
  cleanHref,
  feedback
}: {
  cleanHref: string;
  feedback: RecordsVoidFeedback;
}) {
  const classes: Record<RecordsVoidFeedback["tone"], string> = {
    success: "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]",
    warning: "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]",
    error: "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]"
  };
  const IconComponent =
    feedback.tone === "success" ? BadgeCheck : feedback.tone === "warning" ? AlertCircle : XCircle;

  return (
    <div
      role={feedback.tone === "error" ? "alert" : "status"}
      data-records-void-feedback="true"
      data-records-void-feedback-tone={feedback.tone}
      className={`mt-4 rounded-[26px] border-2 border-dashed px-4 py-3 text-sm font-black leading-6 shadow-[0_5px_0_rgba(121,79,39,0.1)] ${classes[feedback.tone]}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-3">
          <IconComponent aria-hidden="true" size={19} className="mt-0.5 shrink-0" />
          <span>
            <span className="sr-only">Record Void Sticker: </span>
            {feedback.message}
          </span>
        </p>
        <RecordsQueryLink
          href={cleanHref}
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-current bg-white px-4 py-1.5 text-xs font-black shadow-[0_3px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_5px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/20"
        >
          {feedback.actionLabel}
        </RecordsQueryLink>
      </div>
    </div>
  );
}

function createRecordsFilters(
  params: Awaited<NonNullable<RecordsPageProps["searchParams"]>>,
  householdSummary: DashboardHouseholdSummary
): LedgerRecordFilters {
  const type = normalizeRecordTypeFilter(getSingleParam(params.type));
  const category = getSingleParam(params.category);
  const member = getSingleParam(params.member);
  const keyword = normalizeKeyword(getSingleParam(params.q));

  return {
    type,
    categoryId: householdSummary.categories.some((candidate) => candidate.id === category)
      ? category
      : null,
    paidBy: householdSummary.members.some((candidate) => candidate.userId === member)
      ? member
      : null,
    keyword
  };
}

function getRecordsVoidFeedback(value: string | null): RecordsVoidFeedback | null {
  if (value === "1") {
    return {
      tone: "success",
      message: "这笔账已经盖上作废章，普通账本、小结和实时结算都不会再把它算进去。",
      actionLabel: "收好这张贴纸"
    };
  }

  if (value === "already_voided") {
    return {
      tone: "warning",
      message: "这笔账之前已经作废了，当前列表会继续只显示还在生效的账本记录。",
      actionLabel: "知道啦"
    };
  }

  if (value === "blocked_pending_replacement") {
    return {
      tone: "warning",
      message: "这个月正在重新对齐结算便签，先处理完新的结算便签再回来改账会更稳。",
      actionLabel: "先留着"
    };
  }

  if (value === "error") {
    return {
      tone: "error",
      message: "作废这笔账没有成功，小岛刚才没能安全写入作废章，请稍后再试。",
      actionLabel: "收起提示"
    };
  }

  return null;
}

function normalizeRecordTypeFilter(value: string | null): LedgerRecordTypeFilter {
  return value === "expense" || value === "income" ? value : "all";
}

function normalizeKeyword(value: string | null) {
  const keyword = value?.trim();

  if (!keyword) {
    return null;
  }

  return keyword.slice(0, 80);
}

function hasActiveRecordsFilters(filters: LedgerRecordFilters) {
  return Boolean(
    (filters.type && filters.type !== "all") ||
      filters.categoryId ||
      filters.paidBy ||
      filters.keyword
  );
}

function getActiveFilterChips({
  filters,
  range,
  categories,
  members
}: {
  filters: LedgerRecordFilters;
  range: RecordsMonthRange;
  categories: DashboardCategory[];
  members: DashboardHouseholdMember[];
}) {
  const chips: Array<{ key: string; label: string; href: string }> = [];

  if (filters.type && filters.type !== "all") {
    chips.push({
      key: "type",
      label: `类型：${formatFilterType(filters.type)}`,
      href: getRecordsHref(range.month, { ...filters, type: "all" })
    });
  }

  if (filters.categoryId) {
    const category = categories.find((candidate) => candidate.id === filters.categoryId);
    chips.push({
      key: "category",
      label: `分类：${category ? formatCategoryOption(category) : "已选分类"}`,
      href: getRecordsHref(range.month, { ...filters, categoryId: null })
    });
  }

  if (filters.paidBy) {
    const memberIndex = members.findIndex((candidate) => candidate.userId === filters.paidBy);
    const member = memberIndex >= 0 ? members[memberIndex] : null;
    chips.push({
      key: "member",
      label: `经手：${member ? formatMemberFilterLabel(member, memberIndex) : "已选成员"}`,
      href: getRecordsHref(range.month, { ...filters, paidBy: null })
    });
  }

  if (filters.keyword) {
    chips.push({
      key: "q",
      label: `搜索：${filters.keyword}`,
      href: getRecordsHref(range.month, { ...filters, keyword: null })
    });
  }

  return chips;
}

function formatFilterType(type: Exclude<LedgerRecordTypeFilter, "all">) {
  return type === "income" ? "收入" : "支出";
}

function formatCategoryOption(category: DashboardCategory) {
  const displayIcon = getCategoryDisplayIcon(category.icon);
  return `${displayIcon ? `${displayIcon} ` : ""}${category.name}`;
}

function getCategoryDisplayIcon(icon: string | null | undefined) {
  if (!icon || /^[a-z0-9-]+$/i.test(icon)) {
    return "";
  }

  return icon;
}

function formatMemberFilterLabel(member: DashboardHouseholdMember, index: number) {
  const role = member.role === "owner" ? "岛主" : "伙伴";
  const name = member.isCurrentUser ? "你" : `成员 ${index + 1}`;

  return `${role} · ${name}`;
}

const filterInputClassName =
  "min-h-11 w-full rounded-full border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-2 text-sm font-black text-[#794f27] shadow-[inset_0_2px_0_rgba(121,79,39,0.08)] outline-none focus:border-[#19c8b9] focus:ring-4 focus:ring-[#19c8b9]/20";

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatEntryType(entryType: LedgerRecord["entryType"]) {
  return entryType === "income" ? "收入" : "支出";
}

function formatRecordAmount(record: LedgerRecord) {
  const prefix = record.entryType === "income" ? "+" : "-";
  return `${prefix}${formatMoney(record.amount)}`;
}

function formatSignedMoney(amount: number) {
  if (amount === 0) {
    return formatMoney(0);
  }

  return `${amount > 0 ? "+" : "-"}${formatMoney(Math.abs(amount))}`;
}

function formatLongDate(date: string) {
  const [year, month, day] = date.split("-");

  if (!year || !month || !day) {
    return date;
  }

  return `${year}.${month}.${day}`;
}
