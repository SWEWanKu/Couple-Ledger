import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  NotebookTabs,
  ReceiptText,
  ShieldCheck,
  WalletCards
} from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
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
  }>;
};

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

export default async function SettlementPage({ searchParams }: SettlementPageProps) {
  const params = searchParams ? await searchParams : {};
  const selectedMonth = getSingleParam(params.month);
  const { supabase, user, membership } = await requireHouseholdAccess();
  const { summary: householdSummary, warning: householdWarning } =
    await getDashboardHouseholdSummary(supabase, {
      householdId: membership.household_id,
      currentUserId: user.id
    });
  const { summary: settlementSummary, warning: settlementWarning } = await getSettlementSummary(
    supabase,
    {
      householdId: membership.household_id,
      currentUserId: user.id,
      month: selectedMonth
    }
  );
  const range = settlementSummary.month;

  return (
    <AppShell
      title={`${householdSummary.householdName} 小岛结算`}
      subtitle="只读整理这个月谁垫付、谁承担，以及账本给出的轻量转账建议。"
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
            只读结算便签
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
                这张手账页只读取已经写进账本的支出和分摊行，不猜测分摊，也不会写入任何结清状态。
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
                <p className="mt-1">通过结算 helper 读取成员、月度支出和分摊行。</p>
              </div>
            </aside>
          </div>
        </Card>

        {householdWarning ? <PageNotice message={householdWarning} tone="warning" /> : null}
        {settlementWarning ? <PageNotice message={settlementWarning} tone="warning" /> : null}

        <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <MemberBalanceSection
            members={settlementSummary.members}
            balances={settlementSummary.calculation.memberBalances}
          />
          <TransferSuggestionCard calculation={settlementSummary.calculation} />
        </section>
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
  tone: "warning" | "error";
}) {
  const classes =
    tone === "error"
      ? "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]"
      : "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-[24px] border-2 border-dashed px-4 py-3 text-sm font-black leading-6 ${classes}`}
    >
      <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
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
