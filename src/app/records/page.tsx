import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Plus,
  ReceiptText,
  Split,
  Tags,
  Trash2,
  UserRound
} from "lucide-react";
import { Card, Cursor, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import {
  formatMoney,
  getLedgerRecords,
  type LedgerRecord,
  type RecordsMonthRange
} from "@/lib/ledger/list-records";
import { createClient } from "@/lib/supabase/server";

type RecordsPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
  }>;
};

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

function isDevCleanupEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_LOGIN === "true";
}

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  const params = searchParams ? await searchParams : {};
  const selectedMonth = getSingleParam(params.month);
  const { supabase, user, membership } = await requireHouseholdAccess();
  const { summary: householdSummary, warning: householdWarning } =
    await getDashboardHouseholdSummary(supabase, {
      householdId: membership.household_id,
      currentUserId: user.id
    });
  const {
    records,
    range,
    warning: recordsWarning
  } = await getLedgerRecords(supabase, {
    householdId: membership.household_id,
    currentUserId: user.id,
    categories: householdSummary.categories,
    members: householdSummary.members,
    month: selectedMonth
  });

  return (
    <Cursor>
      <AppShell
        title={`${householdSummary.householdName} 小岛流水`}
        subtitle="看看这个月一起记下的账"
      >
        <div className="mx-auto grid max-w-6xl gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <IslandLink
              href="/dashboard"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              <ArrowLeft aria-hidden="true" size={17} />
              回到看板
            </IslandLink>
            <div className="flex flex-wrap items-center gap-3">
              {isDevCleanupEnabled() ? (
                <IslandLink
                  href="/dev-clean-test-records"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d46a5b] bg-[#fff1ed] px-4 py-2 text-sm font-black text-[#9f4f43] shadow-[0_5px_0_rgba(159,79,67,0.14)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(159,79,67,0.14)] focus:outline-none focus:ring-4 focus:ring-[#d46a5b]/20"
                >
                  <Trash2 aria-hidden="true" size={17} />
                  清理 Codex 测试记录
                </IslandLink>
              ) : null}
              <IslandLink
                href="/records/new"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
              >
                <Plus aria-hidden="true" size={18} />
                记一笔账
              </IslandLink>
            </div>
          </div>

          <Card color="default" pattern="app-teal" className="p-5 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
                  Island Records
                </p>
                <div className="mt-3">
                  <Title size="large" color="app-yellow" style={{ fontSize: 34 }}>
                    小岛流水
                  </Title>
                </div>
                <p className="mt-4 max-w-2xl text-sm font-bold leading-7 text-[#725d42]">
                  这里只读 {range.monthLabel} 的真实账本记录，最多显示 50 条。分摊明细、结算、编辑和删除会在后续功能里单独接入。
                </p>
              </div>
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_7px_0_#5fb89f]">
                <ReceiptText aria-hidden="true" size={31} />
              </span>
            </div>

            <Divider type="wave-yellow" className="my-6" />

            <MonthNavigator range={range} />

            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex flex-wrap gap-3">
                <InfoPill icon={<CalendarDays aria-hidden="true" size={16} />} label={formatRangeLabel(range)} />
                <InfoPill icon={<ReceiptText aria-hidden="true" size={16} />} label={`${records.length} 条记录`} />
                <InfoPill icon={<Icon name="icon-map" size={18} bounce />} label={householdSummary.householdName} />
              </div>
              <span className="inline-flex w-fit items-center rounded-full bg-[#fffdf3] px-4 py-2 text-xs font-black text-[#9f927d] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.7)]">
                只读模式
              </span>
            </div>

            {householdWarning ? <PageNotice message={householdWarning} /> : null}
            {recordsWarning ? <PageNotice message={recordsWarning} /> : null}

            <div className="mt-6">
              {records.length > 0 ? (
                <RecordsList records={records} />
              ) : (
                <EmptyRecordsState monthLabel={range.monthLabel} />
              )}
            </div>
          </Card>
        </div>
      </AppShell>
    </Cursor>
  );
}

