import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Coins,
  FileUp,
  HelpCircle,
  Hourglass,
  LockKeyhole,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Split,
  Sparkles,
  Tags,
  UserRound,
  WalletCards
} from "lucide-react";
import { Button, Card, Divider, Icon, Title } from "animal-island-ui";
import { AppShell } from "@/components/layout/AppShell";
import { NotebookEmptyState } from "@/components/NotebookEmptyState";
import { PrivateIslandTrail, islandTrailLabels } from "@/components/PrivateIslandTrail";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import {
  getImportBatchReviewSummary,
  getImportBatchStatusLabel,
  getImportBatchStatusTone,
  getImportReviewHouseholdMembership,
  getImportSourceLabel,
  type ImportBatchSummary
} from "@/lib/import-review/batches";
import {
  getImportReviewCardState,
  getImportItemDisplaySuggestion,
  listImportItemsForReview,
  normalizeImportReviewDirectionFilter,
  normalizeImportReviewSuggestionFilter,
  normalizeImportReviewStatusFilter,
  type ImportReviewCardState,
  type ImportReviewDirectionFilter,
  type ImportReviewItem,
  type ImportReviewSuggestionFilter,
  type ImportReviewStatusFilter
} from "@/lib/import-review/review-items";
import {
  getSettlementSnapshotStatus,
  type GetSettlementSnapshotStatusResult
} from "@/lib/settlement/get-settlement-snapshot-status";
import { createClient } from "@/lib/supabase/server";
import type {
  DashboardCategory,
  DashboardHouseholdMember,
  DashboardHouseholdSummary
} from "@/types/dashboard";
import { ImportReviewKeyboardShortcuts } from "./ImportReviewKeyboardShortcuts";
import {
  confirmImportItemToLedgerAction,
  markImportItemPersonalAction,
  reopenImportItemToPendingAction,
  updateImportItemReviewStatusAction
} from "./actions";

type ImportReviewPageProps = {
  params: Promise<{
    batchId: string;
  }>;
  searchParams?: Promise<{
    notice?: string | string[];
    status?: string | string[];
    suggestion?: string | string[];
    direction?: string | string[];
    item?: string | string[];
    index?: string | string[];
    import_review_result?: string | string[];
    import_review_error?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "对账卡片页 | 小岛账本"
};

const statusFilters: ImportReviewStatusFilter[] = [
  "pending",
  "all",
  "imported",
  "skipped",
  "need_discussion"
];

const statusFilterLabels: Record<ImportReviewStatusFilter, string> = {
  all: "全部",
  pending: "待确认",
  imported: "已入账",
  skipped: "已忽略",
  need_discussion: "待讨论"
};

const reviewStatusLabels = statusFilterLabels;

const suggestionFilters: ImportReviewSuggestionFilter[] = ["all", "skip", "need_discussion", "review"];

const suggestionFilterLabels: Record<ImportReviewSuggestionFilter, string> = {
  all: "全部建议",
  skip: "建议忽略",
  need_discussion: "建议待确认",
  review: "建议入账/复核"
};

const directionFilters: ImportReviewDirectionFilter[] = [
  "all",
  "expense",
  "income",
  "refund",
  "transfer",
  "unknown"
];

const directionFilterLabels: Record<ImportReviewDirectionFilter, string> = {
  all: "全部类型",
  expense: "支出",
  income: "收入",
  refund: "退款",
  transfer: "转账/充值提现",
  unknown: "未知"
};

const shortcutTargetIds = {
  confirmForm: "import-review-confirm-common-form",
  skipForm: "import-review-skip-form",
  needDiscussionForm: "import-review-need-discussion-form"
} as const;

export default async function ImportReviewPage({ params, searchParams }: ImportReviewPageProps) {
  const { batchId } = await params;
  const query = searchParams ? await searchParams : {};
  const statusFilter = normalizeImportReviewStatusFilter(query.status);
  const suggestionFilter = normalizeImportReviewSuggestionFilter(query.suggestion);
  const directionFilter = normalizeImportReviewDirectionFilter(query.direction);
  const { supabase, user, membership } = await requireImportsAccess();
  const householdSummaryResult = await getDashboardHouseholdSummary(supabase, {
    householdId: membership.household_id,
    currentUserId: user.id
  });
  const result = await getImportBatchReviewSummary(supabase, {
    householdId: membership.household_id,
    batchId
  });

  if (!result.ok) {
    return (
      <ImportReviewShell>
        <BatchUnavailableState reason={result.reason} />
      </ImportReviewShell>
    );
  }

  const itemsResult = await listImportItemsForReview(supabase, {
    householdId: membership.household_id,
    batchId,
    statusFilter,
    suggestionFilter,
    directionFilter
  });
  const cardState = getImportReviewCardState({
    batch: result.batch,
    items: itemsResult.items,
    statusFilter,
    suggestionFilter,
    directionFilter,
    suggestionCounts: itemsResult.suggestionCounts,
    directionCounts: itemsResult.directionCounts,
    itemId: getSingleParam(query.item),
    index: getSingleParam(query.index)
  });
  const settlementStatus = cardState.selectedItem
    ? await getSettlementSnapshotStatus(supabase, {
        householdId: membership.household_id,
        month: cardState.selectedItem.monthKey
      })
    : null;

  return (
    <ImportReviewShell>
      {getSingleParam(query.notice) === "duplicate" ? (
        <PageNotice message="这份文件之前已经放进待对账池了，这里直接带你回到已有批次，没有创建第二份。" />
      ) : null}
      {result.warning ? <PageNotice message={result.warning} /> : null}
      {itemsResult.warning ? <PageNotice message={itemsResult.warning} /> : null}
      {householdSummaryResult.warning ? <PageNotice message={householdSummaryResult.warning} /> : null}
      {cardState.warning ? <PageNotice message={cardState.warning} /> : null}
      <ReviewActionNotice
        error={getSingleParam(query.import_review_error)}
        result={getSingleParam(query.import_review_result)}
      />
      <ReviewCardPage
        batch={result.batch}
        currentUserId={user.id}
        householdSummary={householdSummaryResult.summary}
        settlementStatus={settlementStatus}
        state={cardState}
      />
    </ImportReviewShell>
  );
}

async function requireImportsAccess() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const membership = await getImportReviewHouseholdMembership(supabase, user.id);

  if (!membership) {
    redirect("/not-invited");
  }

  return { supabase, user, membership };
}

function ImportReviewShell({ children }: { children: ReactNode }) {
  return (
    <AppShell title="对账卡片页" subtitle="一条一条看待对账流水，把共同支出确认进正式账本">
      <div className="mx-auto grid max-w-6xl gap-6">
        <PrivateIslandTrail
          items={[
            { label: islandTrailLabels.home, href: "/dashboard" },
            { label: "待对账账单", href: "/imports" },
            { label: "对账卡片页", current: true }
          ]}
        />
        {children}
      </div>
    </AppShell>
  );
}

function ReviewCardPage({
  batch,
  currentUserId,
  householdSummary,
  settlementStatus,
  state
}: {
  batch: ImportBatchSummary;
  currentUserId: string;
  householdSummary: DashboardHouseholdSummary;
  settlementStatus: GetSettlementSnapshotStatusResult | null;
  state: ImportReviewCardState;
}) {
  return (
    <div className="grid gap-6">
      <ReviewBatchHeader batch={batch} state={state} />
      <StatusFilterTabs batchId={batch.id} state={state} />
      <SuggestionFilterChips batchId={batch.id} state={state} />
      <DirectionFilterChips batchId={batch.id} state={state} />
      {state.selectedItem ? (
        <ImportItemCard
          batch={batch}
          currentUserId={currentUserId}
          householdSummary={householdSummary}
          item={state.selectedItem}
          settlementStatus={settlementStatus}
          state={state}
        />
      ) : (
        <EmptyReviewState batch={batch} state={state} />
      )}
      <ReadonlyPromise />
    </div>
  );
}

