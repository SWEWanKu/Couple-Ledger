import { notFound, redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Clock3,
  Plus,
  ReceiptText,
  Split,
  Tags,
  UserRound,
  WalletCards
} from "lucide-react";
import { Card, Cursor, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import { getRecordDetail, type RecordDetail } from "@/lib/ledger/get-record-detail";
import { createClient } from "@/lib/supabase/server";

type RecordDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

export default async function RecordDetailPage({ params }: RecordDetailPageProps) {
  const { id } = await params;
  const { supabase, user, membership } = await requireHouseholdAccess();
  const { summary, warning: householdWarning } = await getDashboardHouseholdSummary(supabase, {
    householdId: membership.household_id,
    currentUserId: user.id
  });
  const detail = await getRecordDetail(supabase, {
    recordId: id,
    householdId: membership.household_id,
    currentUserId: user.id,
    categories: summary.categories,
    members: summary.members
  });

  if (detail.status === "not_found") {
    notFound();
  }

  if (detail.status === "error") {
    return (
      <Cursor>
        <AppShell title={`${summary.householdName} 账单详情`} subtitle="这张账单暂时没有读完整">
          <div className="mx-auto grid max-w-4xl gap-6">
            <DetailNav />
            <Card color="default" pattern="app-yellow" className="p-5 sm:p-7">
              <PageNotice message={detail.warning} tone="error" />
            </Card>
          </div>
        </AppShell>
      </Cursor>
    );
  }

  const record = detail.record;

  return (
    <Cursor>
      <AppShell
        title={`${summary.householdName} 账单详情`}
        subtitle="只读查看这张小岛流水，不会修改任何账本数据。"
      >
        <div className="mx-auto grid max-w-6xl gap-6">
          <DetailNav />

          <Card color="default" pattern="app-teal" className="p-5 sm:p-7">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
                  Island Receipt
                </p>
                <div className="mt-3">
                  <Title size="large" color="app-yellow" style={{ fontSize: 34 }}>
                    {record.note?.trim() || "未命名账单"}
                  </Title>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 py-2 text-sm font-black text-white shadow-[0_5px_0_rgba(121,79,39,0.14)] ${
                      record.entryType === "income" ? "bg-[#1f9f8f]" : "bg-[#d46a5b]"
                    }`}
                  >
                    {record.entryTypeLabel}
                  </span>
                  <CategoryPill record={record} />
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.7)]">
                    <CalendarDays aria-hidden="true" size={17} className="text-[#9f927d]" />
                    {formatDateOnly(record.occurredOn)}
                  </span>
                </div>
              </div>
              <div className="rounded-[30px] bg-[#fffdf3] px-6 py-5 text-right shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
                  Amount
                </p>
                <p
                  className={`mt-2 text-4xl font-black ${
                    record.entryType === "income" ? "text-[#1f7a70]" : "text-[#d46a5b]"
                  }`}
                >
                  {record.amountLabel}
                </p>
              </div>
            </div>

            <Divider type="wave-yellow" className="my-6" />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <DetailField
                icon={<UserRound aria-hidden="true" size={18} />}
                label="付款人"
                value={record.paidByLabel}
              />
              <DetailField
                icon={<UserRound aria-hidden="true" size={18} />}
                label="创建人"
                value={record.createdByLabel}
              />
              <DetailField
                icon={<Split aria-hidden="true" size={18} />}
                label="分摊方式"
                value={record.splitModeLabel}
              />
              <DetailField
                icon={<Clock3 aria-hidden="true" size={18} />}
                label="创建时间"
                value={formatDateTime(record.createdAt)}
              />
            </div>

            <div className="mt-5 rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-4">
              <p className="flex items-center gap-2 text-sm font-black text-[#794f27]">
                <ReceiptText aria-hidden="true" size={18} className="text-[#9f927d]" />
                备注
              </p>
              <p className="mt-3 text-sm font-bold leading-7 text-[#725d42]">
                {record.note?.trim() || "这张账单没有填写备注。"}
              </p>
            </div>

            {householdWarning ? <PageNotice message={householdWarning} tone="warning" /> : null}
            {detail.warning ? <PageNotice message={detail.warning} tone="warning" /> : null}
          </Card>

          <SplitBreakdown record={record} />
        </div>
      </AppShell>
    </Cursor>
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

function DetailNav() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <IslandLink
        href="/records"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        返回流水
      </IslandLink>
      <IslandLink
        href="/records/new"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
      >
        <Plus aria-hidden="true" size={18} />
        记一笔支出
      </IslandLink>
    </div>
  );
}

function SplitBreakdown({ record }: { record: RecordDetail }) {
  return (
    <Card color="default" pattern="app-yellow" className="p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
            Split Note
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#794f27]">分摊明细</h2>
          <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
            这里只读 `ledger_entry_splits`，用于确认每个人承担的金额。
          </p>
        </div>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_6px_0_#5fb89f]">
          <Split aria-hidden="true" size={27} />
        </span>
      </div>

      <Divider type="dashed-brown" className="my-5" />

      {record.splits.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {record.splits.map((split) => (
            <div
              key={split.userId}
              className="rounded-[26px] bg-[#fffdf3] px-5 py-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]"
            >
              <p className="flex items-center gap-2 text-sm font-black text-[#794f27]">
                <WalletCards aria-hidden="true" size={18} className="text-[#9f927d]" />
                {split.userLabel}
              </p>
              <p className="mt-2 text-2xl font-black text-[#d46a5b]">{split.shareAmountLabel}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-5 text-sm font-black leading-7 text-[#725d42]">
          这张账单还没有可显示的分摊行。不会自动猜测分摊金额。
        </div>
      )}
    </Card>
  );
}

function DetailField({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] bg-[#fffdf3] px-4 py-4 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">
        {icon}
        {label}
      </p>
      <p className="mt-2 break-words text-base font-black text-[#794f27]">{value}</p>
    </div>
  );
}

function CategoryPill({ record }: { record: RecordDetail }) {
  return (
    <span
      className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-black text-[#794f27]"
      style={{
        backgroundColor: record.categoryColor ? `${record.categoryColor}24` : "#ffffff",
        borderColor: record.categoryColor ?? "#d9c49b"
      }}
    >
      {record.categoryIcon ? <span aria-hidden="true">{record.categoryIcon}</span> : null}
      <Tags aria-hidden="true" size={16} className="text-[#9f927d]" />
      <span className="truncate">{record.categoryName}</span>
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
      className={`mt-4 flex items-start gap-3 rounded-[24px] border-2 border-dashed px-4 py-3 text-sm font-black leading-6 ${classes}`}
    >
      <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function formatDateOnly(date: string) {
  const [year, month, day] = date.split("-");

  if (!year || !month || !day) {
    return date;
  }

  return `${year}.${month}.${day}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
