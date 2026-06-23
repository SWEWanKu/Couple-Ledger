import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  NotebookTabs,
  ReceiptText,
  ShieldCheck,
  Stamp,
  UsersRound,
  WalletCards
} from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import type { SettlementSnapshotJson } from "@/lib/settlement/build-settlement-snapshot-payload";
import type { SettlementSnapshotRow } from "@/lib/settlement/create-settlement-snapshot";
import {
  getSettlementSnapshotDetail,
  type SettlementSnapshotDetail
} from "@/lib/settlement/get-settlement-snapshot-detail";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "结算便签详情 | 小岛账本"
};

type SettlementSnapshotDetailPageProps = {
  params: Promise<{
    snapshotId: string;
  }>;
};

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

export default async function SettlementSnapshotDetailPage({
  params
}: SettlementSnapshotDetailPageProps) {
  const { snapshotId } = await params;
  const { supabase, user, membership } = await requireHouseholdAccess();
  const { summary: householdSummary, warning: householdWarning } =
    await getDashboardHouseholdSummary(supabase, {
      householdId: membership.household_id,
      currentUserId: user.id
    });
  const detailResult = await getSettlementSnapshotDetail(supabase, {
    householdId: membership.household_id,
    snapshotId,
    currentUserId: user.id
  });

  if (detailResult.status === "unauthenticated") {
    redirect("/login");
  }

  if (detailResult.status === "not_found") {
    return (
      <AppShell
        title={`${householdSummary.householdName} 结算便签`}
        subtitle="这张归档便签没有在当前小岛里找到。"
      >
        <div className="mx-auto grid max-w-5xl gap-6">
          <DetailNav />
          {householdWarning ? <PageNotice message={householdWarning} tone="warning" /> : null}
          <NotFoundState />
        </div>
      </AppShell>
    );
  }

  if (detailResult.status === "error") {
    return (
      <AppShell
        title={`${householdSummary.householdName} 结算便签`}
        subtitle="这张归档便签暂时没有读完整。"
      >
        <div className="mx-auto grid max-w-5xl gap-6">
          <DetailNav />
          {householdWarning ? <PageNotice message={householdWarning} tone="warning" /> : null}
          <PageNotice
            message="结算便签详情暂时读不到。实时结算和历史归档仍然安全，这里没有任何写入动作。"
            tone="error"
          />
        </div>
      </AppShell>
    );
  }

  const detail = detailResult.detail;

  return (
    <AppShell
      title={`${householdSummary.householdName} 结算便签`}
      subtitle="只读查看当时保存下来的结算快照、金额纸条和确认章。"
    >
      <div className="mx-auto grid max-w-6xl gap-6">
        <DetailNav monthKey={detail.monthKey} />

        {householdWarning ? <PageNotice message={householdWarning} tone="warning" /> : null}

        <SnapshotHero detail={detail} householdName={householdSummary.householdName} />

        <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <MemberArchiveCard detail={detail} />
          <ConfirmationArchiveCard detail={detail} />
        </section>

        <ArchiveReadOnlyNote detail={detail} />
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

function DetailNav({ monthKey }: { monthKey?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <IslandLink
        href="/settlement/history"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        返回结算归档
      </IslandLink>

      <div className="flex flex-wrap items-center gap-3">
        {monthKey ? (
          <IslandLink
            href={`/settlement?month=${monthKey}`}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
          >
            <WalletCards aria-hidden="true" size={17} />
            打开当月结算页
          </IslandLink>
        ) : null}
        <span className="inline-flex min-h-10 items-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-2 text-xs font-black text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
          <ShieldCheck aria-hidden="true" size={16} />
          归档只读 · 不改账本
        </span>
      </div>
    </div>
  );
}

function SnapshotHero({
  detail,
  householdName
}: {
  detail: SettlementSnapshotDetail;
  householdName: string;
}) {
  const statusCopy = getStatusCopy(detail);
  const transferText = formatSnapshotTransfer(detail);

  return (
    <Card color="default" pattern="app-teal" className="relative overflow-visible p-5 sm:p-7">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-10 h-7 w-24 -rotate-2 rounded-[10px] bg-[#82d5bb]/70 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#fff1a8]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-stretch">
        <div className="min-w-0">
          <p className="inline-flex max-w-full items-center gap-2 rounded-full border-2 border-[#d9c49b] bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#8a7556] shadow-[0_5px_0_rgba(121,79,39,0.1)]">
            <Icon name="icon-diy" size={22} bounce />
            <span className="truncate">Archived Snapshot</span>
          </p>

          <div className="mt-5">
            <span className="hidden sm:inline-block">
              <Title size="large" color="app-yellow">
                {detail.monthLabel} 结算便签
              </Title>
            </span>
            <span className="inline-block sm:hidden">
              <Title size="middle" color="app-yellow">
                {detail.monthLabel} 便签
              </Title>
            </span>
          </div>

          <p className="mt-5 max-w-3xl text-base font-bold leading-8 text-[#725d42] sm:text-lg">
            这是一张已经留下来的结算快照。页面显示的是当时保存下来的金额，不重新计算实时账本，也不会提出或确认新的结算。
          </p>

          <Divider type="wave-yellow" className="my-6" />

          <div className="flex flex-wrap gap-3">
            <InfoPill icon={<CalendarDays aria-hidden="true" size={16} />} label={detail.monthKey} />
            <InfoPill icon={<UsersRound aria-hidden="true" size={16} />} label={`${detail.memberCount} 位岛民`} />
            <InfoPill icon={<Icon name="icon-map" size={18} bounce />} label={householdName} />
          </div>

          <div className="mt-5 rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fff8da] px-4 py-4 text-sm font-black leading-7 text-[#725d42]">
            <p className="flex items-start gap-2 text-[#794f27]">
              <ArrowRightLeft aria-hidden="true" size={18} className="mt-1 shrink-0 text-[#9f927d]" />
              <span>{transferText}</span>
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs font-black tracking-normal text-[#9f927d]">
              <Stamp aria-hidden="true" size={15} />
              状态：{detail.status} / {detail.confirmationCount}/{detail.memberCount}
            </p>
          </div>
        </div>

        <aside className="relative rounded-[32px] border-2 border-[#d9c49b] bg-[#fffdf3] p-4 shadow-[0_8px_0_rgba(121,79,39,0.1)]">
          <span
            className={`absolute -top-3 right-8 rotate-3 rounded-full border-2 px-4 py-1 text-xs font-black shadow-[0_4px_0_rgba(121,79,39,0.08)] ${statusCopy.className}`}
          >
            {statusCopy.label}
          </span>

          <div className="rounded-[26px] bg-[#82d5bb] px-5 py-5 text-white shadow-[0_6px_0_#5fb89f]">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] opacity-90">
              <ReceiptText aria-hidden="true" size={16} />
              Snapshot Total
            </p>
            <p className="mt-3 text-4xl font-black leading-tight">
              {formatCentsCurrency(detail.snapshot.total_expense_cents)}
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-white/90">
              当时保存下来的本月总支出
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            <AmountTile label="支出笔数" value={`${detail.snapshot.expense_count} 笔`} />
            <AmountTile label="建议转账额" value={formatCentsCurrency(detail.snapshot.transfer_amount_cents)} accent />
            <AmountTile label="提出时间" value={formatDateTime(detail.snapshot.created_at)} />
          </div>
        </aside>
      </div>
    </Card>
  );
}

function MemberArchiveCard({ detail }: { detail: SettlementSnapshotDetail }) {
  const balances = detail.snapshotJson?.memberBalances ?? [];

  return (
    <Card color="default" pattern="app-yellow" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -top-3 left-8 h-7 w-24 -rotate-2 rounded-[10px] bg-[#fff1a8]/80 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            Stored Member Notes
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              成员金额纸条
            </Title>
          </div>
          <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
            这里读的是 snapshot JSON 中保存的 paid / share / net，不会按当前流水重新计算。
          </p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27] shadow-[0_5px_0_#d9a43e]">
          <NotebookTabs aria-hidden="true" size={23} />
        </span>
      </div>

      <Divider type="dashed-brown" className="my-5" />

      {balances.length > 0 ? (
        <div className="grid gap-4">
          {balances.map((balance) => (
            <article
              key={balance.userId}
              className="relative rounded-[28px] border-2 border-[#ead9b8] bg-[#fffdf3] px-5 py-4 shadow-[0_6px_0_rgba(121,79,39,0.08)]"
            >
              <span
                aria-hidden="true"
                className="absolute -top-2 right-7 h-5 w-16 rotate-2 rounded-[8px] bg-[#82d5bb]/55 shadow-[0_3px_0_rgba(121,79,39,0.06)]"
              />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-[#794f27]">{balance.displayName}</p>
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">
                    Archived Balance
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)] ${getNetClass(
                    balance.netAmountCents
                  )}`}
                >
                  {getNetLabel(balance.netAmountCents)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <AmountTile label="已付" value={formatCentsCurrency(balance.paidAmountCents)} />
                <AmountTile label="应担" value={formatCentsCurrency(balance.shareAmountCents)} />
                <AmountTile label="净额" value={formatSignedCentsCurrency(balance.netAmountCents)} accent />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-6 text-sm font-black leading-7 text-[#725d42]">
          这张旧便签的成员金额 JSON 暂时读不完整，只展示表中保存的总额、转账额和确认进度。
        </div>
      )}
    </Card>
  );
}

function ConfirmationArchiveCard({ detail }: { detail: SettlementSnapshotDetail }) {
  const statusCopy = getStatusCopy(detail);

  return (
    <Card color="default" pattern="app-green" className="relative overflow-visible p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            Confirmation Stamps
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              确认盖章
            </Title>
          </div>
          <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
            只展示已经写下来的确认记录；这里没有确认按钮，也不会新增盖章。
          </p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_5px_0_#5fb89f]">
          <Stamp aria-hidden="true" size={23} />
        </span>
      </div>

      <Divider type="dashed-brown" className="my-5" />

      <section className={`rounded-[30px] border-2 border-dashed px-5 py-4 shadow-[0_7px_0_rgba(121,79,39,0.08)] ${statusCopy.panelClassName}`}>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-black tracking-normal text-[#9f927d]">
              {statusCopy.icon}
              {detail.status}
            </p>
            <p className="mt-2 text-xl font-black text-[#794f27]">{statusCopy.title}</p>
            <p className="mt-2 text-sm font-black leading-7 text-[#725d42]">{statusCopy.body}</p>
          </div>
          <div className="rounded-[26px] bg-white/80 px-5 py-4 text-center shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">盖章进度</p>
            <p className="mt-1 text-3xl font-black text-[#794f27]">
              {detail.confirmationCount}/{detail.memberCount}
            </p>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-3">
        {detail.members.map((member) => (
          <div
            key={member.userId}
            className={`flex items-start gap-3 rounded-[24px] px-4 py-3 text-sm font-black leading-6 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.6)] ${
              member.hasConfirmed ? "bg-[#e9fbf4] text-[#1f7a70]" : "bg-[#fff8da] text-[#8a6420]"
            }`}
          >
            {member.hasConfirmed ? (
              <CheckCircle2 aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
            ) : (
              <Clock3 aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
            )}
            <span>
              {member.displayName}
              {member.isCurrentUser ? "（你）" : ""} · {member.hasConfirmed ? "已确认" : "等待确认"}
              {member.confirmedAt ? ` · ${formatDateTime(member.confirmedAt)}` : ""}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ArchiveReadOnlyNote({ detail }: { detail: SettlementSnapshotDetail }) {
  const schemaVersion = detail.snapshotJson?.schemaVersion ?? "unknown";
  const calculationVersion = detail.snapshotJson?.calculationVersion ?? detail.snapshot.calculation_version;

  return (
    <Card type="dashed" color="default" className="relative overflow-visible p-5 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            <FileText aria-hidden="true" size={16} />
            Read Only Memo
          </p>
          <div className="mt-3">
            <Title size="small" color="app-yellow">
              这张便签不会被改写
            </Title>
          </div>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-[#725d42]">
            本页只读取 settlement_snapshots 和 settlement_confirmations。实时结算页可以继续看当前账本，但这张归档便签保留的是当时盖章前后留下来的金额。
          </p>
        </div>
        <div className="grid min-w-[230px] gap-2 rounded-[26px] bg-[#fffdf3] px-4 py-4 text-xs font-black leading-6 text-[#8a7556] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
          <span>schema v{schemaVersion}</span>
          <span>calculation {calculationVersion}</span>
          <span>{formatDateOnly(detail.snapshot.month_start)}</span>
        </div>
      </div>
    </Card>
  );
}

function NotFoundState() {
  return (
    <Card type="dashed" color="default" className="p-6 sm:p-8">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_6px_0_#5fb89f]">
          <Icon name="icon-map" size={34} bounce />
        </span>
        <div className="mt-5">
          <Title size="small" color="app-yellow">
            没找到这张结算便签
          </Title>
        </div>
        <p className="mt-4 text-sm font-bold leading-7 text-[#725d42]">
          它可能不属于当前小岛，或者已经不是可读的归档记录。回到结算归档页再翻一张吧。
        </p>
        <IslandLink
          href="/settlement/history"
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
        >
          <ArrowLeft aria-hidden="true" size={17} />
          返回结算归档
        </IslandLink>
      </div>
    </Card>
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

function getStatusCopy(detail: SettlementSnapshotDetail) {
  const status = detail.status;
  const lifecycleCopy = getDetailLifecycleCopy(detail.lifecycleStatus);
  const confirmationCopy = getDetailConfirmationCopy(status);

  return {
    label: `${lifecycleCopy.raw} · ${status}`,
    title: lifecycleCopy.title,
    body: `${lifecycleCopy.body} ${confirmationCopy.body}`,
    icon: confirmationCopy.icon,
    className: lifecycleCopy.className,
    panelClassName: lifecycleCopy.panelClassName
  };
}

function createMemberNameMap(detail: SettlementSnapshotDetail) {
  const map = new Map<string, string>();

  detail.members.forEach((member) => {
    map.set(member.userId, member.displayName);
  });

  detail.snapshotJson?.memberBalances.forEach((balance) => {
    map.set(balance.userId, balance.displayName);
  });

  return map;
}

function getDetailLifecycleCopy(status: SettlementSnapshotDetail["lifecycleStatus"]) {
  if (status === "pending_replacement") {
    return {
      raw: "pending_replacement",
      title: "新的结算便签草稿，等待两个人确认",
      body: "这张便签还没有替代当前 active 结算便签。",
      className: "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]",
      panelClassName: "border-[#f7cd67] bg-[#fff8da]"
    };
  }

  if (status === "superseded") {
    return {
      raw: "superseded",
      title: "旧结算便签，已被新的便签替代",
      body: "这张旧便签仍然只读保留，方便回看当时确认过的金额。",
      className: "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]",
      panelClassName: "border-[#fc736d] bg-[#fff1ed]"
    };
  }

  return {
    raw: "active",
    title: "当前结算便签",
    body: "这是当前 active 的已保存结算便签。",
    className: "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]",
    panelClassName: "border-[#82d5bb] bg-[#e9fbf4]"
  };
}

function getDetailConfirmationCopy(status: SettlementSnapshotDetail["status"]) {
  if (status === "fully_confirmed") {
    return {
      body: "两个人都已经确认啦。",
      icon: <CheckCircle2 aria-hidden="true" size={15} />
    };
  }

  if (status === "partially_confirmed") {
    return {
      body: "它还差一枚确认章。",
      icon: <BadgeCheck aria-hidden="true" size={15} />
    };
  }

  return {
    body: "它还在等待盖章。",
    icon: <Clock3 aria-hidden="true" size={15} />
  };
}

function formatSnapshotTransfer(detail: SettlementSnapshotDetail) {
  const memberNameMap = createMemberNameMap(detail);
  const suggestion = detail.snapshotJson?.transferSuggestion;

  if (suggestion && suggestion.amountCents > 0) {
    const fromName = memberNameMap.get(suggestion.fromUserId) ?? "小岛成员";
    const toName = memberNameMap.get(suggestion.toUserId) ?? "小岛成员";

    return `${fromName} 给 ${toName} ${formatCentsCurrency(suggestion.amountCents)}`;
  }

  return formatSnapshotTransferFromRow(detail.snapshot, detail.snapshotJson, memberNameMap);
}

function formatSnapshotTransferFromRow(
  snapshot: SettlementSnapshotRow,
  snapshotJson: SettlementSnapshotJson | null,
  memberNameMap: Map<string, string>
) {
  const transferAmountCents = toCents(snapshot.transfer_amount_cents);

  if (
    !transferAmountCents ||
    transferAmountCents <= 0 ||
    !snapshot.transfer_from_user_id ||
    !snapshot.transfer_to_user_id
  ) {
    return snapshotJson?.calculationStatus === "no_settlement_needed"
      ? "这张便签记录为无需转账。"
      : "这张便签没有保存可展示的转账方向。";
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

function getNetLabel(amount: number | string) {
  const cents = toCents(amount);

  if (!cents) {
    return "已平衡";
  }

  return cents > 0 ? "应收" : "应付";
}

function getNetClass(amount: number | string) {
  const cents = toCents(amount);

  if (!cents) {
    return "bg-[#fff8da] text-[#8a6420]";
  }

  return cents > 0 ? "bg-[#e9fbf4] text-[#1f7a70]" : "bg-[#fff1ed] text-[#b14c46]";
}

function formatDateOnly(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${year}.${month}.${day}`;
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
