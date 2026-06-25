import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, FileUp, History, ReceiptText, ShieldCheck } from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { NotebookEmptyState } from "@/components/NotebookEmptyState";
import { PrivateIslandTrail, islandTrailLabels } from "@/components/PrivateIslandTrail";
import {
  getImportBatchStatusLabel,
  getImportReviewContinueSummary,
  getImportReviewHouseholdMembership,
  getImportSourceLabel,
  listImportBatches,
  type ImportBatchSummary,
  type ImportReviewContinueSummary
} from "@/lib/import-review/batches";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "待对账账单 | 小岛账本"
};

export default async function ImportsPage() {
  const { supabase, membership } = await requireImportsAccess();
  const { batches, warning } = await listImportBatches(supabase, {
    householdId: membership.household_id
  });
  const continueSummary = await getImportReviewContinueSummary(supabase, {
    householdId: membership.household_id
  });

  return (
    <AppShell title="待对账账单" subtitle="先把微信 / 支付宝流水放进小岛待对账池">
      <div className="mx-auto grid max-w-6xl gap-6">
        <PrivateIslandTrail
          items={[
            { label: islandTrailLabels.home, href: "/dashboard" },
            { label: "待对账账单", current: true }
          ]}
        />

        <ImportHero batchCount={batches.length} />

        {warning ? <PageNotice message={warning} /> : null}

        {continueSummary.latestUnfinishedBatch && continueSummary.continueHref ? (
          <ImportContinueCard summary={continueSummary} />
        ) : null}

        <section className="grid gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
                Import Review
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#794f27]">待对账池</h2>
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
            <div className="grid gap-4">
              {batches.map((batch) => (
                <ImportBatchCard key={batch.id} batch={batch} />
              ))}
            </div>
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

function ImportHero({ batchCount }: { batchCount: number }) {
  return (
    <Card color="default" pattern="app-teal" className="relative overflow-visible p-5 sm:p-7">
      <span
        aria-hidden="true"
        className="absolute -top-4 left-8 h-8 w-28 -rotate-2 rounded-[10px] bg-[#f7cd67]/75 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
            <Icon name="icon-shopping" size={22} bounce />
            Bill Pocket
          </p>
          <div className="mt-5">
            <Title size="large" color="app-yellow">
              共同对账模式
            </Title>
          </div>
          <p className="mt-5 max-w-3xl text-sm font-bold leading-7 text-[#725d42] sm:text-base">
            把外部账单先贴进待对账池，之后再一条条确认。这个入口只做解析和排队，不会创建正式账本流水。
          </p>
          <Divider type="wave-yellow" className="my-5" />
          <div className="flex flex-wrap gap-3">
            <InfoPill icon={<ShieldCheck aria-hidden="true" size={17} />} label="只读回顾 + 上传排队" />
            <InfoPill icon={<ReceiptText aria-hidden="true" size={17} />} label="不直接入账" />
            <InfoPill icon={<History aria-hidden="true" size={17} />} label="保留待对账进度" />
          </div>
        </div>
        <div className="rounded-[30px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-5 text-center shadow-[0_7px_0_rgba(121,79,39,0.09)]">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">Pocket Count</p>
          <p className="mt-3 text-4xl font-black text-[#794f27]">{batchCount}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">当前可查看的待对账批次</p>
        </div>
      </div>
    </Card>
  );
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

function PageNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[24px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-3 text-sm font-black leading-6 text-[#8a6420]">
      <Icon name="icon-chat" size={18} bounce />
      <span>{message}</span>
    </div>
  );
}

function InfoPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.1)]">
      {icon}
      {label}
    </span>
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
