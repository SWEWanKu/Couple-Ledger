import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Coins,
  ReceiptText,
  Split,
  Tags,
  UserRound
} from "lucide-react";
import { Button, Card, Cursor, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import { AppShell } from "@/components/layout/AppShell";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import {
  createRecord,
  getCreateRecordErrorMessage,
  type RecordCategoryOption,
  type RecordMemberOption
} from "@/lib/ledger/create-record";
import { createClient } from "@/lib/supabase/server";
import type { DashboardCategory, DashboardHouseholdMember } from "@/types/dashboard";

type NewRecordPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
  }>;
};

type HouseholdMembershipRow = {
  household_id: string;
  role: string;
};

export default async function NewRecordPage({ searchParams }: NewRecordPageProps) {
  const params = searchParams ? await searchParams : {};
  const errorMessage = getCreateRecordErrorMessage(getSingleParam(params.error));
  const { supabase, user, membership } = await requireHouseholdAccess();
  const { summary, warning } = await getDashboardHouseholdSummary(supabase, {
    householdId: membership.household_id,
    currentUserId: user.id
  });
  const today = getTodayDateOnly();
  const canCreateRecord = summary.categories.length > 0 && summary.members.length > 0;

  return (
    <Cursor>
      <AppShell title={`${summary.householdName} 记一笔账`} subtitle="把今天的小岛流水记下来">
        <div className="mx-auto grid max-w-6xl gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <IslandLink
              href="/dashboard"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d9c49b] bg-white px-4 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              <ArrowLeft aria-hidden="true" size={17} />
              回到看板
            </IslandLink>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#e6f6ee] px-4 py-2 text-sm font-black text-[#2f7a5a] shadow-[0_4px_0_rgba(47,122,90,0.12)]">
              <Icon name="icon-map" size={22} bounce />
              支出 / 收入
            </span>
          </div>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card color="default" pattern="app-teal" className="p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
                    Island Receipt
                  </p>
                  <div className="mt-3">
                    <Title size="large" color="app-yellow" style={{ fontSize: 34 }}>
                      记一笔账
                    </Title>
                  </div>
                  <p className="mt-4 max-w-2xl text-sm font-bold leading-7 text-[#725d42]">
                    把今天的小岛流水记下来。现在可以记录支出和收入，先保持等分和个人承担这两种分摊方式。
                  </p>
                </div>
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_7px_0_#5fb89f]">
                  <ReceiptText aria-hidden="true" size={31} />
                </span>
              </div>

              <Divider type="wave-yellow" className="my-6" />

              {warning ? <FormNotice tone="warning" message={warning} /> : null}
              {errorMessage ? <FormNotice tone="error" message={errorMessage} /> : null}

              {canCreateRecord ? (
                <form action={saveRecordAction} className="mt-5 grid gap-5" noValidate>
                  <fieldset className="rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] p-4">
                    <legend className="px-2 text-sm font-black text-[#794f27]">账单类型</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className={radioCardClassName}>
                        <input
                          type="radio"
                          name="entry_type"
                          value="expense"
                          defaultChecked
                          className="h-4 w-4 accent-[#19c8b9]"
                        />
                        <span>
                          <span className="flex items-center gap-2 font-black text-[#794f27]">
                            <ReceiptText aria-hidden="true" size={17} />
                            支出
                          </span>
                          <span className="mt-1 block text-xs font-bold leading-5 text-[#725d42]">
                            吃饭、通勤、日常小花费，记成从账本里流出去的钱。
                          </span>
                        </span>
                      </label>

                      <label className={radioCardClassName}>
                        <input
                          type="radio"
                          name="entry_type"
                          value="income"
                          className="h-4 w-4 accent-[#19c8b9]"
                        />
                        <span>
                          <span className="flex items-center gap-2 font-black text-[#794f27]">
                            <Coins aria-hidden="true" size={17} />
                            收入
                          </span>
                          <span className="mt-1 block text-xs font-bold leading-5 text-[#725d42]">
                            报销、补贴、礼金或其他进账，记成回到小岛的钱。
                          </span>
                        </span>
                      </label>
                    </div>
                  </fieldset>

                  <div className="grid gap-5 md:grid-cols-2">
                    <FormField
                      id="record-amount"
                      label="金额"
                      icon={<Coins aria-hidden="true" size={18} />}
                    >
                      <input
                        id="record-amount"
                        name="amount"
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        required
                        placeholder="66.00"
                        className={inputClassName}
                      />
                    </FormField>

                    <FormField
                      id="record-occurred-on"
                      label="日期"
                      icon={<CalendarDays aria-hidden="true" size={18} />}
                    >
                      <input
                        id="record-occurred-on"
                        name="occurred_on"
                        type="date"
                        required
                        defaultValue={today}
                        className={inputClassName}
                      />
                    </FormField>

                    <FormField
                      id="record-category"
                      label="分类"
                      icon={<Tags aria-hidden="true" size={18} />}
                    >
                      <select
                        id="record-category"
                        name="category_id"
                        required
                        defaultValue={summary.categories[0]?.id}
                        className={inputClassName}
                      >
                        {summary.categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {formatCategoryOption(category)}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField
                      id="record-paid-by"
                      label="经手人"
                      icon={<UserRound aria-hidden="true" size={18} />}
                    >
                      <select
                        id="record-paid-by"
                        name="paid_by"
                        required
                        defaultValue={getDefaultPaidBy(summary.members, user.id)}
                        className={inputClassName}
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
                          defaultChecked
                          className="h-4 w-4 accent-[#19c8b9]"
                        />
                        <span>
                          <span className="block font-black text-[#794f27]">两人平分</span>
                          <span className="mt-1 block text-xs font-bold leading-5 text-[#725d42]">
                            金额按成员顺序拆分，最后一位补齐分差。
                          </span>
                        </span>
                      </label>

                      <label className={radioCardClassName}>
                        <input
                          type="radio"
                          name="split_mode"
                          value="personal"
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

                  <FormField id="record-note" label="备注" optional>
                    <input
                      id="record-note"
                      name="note"
                      type="text"
                      maxLength={80}
                      placeholder="手动测试收入"
                      className={inputClassName}
                    />
                  </FormField>

                  <Button type="primary" size="large" htmlType="submit" block>
                    保存这笔记录
                  </Button>
                </form>
              ) : (
                <BlockedSetupState
                  hasCategories={summary.categories.length > 0}
                  hasMembers={summary.members.length > 0}
                />
              )}
            </Card>

            <aside className="grid content-start gap-5">
              <Card color="default" pattern="app-yellow" className="p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f7cd67] text-[#794f27] shadow-[0_5px_0_#d9a43e]">
                    <Split aria-hidden="true" size={24} />
                  </span>
                  <div>
                    <Title size="small" color="app-yellow" style={{ fontSize: 18 }}>
                      写入规则
                    </Title>
                    <p className="mt-2 text-sm font-bold leading-7 text-[#725d42]">
                      先保存主账单，再保存分摊行；如果分摊失败，会尝试撤回刚写入的主账单。
                    </p>
                  </div>
                </div>
              </Card>

              <Card type="dashed" color="default" className="p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
                  Current Island
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Icon name="icon-map" size={24} bounce />
                  <h2 className="text-2xl font-black text-[#794f27]">{summary.householdName}</h2>
                </div>
                <Divider type="dashed-brown" className="my-4" />
                <div className="mt-4 grid gap-3">
                  <MiniMetric label="成员" value={`${summary.members.length} 人`} />
                  <MiniMetric label="分类" value={`${summary.categories.length} 个`} />
                  <MiniMetric label="可记类型" value="支出 / 收入" />
                </div>
              </Card>
            </aside>
          </section>
        </div>
      </AppShell>
    </Cursor>
  );
}

