import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Hourglass,
  ReceiptText,
  Stamp,
  UsersRound,
  WalletCards
} from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { NotebookEmptyState } from "@/components/NotebookEmptyState";
import { PrivateIslandTrail, islandTrailLabels } from "@/components/PrivateIslandTrail";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import type { SettlementSnapshotJson } from "@/lib/settlement/build-settlement-snapshot-payload";
import type { SettlementSnapshotRow } from "@/lib/settlement/create-settlement-snapshot";
import {
  getSettlementHistory,
  type GetSettlementHistoryResult,
  type SettlementHistoryItem,
  type SettlementHistoryStatus
} from "@/lib/settlement/get-settlement-history";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "结算手账归档 | 小岛账本"
};

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

export default async function SettlementHistoryPage() {
  const { supabase, user, membership } = await requireHouseholdAccess();
  const { summary: householdSummary, warning: householdWarning } =
    await getDashboardHouseholdSummary(supabase, {
      householdId: membership.household_id,
      currentUserId: user.id
    });
  const history = await getSettlementHistory(supabase, {
    householdId: membership.household_id,
    currentUserId: user.id
  });

  if (history.status === "unauthenticated") {
    redirect("/login");
  }

  return (
    <AppShell
      title={`${householdSummary.householdName} 结算归档`}
      subtitle="只读翻阅已经留下的结算便签，不会提出、确认或改写任何账本。"
    >
      <div className="mx-auto grid max-w-6xl gap-6">
        <PrivateIslandTrail
          items={[
            { label: islandTrailLabels.home, href: "/dashboard" },
            { label: islandTrailLabels.records, href: "/records" },
            { label: islandTrailLabels.settlement, href: "/settlement" },
            { label: islandTrailLabels.settlementHistory, current: true },
            { label: islandTrailLabels.monthlyReport, href: "/reports/monthly" }
          ]}
        />

        <HistoryNav />

        <Card color="default" pattern="app-teal" className="relative overflow-visible p-5 sm:p-7">
          <span
            aria-hidden="true"
            className="absolute -top-3 left-10 h-7 w-24 -rotate-2 rounded-[10px] bg-[#82d5bb]/70 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#fff1a8]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-stretch">
            <div className="min-w-0">
              <p className="inline-flex max-w-full items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
                <Icon name="icon-diy" size={22} bounce />
                <span className="truncate">结算归档</span>
              </p>

              <div className="mt-5">
                <span className="hidden sm:inline-block">
                  <Title size="large" color="app-yellow">
                    结算手账归档
                  </Title>
                </span>
                <span className="inline-block sm:hidden">
                  <Title size="middle" color="app-yellow">
                    结算手账归档
                  </Title>
                </span>
              </div>

              <p className="mt-5 max-w-3xl text-base font-bold leading-8 text-[#725d42] sm:text-lg">
                这里像一本结算便签册，只翻看已经保存过的月份和两个人的确认章。没有盖章按钮，也不会触发真实转账。
              </p>

              <Divider type="wave-yellow" className="my-6" />

              <div className="flex flex-wrap gap-3">
                <InfoPill icon={<Archive aria-hidden="true" size={16} />} label={`${getHistoryCount(history)} 张便签`} />
                <InfoPill icon={<UsersRound aria-hidden="true" size={16} />} label={`${history.memberCount} 位岛民`} />
                <InfoPill icon={<Icon name="icon-map" size={18} bounce />} label={householdSummary.householdName} />
              </div>
            </div>

            <aside className="relative rounded-[32px] border-2 border-[#d9c49b] bg-[#fffdf3] p-4 shadow-[0_8px_0_rgba(121,79,39,0.1)]">
              <span className="absolute -top-3 right-8 rotate-3 rounded-full border-2 border-[#d9c49b] bg-[#fff1ed] px-4 py-1 text-xs font-black text-[#9b6c48] shadow-[0_4px_0_rgba(121,79,39,0.08)]">
                只读
              </span>

              <div className="rounded-[26px] bg-[#82d5bb] px-5 py-5 text-white shadow-[0_6px_0_#5fb89f]">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] opacity-90">
                  <FileText aria-hidden="true" size={16} />
                  归档便签
                </p>
                <p className="mt-3 text-3xl font-black leading-tight">
                  {getHistoryCount(history)} 张
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-white/90">
                  已保存的结算快照
                </p>
              </div>

              <div className="mt-4 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fff8da] px-4 py-3 text-sm font-bold leading-7 text-[#725d42]">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
                  归档说明
                </p>
                <p className="mt-1">这里仅用于回看旧便签，本页没有新的确认操作。</p>
              </div>
            </aside>
          </div>
        </Card>

        {householdWarning ? <PageNotice message={householdWarning} tone="warning" /> : null}
        {history.status === "error" ? (
          <PageNotice
            message="结算归档暂时读不到，可能是 settlement 表还没准备好或当前会话没有读取权限。"
            tone="warning"
          />
        ) : null}

        {history.status === "ok" && history.items.length > 0 ? (
          <HistoryList items={history.items} />
        ) : history.status === "ok" ? (
          <EmptyHistoryState />
        ) : null}
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

function HistoryNav() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <IslandLink
        href="/settlement"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        回到结算页
      </IslandLink>
      <span className="inline-flex min-h-10 items-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-2 text-xs font-black text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
        <ReceiptText aria-hidden="true" size={16} />
        历史只读 · 不盖新章
      </span>
    </div>
  );
}

