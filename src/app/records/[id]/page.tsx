import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileWarning,
  Plus,
  ReceiptText,
  StickyNote,
  Split,
  Tags,
  UserRound,
  WalletCards
} from "lucide-react";
import { Button, Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { RecordsSettlementAwareness } from "@/components/settlement/RecordsSettlementAwareness";
import { voidLedgerRecordAction } from "./actions";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import { getRecordDetail, type RecordDetail } from "@/lib/ledger/get-record-detail";
import {
  formatMoney,
  getLedgerRecords,
  normalizeRecordsMonth,
  type LedgerRecord,
  type LedgerRecordFilters,
  type LedgerRecordTypeFilter
} from "@/lib/ledger/list-records";
import { getRecordDetailHref } from "@/lib/ledger/records-query";
import {
  getSettlementSnapshotStatus,
  type GetSettlementSnapshotStatusResult
} from "@/lib/settlement/get-settlement-snapshot-status";
import { createClient } from "@/lib/supabase/server";
import type { DashboardHouseholdSummary } from "@/types/dashboard";

type RecordDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<RecordDetailSearchParams>;
};

type RecordDetailSearchParams = {
  month?: string | string[];
  type?: string | string[];
  category?: string | string[];
  member?: string | string[];
  q?: string | string[];
};

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

type VoidReturnContextParams = {
  month: string | null;
  type: "expense" | "income" | null;
  category: string | null;
  member: string | null;
  q: string | null;
};

type RecordVoidState = {
  status: "ready" | "settled" | "blocked_pending_replacement" | "status_error";
  disabled: boolean;
  badge: string;
  heading: string;
  body: string;
  toneClassName: string;
};

