import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Coins,
  ReceiptText,
  Save,
  Split,
  StickyNote,
  Tags,
  UserRound
} from "lucide-react";
import { Button, Card, Divider, Icon, Title } from "animal-island-ui";
import { AppShell } from "@/components/layout/AppShell";
import { NotebookEmptyState } from "@/components/NotebookEmptyState";
import { RecordsSettlementAwareness } from "@/components/settlement/RecordsSettlementAwareness";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import { getRecordDetail, type RecordDetail } from "@/lib/ledger/get-record-detail";
import { normalizeRecordsMonth } from "@/lib/ledger/list-records";
import { getUpdateLedgerRecordErrorMessage } from "@/lib/ledger/update-ledger-record";
import { getSettlementSnapshotStatus } from "@/lib/settlement/get-settlement-snapshot-status";
import { createClient } from "@/lib/supabase/server";
import type { DashboardCategory, DashboardHouseholdMember } from "@/types/dashboard";
import { updateLedgerRecordAction } from "./actions";

type EditRecordPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<EditRecordSearchParams>;
};

type EditRecordSearchParams = {
  error?: string | string[];
  month?: string | string[];
  type?: string | string[];
  category?: string | string[];
  member?: string | string[];
  q?: string | string[];
};

type EditReturnContextParams = {
  month: string | null;
  type: "expense" | "income" | null;
  category: string | null;
  member: string | null;
  q: string | null;
};

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

type EditAvailability = {
  canSubmit: boolean;
  state: "ready" | "settled" | "blocked_pending_replacement" | "status_error" | "custom_split";
  heading: string;
  body: string;
  tone: "success" | "warning" | "error";
};