function ReviewBatchHeader({
  batch,
  state
}: {
  batch: ImportBatchSummary;
  state: ImportReviewCardState;
}) {
  const selectedPosition = state.selectedIndex >= 0 ? state.selectedIndex + 1 : 0;
  const progress = getBatchProgress(batch);

  return (
    <Card color="default" pattern="app-teal" className="relative overflow-visible p-5 sm:p-7">
      <span
        aria-hidden="true"
        className="absolute -top-4 left-8 h-8 w-28 -rotate-2 rounded-[10px] bg-[#f7cd67]/75 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
            <Icon name={batch.source === "wechat" ? "icon-chat" : "icon-shopping"} size={22} bounce />
            {getImportSourceLabel(batch.source)}
          </p>
          <div className="mt-5">
            <Title size="large" color="app-yellow">
              一条一条对账
            </Title>
          </div>
          <p className="mt-5 max-w-3xl text-sm font-bold leading-7 text-[#725d42] sm:text-base">
            这页展示外部账单解析出来的待对账条目。V1 只有“共同支出 + 两人平分”会写入正式账本；个人支出会作为非共同账本结果留在导入复核历史里。
          </p>
          <Divider type="wave-yellow" className="my-6" />
          <div
            data-import-review-progress-card="true"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
          >
            <ProgressCard icon={<ReceiptText aria-hidden="true" size={20} />} label="已解析" value={batch.parsedCount} />
            <ProgressCard icon={<Hourglass aria-hidden="true" size={20} />} label="待确认" value={batch.pendingCount} />
            <ProgressCard icon={<BadgeCheck aria-hidden="true" size={20} />} label="已入账" value={batch.importedCount} />
            <ProgressCard icon={<ReceiptText aria-hidden="true" size={20} />} label="已忽略" value={batch.skippedCount} />
            <ProgressCard icon={<HelpCircle aria-hidden="true" size={20} />} label="待讨论" value={batch.needDiscussionCount} />
            <ProgressCard
              icon={<ShieldCheck aria-hidden="true" size={20} />}
              label="对完比例"
              value={`${progress.reviewedPercent}%`}
            />
          </div>
          <div className="mt-4 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-white/75 px-4 py-3 shadow-[0_5px_0_rgba(121,79,39,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black text-[#794f27]">
              <span>整批进度</span>
              <span data-import-review-progress-percent={`${progress.reviewedPercent}%`}>
                {progress.reviewedPercent}%
              </span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#eadfc8] shadow-[inset_0_1px_0_rgba(121,79,39,0.12)]">
              <span
                className="block h-full rounded-full bg-[#82d5bb] transition-[width] duration-300"
                style={{ width: `${progress.reviewedPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-5 shadow-[0_7px_0_rgba(121,79,39,0.09)]">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">Batch Note</p>
          <p className="mt-3 break-words text-lg font-black text-[#794f27]">{batch.fileName}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">{formatImportPeriod(batch)}</p>
          <span
            className={`mt-4 inline-flex rounded-full border-2 border-dashed px-3 py-1 text-xs font-black ${getImportBatchStatusTone(
              batch.status
            )}`}
          >
            {getImportBatchStatusLabel(batch.status)}
          </span>
          <div
            data-import-review-position={`${selectedPosition}/${state.totalItems}`}
            className="mt-5 rounded-[24px] bg-white px-4 py-4 text-center shadow-[inset_0_0_0_2px_rgba(217,196,155,0.62)]"
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">Card Progress</p>
            {state.selectedItem ? (
              <p className="mt-2 text-3xl font-black text-[#794f27]">
                第 {selectedPosition} / {state.totalItems} 条
              </p>
            ) : (
              <p className="mt-2 text-2xl font-black text-[#794f27]">暂无当前卡片</p>
            )}
            <p className="mt-2 text-xs font-bold leading-5 text-[#725d42]">
              当前筛选内 {state.totalItems} 条
            </p>
          </div>
        </div>
      </div>

      {progress.isComplete ? <BatchCompletionCard batch={batch} /> : null}
    </Card>
  );
}

function StatusFilterTabs({
  batchId,
  state
}: {
  batchId: string;
  state: ImportReviewCardState;
}) {
  return (
    <div
      data-import-review-status-filter="true"
      className="flex flex-wrap gap-2 rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-3 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
    >
      {statusFilters.map((filter) => {
        const isActive = filter === state.statusFilter;
        const content = (
          <>
            <span>{statusFilterLabels[filter]}</span>
            <span className="rounded-full bg-white/75 px-2 py-0.5 text-[11px]">{state.counts[filter]}</span>
          </>
        );

        if (isActive) {
          return (
            <span
              key={filter}
              aria-current="page"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-4 py-2 text-xs font-black text-[#794f27] shadow-[0_4px_0_#d9a43e]"
            >
              {content}
            </span>
          );
        }

        return (
          <Link
            key={filter}
            href={getReviewHref(batchId, filter, state.suggestionFilter, state.directionFilter, null)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-xs font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 hover:bg-[#e9fbf4] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}

function SuggestionFilterChips({
  batchId,
  state
}: {
  batchId: string;
  state: ImportReviewCardState;
}) {
  return (
    <div
      data-import-review-suggestion-filter="true"
      className="grid gap-3 rounded-[28px] border-2 border-dashed border-[#82d5bb] bg-[#e9fbf4] p-3 shadow-[0_5px_0_rgba(31,122,112,0.1)]"
    >
      <p className="flex items-center gap-2 px-2 text-xs font-black uppercase tracking-[0.14em] text-[#1f7a70]">
        <Sparkles aria-hidden="true" size={16} />
        按系统建议筛选
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestionFilters.map((filter) => {
          const isActive = filter === state.suggestionFilter;
          const content = (
            <>
              <span>{suggestionFilterLabels[filter]}</span>
              <span className="rounded-full bg-white/75 px-2 py-0.5 text-[11px]">
                {state.suggestionCounts[filter]}
              </span>
            </>
          );

          if (isActive) {
            return (
              <span
                key={filter}
                aria-current="page"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#82d5bb] px-4 py-2 text-xs font-black text-white shadow-[0_4px_0_#5fb89f]"
              >
                {content}
              </span>
            );
          }

          return (
            <Link
              key={filter}
              href={getReviewHref(batchId, state.statusFilter, filter, state.directionFilter, null)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#9fd8ca] bg-white px-4 py-2 text-xs font-black text-[#1f7a70] shadow-[0_4px_0_rgba(31,122,112,0.1)] transition hover:-translate-y-0.5 hover:bg-[#fffdf3] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function DirectionFilterChips({
  batchId,
  state
}: {
  batchId: string;
  state: ImportReviewCardState;
}) {
  return (
    <div
      data-import-review-direction-filter="true"
      className="grid gap-3 rounded-[28px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] p-3 shadow-[0_5px_0_rgba(138,100,32,0.1)]"
    >
      <p className="flex items-center gap-2 px-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a6420]">
        <WalletCards aria-hidden="true" size={16} />
        按流水类型筛选
      </p>
      <div className="flex flex-wrap gap-2">
        {directionFilters.map((filter) => {
          const isActive = filter === state.directionFilter;
          const content = (
            <>
              <span>{directionFilterLabels[filter]}</span>
              <span className="rounded-full bg-white/75 px-2 py-0.5 text-[11px]">
                {state.directionCounts[filter]}
              </span>
            </>
          );

          if (isActive) {
            return (
              <span
                key={filter}
                aria-current="page"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-4 py-2 text-xs font-black text-[#794f27] shadow-[0_4px_0_#d9a43e]"
              >
                {content}
              </span>
            );
          }

          return (
            <Link
              key={filter}
              href={getReviewHref(batchId, state.statusFilter, state.suggestionFilter, filter, null)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-xs font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 hover:bg-[#e9fbf4] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function BatchCompletionCard({ batch }: { batch: ImportBatchSummary }) {
  return (
    <div
      data-import-review-completion-card="true"
      className="mt-5 rounded-[28px] border-2 border-dashed border-[#82d5bb] bg-[#e9fbf4] p-4 shadow-[0_7px_0_rgba(31,122,112,0.1)]"
    >
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#1f7a70]">
        <CheckCircle2 aria-hidden="true" size={18} />
        Batch Finished
      </p>
      <h3 className="mt-3 text-xl font-black text-[#1f7a70]">这批账单已经对完啦</h3>
      <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
        已入账的小纸条已经进入正式账本；已忽略的会留在导入历史里方便回看；待讨论的小纸条仍然可以之后再回来一起确认。
      </p>
      <BatchNextStepLinks batch={batch} />
    </div>
  );
}

function BatchNextStepLinks({ batch }: { batch: ImportBatchSummary }) {
  const month = getBatchMonthKey(batch);
  const links = [
    { href: getReviewHref(batch.id, "all", "all", "all", null), label: "查看全部流水", icon: <ReceiptText aria-hidden="true" size={16} /> },
    { href: getReviewHref(batch.id, "imported", "all", "all", null), label: "查看已入账", icon: <BadgeCheck aria-hidden="true" size={16} /> },
    { href: getReviewHref(batch.id, "need_discussion", "all", "all", null), label: "查看待确认", icon: <HelpCircle aria-hidden="true" size={16} /> },
    { href: "/imports", label: "回到导入列表", icon: <ArrowLeft aria-hidden="true" size={16} /> },
    { href: "/imports/new", label: "导入新账单", icon: <FileUp aria-hidden="true" size={16} /> },
    { href: month ? `/records?month=${month}` : "/records", label: "去账本看看", icon: <ReceiptText aria-hidden="true" size={16} /> },
    {
      href: month ? `/reports/monthly?month=${month}` : "/reports/monthly",
      label: "去月报看看",
      icon: <CalendarDays aria-hidden="true" size={16} />
    },
    { href: month ? `/settlement?month=${month}` : "/settlement", label: "去结算看看", icon: <Coins aria-hidden="true" size={16} /> }
  ];

  return (
    <div
      data-import-review-next-step-links="true"
      className="mt-4 flex flex-wrap gap-2"
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          {link.icon}
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function ImportItemCard({
  batch,
  currentUserId,
  householdSummary,
  state,
  item,
  settlementStatus
}: {
  batch: ImportBatchSummary;
  currentUserId: string;
  householdSummary: DashboardHouseholdSummary;
  state: ImportReviewCardState;
  item: ImportReviewItem;
  settlementStatus: GetSettlementSnapshotStatusResult | null;
}) {
  const confirmBlockReason = getConfirmBlockReason({
    categories: householdSummary.categories,
    item,
    members: householdSummary.members,
    settlementStatus
  });
  const canConfirmCommonExpense = Boolean(
    !confirmBlockReason &&
      getDefaultCategoryId(householdSummary.categories, item) &&
      getDefaultPaidBy(householdSummary.members, currentUserId)
  );
  const canUseStatusShortcut = item.reviewStatus === "pending" && !item.ledgerEntryId;
  const previousHref = state.previousItem
    ? getReviewHref(batch.id, state.statusFilter, state.suggestionFilter, state.directionFilter, state.previousItem.id)
    : null;
  const nextHref = state.nextItem
    ? getReviewHref(batch.id, state.statusFilter, state.suggestionFilter, state.directionFilter, state.nextItem.id)
    : null;

  return (
    <Card
      color="default"
      pattern="app-yellow"
      className="relative overflow-visible p-5 sm:p-7"
      data-import-review-card="true"
    >
      <span
        aria-hidden="true"
        className="absolute -top-4 right-10 h-8 w-28 rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.reviewStatus} />
            <span className="inline-flex items-center gap-2 rounded-full bg-[#e9fbf4] px-3 py-1 text-xs font-black text-[#1f7a70]">
              <Icon name={item.source === "wechat" ? "icon-chat" : "icon-shopping"} size={16} bounce />
              {getImportSourceLabel(item.source)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-white/85 px-3 py-1 text-xs font-black text-[#794f27]">
              <Clock3 aria-hidden="true" size={15} />
              {formatImportItemTime(item.transactionTime)}
            </span>
          </div>

          <div className="mt-5 rounded-[30px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-5 shadow-[0_7px_0_rgba(121,79,39,0.08)]">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">Source Memo</p>
            <h2 className="mt-3 break-words text-2xl font-black leading-tight text-[#794f27]">
              {item.description ?? item.counterparty ?? "没有备注的小纸条"}
            </h2>
            <p className="mt-3 text-sm font-bold leading-7 text-[#725d42]">
              {item.counterparty ? `交易对象：${item.counterparty}` : "交易对象还没有识别出来"}
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-2xl font-black text-[#794f27] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.65)]">
              <CircleDollarSign aria-hidden="true" size={24} />
              {formatCents(item.amountCents)}
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DetailSticker icon={<CalendarDays aria-hidden="true" size={18} />} label="月份" value={item.monthKey} />
            <DetailSticker icon={<WalletCards aria-hidden="true" size={18} />} label="方向" value={getDirectionLabel(item.direction)} />
            <DetailSticker icon={<Tags aria-hidden="true" size={18} />} label="来源分类" value={item.sourceCategory ?? "没有分类"} />
            <DetailSticker icon={<ReceiptText aria-hidden="true" size={18} />} label="支付方式" value={item.paymentMethod ?? "未识别"} />
            <DetailSticker icon={<HelpCircle aria-hidden="true" size={18} />} label="来源状态" value={item.sourceStatus ?? "未识别"} />
            <DetailSticker
              icon={<LockKeyhole aria-hidden="true" size={18} />}
              label="来源流水号"
              value={maskSourceTransactionId(item.sourceTransactionId)}
            />
          </div>
          <DirectionExplanation direction={item.direction} />
        </section>

        <aside className="grid gap-4 content-start">
          <ImportReviewKeyboardShortcuts
            canFocusCommonExpense={canConfirmCommonExpense}
            canMarkNeedDiscussion={canUseStatusShortcut}
            canSkip={canUseStatusShortcut}
            canSubmitConfirm={canConfirmCommonExpense}
            commonExpenseAreaId={shortcutTargetIds.confirmForm}
            confirmFormId={shortcutTargetIds.confirmForm}
            needDiscussionFormId={shortcutTargetIds.needDiscussionForm}
            nextHref={nextHref}
            previousHref={previousHref}
            skipFormId={shortcutTargetIds.skipForm}
          />
          <CardNavigator batchId={batch.id} state={state} />
          <SuggestionPanel canQuickApplyStatus={canUseStatusShortcut} item={item} />
          <ReviewDecisionControls
            batch={batch}
            categories={householdSummary.categories}
            currentUserId={currentUserId}
            item={item}
            members={householdSummary.members}
            settlementStatus={settlementStatus}
            state={state}
          />
        </aside>
      </div>
    </Card>
  );
}

function CardNavigator({
  batchId,
  state
}: {
  batchId: string;
  state: ImportReviewCardState;
}) {
  return (
    <div className="grid gap-3 rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-white/80 p-4 shadow-[0_5px_0_rgba(121,79,39,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">Card Walk</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <PagerSlot
          direction="previous"
          href={
            state.previousItem
              ? getReviewHref(batchId, state.statusFilter, state.suggestionFilter, state.directionFilter, state.previousItem.id)
              : null
          }
          item={state.previousItem}
        />
        <PagerSlot
          direction="next"
          href={
            state.nextItem
              ? getReviewHref(batchId, state.statusFilter, state.suggestionFilter, state.directionFilter, state.nextItem.id)
              : null
          }
          item={state.nextItem}
        />
      </div>
    </div>
  );
}

function PagerSlot({
  direction,
  href,
  item
}: {
  direction: "previous" | "next";
  href: string | null;
  item: ImportReviewItem | null;
}) {
  const icon =
    direction === "previous" ? (
      <ChevronLeft aria-hidden="true" size={18} />
    ) : (
      <ChevronRight aria-hidden="true" size={18} />
    );
  const title = direction === "previous" ? "上一条" : "下一条";
  const dataAttribute =
    direction === "previous"
      ? { "data-import-review-previous-link": "true" }
      : { "data-import-review-next-link": "true" };

  if (!href || !item) {
    return (
      <div className="rounded-[24px] border-2 border-dashed border-[#e4d6bd] bg-[#fffdf3] px-4 py-3 text-sm font-black text-[#b2a38e]">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <p className="mt-1 text-xs leading-5">这一侧没有更多小纸条了</p>
      </div>
    );
  }

  return (
    <Link
      href={href}
      {...dataAttribute}
      className="group rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
    >
      <span className="flex items-center gap-2">
        {icon}
        {title}
      </span>
      <span className="mt-1 block truncate text-xs leading-5 text-[#725d42]">
        {item.description ?? item.counterparty ?? formatCents(item.amountCents)}
      </span>
    </Link>
  );
}

function DirectionExplanation({ direction }: { direction: ImportReviewItem["direction"] }) {
  const explanation = getDirectionExplanation(direction);

  if (!explanation) {
    return null;
  }

  return (
    <div
      data-import-review-direction-explanation={direction}
      className="mt-5 rounded-[26px] border-2 border-dashed border-[#82d5bb] bg-[#e9fbf4] p-4 shadow-[0_6px_0_rgba(31,122,112,0.1)]"
    >
      <p className="flex items-center gap-2 text-sm font-black text-[#1f7a70]">
        <AlertCircle aria-hidden="true" size={18} />
        {explanation.title}
      </p>
      <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
        {explanation.body}
      </p>
      {explanation.helper ? (
        <p className="mt-2 rounded-[18px] bg-white/75 px-3 py-2 text-xs font-black leading-5 text-[#1f7a70] shadow-[inset_0_0_0_2px_rgba(130,213,187,0.42)]">
          {explanation.helper}
        </p>
      ) : null}
    </div>
  );
}

function getDirectionExplanation(direction: ImportReviewItem["direction"]) {
  if (direction === "transfer") {
    return {
      title: "转账类小纸条",
      body: "这类通常是转账、提现、充值或理财流转，不一定是共同消费。",
      helper: "可以按建议忽略，也可以待确认。"
    };
  }

  if (direction === "refund") {
    return {
      title: "退款类小纸条",
      body: "这类可能是退款或交易关闭，建议先确认是否要和原消费对应。",
      helper: null
    };
  }

  if (direction === "unknown") {
    return {
      title: "未识别小纸条",
      body: "这笔流水信息不够明确，建议一起看一下。",
      helper: null
    };
  }

  return null;
}

function SuggestionPanel({
  canQuickApplyStatus,
  item
}: {
  canQuickApplyStatus: boolean;
  item: ImportReviewItem;
}) {
  const suggestion = getImportItemDisplaySuggestion(item);
  const quickApply = getSuggestedQuickApplyAction(item, canQuickApplyStatus, suggestion.reviewAction);

  return (
    <div
      data-import-review-suggestion="true"
      data-import-review-suggested-action={suggestion.reviewAction ?? "none"}
      className="rounded-[28px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] p-4 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
    >
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a6420]">
        <Sparkles aria-hidden="true" size={17} />
        系统建议
      </p>
      <div className="mt-3 grid gap-2">
        <SuggestionLine label="建议分类" value={suggestion.category ?? "暂无分类建议"} />
        <SuggestionLine
          label="建议动作"
          value={suggestion.reviewAction ? getSuggestedReviewActionLabel(suggestion.reviewAction) : "暂无明确动作"}
        />
      </div>
      <p className="mt-3 rounded-[20px] bg-white/75 px-3 py-2 text-xs font-bold leading-6 text-[#8a6420]">
        这些只是辅助判断的小便签，不会自动入账；最后仍需要你们确认。
      </p>
      {quickApply ? (
        <div
          className="mt-4 rounded-[24px] border-2 border-dashed border-[#82d5bb] bg-[#e9fbf4] p-3 shadow-[0_5px_0_rgba(31,122,112,0.1)]"
          data-import-review-suggestion-quick-apply={quickApply.reviewStatus}
        >
          <p className="flex items-center gap-2 text-sm font-black leading-6 text-[#1f7a70]">
            {quickApply.reviewStatus === "skipped" ? (
              <ReceiptText aria-hidden="true" size={17} />
            ) : (
              <Hourglass aria-hidden="true" size={17} />
            )}
            {quickApply.headline}
          </p>
          <p className="mt-2 text-xs font-bold leading-6 text-[#725d42]">
            {quickApply.examples}
          </p>
          <p className="mt-2 rounded-[18px] bg-white/75 px-3 py-2 text-xs font-black leading-5 text-[#1f7a70] shadow-[inset_0_0_0_2px_rgba(130,213,187,0.42)]">
            建议只是小岛便签，最终仍由你们决定；按建议处理只会复用现有状态操作，不会创建正式账本流水。
          </p>
          <Button
            block
            form={quickApply.formId}
            htmlType="submit"
            icon={
              quickApply.reviewStatus === "skipped" ? (
                <ReceiptText aria-hidden="true" size={18} />
              ) : (
                <Hourglass aria-hidden="true" size={18} />
              )
            }
            size="large"
            type="primary"
          >
            {quickApply.buttonLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ReviewDecisionControls({
  batch,
  categories,
  currentUserId,
  item,
  members,
  settlementStatus,
  state
}: {
  batch: ImportBatchSummary;
  categories: DashboardCategory[];
  currentUserId: string;
  item: ImportReviewItem;
  members: DashboardHouseholdMember[];
  settlementStatus: GetSettlementSnapshotStatusResult | null;
  state: ImportReviewCardState;
}) {
  if (item.reviewStatus === "imported") {
    return <ImportedLedgerStatusCard item={item} />;
  }

  if (item.reviewStatus === "skipped" || item.reviewStatus === "need_discussion") {
    return (
      <ReviewedOutcomeStatusCard
        batch={batch}
        currentUserId={currentUserId}
        item={item}
        members={members}
        state={state}
      />
    );
  }

  const canUpdateStatus = item.reviewStatus === "pending" && !item.ledgerEntryId;
  const confirmBlockReason = getConfirmBlockReason({ categories, item, members, settlementStatus });
  const canConfirmCommonExpense = !confirmBlockReason;
  const defaultCategoryId = getDefaultCategoryId(categories, item);
  const defaultPaidBy = getDefaultPaidBy(members, currentUserId);
  const personalActionOptions = getPersonalActionOptions(members, currentUserId);
  const settlementNotice = getImportSettlementNotice(settlementStatus);

  return (
    <div
      data-import-review-decision-controls="true"
      className="rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-4 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
    >
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
        <LockKeyhole aria-hidden="true" size={17} />
        这条怎么处理
      </p>

      {settlementNotice ? <ConfirmNotice notice={settlementNotice} /> : null}

      {canConfirmCommonExpense && defaultCategoryId && defaultPaidBy ? (
        <form
          action={confirmImportItemToLedgerAction}
          className="mt-4 grid gap-4 rounded-[26px] border-2 border-dashed border-[#82d5bb] bg-[#e9fbf4]/75 p-4 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
          data-import-review-common-expense-area="true"
          data-import-review-confirm-common="true"
          id={shortcutTargetIds.confirmForm}
        >
          <ConfirmActionHiddenInputs batch={batch} item={item} state={state} />

          <fieldset className="grid gap-3">
            <legend className="flex items-center gap-2 text-sm font-black text-[#1f7a70]">
              <Tags aria-hidden="true" size={17} />
              分类快捷贴纸
            </legend>
            <div className="grid gap-2">
              {categories.map((category) => (
                <label key={category.id} className={radioCardClassName}>
                  <input
                    type="radio"
                    name="category_id"
                    value={category.id}
                    required
                    defaultChecked={category.id === defaultCategoryId}
                    className="mt-1 h-4 w-4 accent-[#19c8b9]"
                  />
                  <span>
                    <span className="block font-black text-[#794f27]">
                      {formatCategoryOption(category)}
                    </span>
                    <span className="mt-1 block text-xs font-bold leading-5 text-[#725d42]">
                      作为正式账本分类保存
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <ConfirmFormField
            id="import-confirm-paid-by"
            label="谁先付的"
            icon={<UserRound aria-hidden="true" size={17} />}
          >
            <select
              id="import-confirm-paid-by"
              name="paid_by_user_id"
              required
              defaultValue={defaultPaidBy}
              className={inputClassName}
            >
              {members.map((member, index) => (
                <option key={member.userId} value={member.userId}>
                  {formatMemberOption(member, index)}
                </option>
              ))}
            </select>
          </ConfirmFormField>

          <input name="split_type" type="hidden" value="equal" />
          <div className="rounded-[22px] bg-white/80 px-4 py-3 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.6)]">
            <p className="flex items-center gap-2 text-sm font-black text-[#794f27]">
              <Split aria-hidden="true" size={17} />
              两人平分
            </p>
            <p className="mt-1 text-xs font-bold leading-5 text-[#725d42]">
              V1 只开放共同支出等分；个人账和自定义分摊先不写入。
            </p>
          </div>

          <ConfirmFormField id="import-confirm-note" label="备注" optional>
            <input
              id="import-confirm-note"
              name="note"
              type="text"
              maxLength={80}
              defaultValue={getDefaultConfirmNote(item)}
              className={inputClassName}
            />
          </ConfirmFormField>

          <Button
            block
            htmlType="submit"
            icon={<CheckCircle2 aria-hidden="true" size={18} />}
            size="large"
            type="primary"
          >
            确认共同支出并下一条
          </Button>
        </form>
      ) : (
        <div
          className="mt-4 rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-white/78 p-4 text-sm font-bold leading-6 text-[#725d42]"
          data-import-review-confirm-common-disabled="true"
        >
          <p className="flex items-center gap-2 font-black text-[#794f27]">
            <Coins aria-hidden="true" size={17} />
            共同支出确认暂不可用
          </p>
          <p className="mt-2">{confirmBlockReason ?? "这条小纸条暂时还不能确认进正式账本。"}</p>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <PersonalActionPanel
          batch={batch}
          item={item}
          options={personalActionOptions}
          state={state}
        />
        <form
          action={updateImportItemReviewStatusAction}
          data-import-review-status-action="skipped"
          id={shortcutTargetIds.skipForm}
        >
          <ReviewStatusActionHiddenInputs
            batch={batch}
            item={item}
            reviewStatus="skipped"
            state={state}
          />
          <Button
            block
            disabled={!canUpdateStatus}
            htmlType="submit"
            icon={<ReceiptText aria-hidden="true" size={18} />}
            type="dashed"
          >
            忽略此条
          </Button>
        </form>
        <form
          action={updateImportItemReviewStatusAction}
          data-import-review-status-action="need_discussion"
          id={shortcutTargetIds.needDiscussionForm}
        >
          <ReviewStatusActionHiddenInputs
            batch={batch}
            item={item}
            reviewStatus="need_discussion"
            state={state}
          />
          <Button
            block
            disabled={!canUpdateStatus}
            htmlType="submit"
            icon={<Hourglass aria-hidden="true" size={18} />}
            type="dashed"
          >
            标记待确认
          </Button>
        </form>
      </div>
      <p className="mt-3 text-xs font-bold leading-6 text-[#725d42]">
        共同支出确认会创建一笔正式支出流水和等分记录；个人支出、忽略、待讨论只会保留导入复核历史，不会进入共同账本。
      </p>
    </div>
  );
}

type PersonalActionOption = {
  kind: "self" | "other";
  label: string;
  ownerUserId: string | null;
  helper: string;
};

function PersonalActionPanel({
  batch,
  item,
  options,
  state
}: {
  batch: ImportBatchSummary;
  item: ImportReviewItem;
  options: PersonalActionOption[];
  state: ImportReviewCardState;
}) {
  const canMarkPersonal = !item.ledgerEntryId && item.reviewStatus !== "imported";

  return (
    <div
      className="rounded-[24px] border-2 border-dashed border-[#82d5bb] bg-[#e9fbf4]/75 p-3 shadow-[0_5px_0_rgba(31,122,112,0.08)]"
      data-import-review-personal-actions="true"
    >
      <p className="flex items-center gap-2 text-sm font-black text-[#1f7a70]">
        <UserRound aria-hidden="true" size={17} />
        个人支出不会进入共同账本，但会保留在导入复核历史里
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {options.map((option) => (
          <form
            key={option.kind}
            action={markImportItemPersonalAction}
            data-import-review-personal-action={option.kind}
            data-import-review-personal-owner={option.ownerUserId ?? ""}
          >
            <PersonalActionHiddenInputs
              batch={batch}
              item={item}
              ownerUserId={option.ownerUserId}
              state={state}
            />
            <Button
              block
              disabled={!canMarkPersonal || !option.ownerUserId}
              htmlType="submit"
              icon={<UserRound aria-hidden="true" size={18} />}
              type="dashed"
            >
              {option.label}
            </Button>
            <p className="mt-1 px-2 text-[11px] font-bold leading-5 text-[#1f7a70]">
              {option.helper}
            </p>
          </form>
        ))}
      </div>
    </div>
  );
}

function ImportedLedgerStatusCard({ item }: { item: ImportReviewItem }) {
  const ledgerHref = item.ledgerEntryId ? getLedgerRecordHref(item.ledgerEntryId, item.monthKey) : null;

  return (
    <div
      data-import-review-imported-status="true"
      className="rounded-[28px] border-2 border-dashed border-[#82d5bb] bg-[#e9fbf4] p-4 shadow-[0_5px_0_rgba(31,122,112,0.12)]"
    >
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#1f7a70]">
        <BadgeCheck aria-hidden="true" size={17} />
        {importedLedgerCopy.eyebrow}
      </p>
      <div className="mt-3 rounded-[24px] bg-white/80 px-4 py-4 shadow-[inset_0_0_0_2px_rgba(130,213,187,0.55)]">
        <p className="flex items-center gap-2 text-lg font-black text-[#1f7a70]">
          <CheckCircle2 aria-hidden="true" size={21} />
          {importedLedgerCopy.title}
        </p>
        <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">
          {importedLedgerCopy.body}
        </p>
      </div>
      <div className="mt-4 grid gap-2">
        {ledgerHref ? (
          <Link
            href={ledgerHref}
            data-import-review-ledger-link="true"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
          >
            <ReceiptText aria-hidden="true" size={18} />
            {importedLedgerCopy.linkLabel}
          </Link>
        ) : (
          <span
            data-import-review-ledger-link-missing="true"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-white/80 px-5 py-2 text-sm font-black text-[#9f927d]"
          >
            <ReceiptText aria-hidden="true" size={18} />
            {importedLedgerCopy.linkMissing}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs font-bold leading-6 text-[#1f7a70]">
        {importedLedgerCopy.readonly}
      </p>
      <p
        data-import-review-imported-state-note="true"
        className="mt-2 rounded-[18px] bg-white/70 px-3 py-2 text-xs font-black leading-5 text-[#1f7a70] shadow-[inset_0_0_0_2px_rgba(130,213,187,0.42)]"
      >
        后续修改请从正式账单便签进入，这张导入小纸条这里只做来源回看。
      </p>
    </div>
  );
}

function ReviewedOutcomeStatusCard({
  batch,
  currentUserId,
  item,
  members,
  state
}: {
  batch: ImportBatchSummary;
  currentUserId: string;
  item: ImportReviewItem;
  members: DashboardHouseholdMember[];
  state: ImportReviewCardState;
}) {
  const isNeedDiscussion = item.reviewStatus === "need_discussion";
  const isPersonalSkipped = isPersonalSkippedItem(item);
  const ownerLabel = item.finalOwnerUserId
    ? getPersonalOwnerDisplayName(item.finalOwnerUserId, members, currentUserId)
    : null;
  const personalActionOptions = getPersonalActionOptions(members, currentUserId);
  const reopenCopy = isNeedDiscussion ? reviewedOutcomeReopenCopy.needDiscussion : reviewedOutcomeReopenCopy.skipped;

  return (
    <div
      data-import-review-reviewed-outcome={item.reviewStatus}
      className={`rounded-[28px] border-2 border-dashed p-4 shadow-[0_5px_0_rgba(121,79,39,0.08)] ${
        isNeedDiscussion
          ? "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]"
          : "border-[#d9c49b] bg-[#fffdf3] text-[#725d42]"
      }`}
    >
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
        {isNeedDiscussion ? (
          <HelpCircle aria-hidden="true" size={17} />
        ) : (
          <ReceiptText aria-hidden="true" size={17} />
        )}
        {isNeedDiscussion ? "待确认" : "已忽略"}
      </p>
      <div className="mt-3 rounded-[24px] bg-white/78 px-4 py-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.55)]">
        <p className="text-lg font-black text-[#794f27]">
          {isNeedDiscussion
            ? "先放进小岛讨论夹"
            : isPersonalSkipped
              ? "这笔已标记为个人支出，不进入共同账本"
              : "这条没有进入正式账本"}
        </p>
        <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">
          {isNeedDiscussion
            ? "待确认只记录这张来源小纸条，不会创建正式账本流水；可以之后再回来一起确认。"
            : isPersonalSkipped
              ? "个人支出不会进入共同账本，但会保留在导入复核历史里。"
              : "已忽略只保留导入历史，不会创建正式账本流水，也不会影响月报或结算。"}
        </p>
        {isPersonalSkipped ? (
          <p
            className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-dashed border-[#82d5bb] bg-[#e9fbf4] px-3 py-1 text-xs font-black text-[#1f7a70]"
            data-import-review-personal-state="true"
            data-import-review-personal-owner={item.finalOwnerUserId ?? ""}
          >
            <UserRound aria-hidden="true" size={15} />
            归属：{ownerLabel ?? "小岛成员"}
          </p>
        ) : null}
      </div>
      <div className="mt-4">
        <PersonalActionPanel
          batch={batch}
          item={item}
          options={personalActionOptions}
          state={state}
        />
      </div>
      <form
        action={reopenImportItemToPendingAction}
        className="mt-4"
        data-import-review-reopen-action={item.reviewStatus}
      >
        <ReopenActionHiddenInputs batch={batch} item={item} state={state} />
        <Button
          block
          htmlType="submit"
          icon={<RotateCcw aria-hidden="true" size={18} />}
          type="primary"
        >
          {reopenCopy.buttonLabel}
        </Button>
      </form>
      <p className="mt-3 text-xs font-bold leading-6">{reopenCopy.note}</p>
    </div>
  );
}

function ReopenActionHiddenInputs({
  batch,
  item,
  state
}: {
  batch: ImportBatchSummary;
  item: ImportReviewItem;
  state: ImportReviewCardState;
}) {
  return (
    <>
      <input name="batch_id" type="hidden" value={batch.id} />
      <input name="item_id" type="hidden" value={item.id} />
      <input name="return_status" type="hidden" value={state.statusFilter} />
      <input name="return_item" type="hidden" value={item.id} />
      <input name="return_index" type="hidden" value={String(state.selectedIndex + 1)} />
    </>
  );
}

function ConfirmActionHiddenInputs({
  batch,
  item,
  state
}: {
  batch: ImportBatchSummary;
  item: ImportReviewItem;
  state: ImportReviewCardState;
}) {
  return (
    <>
      <input name="batch_id" type="hidden" value={batch.id} />
      <input name="item_id" type="hidden" value={item.id} />
      <input name="return_status" type="hidden" value={state.statusFilter} />
      <input name="return_item" type="hidden" value={item.id} />
      <input name="return_index" type="hidden" value={String(state.selectedIndex + 1)} />
    </>
  );
}

function PersonalActionHiddenInputs({
  batch,
  item,
  ownerUserId,
  state
}: {
  batch: ImportBatchSummary;
  item: ImportReviewItem;
  ownerUserId: string | null;
  state: ImportReviewCardState;
}) {
  return (
    <>
      <input name="batch_id" type="hidden" value={batch.id} />
      <input name="item_id" type="hidden" value={item.id} />
      <input name="owner_user_id" type="hidden" value={ownerUserId ?? ""} />
      <input name="note" type="hidden" value="个人支出，不进入共同账本" />
      <input name="return_status" type="hidden" value={state.statusFilter} />
      <input name="return_item" type="hidden" value={item.id} />
      <input name="return_index" type="hidden" value={String(state.selectedIndex + 1)} />
    </>
  );
}

function ConfirmFormField({
  id,
  label,
  icon,
  optional,
  children
}: {
  id: string;
  label: string;
  icon?: ReactNode;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-[#794f27]" htmlFor={id}>
      <span className="flex items-center gap-2">
        {icon ? <span className="text-[#9f927d]">{icon}</span> : null}
        {label}
        {optional ? <span className="text-xs text-[#9f927d]">可选</span> : null}
      </span>
      {children}
    </label>
  );
}

function ConfirmNotice({
  notice
}: {
  notice: {
    tone: "warning" | "error";
    message: string;
  };
}) {
  const classes =
    notice.tone === "error"
      ? "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]"
      : "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]";

  return (
    <div
      className={`mt-4 flex items-start gap-3 rounded-[22px] border-2 border-dashed px-4 py-3 text-xs font-black leading-6 ${classes}`}
      role={notice.tone === "error" ? "alert" : "status"}
    >
      <AlertCircle aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
      <span>{notice.message}</span>
    </div>
  );
}

function ReviewStatusActionHiddenInputs({
  batch,
  item,
  reviewStatus,
  state
}: {
  batch: ImportBatchSummary;
  item: ImportReviewItem;
  reviewStatus: "skipped" | "need_discussion";
  state: ImportReviewCardState;
}) {
  return (
    <>
      <input name="batch_id" type="hidden" value={batch.id} />
      <input name="item_id" type="hidden" value={item.id} />
      <input name="review_status" type="hidden" value={reviewStatus} />
      <input name="return_status" type="hidden" value={state.statusFilter} />
      <input name="return_item" type="hidden" value={item.id} />
      <input name="return_index" type="hidden" value={String(state.selectedIndex + 1)} />
    </>
  );
}

function EmptyReviewState({
  batch,
  state
}: {
  batch: ImportBatchSummary;
  state: ImportReviewCardState;
}) {
  const isPendingEmpty = state.statusFilter === "pending";
  const isSuggestionEmpty = state.suggestionFilter !== "all";
  const isDirectionEmpty = state.directionFilter !== "all";
  const isFilteredEmpty = isSuggestionEmpty || isDirectionEmpty;

  return (
    <div className="grid gap-5">
      <NotebookEmptyState
        action={{
          href: isFilteredEmpty
            ? getReviewHref(batch.id, "pending", "all", "all", null)
            : getReviewHref(batch.id, "all", "all", "all", null),
          label: isFilteredEmpty ? "全部待对账" : "查看全部条目",
          icon: <ReceiptText aria-hidden="true" size={18} />
        }}
        secondaryAction={{
          href: isFilteredEmpty ? getReviewHref(batch.id, "all", "all", "all", null) : "/imports",
          label: isFilteredEmpty ? "全部流水" : "回到待对账池",
          icon: <ArrowLeft aria-hidden="true" size={18} />
        }}
        dataAttributes={{
          "data-import-review-empty-state": state.statusFilter,
          "data-import-review-empty-suggestion": state.suggestionFilter,
          "data-import-review-empty-direction": state.directionFilter
        }}
        description={
          isFilteredEmpty ? (
            <>
              <p>这个筛选队列暂时没有流水。</p>
              <p className="mt-2">可以切回全部待对账继续看，也可以回到全部流水检查其它小纸条。</p>
            </>
          ) : isPendingEmpty ? (
            <>
              <p>这个筛选下没有待处理流水了。</p>
              <p className="mt-2">待讨论的小纸条还可以之后再回来一起确认，不算永远完成。</p>
            </>
          ) : (
            <p>这个筛选下暂时没有小纸条。换个状态看看，也许它们躲在别的夹层里。</p>
          )
        }
        eyebrow={isFilteredEmpty ? "Filtered Queue" : "Quiet Stack"}
        iconName="icon-map"
        title={
          isFilteredEmpty
            ? "这个筛选队列暂时没有流水"
            : isPendingEmpty
              ? "这个筛选下没有待处理流水了"
              : "这里暂时没有对账卡片"
        }
        tone="yellow"
      />
      {isFilteredEmpty ? (
        <FilteredEmptyLinks batchId={batch.id} />
      ) : isPendingEmpty ? (
        <PendingEmptyLinks batchId={batch.id} />
      ) : null}
    </div>
  );
}

function FilteredEmptyLinks({ batchId }: { batchId: string }) {
  const links = [
    { href: getReviewHref(batchId, "pending", "all", "all", null), label: "全部待对账", icon: <ReceiptText aria-hidden="true" size={16} /> },
    { href: getReviewHref(batchId, "all", "all", "all", null), label: "全部流水", icon: <ReceiptText aria-hidden="true" size={16} /> },
    { href: "/imports", label: "导入列表", icon: <ArrowLeft aria-hidden="true" size={16} /> }
  ];

  return (
    <div
      data-import-review-filter-empty-links="true"
      className="flex flex-wrap gap-2 rounded-[28px] border-2 border-dashed border-[#82d5bb] bg-[#e9fbf4] p-3 shadow-[0_5px_0_rgba(31,122,112,0.1)]"
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#9fd8ca] bg-white px-4 py-2 text-xs font-black text-[#1f7a70] shadow-[0_4px_0_rgba(31,122,112,0.1)] transition hover:-translate-y-0.5 hover:bg-[#fffdf3] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          {link.icon}
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function PendingEmptyLinks({ batchId }: { batchId: string }) {
  const links = [
    { href: getReviewHref(batchId, "all", "all", "all", null), label: "全部流水", icon: <ReceiptText aria-hidden="true" size={16} /> },
    {
      href: getReviewHref(batchId, "need_discussion", "all", "all", null),
      label: "待讨论",
      icon: <HelpCircle aria-hidden="true" size={16} />
    },
    { href: getReviewHref(batchId, "imported", "all", "all", null), label: "已入账", icon: <BadgeCheck aria-hidden="true" size={16} /> },
    { href: getReviewHref(batchId, "skipped", "all", "all", null), label: "已忽略", icon: <ReceiptText aria-hidden="true" size={16} /> }
  ];

  return (
    <div
      data-import-review-pending-empty-links="true"
      className="flex flex-wrap gap-2 rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-3 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-xs font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 hover:bg-[#e9fbf4] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          {link.icon}
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function BatchUnavailableState({ reason }: { reason: "not_found" | "read_failed" }) {
  return (
    <NotebookEmptyState
      action={{
        href: "/imports",
        label: "回到待对账池",
        icon: <ArrowLeft aria-hidden="true" size={18} />
      }}
      secondaryAction={{
        href: "/imports/new",
        label: "导入新账单",
        icon: <FileUp aria-hidden="true" size={18} />
      }}
      dataAttributes={{ "data-import-review-unavailable": reason }}
      description={
        reason === "read_failed"
          ? "这份待对账账单暂时没有读出来，先回到待对账池再试一次。"
          : "没有找到这份待对账账单，或者它不属于当前共同小岛。"
      }
      eyebrow="Missing Memo"
      iconName="icon-map"
      title="这张对账便签不在这里"
      tone="yellow"
    />
  );
}

function ReviewActionNotice({
  error,
  result
}: {
  error: string | null;
  result: string | null;
}) {
  const notice = getReviewActionNotice(result, error);

  if (!notice) {
    return null;
  }

  return (
    <div
      data-import-review-result={notice.kind}
      className={`flex items-start gap-3 rounded-[24px] border-2 border-dashed px-4 py-3 text-sm font-black leading-6 ${
        notice.kind === "error"
          ? "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]"
          : "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]"
      }`}
    >
      {notice.kind === "error" ? (
        <HelpCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      ) : (
        <BadgeCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      )}
      <span>{notice.message}</span>
    </div>
  );
}

function ReadonlyPromise() {
  return (
    <div className="flex items-start gap-3 rounded-[24px] border-2 border-dashed border-[#82d5bb] bg-[#e9fbf4] px-4 py-3 text-sm font-black leading-6 text-[#1f7a70]">
      <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <span>本页只开放单条共同支出确认、个人支出来源标记、忽略和待讨论。个人支出不会写入正式账本；确认入账不会改动结算快照，也不会开放自定义分摊或批量确认。</span>
    </div>
  );
}

function PageNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[24px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-3 text-sm font-black leading-6 text-[#8a6420]">
      <Icon name="icon-chat" size={18} bounce />
      <span>{message}</span>
    </div>
  );
}

function getReviewActionNotice(result: string | null, error: string | null) {
  if (result === "skipped") {
    return {
      kind: "success" as const,
      message: "已忽略此条，正式账本没有新增流水。"
    };
  }

  if (result === "personal_skipped") {
    return {
      kind: "success" as const,
      message: "已标记为个人支出，不会进入共同账本，但会留在导入复核历史里。"
    };
  }

  if (result === "need_discussion") {
    return {
      kind: "success" as const,
      message: "已标记待确认，先放进小岛讨论夹里。"
    };
  }

  if (result === "imported") {
    return {
      kind: "success" as const,
      message: "已确认共同支出并写入正式账本，带你继续看下一张待对账卡片。"
    };
  }

  if (result === "reopened") {
    return {
      kind: "success" as const,
      message: "已放回待对账，这张小纸条又回到 pending 队列啦。"
    };
  }

  if (result === "already_pending") {
    return {
      kind: "success" as const,
      message: "这张小纸条已经在待对账队列里，不需要重复放回。"
    };
  }

  if (result === "already_imported") {
    return {
      kind: "error" as const,
      message: "这张已经写入正式账本，不能用轻量重开把它放回待对账。"
    };
  }

  if (result === "not_found") {
    return {
      kind: "error" as const,
      message: "没有找到这张对账小纸条，可能已经不在当前批次里。"
    };
  }

  if (result === "invalid_owner") {
    return {
      kind: "error" as const,
      message: "没有确认这位个人归属属于当前共同小岛，先刷新后再试一次。"
    };
  }

  if (result === "error") {
    return {
      kind: "error" as const,
      message: getReviewActionErrorMessage(error)
    };
  }

  return null;
}

function getReviewActionErrorMessage(error: string | null) {
  if (error === "already_imported") {
    return "这条已经入账，不能再改成忽略或待确认。";
  }

  if (error === "already_reviewed") {
    return "这条已经处理过了，不能再重复确认入账。";
  }

  if (error === "blocked_pending_replacement") {
    return "这个月份正在等待替换结算确认，先处理结算便签，再回来确认入账。";
  }

  if (error === "unsupported_direction") {
    return "V1 只支持把支出确认成共同支出，收入、转账和退款先放到待讨论。";
  }

  if (error === "invalid_confirm_input") {
    return "分类、经手人或分摊方式不完整，重新选一下再确认。";
  }

  if (error === "invalid_status") {
    return "这个操作暂时不能用于当前小纸条。";
  }

  if (error === "not_found") {
    return "没有找到这条待对账流水，可能已经不在当前批次里。";
  }

  return "操作失败，请稍后再试一次。";
}

function ProgressCard({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[24px] bg-white px-4 py-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-[#794f27]">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ImportReviewItem["reviewStatus"] }) {
  const className =
    status === "pending"
      ? "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]"
      : status === "imported"
        ? "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]"
        : status === "skipped"
          ? "border-[#d9c49b] bg-white text-[#725d42]"
          : "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border-2 border-dashed px-3 py-1 text-xs font-black ${className}`}>
      <BadgeCheck aria-hidden="true" size={15} />
      {reviewStatusLabels[status]}
    </span>
  );
}

function DetailSticker({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-white/85 px-4 py-3 shadow-[0_5px_0_rgba(121,79,39,0.08)]">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">
        {icon}
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-black leading-6 text-[#794f27]">{value}</p>
    </div>
  );
}

function SuggestionLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] bg-white/80 px-3 py-2 text-sm font-black text-[#794f27] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.45)]">
      <span className="text-[#8a7556]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function getReviewHref(
  batchId: string,
  statusFilter: ImportReviewStatusFilter,
  suggestionFilter: ImportReviewSuggestionFilter,
  directionFilter: ImportReviewDirectionFilter,
  itemId: string | null
) {
  const params = new URLSearchParams();
  params.set("status", statusFilter);

  if (suggestionFilter !== "all") {
    params.set("suggestion", suggestionFilter);
  }

  if (directionFilter !== "all") {
    params.set("direction", directionFilter);
  }

  if (itemId) {
    params.set("item", itemId);
  }

  return `/imports/${batchId}/review?${params.toString()}`;
}

function getBatchProgress(batch: ImportBatchSummary) {
  const reviewedPercent =
    batch.parsedCount > 0 ? Math.min(100, Math.round((batch.reviewedCount / batch.parsedCount) * 100)) : 0;

  return {
    isComplete: batch.parsedCount > 0 && batch.pendingCount === 0,
    reviewedPercent
  };
}

function getBatchMonthKey(batch: ImportBatchSummary) {
  const monthSource = batch.periodEnd ?? batch.periodStart;

  if (!monthSource) {
    return null;
  }

  const match = monthSource.match(/^(\d{4}-\d{2})(?:-\d{2})?$/);

  return match?.[1] ?? null;
}

function getLedgerRecordHref(ledgerEntryId: string, monthKey: string) {
  const params = new URLSearchParams();
  const safeMonth = /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : null;

  if (safeMonth) {
    params.set("month", safeMonth);
  }

  const query = params.toString();

  return query ? `/records/${ledgerEntryId}?${query}` : `/records/${ledgerEntryId}`;
}

function getDirectionLabel(direction: ImportReviewItem["direction"]) {
  if (direction === "income") {
    return "收入";
  }

  if (direction === "transfer") {
    return "转账 / 不计入";
  }

  if (direction === "refund") {
    return "退款";
  }

  if (direction === "unknown") {
    return "待确认";
  }

  return "支出";
}

function getSuggestedQuickApplyAction(
  item: ImportReviewItem,
  canQuickApplyStatus: boolean,
  suggestedReviewAction: ImportReviewItem["suggestedReviewAction"]
) {
  if (
    !canQuickApplyStatus ||
    item.reviewStatus !== "pending" ||
    item.ledgerEntryId ||
    (suggestedReviewAction !== "skip" && suggestedReviewAction !== "need_discussion")
  ) {
    return null;
  }

  if (suggestedReviewAction === "skip") {
    return {
      reviewStatus: "skipped" as const,
      formId: shortcutTargetIds.skipForm,
      headline: "系统建议：这笔可能不进入共同账本",
      examples: "常见例子：转账 / 提现 / 充值 / 理财 / 交易关闭。",
      buttonLabel: "按建议忽略并下一条"
    };
  }

  return {
    reviewStatus: "need_discussion" as const,
    formId: shortcutTargetIds.needDiscussionForm,
    headline: "系统建议：这笔需要一起确认",
    examples: "常见例子：退款 / 状态不明确 / 看不出用途。",
    buttonLabel: "按建议标记待确认"
  };
}

function getSuggestedReviewActionLabel(action: NonNullable<ImportReviewItem["suggestedReviewAction"]>) {
  if (action === "skip") {
    return "建议忽略";
  }

  if (action === "need_discussion") {
    return "建议待讨论";
  }

  return "建议人工确认";
}

function getConfirmBlockReason({
  categories,
  item,
  members,
  settlementStatus
}: {
  categories: DashboardCategory[];
  item: ImportReviewItem;
  members: DashboardHouseholdMember[];
  settlementStatus: GetSettlementSnapshotStatusResult | null;
}) {
  if (item.reviewStatus !== "pending" || item.ledgerEntryId) {
    return "这条已经离开待确认状态，不能再确认成新的正式流水。";
  }

  if (item.direction !== "expense") {
    return "V1 只支持把支出确认成共同支出；收入、转账和退款先标记待讨论。";
  }

  if (item.amountCents <= 0) {
    return "金额不是有效支出，先标记待讨论再人工确认。";
  }

  if (categories.length === 0) {
    return "还没有读取到小岛分类，暂时不能把它写入正式账本。";
  }

  if (members.length === 0) {
    return "还没有读取到小岛成员，暂时不能生成等分记录。";
  }

  if (settlementStatus?.pendingReplacement) {
    return "这个月份有一张待替换的结算便签，先完成结算确认后再新增正式流水。";
  }

  return null;
}

function getImportSettlementNotice(status: GetSettlementSnapshotStatusResult | null) {
  if (!status) {
    return null;
  }

  if (status.pendingReplacement) {
    return {
      tone: "error" as const,
      message: `${status.month.monthLabel} 正在等待替换结算确认，本页会拦住确认入账，避免新的流水和结算便签交叉。`
    };
  }

  if (status.status === "error") {
    return {
      tone: "warning" as const,
      message: "结算状态暂时没有读完整；提交时后端仍会检查是否存在待替换结算。"
    };
  }

  if (status.status !== "no_snapshot") {
    return {
      tone: "warning" as const,
      message: `${status.month.monthLabel} 已有结算便签。确认入账只会更新正式账本，不会改写已保存的结算快照。`
    };
  }

  return null;
}

function getDefaultCategoryId(categories: DashboardCategory[], item: ImportReviewItem) {
  const hints = [item.suggestedCategory, item.sourceCategory, item.description, item.counterparty]
    .map(normalizeMatchText)
    .filter(Boolean);

  const matched = categories.find((category) => {
    const categoryName = normalizeMatchText(category.name);

    return hints.some((hint) => categoryName.includes(hint) || hint.includes(categoryName));
  });

  return matched?.id ?? categories[0]?.id ?? null;
}

function getDefaultPaidBy(members: DashboardHouseholdMember[], currentUserId: string) {
  return members.some((member) => member.userId === currentUserId)
    ? currentUserId
    : members[0]?.userId ?? null;
}

function getPersonalActionOptions(
  members: DashboardHouseholdMember[],
  currentUserId: string
): PersonalActionOption[] {
  const currentMember =
    members.find((member) => member.userId === currentUserId) ??
    members.find((member) => member.isCurrentUser);
  const currentOwnerUserId = currentMember?.userId ?? currentUserId;
  const otherMember = members.find((member) => member.userId !== currentOwnerUserId) ?? null;

  return [
    {
      kind: "self",
      label: "我的个人",
      ownerUserId: currentOwnerUserId,
      helper: "标记给你，只留下来源线索"
    },
    {
      kind: "other",
      label: otherMember ? "她的个人" : "对方个人",
      ownerUserId: otherMember?.userId ?? null,
      helper: otherMember
        ? `标记给${formatPersonalMemberLabel(otherMember, members, currentUserId)}，不写入共同账本`
        : "还没有读到对方成员，暂时不能提交"
    }
  ];
}

function isPersonalSkippedItem(item: ImportReviewItem) {
  return (
    item.reviewStatus === "skipped" &&
    item.finalSplitType === "personal" &&
    Boolean(item.finalOwnerUserId)
  );
}

function getPersonalOwnerDisplayName(
  ownerUserId: string,
  members: DashboardHouseholdMember[],
  currentUserId: string
) {
  const member = members.find((candidate) => candidate.userId === ownerUserId);

  if (!member) {
    return ownerUserId === currentUserId ? "你" : null;
  }

  return formatPersonalMemberLabel(member, members, currentUserId);
}

function formatPersonalMemberLabel(
  member: DashboardHouseholdMember,
  members: DashboardHouseholdMember[],
  currentUserId: string
) {
  if (member.userId === currentUserId || member.isCurrentUser) {
    return "你";
  }

  if (member.role === "owner") {
    return "岛主";
  }

  if (member.role === "partner") {
    return "伙伴";
  }

  const index = members.findIndex((candidate) => candidate.userId === member.userId);

  return index >= 0 ? `成员 ${index + 1}` : "小岛成员";
}

function getDefaultConfirmNote(item: ImportReviewItem) {
  const parts = [item.description, item.counterparty].filter(
    (part, index, allParts): part is string => Boolean(part) && allParts.indexOf(part) === index
  );

  return (parts.join(" · ") || "导入账单确认").slice(0, 80);
}

function formatCategoryOption(category: DashboardCategory) {
  return `${category.icon ? `${category.icon} ` : ""}${category.name}`;
}

function formatMemberOption(member: DashboardHouseholdMember, index: number) {
  const name = member.isCurrentUser ? "你" : `成员 ${index + 1}`;
  const role = member.role === "owner" ? "岛主" : "伙伴";

  return `${role} · ${name}`;
}

function normalizeMatchText(value: string | null) {
  return value?.replace(/\s+/g, "").toLowerCase() ?? "";
}

function maskSourceTransactionId(value: string | null) {
  if (!value) {
    return "未提供";
  }

  if (value.length <= 8) {
    return "已打码";
  }

  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function formatCents(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}

function formatImportPeriod(batch: ImportBatchSummary) {
  if (!batch.periodStart && !batch.periodEnd) {
    return "账单时间待识别";
  }

  if (batch.periodStart === batch.periodEnd) {
    return batch.periodStart ?? batch.periodEnd;
  }

  return `${batch.periodStart ?? "?"} 至 ${batch.periodEnd ?? "?"}`;
}

function formatImportItemTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

const importedLedgerCopy = {
  eyebrow: "\u5df2\u5165\u8d26",
  title: "\u5df2\u5165\u8d26",
  body:
    "\u8fd9\u6761\u5bf9\u8d26\u5c0f\u7eb8\u6761\u5df2\u7ecf\u5199\u5165\u6b63\u5f0f\u8d26\u672c\uff0c\u8fd9\u91cc\u53ea\u4fdd\u7559\u6765\u6e90\u7ebf\u7d22\uff0c\u4e0d\u518d\u63d0\u4f9b\u786e\u8ba4\u3001\u5ffd\u7565\u6216\u5f85\u8ba8\u8bba\u64cd\u4f5c\u3002",
  linkLabel: "\u67e5\u770b\u8d26\u5355\u4fbf\u7b7e",
  linkMissing: "\u8d26\u5355\u4fbf\u7b7e\u94fe\u63a5\u6682\u4e0d\u53ef\u7528",
  readonly:
    "\u53ea\u8bfb\u67e5\u770b\uff1a\u4e0d\u4f1a\u6539\u52a8\u5bfc\u5165\u72b6\u6001\uff0c\u4e0d\u4f1a\u5199\u5165\u65b0\u8d26\u5355\u3002"
} as const;

const reviewedOutcomeReopenCopy = {
  skipped: {
    buttonLabel: "\u91cd\u65b0\u653e\u56de\u5f85\u5bf9\u8d26",
    note: "\u53ea\u4f1a\u628a\u8fd9\u5f20\u6765\u6e90\u5c0f\u7eb8\u6761\u91cd\u65b0\u653e\u56de\u5f85\u5bf9\u8d26\uff0c\u4e0d\u4f1a\u521b\u5efa\u6216\u5220\u9664\u6b63\u5f0f\u8d26\u672c\u6d41\u6c34\u3002"
  },
  needDiscussion: {
    buttonLabel: "\u653e\u56de\u5f85\u5bf9\u8d26",
    note: "\u5148\u628a\u5b83\u653e\u56de\u5f85\u5bf9\u8d26\u961f\u5217\uff0c\u4e4b\u540e\u53ef\u4ee5\u91cd\u65b0\u786e\u8ba4\u3001\u5ffd\u7565\u6216\u7ee7\u7eed\u6807\u8bb0\u5f85\u786e\u8ba4\u3002"
  }
} as const;

const inputClassName =
  "h-12 w-full rounded-full border-2 border-[#d9c49b] bg-[#fffdf3] px-4 text-sm font-black text-[#794f27] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.5),0_5px_0_rgba(121,79,39,0.08)] outline-none transition placeholder:text-[#9f927d]/70 focus:border-[#19c8b9] focus:ring-4 focus:ring-[#19c8b9]/25";

const radioCardClassName =
  "grid cursor-pointer grid-cols-[auto_1fr] gap-3 rounded-[22px] bg-white/78 px-4 py-3 shadow-[0_4px_0_rgba(121,79,39,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(121,79,39,0.08)]";
