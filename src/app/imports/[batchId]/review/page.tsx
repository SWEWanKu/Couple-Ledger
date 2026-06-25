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
  listImportItemsForReview,
  normalizeImportReviewStatusFilter,
  type ImportReviewCardState,
  type ImportReviewItem,
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
import { confirmImportItemToLedgerAction, updateImportItemReviewStatusAction } from "./actions";

type ImportReviewPageProps = {
  params: Promise<{
    batchId: string;
  }>;
  searchParams?: Promise<{
    notice?: string | string[];
    status?: string | string[];
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

export default async function ImportReviewPage({ params, searchParams }: ImportReviewPageProps) {
  const { batchId } = await params;
  const query = searchParams ? await searchParams : {};
  const statusFilter = normalizeImportReviewStatusFilter(query.status);
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
    statusFilter
  });
  const cardState = getImportReviewCardState({
    batch: result.batch,
    items: itemsResult.items,
    statusFilter,
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
  if (!state.selectedItem) {
    return <EmptyReviewState batch={batch} state={state} />;
  }

  return (
    <div className="grid gap-6">
      <ReviewBatchHeader batch={batch} state={state} />
      <StatusFilterTabs batchId={batch.id} state={state} />
      <ImportItemCard
        batch={batch}
        currentUserId={currentUserId}
        householdSummary={householdSummary}
        item={state.selectedItem}
        settlementStatus={settlementStatus}
        state={state}
      />
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
            这页展示外部账单解析出来的待对账条目。V1 只开放“共同支出 + 两人平分”的确认入账，其余个人、自定义分摊仍先留在未来版本。
          </p>
          <Divider type="wave-yellow" className="my-6" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ProgressCard icon={<ReceiptText aria-hidden="true" size={20} />} label="已解析" value={batch.parsedCount} />
            <ProgressCard icon={<Hourglass aria-hidden="true" size={20} />} label="待确认" value={batch.pendingCount} />
            <ProgressCard icon={<ShieldCheck aria-hidden="true" size={20} />} label="已处理" value={batch.reviewedCount} />
            <ProgressCard icon={<Icon name="icon-map" size={20} bounce />} label="筛选内" value={state.totalItems} />
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
            <p className="mt-2 text-3xl font-black text-[#794f27]">
              第 {selectedPosition} / {state.totalItems} 条
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-white/75 p-4 sm:grid-cols-4">
        <ProgressPill label="已入账" value={state.counts.imported} />
        <ProgressPill label="已忽略" value={state.counts.skipped} />
        <ProgressPill label="待讨论" value={state.counts.need_discussion} />
        <ProgressPill label="全部条目" value={state.counts.all} />
      </div>
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
            href={getReviewHref(batchId, filter, null)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-xs font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 hover:bg-[#e9fbf4] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
          >
            {content}
          </Link>
        );
      })}
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
        </section>

        <aside className="grid gap-4 content-start">
          <CardNavigator batchId={batch.id} state={state} />
          <SuggestionPanel item={item} />
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
            state.previousItem ? getReviewHref(batchId, state.statusFilter, state.previousItem.id) : null
          }
          item={state.previousItem}
        />
        <PagerSlot
          direction="next"
          href={state.nextItem ? getReviewHref(batchId, state.statusFilter, state.nextItem.id) : null}
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

function SuggestionPanel({ item }: { item: ImportReviewItem }) {
  return (
    <div
      data-import-review-suggestion="true"
      className="rounded-[28px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] p-4 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
    >
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a6420]">
        <Sparkles aria-hidden="true" size={17} />
        系统建议
      </p>
      <div className="mt-3 grid gap-2">
        <SuggestionLine label="建议分类" value={item.suggestedCategory ?? "暂无分类建议"} />
        <SuggestionLine
          label="建议动作"
          value={item.suggestedReviewAction ? getSuggestedReviewActionLabel(item.suggestedReviewAction) : "暂无明确动作"}
        />
      </div>
      <p className="mt-3 rounded-[20px] bg-white/75 px-3 py-2 text-xs font-bold leading-6 text-[#8a6420]">
        这些只是辅助判断的小便签，不会自动入账；最后仍需要你们确认。
      </p>
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
  const canUpdateStatus = item.reviewStatus !== "imported" && !item.ledgerEntryId;
  const confirmBlockReason = getConfirmBlockReason({ categories, item, members, settlementStatus });
  const canConfirmCommonExpense = !confirmBlockReason;
  const defaultCategoryId = getDefaultCategoryId(categories, item);
  const defaultPaidBy = getDefaultPaidBy(members, currentUserId);
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
          data-import-review-confirm-common="true"
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

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <Button type="dashed" htmlType="button" disabled block>
          我的个人
        </Button>
        <Button type="dashed" htmlType="button" disabled block>
          她的个人
        </Button>
        <form action={updateImportItemReviewStatusAction} data-import-review-status-action="skipped">
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
        <form action={updateImportItemReviewStatusAction} data-import-review-status-action="need_discussion">
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
        共同支出确认会创建一笔正式支出流水和等分记录；忽略、待讨论只改待对账状态。个人账、自定义分摊和批量确认仍不开放。
      </p>
    </div>
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
  return (
    <div className="grid gap-5">
      <StatusFilterTabs batchId={batch.id} state={state} />
      <NotebookEmptyState
        action={{
          href: getReviewHref(batch.id, "all", null),
          label: "查看全部条目",
          icon: <ReceiptText aria-hidden="true" size={18} />
        }}
        secondaryAction={{
          href: "/imports",
          label: "回到待对账池",
          icon: <ArrowLeft aria-hidden="true" size={18} />
        }}
        dataAttributes={{ "data-import-review-empty-state": state.statusFilter }}
        description={
          state.statusFilter === "pending" ? (
            <p>这个筛选下没有待处理流水了，可以切换到全部、待确认或已忽略查看。</p>
          ) : (
            <p>这个筛选下暂时没有小纸条。换个状态看看，也许它们躲在别的夹层里。</p>
          )
        }
        eyebrow="Quiet Stack"
        iconName="icon-map"
        title="这里暂时没有对账卡片"
        tone="yellow"
      />
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
      <span>本页只开放单条共同支出确认、忽略和待讨论。确认入账不会改动结算快照，不会开放个人账、自定义分摊或批量确认。</span>
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
  value: number;
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

function ProgressPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center justify-between gap-3 rounded-[20px] bg-[#fffdf3] px-3 py-2 text-xs font-black text-[#794f27] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.5)]">
      <span>{label}</span>
      <span>{value}</span>
    </span>
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
  itemId: string | null
) {
  const params = new URLSearchParams();
  params.set("status", statusFilter);

  if (itemId) {
    params.set("item", itemId);
  }

  return `/imports/${batchId}/review?${params.toString()}`;
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

const inputClassName =
  "h-12 w-full rounded-full border-2 border-[#d9c49b] bg-[#fffdf3] px-4 text-sm font-black text-[#794f27] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.5),0_5px_0_rgba(121,79,39,0.08)] outline-none transition placeholder:text-[#9f927d]/70 focus:border-[#19c8b9] focus:ring-4 focus:ring-[#19c8b9]/25";

const radioCardClassName =
  "grid cursor-pointer grid-cols-[auto_1fr] gap-3 rounded-[22px] bg-white/78 px-4 py-3 shadow-[0_4px_0_rgba(121,79,39,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(121,79,39,0.08)]";
