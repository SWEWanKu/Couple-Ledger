import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FilePenLine,
  Hourglass,
  NotebookTabs,
  ReceiptText,
  Send,
  ShieldCheck,
  Stamp,
  UsersRound,
  WalletCards
} from "lucide-react";
import { Button, Card, Divider, Icon, Title } from "animal-island-ui";
import {
  confirmSettlementSnapshotAction,
  proposeSettlementSnapshotAction
} from "@/app/settlement/actions";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import {
  buildSettlementSnapshotPayload,
  type SettlementSnapshotJson
} from "@/lib/settlement/build-settlement-snapshot-payload";
import type { SettlementSnapshotRow } from "@/lib/settlement/create-settlement-snapshot";
import {
  getSettlementSnapshotStatus,
  type GetSettlementSnapshotStatusResult
} from "@/lib/settlement/get-settlement-snapshot-status";
import { getSettlementSummary } from "@/lib/settlement/get-settlement-summary";
import { createClient } from "@/lib/supabase/server";
import type {
  SettlementCalculationResult,
  SettlementMemberBalance,
  SettlementMonthMetadata,
  SettlementSummaryMember
} from "@/types/settlement";

export const metadata: Metadata = {
  title: "小岛结算 | 小岛账本"
};

type SettlementPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
    settlement_action?: string | string[];
    settlement_result?: string | string[];
    settlement_error?: string | string[];
  }>;
};

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