function HistoryList({ items }: { items: SettlementHistoryItem[] }) {
  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">
        <span className="inline-flex items-center gap-2">
          <Icon name="icon-chat" size={18} bounce />
          结算便签
        </span>
        <span className="inline-flex items-center gap-2">
          <Icon name="icon-shopping" size={18} bounce />
          月份 / 金额 / 确认章
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {items.map((item) => (
          <HistoryCard key={item.snapshot.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function HistoryCard({ item }: { item: SettlementHistoryItem }) {
  const statusCopy = getStatusCopy(item);
  const memberNameMap = getSnapshotMemberNameMap(item.snapshotJson);

  return (
    <article className="relative rounded-[32px] border-2 border-[#d9c49b] bg-[#fffdf3] p-5 shadow-[0_8px_0_rgba(121,79,39,0.08)]">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-8 h-7 w-24 -rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
            <CalendarDays aria-hidden="true" size={16} />
            {item.monthKey}
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#794f27]">{item.monthLabel}</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">
            提出时间：{formatDateTime(item.snapshot.created_at)}
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

      <div className="grid gap-3 sm:grid-cols-3">
        <AmountTile label="总支出" value={formatCentsCurrency(item.snapshot.total_expense_cents)} />
        <AmountTile label="支出笔数" value={`${item.snapshot.expense_count} 笔`} />
        <AmountTile label="确认进度" value={`${item.confirmationCount}/${item.memberCount}`} accent />
      </div>

      <div className="mt-4 rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fff8da] px-4 py-4 text-sm font-black leading-7 text-[#725d42]">
        <p className="flex items-start gap-2 text-[#794f27]">
          <ArrowRightLeft aria-hidden="true" size={18} className="mt-1 shrink-0 text-[#9f927d]" />
          <span>{formatSnapshotTransfer(item.snapshot, item.snapshotJson, memberNameMap)}</span>
        </p>
        <p className="mt-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">
          <Stamp aria-hidden="true" size={15} />
          {statusCopy.memo}
        </p>
      </div>

      {item.snapshotJson?.memberBalances.length ? (
        <div className="mt-4 grid gap-3">
          {item.snapshotJson.memberBalances.map((balance) => (
            <div
              key={balance.userId}
              className="rounded-[24px] bg-white px-4 py-3 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-[#794f27]">{balance.displayName}</p>
                <p className="rounded-full bg-[#fff8da] px-3 py-1 text-xs font-black text-[#8a6420]">
                  净额 {formatSignedCentsCurrency(balance.netAmountCents)}
                </p>
              </div>
              <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">
                已付 {formatCentsCurrency(balance.paidAmountCents)} · 应担{" "}
                {formatCentsCurrency(balance.shareAmountCents)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-white px-4 py-3 text-sm font-black leading-6 text-[#725d42]">
          这张旧便签的明细暂时读不完整，只展示已保存的总额和确认进度。
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <IslandLink
          href={`/settlement/history/${item.snapshot.id}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#82d5bb] px-5 py-2 text-sm font-black text-white shadow-[0_5px_0_#5fb89f] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#5fb89f] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          <FileText aria-hidden="true" size={17} />
          打开这张结算便签
        </IslandLink>
        <IslandLink
          href={`/settlement?month=${item.monthKey}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
        >
          <WalletCards aria-hidden="true" size={17} />
          查看当月实时结算
        </IslandLink>
      </div>
    </article>
  );
}

function EmptyHistoryState() {
  return (
    <NotebookEmptyState
      action={{
        href: "/settlement",
        label: "回到结算页",
        icon: <ArrowLeft aria-hidden="true" size={17} />
      }}
      dataAttributes={{ "data-settlement-history-empty-state": "true" }}
      description="等某个月在结算页提出过便签后，这里会像手账归档一样，把每个月的总支出、转账建议和盖章进度贴出来。"
      eyebrow="归档便签"
      iconName="icon-chat"
      title="还没有留下结算便签"
      tone="teal"
    />
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

function getStatusCopy(item: SettlementHistoryItem) {
  const lifecycleCopy = getLifecycleHistoryCopy(item.lifecycleStatus);
  const confirmationCopy = getHistoryConfirmationCopy(item);

  return {
    label: `${lifecycleCopy.raw} · ${item.status}`,
    memo: `${lifecycleCopy.memo} · ${confirmationCopy.memo}`,
    icon: confirmationCopy.icon,
    className: lifecycleCopy.className
  };
}

function getHistoryCount(history: GetSettlementHistoryResult) {
  return history.status === "ok" ? history.items.length : 0;
}

function getLifecycleHistoryCopy(status: SettlementHistoryItem["lifecycleStatus"]) {
  if (status === "pending_replacement") {
    return {
      raw: "待确认新版",
      memo: "新的结算便签草稿，等待两个人确认",
      className: "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]"
    };
  }

  if (status === "superseded") {
    return {
      raw: "已归档",
      memo: "旧结算便签，已被新的便签替代",
      className: "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]"
    };
  }

  return {
    raw: "当前",
    memo: "当前结算便签",
    className: "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]"
  };
}

function getHistoryConfirmationCopy(item: SettlementHistoryItem) {
  if (item.status === "fully_confirmed") {
    return {
      memo: "两个人都确认啦",
      icon: <CheckCircle2 aria-hidden="true" size={15} />
    };
  }

  if (item.currentUserConfirmed) {
    return {
      memo: "你已确认，等对方盖章",
      icon: <BadgeCheck aria-hidden="true" size={15} />
    };
  }

  if (item.status === "partially_confirmed") {
    return {
      memo: "等待你盖章",
      icon: <Hourglass aria-hidden="true" size={15} />
    };
  }

  return {
    memo: "等待盖章",
    icon: <Clock3 aria-hidden="true" size={15} />
  };
}

function getSnapshotMemberNameMap(snapshotJson: SettlementSnapshotJson | null) {
  const map = new Map<string, string>();

  snapshotJson?.memberBalances.forEach((balance) => {
    map.set(balance.userId, balance.displayName);
  });

  return map;
}

function formatSnapshotTransfer(
  snapshot: SettlementSnapshotRow,
  snapshotJson: SettlementSnapshotJson | null,
  memberNameMap: Map<string, string>
) {
  const suggestion = snapshotJson?.transferSuggestion;

  if (suggestion && suggestion.amountCents > 0) {
    const fromName = memberNameMap.get(suggestion.fromUserId) ?? "小岛成员";
    const toName = memberNameMap.get(suggestion.toUserId) ?? "小岛成员";

    return `${fromName} 给 ${toName} ${formatCentsCurrency(suggestion.amountCents)}`;
  }

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