function MonthNavigator({ range }: { range: RecordsMonthRange }) {
  return (
    <div className="mb-5 rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-3">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <IslandLink
          href={getRecordsMonthHref(range.previousMonth)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          <ChevronLeft aria-hidden="true" size={17} />
          上个月
        </IslandLink>
        <div className="rounded-[22px] bg-white px-4 py-3 text-center shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
            Selected Month
          </p>
          <p className="mt-1 text-xl font-black text-[#794f27]">{range.monthLabel}</p>
        </div>
        <IslandLink
          href={getRecordsMonthHref(range.nextMonth)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_4px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
        >
          下个月
          <ChevronRight aria-hidden="true" size={17} />
        </IslandLink>
      </div>
      <div className="mt-3 grid gap-3 rounded-[22px] bg-white px-4 py-3 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
        <p className="text-center text-xs font-black uppercase tracking-[0.14em] text-[#9f927d] md:text-left">
          按月份查看
        </p>
        <form action="/records" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="records-month">
            按月份查看
          </label>
          <input
            id="records-month"
            name="month"
            type="month"
            defaultValue={range.month}
            className="min-h-11 min-w-0 flex-1 rounded-full border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-2 text-sm font-black text-[#794f27] shadow-[inset_0_2px_0_rgba(121,79,39,0.08)] outline-none focus:border-[#19c8b9] focus:ring-4 focus:ring-[#19c8b9]/20"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f7cd67] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_4px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
          >
            查看月份
          </button>
        </form>
        <IslandLink
          href="/records"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d9c49b] bg-[#fffdf3] px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          本月
        </IslandLink>
      </div>
    </div>
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

function RecordsList({ records }: { records: LedgerRecord[] }) {
  return (
    <div className="overflow-hidden rounded-[28px] border-2 border-[#d9c49b] bg-[#fffdf3]">
      <div className="grid grid-cols-[1fr_auto] gap-4 border-b-2 border-[#ead9b8] px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d] sm:grid-cols-[1.2fr_0.6fr_0.8fr_0.7fr]">
        <span>账单</span>
        <span className="hidden sm:block">分类</span>
        <span className="hidden sm:block">经手</span>
        <span className="text-right">金额</span>
      </div>
      <div className="divide-y-2 divide-[#ead9b8]">
        {records.map((record) => (
          <IslandLink
            key={record.id}
            href={`/records/${record.id}`}
            ariaLabel={`查看账单 ${record.note?.trim() || record.categoryName}`}
            className="group grid gap-4 px-5 py-4 transition hover:bg-white/55 focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25 sm:grid-cols-[1.2fr_0.6fr_0.8fr_0.7fr] sm:items-center"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#794f27] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.72)] transition group-hover:-translate-y-0.5">
                  {record.entryType === "income" ? (
                    <CircleDollarSign aria-hidden="true" size={18} />
                  ) : (
                    <ReceiptText aria-hidden="true" size={18} />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-black text-[#794f27]">
                    {record.note?.trim() || "未命名账单"}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-[#9f927d]">
                    {formatLongDate(record.occurredOn)} · {formatEntryType(record.entryType)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 sm:hidden">
                <CategoryPill record={record} />
                <MetaPill icon={<UserRound aria-hidden="true" size={14} />} label={record.paidByLabel} />
                <MetaPill icon={<Split aria-hidden="true" size={14} />} label={record.splitModeLabel} />
              </div>
            </div>

            <div className="hidden sm:block">
              <CategoryPill record={record} />
            </div>

            <div className="hidden gap-2 text-sm font-bold text-[#725d42] sm:grid">
              <span className="inline-flex items-center gap-2">
                <UserRound aria-hidden="true" size={15} className="text-[#9f927d]" />
                {record.paidByLabel}
              </span>
              <span className="inline-flex items-center gap-2 text-xs text-[#9f927d]">
                <Split aria-hidden="true" size={14} />
                {record.splitModeLabel}
              </span>
            </div>

            <p
              className={`text-right text-lg font-black ${
                record.entryType === "income" ? "text-[#1f7a70]" : "text-[#d46a5b]"
              }`}
            >
              {formatRecordAmount(record)}
            </p>
          </IslandLink>
        ))}
      </div>
    </div>
  );
}

function EmptyRecordsState({ monthLabel }: { monthLabel: string }) {
  return (
    <div className="rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_6px_0_#5fb89f]">
        <Tags aria-hidden="true" size={25} />
      </span>
      <h2 className="mt-5 text-2xl font-black text-[#794f27]">这个月还没有记录</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm font-bold leading-7 text-[#725d42]">
        {monthLabel} 还没有账单流水。等有记录写入后，这里会按日期把最近的记录排出来。
      </p>
      <IslandLink
        href="/records/new"
        className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
      >
        <Plus aria-hidden="true" size={18} />
        记第一笔账
      </IslandLink>
    </div>
  );
}

function CategoryPill({ record }: { record: LedgerRecord }) {
  return (
    <span
      className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black text-[#794f27]"
      style={{
        backgroundColor: record.categoryColor ? `${record.categoryColor}24` : "#ffffff",
        borderColor: record.categoryColor ?? "#d9c49b"
      }}
    >
      {record.categoryIcon ? <span aria-hidden="true">{record.categoryIcon}</span> : null}
      <span className="truncate">{record.categoryName}</span>
    </span>
  );
}

function InfoPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black text-[#794f27] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.7)]">
      <span className="text-[#9f927d]">{icon}</span>
      {label}
    </span>
  );
}

function MetaPill({ icon, label }: { icon: React.ReactNode; label: string }) {
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

function formatRangeLabel(range: RecordsMonthRange) {
  return `${range.monthStart} 至 ${range.nextMonthStart}`;
}

function getRecordsMonthHref(month: string) {
  return `/records?month=${month}`;
}

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

function formatLongDate(date: string) {
  const [year, month, day] = date.split("-");

  if (!year || !month || !day) {
    return date;
  }

  return `${year}.${month}.${day}`;
}