export default async function SettlementPage({ searchParams }: SettlementPageProps) {
  const params = searchParams ? await searchParams : {};
  const selectedMonth = getSingleParam(params.month);
  const settlementFeedback = getSettlementFeedback({
    action: getSingleParam(params.settlement_action),
    result: getSingleParam(params.settlement_result),
    error: getSingleParam(params.settlement_error)
  });
  const { supabase, user, membership } = await requireHouseholdAccess();
  const { summary: householdSummary, warning: householdWarning } =
    await getDashboardHouseholdSummary(supabase, {
      householdId: membership.household_id,
      currentUserId: user.id
    });
  const settlementResult = await getSettlementSummary(supabase, {
    householdId: membership.household_id,
    currentUserId: user.id,
    month: selectedMonth
  });
  const { summary: settlementSummary, warning: settlementWarning } = settlementResult;
  const snapshotStatus = await getSettlementSnapshotStatus(supabase, {
    householdId: membership.household_id,
    month: selectedMonth
  });
  const outdatedSnapshotWarning = getOutdatedSnapshotWarning({
    householdId: membership.household_id,
    currentUserId: user.id,
    settlementResult,
    snapshotStatus
  });
  const range = settlementSummary.month;

  return (
    <AppShell
      title={`${householdSummary.householdName} 小岛结算`}
      subtitle="实时计算保持只读，结算便签可以盖章存档并等待两个人确认。"
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
          <span className="inline-flex min-h-10 items-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-2 text-xs font-black text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
            <ShieldCheck aria-hidden="true" size={16} />
            双人确认 · 不转钱
          </span>
        </div>

        <Card color="default" pattern="app-teal" className="relative overflow-visible p-5 sm:p-7">
          <span
            aria-hidden="true"
            className="absolute -top-3 left-10 h-7 w-24 -rotate-2 rounded-[10px] bg-[#82d5bb]/70 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#fff1a8]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-stretch">
            <div className="min-w-0">
              <p className="inline-flex max-w-full items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
                <Icon name="icon-diy" size={22} bounce />
                <span className="truncate">Settlement Notebook</span>
              </p>

              <div className="mt-5">
                <span className="hidden sm:inline-block">
                  <Title size="large" color="app-yellow">
                    本月小岛结算
                  </Title>
                </span>
                <span className="inline-block sm:hidden">
                  <Title size="middle" color="app-yellow">
                    本月小岛结算
                  </Title>
                </span>
              </div>

              <p className="mt-5 max-w-3xl text-base font-bold leading-8 text-[#725d42] sm:text-lg">
                上半页继续用 helper 实时读取支出和分摊行；下半页可以把本月结果盖章成不可变便签，再等两个人各自确认。
              </p>

              <Divider type="wave-yellow" className="my-6" />

              <MonthNavigator range={range} />

              <div className="mt-5 flex flex-wrap gap-3">
                <InfoPill icon={<CalendarDays aria-hidden="true" size={16} />} label={formatRangeLabel(range)} />
                <InfoPill
                  icon={<ReceiptText aria-hidden="true" size={16} />}
                  label={`${settlementSummary.includedExpenseCount} 笔支出`}
                />
                <InfoPill
                  icon={<Icon name="icon-map" size={18} bounce />}
                  label={householdSummary.householdName}
                />
              </div>
            </div>

            <aside className="relative rounded-[32px] border-2 border-[#d9c49b] bg-[#fffdf3] p-4 shadow-[0_8px_0_rgba(121,79,39,0.1)]">
              <span className="absolute -top-3 right-8 rotate-3 rounded-full border-2 border-[#d9c49b] bg-[#fff1ed] px-4 py-1 text-xs font-black text-[#9b6c48] shadow-[0_4px_0_rgba(121,79,39,0.08)]">
                {range.monthLabel}
              </span>

              <div className="rounded-[26px] bg-[#82d5bb] px-5 py-5 text-white shadow-[0_6px_0_#5fb89f]">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] opacity-90">
                  <WalletCards aria-hidden="true" size={16} />
                  Monthly Total
                </p>
                <p className="mt-3 text-4xl font-black leading-tight">
                  {formatCurrency(settlementSummary.totalExpense)}
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-white/90">
                  本月纳入结算的真实支出总额
                </p>
              </div>

              <div className="mt-4 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fff8da] px-4 py-3 text-sm font-bold leading-7 text-[#725d42]">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
                  Read Source
                </p>
                <p className="mt-1">实时计算来自结算 helper；盖章便签来自 settlement snapshot。</p>
              </div>
            </aside>
          </div>
        </Card>

        {settlementFeedback ? (
          <PageNotice message={settlementFeedback.message} tone={settlementFeedback.tone} />
        ) : null}
        {householdWarning ? <PageNotice message={householdWarning} tone="warning" /> : null}
        {settlementWarning ? <PageNotice message={settlementWarning} tone="warning" /> : null}
        {snapshotStatus.status === "error" ? (
          <PageNotice
            message="结算便签状态暂时读不到，实时计算仍然可以查看。如果本地数据库还没有 settlement 表，请先只看预览，不要运行远程 SQL。"
            tone="warning"
          />
        ) : null}
        {outdatedSnapshotWarning ? <PageNotice message={outdatedSnapshotWarning} tone="warning" /> : null}

        <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <MemberBalanceSection
            members={settlementSummary.members}
            balances={settlementSummary.calculation.memberBalances}
          />
          <TransferSuggestionCard calculation={settlementSummary.calculation} />
        </section>

        <SettlementSnapshotStatusCard
          currentUserId={user.id}
          range={range}
          statusResult={snapshotStatus}
          calculation={settlementSummary.calculation}
          members={settlementSummary.members}
          includedExpenseCount={settlementSummary.includedExpenseCount}
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

function MonthNavigator({ range }: { range: SettlementMonthMetadata }) {
  return (
    <div className="rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-3">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <IslandLink
          href={`/settlement?month=${range.previousMonth}`}
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
          href={`/settlement?month=${range.nextMonth}`}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_4px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
        >
          下个月
          <ChevronRight aria-hidden="true" size={17} />
        </IslandLink>
      </div>
    </div>
  );
}

function MemberBalanceSection({
  members,
  balances
}: {
  members: SettlementSummaryMember[];
  balances: SettlementMemberBalance[];
}) {
  const memberMap = new Map(members.map((member) => [member.userId, member]));

  return (
    <Card color="default" pattern="app-yellow" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-8 h-7 w-24 -rotate-2 rounded-[10px] bg-[#fff1a8]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            Balance Stickers
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              成员小纸条
            </Title>
          </div>
          <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
            每张纸条都来自结算 helper 的 paid / share / net 结果。
          </p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_5px_0_#5fb89f]">
          <NotebookTabs aria-hidden="true" size={23} />
        </span>
      </div>

      <Divider type="dashed-brown" className="my-5" />

      {balances.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {balances.map((balance) => (
            <MemberBalanceCard key={balance.userId} balance={balance} member={memberMap.get(balance.userId)} />
          ))}
        </div>
      ) : (
        <EmptySettlementState />
      )}
    </Card>
  );
}

function MemberBalanceCard({
  balance,
  member
}: {
  balance: SettlementMemberBalance;
  member: SettlementSummaryMember | undefined;
}) {
  return (
    <article className="relative rounded-[28px] border-2 border-[#ead9b8] bg-[#fffdf3] px-5 py-4 shadow-[0_6px_0_rgba(121,79,39,0.08)]">
      <span
        aria-hidden="true"
        className="absolute -top-2 right-7 h-5 w-16 rotate-2 rounded-[8px] bg-[#82d5bb]/55 shadow-[0_3px_0_rgba(121,79,39,0.06)]"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-[#794f27]">{balance.displayName}</p>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">
            {member?.isCurrentUser ? "你的小纸条" : "小岛成员"}
          </p>
        </div>
        <span className="rounded-full bg-[#fff8da] px-3 py-1 text-xs font-black text-[#8a6420] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
          {formatNetLabel(balance.netAmount)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <AmountTile label="已支付" value={formatCurrency(balance.paidAmount)} />
        <AmountTile label="应承担" value={formatCurrency(balance.shareAmount)} />
        <AmountTile label="净额" value={formatSignedCurrency(balance.netAmount)} accent />
      </div>
    </article>
  );
}

function TransferSuggestionCard({ calculation }: { calculation: SettlementCalculationResult }) {
  const memberLabelMap = new Map(calculation.memberBalances.map((balance) => [balance.userId, balance.displayName]));
  const suggestion = calculation.transferSuggestion;

  return (
    <Card color="default" pattern="app-orange" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#82d5bb]/60 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            Transfer Memo
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              结算建议
            </Title>
          </div>
          <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
            这里只给只读建议，后续是否记录结清会另开设计。
          </p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27] shadow-[0_5px_0_#d9a43e]">
          <ArrowRightLeft aria-hidden="true" size={23} />
        </span>
      </div>

      <Divider type="dashed-brown" className="my-5" />

      {suggestion ? (
        <div className="rounded-[30px] border-2 border-[#d9c49b] bg-[#fffdf3] px-5 py-6 text-center shadow-[0_7px_0_rgba(121,79,39,0.08)]">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            建议转账
          </p>
          <p className="mt-4 text-2xl font-black leading-tight text-[#794f27] sm:text-3xl">
            {memberLabelMap.get(suggestion.fromUserId) ?? "小岛成员"} 给{" "}
            {memberLabelMap.get(suggestion.toUserId) ?? "小岛成员"}
          </p>
          <p className="mt-4 text-4xl font-black text-[#d46a5b]">
            {formatCurrency(suggestion.amount)}
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm font-bold leading-7 text-[#725d42]">
            算完这笔，这个月的 paid / share / net 就能对齐啦。
          </p>
        </div>
      ) : (
        <NoTransferState status={calculation.status} />
      )}

      {calculation.warnings.length > 0 ? (
        <div className="mt-5 grid gap-2">
          {calculation.warnings.map((warning) => (
            <PageNotice key={warning} message={warning} tone="warning" />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function SettlementSnapshotStatusCard({
  currentUserId,
  range,
  statusResult,
  calculation,
  members,
  includedExpenseCount
}: {
  currentUserId: string;
  range: SettlementMonthMetadata;
  statusResult: GetSettlementSnapshotStatusResult;
  calculation: SettlementCalculationResult;
  members: SettlementSummaryMember[];
  includedExpenseCount: number;
}) {
  const statusCopy = getSnapshotStatusCopy(statusResult.status);

  return (
    <Card color="default" pattern="app-green" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-10 h-7 w-24 -rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-12 h-7 w-24 rotate-2 rounded-[10px] bg-[#fff1a8]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            <Stamp aria-hidden="true" size={17} />
            Snapshot Stamp
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              结算盖章便签
            </Title>
          </div>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-[#725d42]">
            上方是实时计算；这里展示已经存档的结算快照和两个人的确认进度。它只记录小岛账本里的约定，不代表真实转账。
          </p>
        </div>
        <span
          className={`inline-flex min-h-10 w-fit items-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black shadow-[0_5px_0_rgba(121,79,39,0.1)] ${statusCopy.className}`}
        >
          {statusCopy.icon}
          {statusCopy.label}
        </span>
      </div>

      <Divider type="dashed-brown" className="my-5" />

      {statusResult.status === "error" ? (
        <div className="rounded-[30px] border-2 border-dashed border-[#f7cd67] bg-[#fff8da] px-5 py-6 text-sm font-bold leading-7 text-[#725d42]">
          <p className="text-lg font-black text-[#794f27]">结算便签册暂时翻不开</p>
          <p className="mt-2">
            实时计算仍在正常展示。等 settlement snapshot 表可读后，这里会显示提出、确认和已完成状态。
          </p>
        </div>
      ) : statusResult.status === "no_snapshot" ? (
        <NoSnapshotActionPanel
          calculation={calculation}
          includedExpenseCount={includedExpenseCount}
          range={range}
        />
      ) : (
        <StoredSnapshotPanel
          currentUserId={currentUserId}
          members={members}
          range={range}
          statusResult={statusResult}
        />
      )}
    </Card>
  );
}

function NoSnapshotActionPanel({
  calculation,
  includedExpenseCount,
  range
}: {
  calculation: SettlementCalculationResult;
  includedExpenseCount: number;
  range: SettlementMonthMetadata;
}) {
  const canPropose =
    includedExpenseCount > 0 && calculation.status === "ready" && Boolean(calculation.transferSuggestion);
  const copy = getProposalReadinessCopy({
    status: calculation.status,
    includedExpenseCount,
    canPropose
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-stretch">
      <div className="rounded-[30px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-5 shadow-[0_6px_0_rgba(121,79,39,0.08)]">
        <p className="flex items-center gap-2 text-lg font-black text-[#794f27]">
          <FilePenLine aria-hidden="true" size={21} className="text-[#9f927d]" />
          {copy.title}
        </p>
        <p className="mt-3 text-sm font-bold leading-7 text-[#725d42]">{copy.body}</p>
      </div>

      <div className="rounded-[30px] bg-[#fff8da] px-5 py-5 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
        {canPropose ? (
          <form action={proposeSettlementSnapshotAction} className="grid h-full content-center gap-4">
            <input type="hidden" name="month" value={range.month} />
            <p className="text-sm font-black leading-7 text-[#725d42]">
              把当前实时计算盖章存成 {range.monthLabel} 的结算便签。
            </p>
            <Button type="primary" size="large" htmlType="submit" icon={<Send aria-hidden="true" size={18} />} block>
              提出本月结算便签
            </Button>
          </form>
        ) : (
          <div className="grid h-full content-center gap-3 text-sm font-bold leading-7 text-[#725d42]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_5px_0_#5fb89f]">
              <Icon name="icon-chat" size={26} bounce />
            </span>
            <p>先不用盖章；等本月有明确的转账建议时，这里才会出现提出按钮。</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StoredSnapshotPanel({
  currentUserId,
  members,
  range,
  statusResult
}: {
  currentUserId: string;
  members: SettlementSummaryMember[];
  range: SettlementMonthMetadata;
  statusResult: Extract<GetSettlementSnapshotStatusResult, { snapshot: SettlementSnapshotRow }>;
}) {
  const snapshot = statusResult.snapshot;
  const snapshotJson = getSnapshotJson(snapshot.snapshot);
  const memberNameMap = getSnapshotMemberNameMap(members, snapshotJson);
  const confirmedUserIds = new Set(statusResult.confirmations.map((confirmation) => confirmation.confirmed_by));
  const hasCurrentUserConfirmed = confirmedUserIds.has(currentUserId);
  const isFullyConfirmed = statusResult.status === "fully_confirmed";
  const pendingMembers = members.filter((member) => !confirmedUserIds.has(member.userId));
  const confirmedMembers = statusResult.confirmations.map((confirmation) => ({
    id: confirmation.id,
    userId: confirmation.confirmed_by,
    displayName: memberNameMap.get(confirmation.confirmed_by) ?? "小岛成员",
    confirmedAt: confirmation.confirmed_at
  }));
  const statusMemo = getStoredSnapshotStatusMemo({
    hasCurrentUserConfirmed,
    isFullyConfirmed,
    pendingMembers,
    progressLabel: `${confirmedUserIds.size}/${statusResult.requiredConfirmationCount}`
  });

  return (
    <div className="grid gap-5">
      <section className={`rounded-[30px] border-2 border-dashed px-5 py-4 shadow-[0_7px_0_rgba(121,79,39,0.08)] ${statusMemo.className}`}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
              {statusMemo.icon}
              Confirmation Progress
            </p>
            <p className="mt-2 text-xl font-black text-[#794f27]">{statusMemo.title}</p>
            <p className="mt-2 text-sm font-black leading-7 text-[#725d42]">{statusMemo.body}</p>
          </div>
          <div className="rounded-[26px] bg-white/80 px-5 py-4 text-center shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">盖章进度</p>
            <p className="mt-1 text-3xl font-black text-[#794f27]">{statusMemo.progressLabel}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.98fr_1.02fr]">
      <section className="rounded-[30px] border-2 border-[#d9c49b] bg-[#fffdf3] px-5 py-5 shadow-[0_7px_0_rgba(121,79,39,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
              Stored Snapshot
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#794f27]">{range.monthLabel} 存档便签</h2>
          </div>
          <span className="inline-flex min-h-9 items-center rounded-full bg-[#fff8da] px-3 py-1 text-xs font-black text-[#8a6420] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
            {snapshot.calculation_status === "ready" ? "有转账建议" : "无需转账"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <AmountTile label="快照总支出" value={formatCentsCurrency(snapshot.total_expense_cents)} />
          <AmountTile label="快照支出数" value={`${snapshot.expense_count} 笔`} />
          <AmountTile label="快照转账额" value={formatCentsCurrency(snapshot.transfer_amount_cents)} accent />
        </div>

        <div className="mt-5 rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fff8da] px-4 py-4 text-sm font-black leading-7 text-[#725d42]">
          <p className="flex items-center gap-2 text-[#794f27]">
            <ArrowRightLeft aria-hidden="true" size={18} className="text-[#9f927d]" />
            {formatSnapshotTransfer(snapshot, memberNameMap)}
          </p>
          <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">
            提出时间：{formatDateTime(snapshot.created_at)}
          </p>
        </div>

        {snapshotJson?.memberBalances.length ? (
          <div className="mt-5 grid gap-3">
            {snapshotJson.memberBalances.map((balance) => (
              <div
                key={balance.userId}
                className="grid gap-3 rounded-[24px] bg-white px-4 py-3 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)] sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <p className="min-w-0 text-sm font-black text-[#794f27]">{balance.displayName}</p>
                <p className="text-sm font-black text-[#725d42]">
                  已付 {formatCentsCurrency(balance.paidAmountCents)} · 应担{" "}
                  {formatCentsCurrency(balance.shareAmountCents)} · 净额{" "}
                  {formatSignedCentsCurrency(balance.netAmountCents)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-[30px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-5 shadow-[0_7px_0_rgba(121,79,39,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
              Confirmations
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#794f27]">
              {isFullyConfirmed ? "这个月已经两个人都确认啦" : "等待小岛成员确认"}
            </h2>
          </div>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#82d5bb] px-3 py-1 text-xs font-black text-white shadow-[0_4px_0_#5fb89f]">
            <UsersRound aria-hidden="true" size={15} />
            {confirmedUserIds.size}/{statusResult.requiredConfirmationCount}
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {confirmedMembers.length > 0 ? (
            confirmedMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-start gap-3 rounded-[24px] bg-[#e9fbf4] px-4 py-3 text-sm font-black leading-6 text-[#1f7a70] shadow-[inset_0_0_0_2px_rgba(130,213,187,0.55)]"
              >
                <CheckCircle2 aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
                <span>
                  {member.displayName} 已确认 · {formatDateTime(member.confirmedAt)}
                </span>
              </div>
            ))
          ) : (
            <div className="flex items-start gap-3 rounded-[24px] bg-[#fff8da] px-4 py-3 text-sm font-black leading-6 text-[#8a6420] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
              <Hourglass aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
              <span>这张便签已经提出，还没有人盖确认章。</span>
            </div>
          )}

          {pendingMembers.length > 0 && !isFullyConfirmed ? (
            <div className="rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-white px-4 py-3 text-sm font-black leading-6 text-[#725d42]">
              还在等待：{pendingMembers.map((member) => member.displayName).join("、")}
            </div>
          ) : null}
        </div>

        <Divider type="wave-yellow" className="my-5" />

        {isFullyConfirmed ? (
          <div className="rounded-[26px] bg-[#e9fbf4] px-4 py-4 text-sm font-black leading-7 text-[#1f7a70] shadow-[inset_0_0_0_2px_rgba(130,213,187,0.55)]">
            两个人都已经确认这张结算便签，本月在小岛账本里正式对齐啦。
          </div>
        ) : hasCurrentUserConfirmed ? (
          <div className="rounded-[26px] bg-[#fff8da] px-4 py-4 text-sm font-black leading-7 text-[#8a6420] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
            你已经确认过这张便签啦，等另一位小岛成员盖章就好。
          </div>
        ) : (
          <form action={confirmSettlementSnapshotAction} className="grid gap-4">
            <input type="hidden" name="month" value={range.month} />
            <input type="hidden" name="snapshot_id" value={snapshot.id} />
            <p className="text-sm font-bold leading-7 text-[#725d42]">
              确认后只会新增你自己的确认记录，不会改动原始账本，也不会替对方确认。
            </p>
            <Button type="primary" size="large" htmlType="submit" icon={<Stamp aria-hidden="true" size={18} />} block>
              确认这张结算便签
            </Button>
          </form>
        )}
      </section>
      </div>
    </div>
  );
}

function NoTransferState({ status }: { status: SettlementCalculationResult["status"] }) {
  const copy = getNoTransferCopy(status);

  return (
    <div className="rounded-[30px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-7 text-center shadow-[0_6px_0_rgba(121,79,39,0.08)]">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#82d5bb] shadow-[0_6px_0_#5fb89f]">
        <Icon name="icon-chat" size={29} bounce />
      </span>
      <p className="mt-4 text-xl font-black text-[#794f27]">{copy.title}</p>
      <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-7 text-[#725d42]">{copy.body}</p>
    </div>
  );
}

function EmptySettlementState() {
  return (
    <div className="rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_6px_0_#5fb89f]">
        <Icon name="icon-map" size={28} bounce />
      </span>
      <h2 className="mt-5 text-2xl font-black text-[#794f27]">这个月小岛还没有要结算的支出</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm font-bold leading-7 text-[#725d42]">
        等账本里有本月支出和分摊行后，这里会自动长出成员纸条。
      </p>
    </div>
  );
}

function AmountTile({
  label,
  value,
  accent = false
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] px-3 py-3 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)] ${
        accent ? "bg-[#fff8da]" : "bg-white"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">{label}</p>
      <p className="mt-1 break-words text-base font-black text-[#794f27]">{value}</p>
    </div>
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

function PageNotice({
  message,
  tone
}: {
  message: string;
  tone: "success" | "warning" | "error";
}) {
  const classes =
    tone === "error"
      ? "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]"
      : tone === "success"
        ? "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]"
        : "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]";
  const NoticeIcon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-[24px] border-2 border-dashed px-4 py-3 text-sm font-black leading-6 ${classes}`}
    >
      <NoticeIcon aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function getSettlementFeedback({
  action,
  result,
  error
}: {
  action: string | null;
  result: string | null;
  error: string | null;
}) {
  if (!action || !result) {
    return null;
  }

  const errorSuffix = error ? `（${error}）` : "";

  if (action === "propose") {
    if (result === "created") {
      return {
        tone: "success" as const,
        message: "结算便签已经提出啦。它会保留当前这份快照，接下来等两个人分别盖章确认。"
      };
    }

    if (result === "already_exists") {
      return {
        tone: "warning" as const,
        message: "这个月已经有一张结算便签啦。小岛不会重复写一张，直接查看下方盖章进度就好。"
      };
    }

    if (result === "unauthenticated") {
      return {
        tone: "error" as const,
        message: "登录状态过期啦，请重新登录后再提出结算便签。"
      };
    }

    if (result === "unsupported_calculation_status") {
      return {
        tone: "warning" as const,
        message: "结算表还没有准备好，先补齐分摊数据或等出现明确转账建议。"
      };
    }

    if (result === "insert_failed" || result === "existing_snapshot_read_failed") {
      return {
        tone: "warning" as const,
        message: `结算表还没有准备好，暂时不能提出这张便签${errorSuffix}。`
      };
    }

    return {
      tone: "warning" as const,
      message: `结算便签暂时没有写上去，实时计算仍然安全可看${errorSuffix}。`
    };
  }

  if (action === "confirm") {
    if (result === "confirmed") {
      return {
        tone: "success" as const,
        message: "你已经在这张结算便签上盖章确认啦，等另一位小岛成员也盖章后，本月就正式对齐。"
      };
    }

    if (result === "already_confirmed") {
      return {
        tone: "warning" as const,
        message: "你之前已经确认过啦，小岛不会重复盖同一枚章。"
      };
    }

    if (result === "snapshot_not_found" || result === "snapshot_missing") {
      return {
        tone: "warning" as const,
        message: "这张结算便签没有找到，刷新后再从当前月份重新确认。"
      };
    }

    if (result === "snapshot_status_unavailable") {
      return {
        tone: "warning" as const,
        message: `结算表还没有准备好，暂时不能确认这张便签${errorSuffix}。`
      };
    }

    if (result === "insert_failed" || result === "confirmation_read_failed") {
      return {
        tone: "warning" as const,
        message: `结算表还没有准备好，暂时不能盖确认章${errorSuffix}。`
      };
    }

    if (result === "unauthenticated") {
      return {
        tone: "error" as const,
        message: "登录状态过期啦，请重新登录后再确认结算便签。"
      };
    }

    return {
      tone: "warning" as const,
      message: `确认章暂时没有盖上去，稍后可以再试一次${errorSuffix}。`
    };
  }

  return null;
}

function getOutdatedSnapshotWarning({
  householdId,
  currentUserId,
  settlementResult,
  snapshotStatus
}: {
  householdId: string;
  currentUserId: string;
  settlementResult: Awaited<ReturnType<typeof getSettlementSummary>>;
  snapshotStatus: GetSettlementSnapshotStatusResult;
}) {
  if (snapshotStatus.status === "error" || snapshotStatus.status === "no_snapshot") {
    return null;
  }

  const built = buildSettlementSnapshotPayload({
    householdId,
    createdBy: currentUserId,
    createdAt: new Date(0),
    summaryResult: settlementResult
  });

  if (!built.ok) {
    return null;
  }

  if (built.payload.source_fingerprint !== snapshotStatus.snapshot.source_fingerprint) {
    return "这张结算便签生成后，账本好像又有变化，建议重新看一看。旧便签不会被自动改写，也不会偷偷替你们重新结算。";
  }

  return null;
}

function getStoredSnapshotStatusMemo({
  hasCurrentUserConfirmed,
  isFullyConfirmed,
  pendingMembers,
  progressLabel
}: {
  hasCurrentUserConfirmed: boolean;
  isFullyConfirmed: boolean;
  pendingMembers: SettlementSummaryMember[];
  progressLabel: string;
}) {
  if (isFullyConfirmed) {
    return {
      title: "这张便签已经两个人都盖章啦",
      body: "本月结算在小岛账本里已经对齐。这里仍然只是家庭账本记录，不代表真实银行转账。",
      progressLabel,
      icon: <CheckCircle2 aria-hidden="true" size={17} />,
      className: "border-[#82d5bb] bg-[#e9fbf4]"
    };
  }

  if (hasCurrentUserConfirmed) {
    const pendingLabel = pendingMembers.map((member) => member.displayName).join("、") || "另一位小岛成员";

    return {
      title: "你已经盖章，正在等对方确认",
      body: `你的确认已经写进便签册。现在只需要等 ${pendingLabel} 再盖一次章。`,
      progressLabel,
      icon: <BadgeCheck aria-hidden="true" size={17} />,
      className: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  return {
    title: "结算便签已提出，等你盖确认章",
    body: "确认只会新增你自己的盖章记录，不会改账本金额，也不会替对方确认。",
    progressLabel,
    icon: <Hourglass aria-hidden="true" size={17} />,
    className: "border-[#d9c49b] bg-[#fffdf3]"
  };
}

function getSnapshotStatusCopy(status: GetSettlementSnapshotStatusResult["status"]) {
  if (status === "no_snapshot") {
    return {
      label: "还没盖章",
      icon: <FilePenLine aria-hidden="true" size={15} />,
      className: "border-[#d9c49b] bg-[#fffdf3] text-[#8a7556]"
    };
  }

  if (status === "proposed") {
    return {
      label: "已提出",
      icon: <Hourglass aria-hidden="true" size={15} />,
      className: "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]"
    };
  }

  if (status === "partially_confirmed") {
    return {
      label: "部分确认",
      icon: <BadgeCheck aria-hidden="true" size={15} />,
      className: "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]"
    };
  }

  if (status === "fully_confirmed") {
    return {
      label: "两人确认",
      icon: <CheckCircle2 aria-hidden="true" size={15} />,
      className: "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]"
    };
  }

  return {
    label: "暂时读不到",
    icon: <AlertCircle aria-hidden="true" size={15} />,
    className: "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]"
  };
}

function getProposalReadinessCopy({
  status,
  includedExpenseCount,
  canPropose
}: {
  status: SettlementCalculationResult["status"];
  includedExpenseCount: number;
  canPropose: boolean;
}) {
  if (canPropose) {
    return {
      title: "可以提出本月结算便签",
      body: "当前实时计算已经给出明确转账建议。提出后会保存一张不可变快照，后续账本变化不会偷偷改写它。"
    };
  }

  if (includedExpenseCount === 0) {
    return {
      title: "这个月还没有要盖章的支出",
      body: "等本月有真实支出和分摊行后，小岛账本会先给出实时结算建议。"
    };
  }

  if (status === "no_settlement_needed") {
    return {
      title: "这个月已经平衡啦",
      body: "当前没有需要互相转的金额，所以先不鼓励创建空结算便签。"
    };
  }

  if (status === "incomplete") {
    return {
      title: "分摊数据待完善",
      body: "有些账单的分摊行还没对齐，等实时计算准备好后再提出便签。"
    };
  }

  return {
    title: "结算规则还在待办夹",
    body: "当前状态还不能生成 V1 双人结算便签，先保留实时预览。"
  };
}

function getSnapshotJson(value: unknown): SettlementSnapshotJson | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<SettlementSnapshotJson>;

  if (!snapshot.month || !Array.isArray(snapshot.memberBalances)) {
    return null;
  }

  return snapshot as SettlementSnapshotJson;
}

function getSnapshotMemberNameMap(
  members: SettlementSummaryMember[],
  snapshotJson: SettlementSnapshotJson | null
) {
  const map = new Map(members.map((member) => [member.userId, member.displayName]));

  snapshotJson?.memberBalances.forEach((balance) => {
    if (!map.has(balance.userId)) {
      map.set(balance.userId, balance.displayName);
    }
  });

  return map;
}

function formatSnapshotTransfer(snapshot: SettlementSnapshotRow, memberNameMap: Map<string, string>) {
  const transferAmountCents = toCents(snapshot.transfer_amount_cents);

  if (
    !transferAmountCents ||
    transferAmountCents <= 0 ||
    !snapshot.transfer_from_user_id ||
    !snapshot.transfer_to_user_id
  ) {
    return "这张便签记录为无需转账。";
  }

  const fromName = memberNameMap.get(snapshot.transfer_from_user_id) ?? "小岛成员";
  const toName = memberNameMap.get(snapshot.transfer_to_user_id) ?? "小岛成员";

  return `${fromName} 给 ${toName} ${formatCentsCurrency(transferAmountCents)}`;
}

function formatCentsCurrency(amount: number | string) {
  const cents = toCents(amount);

  if (cents === null) {
    return "¥--";
  }

  const sign = cents < 0 ? "-" : "";
  const absoluteCents = Math.abs(cents);
  const yuan = Math.floor(absoluteCents / 100);
  const centPart = String(absoluteCents % 100).padStart(2, "0");

  return `${sign}¥${yuan}.${centPart}`;
}

function formatSignedCentsCurrency(amount: number | string) {
  return formatCentsCurrency(amount);
}

function toCents(amount: number | string | null | undefined) {
  if (amount === null || amount === undefined) {
    return null;
  }

  const value = typeof amount === "string" ? Number(amount) : amount;

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getNoTransferCopy(status: SettlementCalculationResult["status"]) {
  if (status === "incomplete") {
    return {
      title: "分摊数据待完善",
      body: "有些账单的分摊行还没对齐，所以先不展示确定的转账建议。"
    };
  }

  if (status === "unsupported_member_count") {
    return {
      title: "多人结算先放进待办夹",
      body: "当前 helper 已算出每个人的净额，但多人转账简化规则需要单独设计。"
    };
  }

  return {
    title: "这个月已经平衡啦",
    body: "没有需要互相转的金额，账本纸条已经安静贴好。"
  };
}

function formatNetLabel(amount: string) {
  const value = Number(amount);

  if (!Number.isFinite(value) || value === 0) {
    return "已平衡";
  }

  return value > 0 ? "应收" : "应付";
}

function formatCurrency(amount: string) {
  return `¥${amount}`;
}

function formatSignedCurrency(amount: string) {
  return amount.startsWith("-") ? `-¥${amount.slice(1)}` : `¥${amount}`;
}

function formatRangeLabel(range: SettlementMonthMetadata) {
  return `${range.monthStart} 至 ${range.nextMonthStart}`;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