export default async function EditRecordPage({ params, searchParams }: EditRecordPageProps) {
  const { id } = await params;
  const queryParams = searchParams ? await searchParams : {};
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

  const fallbackMonth =
    detail.status === "found" ? getMonthKeyFromDateOnly(detail.record.occurredOn) : null;
  const returnParams = getReturnContextParams(queryParams, fallbackMonth);
  const detailHref = getRecordDetailReturnHref(id, returnParams);

  if (detail.status === "error") {
    return (
      <AppShell title={`${summary.householdName} 修改账单`} subtitle="这张账单暂时没有读完整">
        <div className="mx-auto grid max-w-4xl gap-6">
          <EditNav detailHref={detailHref} listHref={getRecordsReturnHref(returnParams)} />
          <Card color="default" pattern="app-yellow" className="p-5 sm:p-7">
            <FormNotice message={detail.warning} tone="error" />
          </Card>
        </div>
      </AppShell>
    );
  }

  const record = detail.record;
  const recordMonth = getMonthKeyFromDateOnly(record.occurredOn);
  const settlementStatus = await getSettlementSnapshotStatus(supabase, {
    householdId: membership.household_id,
    month: recordMonth
  });
  const availability = getEditAvailability(record, settlementStatus);
  const errorMessage = getUpdateLedgerRecordErrorMessage(getSingleParam(queryParams.error));
  const canEditRecord =
    availability.canSubmit && summary.categories.length > 0 && summary.members.length > 0;

  return (
    <AppShell
      title={`${summary.householdName} 修改账单`}
      subtitle="只改这张小岛流水，不改写已经归档的结算便签"
    >
      <div className="mx-auto grid max-w-6xl gap-6">
        <EditNav detailHref={detailHref} listHref={getRecordsReturnHref(returnParams)} />

        <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <Card
            color="default"
            pattern="app-teal"
            className="relative overflow-visible p-5 sm:p-7"
            data-record-edit-card="true"
          >
            <span
              aria-hidden="true"
              className="absolute -top-3 left-8 h-7 w-28 -rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
            />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
                  Edit Receipt
                </p>
                <div className="mt-3">
                  <Title size="large" color="app-yellow" style={{ fontSize: 34 }}>
                    修改这笔账
                  </Title>
                </div>
                <p className="mt-4 max-w-2xl text-sm font-bold leading-7 text-[#725d42]">
                  把金额、日期、分类、经手人或备注修正好。保存时只会通过小岛的账本 RPC 更新这笔记录和分摊行。
                </p>
              </div>
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_7px_0_#5fb89f]">
                <ReceiptText aria-hidden="true" size={31} />
              </span>
            </div>

            <Divider type="wave-yellow" className="my-6" />

            {householdWarning ? <FormNotice tone="warning" message={householdWarning} /> : null}
            {detail.warning ? <FormNotice tone="warning" message={detail.warning} /> : null}
            {errorMessage ? (
              <FormNotice tone="error" message={errorMessage} dataAttribute="data-record-edit-error" />
            ) : null}
            <AvailabilityNotice availability={availability} />
            <RecordsSettlementAwareness
              statusResult={settlementStatus}
              context="detail"
              className="mt-5"
            />

            {canEditRecord ? (
              <form action={updateLedgerRecordAction} className="mt-5 grid gap-5" data-record-edit-form="true" noValidate>
                <input type="hidden" name="record_id" value={record.id} />
                <ReturnContextHiddenInputs returnParams={returnParams} />

                <fieldset className="rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-4">
                  <legend className="px-2 text-sm font-black text-[#794f27]">账单类型</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={radioCardClassName}>
                      <input
                        type="radio"
                        name="entry_type"
                        value="expense"
                        defaultChecked={record.entryType === "expense"}
                        className="h-4 w-4 accent-[#19c8b9]"
                      />
                      <span>
                        <span className="flex items-center gap-2 font-black text-[#794f27]">
                          <ReceiptText aria-hidden="true" size={17} />
                          支出
                        </span>
                        <span className="mt-1 block text-xs font-bold leading-5 text-[#725d42]">
                          这笔钱从小岛账本里花出去。
                        </span>
                      </span>
                    </label>

                    <label className={radioCardClassName}>
                      <input
                        type="radio"
                        name="entry_type"
                        value="income"
                        defaultChecked={record.entryType === "income"}
                        className="h-4 w-4 accent-[#19c8b9]"
                      />
                      <span>
                        <span className="flex items-center gap-2 font-black text-[#794f27]">
                          <Coins aria-hidden="true" size={17} />
                          收入
                        </span>
                        <span className="mt-1 block text-xs font-bold leading-5 text-[#725d42]">
                          报销、补贴或其他回到小岛的钱。
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>

                <div className="grid gap-5 md:grid-cols-2">
                  <FormField id="record-edit-amount" label="金额" icon={<Coins aria-hidden="true" size={18} />}>
                    <input
                      id="record-edit-amount"
                      name="amount"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      required
                      defaultValue={record.amount.toFixed(2)}
                      className={inputClassName}
                      data-record-edit-amount="true"
                    />
                  </FormField>

                  <FormField id="record-edit-occurred-on" label="日期" icon={<CalendarDays aria-hidden="true" size={18} />}>
                    <input
                      id="record-edit-occurred-on"
                      name="occurred_on"
                      type="date"
                      required
                      defaultValue={record.occurredOn}
                      className={inputClassName}
                      data-record-edit-date="true"
                    />
                  </FormField>

                  <FormField id="record-edit-category" label="分类" icon={<Tags aria-hidden="true" size={18} />}>
                    <select
                      id="record-edit-category"
                      name="category_id"
                      required
                      defaultValue={record.categoryId ?? summary.categories[0]?.id}
                      className={inputClassName}
                      data-record-edit-category="true"
                    >
                      {summary.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {formatCategoryOption(category)}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField id="record-edit-paid-by" label="经手人" icon={<UserRound aria-hidden="true" size={18} />}>
                    <select
                      id="record-edit-paid-by"
                      name="paid_by"
                      required
                      defaultValue={record.paidBy}
                      className={inputClassName}
                      data-record-edit-paid-by="true"
                    >
                      {summary.members.map((member, index) => (
                        <option key={member.userId} value={member.userId}>
                          {formatMemberOption(member, index)}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <fieldset className="rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-4">
                  <legend className="px-2 text-sm font-black text-[#794f27]">分摊方式</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={radioCardClassName}>
                      <input
                        type="radio"
                        name="split_mode"
                        value="equal"
                        defaultChecked={record.splitMode === "equal"}
                        className="h-4 w-4 accent-[#19c8b9]"
                      />
                      <span>
                        <span className="block font-black text-[#794f27]">两人平分</span>
                        <span className="mt-1 block text-xs font-bold leading-5 text-[#725d42]">
                          按当前小岛成员重新生成平分分摊行。
                        </span>
                      </span>
                    </label>

                    <label className={radioCardClassName}>
                      <input
                        type="radio"
                        name="split_mode"
                        value="personal"
                        defaultChecked={record.splitMode === "personal"}
                        className="h-4 w-4 accent-[#19c8b9]"
                      />
                      <span>
                        <span className="block font-black text-[#794f27]">个人承担</span>
                        <span className="mt-1 block text-xs font-bold leading-5 text-[#725d42]">
                          只给经手人生成一条分摊记录。
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>

                <FormField id="record-edit-note" label="备注" icon={<StickyNote aria-hidden="true" size={18} />} optional>
                  <input
                    id="record-edit-note"
                    name="note"
                    type="text"
                    maxLength={80}
                    defaultValue={record.note ?? ""}
                    className={inputClassName}
                    data-record-edit-note="true"
                  />
                </FormField>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-bold leading-6 text-[#9f927d]">
                    保存后不会改写旧结算便签；若金额影响结算，实时结算会在下次打开时自然更新。
                  </p>
                  <Button
                    type="primary"
                    size="large"
                    htmlType="submit"
                    icon={<Save aria-hidden="true" size={18} />}
                    data-record-edit-submit="true"
                  >
                    保存修改
                  </Button>
                </div>
              </form>
            ) : (
              <BlockedEditState
                availability={availability}
                hasCategories={summary.categories.length > 0}
                hasMembers={summary.members.length > 0}
              />
            )}
          </Card>

          <aside className="grid content-start gap-5">
            <Card color="default" pattern="app-yellow" className="p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
                Original Note
              </p>
              <div className="mt-3">
                <Title size="small" color="app-yellow" style={{ fontSize: 18 }}>
                  当前账单快照
                </Title>
              </div>
              <Divider type="dashed-brown" className="my-4" />
              <div className="grid gap-3">
                <MiniMetric label="当前金额" value={record.amountLabel} />
                <MiniMetric label="当前日期" value={formatDateOnly(record.occurredOn)} />
                <MiniMetric label="当前分类" value={record.categoryName} />
                <MiniMetric label="当前经手" value={record.paidByLabel} />
                <MiniMetric label="当前分摊" value={record.splitModeLabel} />
              </div>
            </Card>

            <Card type="dashed" color="default" className="p-5">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
                <Icon name="icon-diy" size={18} bounce />
                RPC Only
              </p>
              <p className="mt-3 text-sm font-bold leading-7 text-[#725d42]">
                这张修改便签只提交给 `update_ledger_record_v1`，由数据库一次性更新账单和分摊行。
              </p>
            </Card>
          </aside>
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

function EditNav({ detailHref, listHref }: { detailHref: string; listHref: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link
        href={detailHref}
        data-record-edit-return-detail="true"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
      >
        <ArrowLeft aria-hidden="true" size={17} />
        返回账单详情
      </Link>
      <Link
        href={listHref}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#f7cd67] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_#d9a43e] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#d9a43e] focus:outline-none focus:ring-4 focus:ring-[#f7cd67]/35"
      >
        返回账本列表
      </Link>
    </div>
  );
}

function AvailabilityNotice({ availability }: { availability: EditAvailability }) {
  if (availability.state === "ready") {
    return null;
  }

  return (
    <FormNotice
      tone={availability.tone}
      message={`${availability.heading} ${availability.body}`}
      dataAttribute={
        availability.state === "blocked_pending_replacement"
          ? "data-record-edit-pending-block"
          : availability.state === "settled"
            ? "data-record-edit-settled-warning"
            : "data-record-edit-blocked"
      }
    />
  );
}

function BlockedEditState({
  availability,
  hasCategories,
  hasMembers
}: {
  availability: EditAvailability;
  hasCategories: boolean;
  hasMembers: boolean;
}) {
  const setupMessage =
    hasCategories && hasMembers
      ? availability.body
      : "还没有读到完整的小岛成员或分类，先不保存修改。";

  return (
    <NotebookEmptyState
      className="mt-5"
      dataAttributes={{ "data-record-edit-blocked-state": availability.state }}
      description={setupMessage}
      eyebrow="Edit Memo"
      iconName="icon-diy"
      title={availability.heading}
      tone={availability.tone === "error" ? "red" : "yellow"}
    />
  );
}

function ReturnContextHiddenInputs({ returnParams }: { returnParams: EditReturnContextParams }) {
  return (
    <>
      {returnParams.month ? <input type="hidden" name="return_month" value={returnParams.month} /> : null}
      {returnParams.type ? <input type="hidden" name="return_type" value={returnParams.type} /> : null}
      {returnParams.category ? <input type="hidden" name="return_category" value={returnParams.category} /> : null}
      {returnParams.member ? <input type="hidden" name="return_member" value={returnParams.member} /> : null}
      {returnParams.q ? <input type="hidden" name="return_q" value={returnParams.q} /> : null}
    </>
  );
}

function FormField({
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

function FormNotice({
  tone,
  message,
  dataAttribute
}: {
  tone: "success" | "warning" | "error";
  message: string;
  dataAttribute?: string;
}) {
  const classes = {
    success: "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]",
    warning: "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]",
    error: "border-[#fc736d] bg-[#fff1ed] text-[#b14c46]"
  };
  const dataProps = dataAttribute ? { [dataAttribute]: "true" } : {};

  return (
    <div
      {...dataProps}
      role={tone === "error" ? "alert" : "status"}
      className={`mt-4 flex items-start gap-3 rounded-[24px] border-2 border-dashed px-4 py-3 text-sm font-black leading-6 ${classes[tone]}`}
    >
      <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-[#fffdf3] px-4 py-3 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.7)]">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">{label}</p>
      <p className="mt-1 break-words text-base font-black text-[#794f27]">{value}</p>
    </div>
  );
}

function getEditAvailability(
  record: RecordDetail,
  statusResult: Awaited<ReturnType<typeof getSettlementSnapshotStatus>>
): EditAvailability {
  if (record.splitMode === "custom") {
    return {
      canSubmit: false,
      state: "custom_split",
      heading: "这笔账是自定义分摊",
      body: "V1 修改便签只支持两人平分和个人承担；自定义分摊要等后续单独设计。",
      tone: "warning"
    };
  }

  if (statusResult.pendingReplacement) {
    return {
      canSubmit: false,
      state: "blocked_pending_replacement",
      heading: "这个月正在重新对齐结算便签",
      body: "先处理完新的结算便签再改账，避免旧便签和新便签一起变得不稳。",
      tone: "warning"
    };
  }

  if (statusResult.status === "error") {
    return {
      canSubmit: false,
      state: "status_error",
      heading: "结算状态暂时没有读完整",
      body: "为了避免误操作，先不保存修改；等小岛重新读到结算状态后再回来。",
      tone: "warning"
    };
  }

  if (statusResult.snapshot) {
    return {
      canSubmit: true,
      state: "settled",
      heading: "这笔账所在月份已经留下结算便签",
      body: "修改后不会改写旧便签，实时结算可能会变成新的结果，之后可以用新的结算便签重新对齐。",
      tone: "error"
    };
  }

  return {
    canSubmit: true,
    state: "ready",
    heading: "可以修改这笔账",
    body: "保存后会重新生成这笔账的分摊行。",
    tone: "success"
  };
}

function getReturnContextParams(
  params: EditRecordSearchParams,
  fallbackMonth: string | null
): EditReturnContextParams {
  return {
    month: normalizeRecordsMonth(getSingleParam(params.month)) ?? fallbackMonth,
    type: normalizeReturnType(getSingleParam(params.type)),
    category: normalizeReturnText(getSingleParam(params.category), 120),
    member: normalizeReturnText(getSingleParam(params.member), 120),
    q: normalizeReturnText(getSingleParam(params.q), 80)
  };
}

function getRecordDetailReturnHref(recordId: string, returnParams: EditReturnContextParams) {
  const query = getReturnContextQuery(returnParams);
  const queryString = query.toString();

  return queryString ? `/records/${recordId}?${queryString}` : `/records/${recordId}`;
}

function getRecordsReturnHref(returnParams: EditReturnContextParams) {
  const query = getReturnContextQuery(returnParams);
  const queryString = query.toString();

  return queryString ? `/records?${queryString}` : "/records";
}

function getReturnContextQuery(returnParams: EditReturnContextParams) {
  const query = new URLSearchParams();

  if (returnParams.month) {
    query.set("month", returnParams.month);
  }

  if (returnParams.type) {
    query.set("type", returnParams.type);
  }

  if (returnParams.category) {
    query.set("category", returnParams.category);
  }

  if (returnParams.member) {
    query.set("member", returnParams.member);
  }

  if (returnParams.q) {
    query.set("q", returnParams.q);
  }

  return query;
}

function formatCategoryOption(category: DashboardCategory) {
  return `${category.icon ? `${category.icon} ` : ""}${category.name}`;
}

function formatMemberOption(member: DashboardHouseholdMember, index: number) {
  const name = member.isCurrentUser ? "你" : `成员 ${index + 1}`;
  const role = member.role === "owner" ? "岛主" : "伙伴";

  return `${role} · ${name}`;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeReturnType(value: string | null) {
  return value === "expense" || value === "income" ? value : null;
}

function normalizeReturnText(value: string | null, maxLength: number) {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function getMonthKeyFromDateOnly(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : null;
}

function formatDateOnly(date: string) {
  const [year, month, day] = date.split("-");

  if (!year || !month || !day) {
    return date;
  }

  return `${year}.${month}.${day}`;
}

const inputClassName =
  "h-14 w-full rounded-full border-2 border-[#d9c49b] bg-[#fffdf3] px-4 text-sm font-black text-[#794f27] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.5),0_5px_0_rgba(121,79,39,0.08)] outline-none transition placeholder:text-[#9f927d]/70 focus:border-[#19c8b9] focus:ring-4 focus:ring-[#19c8b9]/25";

const radioCardClassName =
  "grid cursor-pointer grid-cols-[auto_1fr] gap-3 rounded-[22px] bg-white/75 px-4 py-3 shadow-[0_4px_0_rgba(121,79,39,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(121,79,39,0.08)]";
