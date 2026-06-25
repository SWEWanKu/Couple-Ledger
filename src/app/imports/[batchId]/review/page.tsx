import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileUp,
  HelpCircle,
  Hourglass,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Tags,
  WalletCards
} from "lucide-react";
import { Button, Card, Divider, Icon, Title } from "animal-island-ui";
import { AppShell } from "@/components/layout/AppShell";
import { NotebookEmptyState } from "@/components/NotebookEmptyState";
import { PrivateIslandTrail, islandTrailLabels } from "@/components/PrivateIslandTrail";
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
import { createClient } from "@/lib/supabase/server";
import { updateImportItemReviewStatusAction } from "./actions";

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
  const { supabase, membership } = await requireImportsAccess();
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

  return (
    <ImportReviewShell>
      {getSingleParam(query.notice) === "duplicate" ? (
        <PageNotice message="这份文件之前已经放进待对账池了，这里直接带你回到已有批次，没有创建第二份。" />
      ) : null}
      {result.warning ? <PageNotice message={result.warning} /> : null}
      {itemsResult.warning ? <PageNotice message={itemsResult.warning} /> : null}
      {cardState.warning ? <PageNotice message={cardState.warning} /> : null}
      <ReviewActionNotice
        error={getSingleParam(query.import_review_error)}
        result={getSingleParam(query.import_review_result)}
      />
      <ReviewCardPage batch={result.batch} state={cardState} />
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
    <AppShell title="对账卡片页" subtitle="一条一条看待对账流水，先预览，不写入正式账本">
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
  state
}: {
  batch: ImportBatchSummary;
  state: ImportReviewCardState;
}) {
  if (!state.selectedItem) {
    return <EmptyReviewState batch={batch} state={state} />;
  }

  return (
    <div className="grid gap-6">
      <ReviewBatchHeader batch={batch} state={state} />
      <StatusFilterTabs batchId={batch.id} state={state} />
      <ImportItemCard batch={batch} state={state} item={state.selectedItem} />
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
            这页只展示外部账单解析出来的待对账条目。下面的按钮都是未来确认流程的占位，不会提交、不会入账、不会改变正式账本。
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
  state,
  item
}: {
  batch: ImportBatchSummary;
  state: ImportReviewCardState;
  item: ImportReviewItem;
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
          <ReviewDecisionControls batch={batch} item={item} state={state} />
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
  item,
  state
}: {
  batch: ImportBatchSummary;
  item: ImportReviewItem;
  state: ImportReviewCardState;
}) {
  const canUpdateStatus = item.reviewStatus !== "imported" && !item.ledgerEntryId;

  return (
    <div
      data-import-review-disabled-controls="true"
      className="rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-4 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
    >
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
        <LockKeyhole aria-hidden="true" size={17} />
        这条怎么处理
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <Button type="dashed" htmlType="button" disabled block>
          共同支出
        </Button>
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
        <Button type="primary" htmlType="button" disabled block>
          确认入账并下一条
        </Button>
      </div>
      <p className="mt-3 text-xs font-bold leading-6 text-[#725d42]">
        忽略和待确认会记录到待对账清单，不会创建正式流水。共同支出、个人支出和确认入账仍然留给下一步开放。
      </p>
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
      <span>本页现在只开放“忽略”和“待确认”两个轻量状态动作，不会创建正式流水，也不会改动结算或上传解析逻辑。</span>
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