export default async function RecordDetailPage({ params, searchParams }: RecordDetailPageProps) {
  const { id } = await params;
  const returnParams = searchParams ? await searchParams : {};
  const { supabase, user, membership } = await requireHouseholdAccess();
  const { summary, warning: householdWarning } = await getDashboardHouseholdSummary(supabase, {
    householdId: membership.household_id,
    currentUserId: user.id
  });
  const detail = await getRecordDetail(supabase, {
    recordId: id,
    householdId: membership.household_id,
    currentUserId: user.id,
    categories: summary.categories,
    members: summary.members
  });

  if (detail.status === "not_found") {
    notFound();
  }

  if (detail.status === "error") {
    const returnHref = getRecordsReturnHref(returnParams, null);

    return (
      <AppShell title={`${summary.householdName} 账单详情`} subtitle="这张账单暂时没有读完整">
          <div className="mx-auto grid max-w-4xl gap-6">
            <DetailNav returnHref={returnHref} />
            <Card color="default" pattern="app-yellow" className="p-5 sm:p-7">
              <PageNotice message={detail.warning} tone="error" />
            </Card>
          </div>
      </AppShell>
    );
  }

  const record = detail.record;
  const recordMonth = getMonthKeyFromDateOnly(record.occurredOn);
  const returnHref = getRecordsReturnHref(returnParams, recordMonth);
  const recordPager = await getRecordPager(supabase, {
    currentRecordId: record.id,
    currentUserId: user.id,
    householdId: membership.household_id,
    householdSummary: summary,
    params: returnParams,
    recordMonth
  });
  const settlementStatus = await getSettlementSnapshotStatus(supabase, {
    householdId: membership.household_id,
    month: recordMonth
  });
  const voidReturnContext = getVoidReturnContext(returnParams, recordMonth);
  const voidState = getRecordVoidState(settlementStatus);

  return (
    <AppShell
      title={`${summary.householdName} 账单详情`}
      subtitle="只读查看这张小岛流水，不会修改任何账本数据。"
    >
        <div className="mx-auto grid max-w-6xl gap-6">
          <DetailNav returnHref={returnHref} />

          <RecordPager pager={recordPager} />

          <Card
            color="default"
            pattern="app-teal"
            className="relative overflow-visible p-5 sm:p-7"
            data-record-detail-note="true"
          >
            <span
              aria-hidden="true"
              className="absolute -top-3 left-8 h-7 w-28 -rotate-2 rounded-[10px] bg-[#f7cd67]/70 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
            />
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
                  Island Receipt
                </p>
                <div className="mt-3">
                  <Title size="large" color="app-yellow" style={{ fontSize: 34 }}>
                    {record.note?.trim() || "未命名账单"}
                  </Title>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span
                    data-record-detail-type={record.entryType}
                    className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 py-2 text-sm font-black text-white shadow-[0_5px_0_rgba(121,79,39,0.14)] ${
                      record.entryType === "income" ? "bg-[#1f9f8f]" : "bg-[#d46a5b]"
                    }`}
                  >
                    {record.entryTypeLabel}
                  </span>
                  <CategoryPill record={record} />
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.7)]">
                    <CalendarDays aria-hidden="true" size={17} className="text-[#9f927d]" />
                    {formatDateOnly(record.occurredOn)}
                  </span>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-[30px] bg-[#fffdf3] px-6 py-5 text-right shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
                <span data-record-detail-amount="true" className="sr-only">
                  {record.amountLabel}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#82d5bb]/20"
                />
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
                  Amount
                </p>
                <p
                  className={`mt-2 text-4xl font-black ${
                    record.entryType === "income" ? "text-[#1f7a70]" : "text-[#d46a5b]"
                  }`}
                >
                  {record.amountLabel}
                </p>
              </div>
            </div>

            <Divider type="wave-yellow" className="my-6" />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <DetailField
                icon={<UserRound aria-hidden="true" size={18} />}
                label="经手人"
                value={record.paidByLabel}
              />
              <DetailField
                icon={<UserRound aria-hidden="true" size={18} />}
                label="创建人"
                value={record.createdByLabel}
              />
              <DetailField
                icon={<Split aria-hidden="true" size={18} />}
                label="分摊方式"
                value={record.splitModeLabel}
              />
              <DetailField
                icon={<Clock3 aria-hidden="true" size={18} />}
                label="创建时间"
                value={formatDateTime(record.createdAt)}
              />
            </div>

            <div className="mt-5 rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-4">
              <p className="flex items-center gap-2 text-sm font-black text-[#794f27]">
                <ReceiptText aria-hidden="true" size={18} className="text-[#9f927d]" />
                备注
              </p>
              <p className="mt-3 text-sm font-bold leading-7 text-[#725d42]">
                {record.note?.trim() || "这张账单没有填写备注。"}
              </p>
            </div>

            {householdWarning ? <PageNotice message={householdWarning} tone="warning" /> : null}
            {detail.warning ? <PageNotice message={detail.warning} tone="warning" /> : null}
          </Card>

          <RecordsSettlementAwareness statusResult={settlementStatus} context="detail" />

          <SplitBreakdown record={record} />

          <SoftVoidCard
            record={record}
            returnContext={voidReturnContext}
            state={voidState}
          />
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

type RecordPagerContext = {
  month: string | null;
  filters: LedgerRecordFilters;
};

type RecordPagerLink = {
  href: string;
  title: string;
  meta: string;
};

type RecordPagerState = {
  previous: RecordPagerLink | null;
  next: RecordPagerLink | null;
  fallbackApplied: boolean;
  currentFound: boolean;
  warning: string | null;
};

async function getRecordPager(
  supabase: SupabaseClient,
  {
    currentRecordId,
    currentUserId,
    householdId,
    householdSummary,
    params,
    recordMonth
  }: {
    currentRecordId: string;
    currentUserId: string;
    householdId: string;
    householdSummary: DashboardHouseholdSummary;
    params: RecordDetailSearchParams;
    recordMonth: string | null;
  }
): Promise<RecordPagerState> {
  const requestedContext = createRecordPagerContext(params, recordMonth, householdSummary);
  const requestedPager = await getRecordPagerForContext(supabase, {
    context: requestedContext,
    currentRecordId,
    currentUserId,
    householdId,
    householdSummary
  });

  if (requestedPager.currentFound) {
    return requestedPager;
  }

  const fallbackContext = createMonthOnlyPagerContext(recordMonth);

  if (isSamePagerContext(requestedContext, fallbackContext)) {
    return requestedPager;
  }

  const fallbackPager = await getRecordPagerForContext(supabase, {
    context: fallbackContext,
    currentRecordId,
    currentUserId,
    householdId,
    householdSummary
  });

  return {
    ...fallbackPager,
    fallbackApplied: true,
    warning: fallbackPager.warning ?? requestedPager.warning
  };
}

async function getRecordPagerForContext(
  supabase: SupabaseClient,
  {
    context,
    currentRecordId,
    currentUserId,
    householdId,
    householdSummary
  }: {
    context: RecordPagerContext;
    currentRecordId: string;
    currentUserId: string;
    householdId: string;
    householdSummary: DashboardHouseholdSummary;
  }
): Promise<RecordPagerState> {
  const result = await getLedgerRecords(supabase, {
    householdId,
    currentUserId,
    categories: householdSummary.categories,
    members: householdSummary.members,
    month: context.month,
    filters: context.filters
  });
  const currentIndex = result.records.findIndex((record) => record.id === currentRecordId);

  return createRecordPagerState({
    context,
    currentIndex,
    records: result.records,
    warning: result.warning
  });
}

function createRecordPagerState({
  context,
  currentIndex,
  records,
  warning
}: {
  context: RecordPagerContext;
  currentIndex: number;
  records: LedgerRecord[];
  warning: string | null;
}): RecordPagerState {
  const currentFound = currentIndex >= 0;
  const previousRecord = currentFound && currentIndex > 0 ? records[currentIndex - 1] : null;
  const nextRecord = currentFound && currentIndex < records.length - 1 ? records[currentIndex + 1] : null;

  return {
    previous: previousRecord ? createRecordPagerLink(previousRecord, context) : null,
    next: nextRecord ? createRecordPagerLink(nextRecord, context) : null,
    fallbackApplied: false,
    currentFound,
    warning
  };
}

function createRecordPagerLink(record: LedgerRecord, context: RecordPagerContext): RecordPagerLink {
  const month = context.month ?? getMonthKeyFromDateOnly(record.occurredOn) ?? "";

  return {
    href: getRecordDetailHref(record.id, month, context.filters),
    title: record.note?.trim() || record.categoryName,
    meta: `${formatDateOnly(record.occurredOn)} · ${formatLedgerEntryType(record.entryType)} · ${formatLedgerRecordAmount(record)}`
  };
}

function createRecordPagerContext(
  params: RecordDetailSearchParams,
  fallbackMonth: string | null,
  householdSummary: DashboardHouseholdSummary
): RecordPagerContext {
  const category = normalizeReturnText(getSingleParam(params.category), 120);
  const member = normalizeReturnText(getSingleParam(params.member), 120);

  return {
    month: normalizeRecordsMonth(getSingleParam(params.month)) ?? fallbackMonth,
    filters: {
      type: normalizeRecordTypeFilter(getSingleParam(params.type)),
      categoryId: householdSummary.categories.some((candidate) => candidate.id === category)
        ? category
        : null,
      paidBy: householdSummary.members.some((candidate) => candidate.userId === member)
        ? member
        : null,
      keyword: normalizeReturnText(getSingleParam(params.q), 80)
    }
  };
}

function createMonthOnlyPagerContext(month: string | null): RecordPagerContext {
  return {
    month,
    filters: {
      type: "all",
      categoryId: null,
      paidBy: null,
      keyword: null
    }
  };
}

function isSamePagerContext(left: RecordPagerContext, right: RecordPagerContext) {
  return (
    left.month === right.month &&
    (left.filters.type ?? "all") === (right.filters.type ?? "all") &&
    (left.filters.categoryId ?? null) === (right.filters.categoryId ?? null) &&
    (left.filters.paidBy ?? null) === (right.filters.paidBy ?? null) &&
    (left.filters.keyword ?? null) === (right.filters.keyword ?? null)
  );
}

function RecordPager({ pager }: { pager: RecordPagerState }) {
  return (
    <Card
      type="dashed"
      color="default"
      className="relative overflow-visible p-4 sm:p-5"
      data-record-detail-pager="true"
      data-record-detail-pager-fallback={pager.fallbackApplied ? "true" : "false"}
    >
      <span
        aria-hidden="true"
        className="absolute -top-3 left-8 h-7 w-24 -rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PagerSlot
          direction="previous"
          item={pager.previous}
          missingLabel={
            pager.currentFound
              ? "已经是这张筛选贴纸下的第一笔"
              : "这张筛选贴纸里没有找到相邻账单"
          }
        />
        <PagerSlot
          direction="next"
          item={pager.next}
          missingLabel={
            pager.currentFound
              ? "已经翻到最后一笔啦"
              : "这张筛选贴纸里没有找到相邻账单"
          }
        />
      </div>

      {pager.fallbackApplied || pager.warning ? (
        <div className="mt-4 rounded-[22px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-3 text-xs font-black leading-6 text-[#8a6420]">
          {pager.fallbackApplied ? (
            <p>当前筛选没有包含这张账单，已经按账单所在月份继续翻页。</p>
          ) : null}
          {pager.warning ? <p>{pager.warning}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

function PagerSlot({
  direction,
  item,
  missingLabel
}: {
  direction: "previous" | "next";
  item: RecordPagerLink | null;
  missingLabel: string;
}) {
  const isPrevious = direction === "previous";
  const EyebrowIcon = isPrevious ? ChevronLeft : ChevronRight;
  const eyebrow = isPrevious ? "上一笔" : "下一笔";
  const enabledDataAttribute = isPrevious
    ? { "data-record-detail-prev-link": "true" }
    : { "data-record-detail-next-link": "true" };
  const disabledDataAttribute = isPrevious
    ? { "data-record-detail-prev-boundary": "true" }
    : { "data-record-detail-next-boundary": "true" };

  if (!item) {
    return (
      <div
        {...disabledDataAttribute}
        className="rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-4 text-sm font-black leading-6 text-[#9f927d] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.45)]"
      >
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em]">
          <EyebrowIcon aria-hidden="true" size={16} />
          {eyebrow}
        </p>
        <p className="mt-2 text-[#725d42]">{missingLabel}</p>
      </div>
    );
  }

  return (
    <Link
      {...enabledDataAttribute}
      href={item.href}
      aria-label={`${eyebrow} ${item.title}`}
      className="group block rounded-[26px] border-2 border-[#ead9b8] bg-[#fffdf3] px-4 py-4 shadow-[0_5px_0_rgba(121,79,39,0.08)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_7px_0_rgba(121,79,39,0.1)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
    >
      <div className={`flex items-start gap-3 ${isPrevious ? "" : "lg:flex-row-reverse lg:text-right"}`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27] shadow-[0_4px_0_#d9a43e] transition group-hover:-translate-y-0.5">
          <EyebrowIcon aria-hidden="true" size={20} />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
            {eyebrow}
          </span>
          <span className="mt-1 block truncate text-base font-black text-[#794f27]">
            {item.title}
          </span>
          <span className="mt-1 block text-xs font-bold leading-5 text-[#9f927d]">
            {item.meta}
          </span>
        </span>
      </div>
    </Link>
  );
}

function DetailNav({ returnHref }: { returnHref: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link
        href={returnHref}
        aria-label="返回账本列表"
        data-record-detail-return="true"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        返回账本列表
      </Link>
      <IslandLink
        href="/records/new"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
      >
        <Plus aria-hidden="true" size={18} />
        记一笔账
      </IslandLink>
    </div>
  );
}

function SoftVoidCard({
  record,
  returnContext,
  state
}: {
  record: RecordDetail;
  returnContext: VoidReturnContextParams;
  state: RecordVoidState;
}) {
  return (
    <Card
      type="dashed"
      color="default"
      className="relative overflow-visible p-5 sm:p-7"
      data-record-soft-void="true"
      data-record-soft-void-state={state.status}
    >
      <span
        aria-hidden="true"
        className="absolute -top-3 left-8 h-7 w-28 rotate-1 rounded-[10px] bg-[#fc736d]/45 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            <Icon name="icon-diy" size={18} bounce />
            Record Mutation V1
          </p>
          <div className="mt-3">
            <Title size="small" color="app-red" style={{ fontSize: 20 }}>
              作废这笔账
            </Title>
          </div>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-[#725d42]">
            作废后，这笔账会从普通账本、小结和实时结算里消失；不会删除历史结算便签，也不会改写已经保存的金额。
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-dashed border-[#d46a5b] bg-[#fff1ed] px-4 py-2 text-xs font-black text-[#b14c46] shadow-[0_4px_0_rgba(177,76,70,0.12)]">
          <FileWarning aria-hidden="true" size={16} />
          {state.badge}
        </span>
      </div>

      <Divider type="dashed-brown" className="my-5" />

      <div
        data-record-soft-void-warning="true"
        className={`rounded-[24px] border-2 border-dashed px-4 py-3 text-sm font-black leading-7 shadow-[0_5px_0_rgba(121,79,39,0.08)] ${state.toneClassName}`}
      >
        <p className="flex items-start gap-3">
          <AlertCircle aria-hidden="true" size={18} className="mt-1 shrink-0" />
          <span>
            <span className="block">{state.heading}</span>
            <span className="mt-1 block font-bold">{state.body}</span>
          </span>
        </p>
      </div>

      <form action={voidLedgerRecordAction} className="mt-5 grid gap-4">
        <input type="hidden" name="record_id" value={record.id} />
        <VoidReturnContextHiddenInputs returnContext={returnContext} />
        <label className="grid gap-2 text-sm font-black text-[#794f27]" htmlFor="record-void-reason">
          <span className="flex items-center gap-2">
            <StickyNote aria-hidden="true" size={17} className="text-[#9f927d]" />
            作废原因
            <span className="text-xs text-[#9f927d]">可选</span>
          </span>
          <textarea
            id="record-void-reason"
            name="void_reason"
            maxLength={180}
            disabled={state.disabled}
            placeholder="例如：重复记录、记错月份、这笔后来不需要计入账本"
            className="min-h-24 w-full resize-y rounded-[24px] border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-3 text-sm font-black leading-6 text-[#794f27] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.5),0_5px_0_rgba(121,79,39,0.08)] outline-none transition placeholder:text-[#9f927d]/70 disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#19c8b9] focus:ring-4 focus:ring-[#19c8b9]/25"
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold leading-6 text-[#9f927d]">
            这不是硬删除。分摊行会保留在数据库里，之后普通页面只是不再把这笔账算进去。
          </p>
          <Button
            type="primary"
            danger
            htmlType="submit"
            disabled={state.disabled}
            icon={<Ban aria-hidden="true" size={17} />}
          >
            作废这笔账
          </Button>
        </div>
      </form>
    </Card>
  );
}

function VoidReturnContextHiddenInputs({ returnContext }: { returnContext: VoidReturnContextParams }) {
  return (
    <>
      {returnContext.month ? <input type="hidden" name="return_month" value={returnContext.month} /> : null}
      {returnContext.type ? <input type="hidden" name="return_type" value={returnContext.type} /> : null}
      {returnContext.category ? <input type="hidden" name="return_category" value={returnContext.category} /> : null}
      {returnContext.member ? <input type="hidden" name="return_member" value={returnContext.member} /> : null}
      {returnContext.q ? <input type="hidden" name="return_q" value={returnContext.q} /> : null}
    </>
  );
}

function SplitBreakdown({ record }: { record: RecordDetail }) {
  return (
    <Card color="default" pattern="app-yellow" className="p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            Split Note
          </p>
          <div className="mt-2">
            <Title size="middle" color="app-yellow" style={{ fontSize: 22 }}>
              分摊明细
            </Title>
          </div>
          <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
            这里只读 `ledger_entry_splits`，用于确认每个人承担的金额。
          </p>
        </div>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_6px_0_#5fb89f]">
          <Split aria-hidden="true" size={27} />
        </span>
      </div>

      <Divider type="dashed-brown" className="my-5" />

      {record.splits.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {record.splits.map((split) => (
            <div
              key={split.userId}
              className="rounded-[26px] bg-[#fffdf3] px-5 py-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]"
            >
              <p className="flex items-center gap-2 text-sm font-black text-[#794f27]">
                <WalletCards aria-hidden="true" size={18} className="text-[#9f927d]" />
                {split.userLabel}
              </p>
              <p className="mt-2 text-2xl font-black text-[#d46a5b]">{split.shareAmountLabel}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-5 text-sm font-black leading-7 text-[#725d42]">
          这张账单还没有可显示的分摊行。不会自动猜测分摊金额。
        </div>
      )}
    </Card>
  );
}

function DetailField({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] bg-[#fffdf3] px-4 py-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">
        {icon}
        {label}
      </p>
      <p className="mt-2 break-words text-base font-black text-[#794f27]">{value}</p>
    </div>
  );
}

function CategoryPill({ record }: { record: RecordDetail }) {
  return (
    <span
      className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-black text-[#794f27]"
      style={{
        backgroundColor: record.categoryColor ? `${record.categoryColor}24` : "#ffffff",
        borderColor: record.categoryColor ?? "#d9c49b"
      }}
    >
      {record.categoryIcon ? <span aria-hidden="true">{record.categoryIcon}</span> : null}
      <Tags aria-hidden="true" size={16} className="text-[#9f927d]" />
      <span className="truncate">{record.categoryName}</span>
    </span>
  );
}

function PageNotice({
  message,
  tone
}: {
  message: string;
  tone: "warning" | "error";
}) {
  const classes =
    tone === "error"
      ? "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]"
      : "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mt-4 flex items-start gap-3 rounded-[24px] border-2 border-dashed px-4 py-3 text-sm font-black leading-6 ${classes}`}
    >
      <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function getVoidReturnContext(
  params: RecordDetailSearchParams,
  fallbackMonth: string | null
): VoidReturnContextParams {
  return {
    month: normalizeReturnMonth(getSingleParam(params.month)) ?? fallbackMonth,
    type: normalizeReturnType(getSingleParam(params.type)),
    category: normalizeReturnText(getSingleParam(params.category), 120),
    member: normalizeReturnText(getSingleParam(params.member), 120),
    q: normalizeReturnText(getSingleParam(params.q), 80)
  };
}

function getRecordVoidState(statusResult: GetSettlementSnapshotStatusResult): RecordVoidState {
  if (statusResult.pendingReplacement) {
    return {
      status: "blocked_pending_replacement",
      disabled: true,
      badge: "先处理新便签",
      heading: "这个月正在重新对齐结算便签。",
      body: "先处理完新的结算便签再改账。作废按钮会暂时锁住，避免让旧便签和新便签一起变得不稳。",
      toneClassName: "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]"
    };
  }

  if (statusResult.status === "error") {
    return {
      status: "status_error",
      disabled: true,
      badge: "稍后再试",
      heading: "结算状态暂时没读完整。",
      body: "为了避免误操作，先不要作废这笔账。等小岛重新读到结算便签状态后再回来处理。",
      toneClassName: "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]"
    };
  }

  if (statusResult.snapshot) {
    return {
      status: "settled",
      disabled: false,
      badge: "已留结算便签",
      heading: "这笔账所在月份已经留下一张结算便签。",
      body: "作废后不会改写旧便签，结算页会提示账本变化；之后可以用新的结算便签重新对齐。",
      toneClassName: "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]"
    };
  }

  return {
    status: "ready",
    disabled: false,
    badge: "只作废账本记录",
    heading: "这次只给账本记录盖上作废章。",
    body: "普通账本、小结和实时结算会在下次读取时自动排除它；历史结算便签和分摊行不会被删除。",
    toneClassName: "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]"
  };
}

function getRecordsReturnHref(params: RecordDetailSearchParams, fallbackMonth: string | null) {
  const month = normalizeReturnMonth(getSingleParam(params.month)) ?? fallbackMonth;
  const query = new URLSearchParams();

  if (month) {
    query.set("month", month);
  }

  const type = normalizeReturnType(getSingleParam(params.type));

  if (type) {
    query.set("type", type);
  }

  const category = normalizeReturnText(getSingleParam(params.category), 120);

  if (category) {
    query.set("category", category);
  }

  const member = normalizeReturnText(getSingleParam(params.member), 120);

  if (member) {
    query.set("member", member);
  }

  const keyword = normalizeReturnText(getSingleParam(params.q), 80);

  if (keyword) {
    query.set("q", keyword);
  }

  const queryString = query.toString();

  return queryString ? `/records?${queryString}` : "/records";
}

function normalizeReturnMonth(value: string | null) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month] = value.split("-").map(Number);

  if (year < 1 || year > 9999 || month < 1 || month > 12) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function normalizeReturnType(value: string | null) {
  return value === "expense" || value === "income" ? value : null;
}

function normalizeRecordTypeFilter(value: string | null): LedgerRecordTypeFilter {
  return value === "expense" || value === "income" ? value : "all";
}

function normalizeReturnText(value: string | null, maxLength: number) {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatDateOnly(date: string) {
  const [year, month, day] = date.split("-");

  if (!year || !month || !day) {
    return date;
  }

  return `${year}.${month}.${day}`;
}

function getMonthKeyFromDateOnly(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : null;
}

function formatLedgerEntryType(entryType: LedgerRecord["entryType"]) {
  return entryType === "income" ? "收入" : "支出";
}

function formatLedgerRecordAmount(record: LedgerRecord) {
  const prefix = record.entryType === "income" ? "+" : "-";

  return `${prefix}${formatMoney(record.amount)}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
