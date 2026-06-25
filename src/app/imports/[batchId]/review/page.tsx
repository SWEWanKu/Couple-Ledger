import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, FileUp, Hourglass, ReceiptText, ShieldCheck } from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
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
import { createClient } from "@/lib/supabase/server";

type ImportReviewPageProps = {
  params: Promise<{
    batchId: string;
  }>;
  searchParams?: Promise<{
    notice?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "对账占位页 | 小岛账本"
};

export default async function ImportReviewPage({ params, searchParams }: ImportReviewPageProps) {
  const { batchId } = await params;
  const query = searchParams ? await searchParams : {};
  const { supabase, membership } = await requireImportsAccess();
  const result = await getImportBatchReviewSummary(supabase, {
    householdId: membership.household_id,
    batchId
  });

  return (
    <AppShell title="对账占位页" subtitle="账单已经放进待对账池，还没有写入正式账本">
      <div className="mx-auto grid max-w-5xl gap-6">
        <PrivateIslandTrail
          items={[
            { label: islandTrailLabels.home, href: "/dashboard" },
            { label: "待对账账单", href: "/imports" },
            { label: "对账占位页", current: true }
          ]}
        />

        {result.ok ? (
          <>
            {getSingleParam(query.notice) === "duplicate" ? (
              <PageNotice message="这份文件之前已经放进待对账池了，这里直接带你回到已有批次，没有创建第二份。" />
            ) : null}
            {result.warning ? <PageNotice message={result.warning} /> : null}
            <ReviewPlaceholder batch={result.batch} />
          </>
        ) : (
          <BatchUnavailableState reason={result.reason} />
        )}
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

function ReviewPlaceholder({ batch }: { batch: ImportBatchSummary }) {
  return (
    <Card color="default" pattern="app-green" className="relative overflow-visible p-5 sm:p-7">
      <span
        aria-hidden="true"
        className="absolute -top-4 left-8 h-8 w-28 -rotate-2 rounded-[10px] bg-[#f7cd67]/75 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_270px]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
            <Icon name={batch.source === "wechat" ? "icon-chat" : "icon-shopping"} size={22} bounce />
            {getImportSourceLabel(batch.source)}
          </p>
          <div className="mt-5">
            <Title size="large" color="app-yellow">
              待对账卡片模式
            </Title>
          </div>
          <p className="mt-5 max-w-2xl text-sm font-bold leading-7 text-[#725d42] sm:text-base">
            现在已经成功把账单放进待对账池，还没有写入正式账本。下一步会在这里长出一张张对账卡片，让你们逐条确认。
          </p>
          <Divider type="wave-yellow" className="my-6" />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <IslandLink
              href="/imports"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              <ArrowLeft aria-hidden="true" size={18} />
              回到待对账池
            </IslandLink>
            <IslandLink
              href="/imports/new"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-3 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
            >
              <FileUp aria-hidden="true" size={18} />
              再导入一份
            </IslandLink>
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
        </div>
      </div>

      <Divider type="wave-yellow" className="my-6" />

      <div
        data-import-review-progress="true"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <ProgressCard icon={<ReceiptText aria-hidden="true" size={20} />} label="已解析" value={batch.parsedCount} />
        <ProgressCard icon={<Hourglass aria-hidden="true" size={20} />} label="待确认" value={batch.pendingCount} />
        <ProgressCard icon={<ShieldCheck aria-hidden="true" size={20} />} label="已处理" value={batch.reviewedCount} />
        <ProgressCard icon={<Icon name="icon-map" size={20} bounce />} label="总条数" value={batch.totalCount} />
      </div>

      <div className="mt-5 grid gap-3 rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-white/75 p-4 sm:grid-cols-3">
        <ProgressPill label="已入账" value={batch.importedCount} />
        <ProgressPill label="已忽略" value={batch.skippedCount} />
        <ProgressPill label="待讨论" value={batch.needDiscussionCount} />
      </div>

      <div className="mt-6 rounded-[28px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-4 text-sm font-black leading-7 text-[#8a6420]">
        待对账卡片模式下一步实现。当前页面只展示批次摘要和进度，不提供确认入账、跳过、标记待讨论或其它写入操作。
      </div>
    </Card>
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

function PageNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[24px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-4 py-3 text-sm font-black leading-6 text-[#8a6420]">
      <Icon name="icon-chat" size={18} bounce />
      <span>{message}</span>
    </div>
  );
}

function ProgressCard({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
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

function formatImportPeriod(batch: ImportBatchSummary) {
  if (!batch.periodStart && !batch.periodEnd) {
    return "账单时间待识别";
  }

  if (batch.periodStart === batch.periodEnd) {
    return batch.periodStart ?? batch.periodEnd;
  }

  return `${batch.periodStart ?? "?"} 至 ${batch.periodEnd ?? "?"}`;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
