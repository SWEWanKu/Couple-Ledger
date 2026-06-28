import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, FileUp } from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { NotebookEmptyState } from "@/components/NotebookEmptyState";
import {
  getImportBatchStatusLabel,
  getImportBatchContinueHref,
  getImportBatchReviewedPercent,
  getImportReviewHouseholdMembership,
  getImportSourceLabel,
  isImportBatchUnfinished,
  listImportBatches,
  type ImportBatchSummary,
  type ImportReviewContinueSummary
} from "@/lib/import-review/batches";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "待对账账单 | 小岛账本"
};

type ImportsPageProps = {
  searchParams?: Promise<{
    page?: string | string[];
  }>;
};

const importBatchPageSize = 3;

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const params = searchParams ? await searchParams : {};
  const { supabase, membership } = await requireImportsAccess();
  const { batches, warning } = await listImportBatches(supabase, {
    householdId: membership.household_id
  });
  const continueSummary = getContinueSummaryFromBatches(batches, warning);
  const pagination = getImportBatchPagination(batches, getSingleParam(params.page));

  return (
    <AppShell title="待对账账单" subtitle="先把微信 / 支付宝流水放进小岛待对账池" hideTopbar compact>
      <div className="mx-auto grid max-w-6xl gap-6">
        {warning ? <PageNotice message={warning} /> : null}

        {continueSummary.latestUnfinishedBatch && continueSummary.continueHref ? (
          <ImportContinueCard summary={continueSummary} />
        ) : null}

        <section className="grid gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
                共同对账
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#794f27]">待对账池</h2>
              {batches.length > 0 ? (
                <p className="mt-1 text-sm font-bold text-[#725d42]">
                  第 {pagination.currentPage} / {pagination.totalPages} 页 · 共 {batches.length} 批
                </p>
              ) : null}
            </div>
            <IslandLink
              href="/imports/new"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
            >
              <FileUp aria-hidden="true" size={18} />
              导入新账单
            </IslandLink>
          </div>

          {batches.length > 0 ? (
            <>
              <div className="grid gap-4">
                {pagination.pageBatches.map((batch) => (
                  <ImportBatchCard key={batch.id} batch={batch} />
                ))}
              </div>
              <ImportBatchPager
                currentPage={pagination.currentPage}
                hasNextPage={pagination.hasNextPage}
                hasPreviousPage={pagination.hasPreviousPage}
                totalPages={pagination.totalPages}
              />
            </>
          ) : (
            <NotebookEmptyState
              action={{
                href: "/imports/new",
                label: "导入新账单",
                icon: <FileUp aria-hidden="true" size={18} />
              }}
              dataAttributes={{ "data-imports-empty-state": "true" }}
              description={
                <>
                  <p>先导入微信 / 支付宝流水，它们只会进入待对账池。</p>
                  <p className="mt-2">不会直接进入正式账本，也不会影响结算便签。</p>
                </>
              }
              eyebrow="Quiet Pocket"
              iconName="icon-shopping"
              title="还没有待对账账单"
              tone="yellow"
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function requireImportsAccess() {
  const supabase = await createClient();
  const currentUserId = (await headers()).get("x-couple-ledger-user-id");

  if (!currentUserId) {
    redirect("/login");
  }

  const membership = await getImportReviewHouseholdMembership(supabase, currentUserId);

  if (!membership) {
    redirect("/not-invited");
  }

  return { supabase, membership };
}

function getContinueSummaryFromBatches(
  batches: ImportBatchSummary[],
  warning: string | null
): ImportReviewContinueSummary {
  const unfinishedBatches = batches.filter(isImportBatchUnfinished);
  const latestUnfinishedBatch = unfinishedBatches[0] ?? null;

  return {
    recentBatchCount: batches.length,
    unfinishedBatchCount: unfinishedBatches.length,
    totalPendingItemCount: unfinishedBatches.reduce((sum, batch) => sum + batch.pendingCount, 0),
    totalNeedDiscussionCount: unfinishedBatches.reduce((sum, batch) => sum + batch.needDiscussionCount, 0),
    latestUnfinishedBatch,
    latestUnfinishedBatchId: latestUnfinishedBatch?.id ?? null,
    latestUnfinishedBatchFileName: latestUnfinishedBatch?.fileName ?? null,
    latestUnfinishedBatchSource: latestUnfinishedBatch?.source ?? null,
    latestUnfinishedBatchPendingCount: latestUnfinishedBatch?.pendingCount ?? 0,
    latestUnfinishedBatchNeedDiscussionCount: latestUnfinishedBatch?.needDiscussionCount ?? 0,
    latestUnfinishedBatchReviewedPercent: latestUnfinishedBatch
      ? getImportBatchReviewedPercent(latestUnfinishedBatch)
      : 0,
    continueHref: latestUnfinishedBatch ? getImportBatchContinueHref(latestUnfinishedBatch) : null,
    warning
  };
}

function ImportContinueCard({ summary }: { summary: ImportReviewContinueSummary }) {
  const batch = summary.latestUnfinishedBatch;

  if (!batch || !summary.continueHref) {
    return null;
  }

  return (
    <Card
      color="default"
      pattern="app-yellow"
      className="relative overflow-visible p-5 sm:p-6"
      data-imports-continue-section="true"
    >
      <span
        aria-hidden="true"
        className="absolute -top-3 left-10 h-7 w-28 -rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
            <Icon name={batch.source === "wechat" ? "icon-chat" : "icon-shopping"} size={20} bounce />
            Continue Review
          </p>
          <div className="mt-4">
            <Title size="middle" color="app-yellow">
              继续对账
            </Title>
          </div>
          <p className="mt-4 max-w-3xl text-sm font-bold leading-7 text-[#725d42]">
            还有一批账单没对完。先从最新的待确认小纸条继续，如果待确认已经清空，就回到待讨论队列。
          </p>
          <Divider type="wave-yellow" className="my-5" />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <IslandLink
              href={summary.continueHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
              data-imports-continue-link="true"
              data-imports-continue-href={summary.continueHref}
            >
              <ArrowRight aria-hidden="true" size={18} />
              继续对账
            </IslandLink>
            <IslandLink
              href="/imports/new"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-white/85 px-5 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:bg-[#e9fbf4] hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              <FileUp aria-hidden="true" size={18} />
              导入新账单
            </IslandLink>
          </div>
        </div>

        <div className="rounded-[30px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-4 shadow-[0_7px_0_rgba(121,79,39,0.09)]">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">Next Pocket</p>
          <p className="mt-2 truncate text-lg font-black text-[#794f27]">{batch.fileName}</p>
          <p className="mt-1 text-sm font-bold leading-6 text-[#725d42]">
            {getImportSourceLabel(batch.source)} · {formatImportPeriod(batch)}
          </p>
          <div className="mt-4 grid gap-2">
            <MiniMetric label="未完成批次" value={`${summary.unfinishedBatchCount} 批`} />
            <MiniMetric label="待确认" value={`${summary.totalPendingItemCount} 条`} />
            <MiniMetric label="待讨论" value={`${summary.totalNeedDiscussionCount} 条`} />
            <MiniMetric label="这批进度" value={`${summary.latestUnfinishedBatchReviewedPercent}%`} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function ImportBatchCard({ batch }: { batch: ImportBatchSummary }) {
  const progress = getBatchProgress(batch);

  return (
    <IslandLink
      href={`/imports/${batch.id}/review`}
      className="group relative block overflow-visible rounded-[30px] border-2 border-[#d9c49b] bg-[#fffdf3] p-4 shadow-[0_6px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25 sm:p-5"
      data-import-batch-link="true"
    >
      <span
        aria-hidden="true"
        className="absolute -top-3 right-10 h-6 w-24 rotate-2 rounded-[9px] bg-[#82d5bb]/60 shadow-[0_4px_0_rgba(121,79,39,0.08)]"
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#e9fbf4] px-3 py-1 text-xs font-black text-[#1f7a70]">
              <Icon name={batch.source === "wechat" ? "icon-chat" : "icon-shopping"} size={16} bounce />
              {getImportSourceLabel(batch.source)}
            </span>
            <span
              data-import-batch-state-label={progress.stateLabel}
              className={`inline-flex rounded-full border-2 border-dashed px-3 py-1 text-xs font-black ${progress.stateTone}`}
            >
              {progress.stateLabel}
            </span>
            <span className="inline-flex rounded-full border-2 border-dashed border-[#d9c49b] bg-white/85 px-3 py-1 text-xs font-black text-[#725d42]">
              {getImportBatchStatusLabel(batch.status)}
            </span>
          </div>
          <h3 className="mt-3 truncate text-lg font-black text-[#794f27]">{batch.fileName}</h3>
          <p className="mt-1 text-sm font-bold leading-6 text-[#725d42]">
            {formatImportPeriod(batch)} · {formatDateTime(batch.createdAt)}
          </p>
          {progress.isComplete ? (
            <p
              data-import-batch-complete="true"
              className="mt-3 inline-flex items-center gap-2 rounded-[18px] bg-[#e9fbf4] px-3 py-2 text-xs font-black leading-5 text-[#1f7a70] shadow-[inset_0_0_0_2px_rgba(130,213,187,0.45)]"
            >
              <CheckCircle2 aria-hidden="true" size={16} />
              这批账单已经没有待处理流水
            </p>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[430px] lg:grid-cols-4">
          <MiniMetric label="已解析" value={`${batch.parsedCount} 条`} />
          <MiniMetric label="待确认" value={`${batch.pendingCount} 条`} />
          <MiniMetric label="已处理" value={`${batch.reviewedCount} 条`} />
          <MiniMetric label="对完比例" value={`${progress.reviewedPercent}%`} />
        </div>
      </div>
      <div
        data-import-batch-progress="true"
        className="mt-4 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-white/75 px-4 py-3 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black text-[#794f27]">
          <span>对账进度</span>
          <span data-import-batch-progress-percent={`${progress.reviewedPercent}%`}>
            {progress.reviewedPercent}%
          </span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#eadfc8] shadow-[inset_0_1px_0_rgba(121,79,39,0.12)]">
          <span
            className="block h-full rounded-full bg-[#82d5bb] transition-[width] duration-300"
            style={{ width: `${progress.reviewedPercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-bold leading-5 text-[#725d42]">
          {progress.isComplete ? "已对完，可以回看全部流水或继续导入新账单。" : `还有 ${batch.pendingCount} 条待确认小纸条。`}
        </p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <ProgressPill label="已入账" value={batch.importedCount} />
        <ProgressPill label="已忽略" value={batch.skippedCount} />
        <ProgressPill label="待讨论" value={batch.needDiscussionCount} />
      </div>
      <p className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#1f7a70]">
        打开对账卡片
        <ArrowRight aria-hidden="true" size={17} className="transition group-hover:translate-x-0.5" />
      </p>
    </IslandLink>
  );
}

function ImportBatchPager({
  currentPage,
  hasNextPage,
  hasPreviousPage,
  totalPages
}: {
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-3 shadow-[0_5px_0_rgba(121,79,39,0.08)]">
      {hasPreviousPage ? (
        <IslandLink
          href={getImportsPageHref(currentPage - 1)}
          scroll={false}
          className="inline-flex min-h-10 items-center justify-center rounded-full border-2 border-dashed border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
          data-imports-previous-page="true"
        >
          上一页
        </IslandLink>
      ) : (
        <span className="inline-flex min-h-10 items-center justify-center rounded-full border-2 border-dashed border-[#d9c49b] bg-white/60 px-4 py-2 text-sm font-black text-[#b4a58b]">
          上一页
        </span>
      )}
      <span className="text-sm font-black text-[#725d42]">
        {currentPage} / {totalPages}
      </span>
      {hasNextPage ? (
        <IslandLink
          href={getImportsPageHref(currentPage + 1)}
          scroll={false}
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#82d5bb] px-4 py-2 text-sm font-black text-white shadow-[0_4px_0_#5fb89f] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
          data-imports-next-page="true"
        >
          下一页
        </IslandLink>
      ) : (
        <span className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#82d5bb]/45 px-4 py-2 text-sm font-black text-white">
          下一页
        </span>
      )}
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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-white px-3 py-3 text-center shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">{label}</p>
      <p className="mt-1 text-base font-black text-[#794f27]">{value}</p>
    </div>
  );
}

function ProgressPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center justify-between gap-3 rounded-[20px] bg-[#fff8da] px-3 py-2 text-xs font-black text-[#794f27] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.5)]">
      <span>{label}</span>
      <span>{value}</span>
    </span>
  );
}

function getBatchProgress(batch: ImportBatchSummary) {
  const reviewedPercent =
    batch.parsedCount > 0 ? Math.min(100, Math.round((batch.reviewedCount / batch.parsedCount) * 100)) : 0;
  const isComplete = batch.parsedCount > 0 && batch.pendingCount === 0;
  const stateLabel = isComplete ? "已对完" : batch.reviewedCount > 0 ? "对账中" : "待对账";
  const stateTone = isComplete
    ? "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]"
    : batch.reviewedCount > 0
      ? "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]"
      : "border-[#d9c49b] bg-[#fffdf3] text-[#794f27]";

  return {
    isComplete,
    reviewedPercent,
    stateLabel,
    stateTone
  };
}

function getImportBatchPagination(batches: ImportBatchSummary[], pageParam: string | undefined) {
  const totalPages = Math.max(1, Math.ceil(batches.length / importBatchPageSize));
  const requestedPage = Number.parseInt(pageParam ?? "1", 10);
  const currentPage = Math.min(Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1), totalPages);
  const start = (currentPage - 1) * importBatchPageSize;

  return {
    currentPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    pageBatches: batches.slice(start, start + importBatchPageSize),
    totalPages
  };
}

function getImportsPageHref(page: number) {
  return page <= 1 ? "/imports" : `/imports?page=${page}`;
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

function formatDateTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