async function saveRecordAction(formData: FormData) {
  "use server";

  const { supabase, user, membership } = await requireHouseholdAccess();
  const { summary } = await getDashboardHouseholdSummary(supabase, {
    householdId: membership.household_id,
    currentUserId: user.id
  });
  const result = await createRecord(
    supabase,
    {
      householdId: membership.household_id,
      currentUserId: user.id,
      categories: summary.categories.map<RecordCategoryOption>((category) => ({
        id: category.id
      })),
      members: summary.members.map<RecordMemberOption>((member) => ({
        userId: member.userId
      }))
    },
    formData
  );

  if (!result.ok) {
    redirect(`/records/new?error=${result.errorCode}`);
  }

  redirect("/dashboard");
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

function FormField({
  id,
  label,
  icon,
  optional,
  children
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
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

function FormNotice({ tone, message }: { tone: "warning" | "error"; message: string }) {
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

function BlockedSetupState({
  hasCategories,
  hasMembers
}: {
  hasCategories: boolean;
  hasMembers: boolean;
}) {
  return (
    <div className="mt-5 rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-6 text-sm font-bold leading-7 text-[#725d42]">
      <p className="text-lg font-black text-[#794f27]">暂时还不能记账</p>
      <p className="mt-2">
        {hasMembers ? "小岛成员已经准备好。" : "还没有读取到小岛成员。"}
        {hasCategories ? " 分类已经准备好。" : " 还没有读取到分类。"}
      </p>
      <p className="mt-2">等成员和分类都准备好后，再回来记录第一笔账。</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-[#fffdf3] px-4 py-3 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.7)]">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">{label}</p>
      <p className="mt-1 text-lg font-black text-[#794f27]">{value}</p>
    </div>
  );
}

function formatCategoryOption(category: DashboardCategory) {
  return `${category.icon ? `${category.icon} ` : ""}${category.name}`;
}

function formatMemberOption(member: DashboardHouseholdMember, index: number) {
  const name = member.isCurrentUser ? "你" : `成员 ${index + 1}`;
  const role = member.role === "owner" ? "岛主" : "伙伴";

  return `${role} · ${name}`;
}

function getDefaultPaidBy(members: DashboardHouseholdMember[], currentUserId: string) {
  return members.some((member) => member.userId === currentUserId)
    ? currentUserId
    : members[0]?.userId;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getTodayDateOnly() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const inputClassName =
  "h-14 w-full rounded-full border-2 border-[#d9c49b] bg-[#fffdf3] px-4 text-sm font-black text-[#794f27] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.5),0_5px_0_rgba(121,79,39,0.08)] outline-none transition placeholder:text-[#9f927d]/70 focus:border-[#19c8b9] focus:ring-4 focus:ring-[#19c8b9]/25";

const radioCardClassName =
  "grid cursor-pointer grid-cols-[auto_1fr] gap-3 rounded-[22px] bg-white/75 px-4 py-3 shadow-[0_4px_0_rgba(121,79,39,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(121,79,39,0.08)]";
