import { redirect } from "next/navigation";
import { AlertCircle, Clock3, Home, Tags, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/StatCard";
import { dashboardStats, mockDataNotice, pendingBills, recentBills } from "@/lib/dashboard-mock";
import { getDashboardHouseholdSummary } from "@/lib/dashboard/household-summary";
import { createClient } from "@/lib/supabase/server";
import type { DashboardCategory, DashboardHouseholdMember } from "@/types/dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    redirect("/not-invited");
  }

  const { summary: householdSummary, warning: householdSummaryWarning } =
    await getDashboardHouseholdSummary(supabase, {
      householdId: membership.household_id,
      currentUserId: user.id
    });

  return (
    <AppShell
      title={`${householdSummary.householdName} 账本看板`}
      subtitle={`已通过 ${householdSummary.householdName} 成员检查，当前角色：${formatMemberRole(membership.role)}。`}
    >
      <div className="grid gap-6">
        <section className="rounded-md border border-ledger-line bg-ledger-panel px-4 py-3 text-sm text-ledger-muted">
          <div className="flex items-center gap-2">
            <AlertCircle aria-hidden="true" size={17} className="text-ledger-coral" />
            <span>{mockDataNotice}</span>
          </div>
        </section>

        <DashboardHouseholdSummaryCard summary={householdSummary} warning={householdSummaryWarning} />

        <section className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
          {dashboardStats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-md border border-ledger-line bg-ledger-panel p-5 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ledger-ink">待确认账单</h2>
                <p className="mt-1 text-sm text-ledger-muted">Mock/fallback 列表，仅展示状态区域。</p>
              </div>
              <span className="rounded-md bg-ledger-paper px-3 py-1 text-sm font-semibold text-ledger-coral">{pendingBills.length} 条</span>
            </div>

            <div className="mt-5 grid gap-3">
              {pendingBills.map((bill) => (
                <article key={bill.id} className="grid grid-cols-[1fr_auto] gap-4 rounded-md border border-ledger-line bg-ledger-paper p-4">
                  <div>
                    <p className="font-semibold text-ledger-ink">{bill.title}</p>
                    <p className="mt-1 text-sm text-ledger-muted">
                      {bill.payer} · {bill.date}
                    </p>
                  </div>
                  <p className="text-right text-base font-semibold text-ledger-ink">{bill.amount}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-ledger-line bg-ledger-panel p-5 shadow-panel">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ledger-ink">最近账单</h2>
                <p className="mt-1 text-sm text-ledger-muted">后续接入真实账单后替换这里的数据源。</p>
              </div>
              <Clock3 aria-hidden="true" className="text-ledger-teal" size={20} />
            </div>

            <div className="mt-5 overflow-hidden rounded-md border border-ledger-line">
              <div className="grid grid-cols-[1.3fr_0.8fr_0.7fr_0.8fr_0.5fr] bg-ledger-paper px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-ledger-muted">
                <span>项目</span>
                <span>付款人</span>
                <span>归属</span>
                <span className="text-right">金额</span>
                <span className="text-right">日期</span>
              </div>
              {recentBills.map((bill) => (
                <div
                  key={bill.id}
                  className="grid grid-cols-[1.3fr_0.8fr_0.7fr_0.8fr_0.5fr] border-t border-ledger-line px-4 py-3 text-sm text-ledger-ink"
                >
                  <span className="font-medium">{bill.title}</span>
                  <span className="text-ledger-muted">{bill.payer}</span>
                  <span className="text-ledger-muted">{bill.share}</span>
                  <span className="text-right font-semibold">{bill.amount}</span>
                  <span className="text-right text-ledger-muted">{bill.date}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function DashboardHouseholdSummaryCard({
  summary,
  warning
}: {
  summary: Awaited<ReturnType<typeof getDashboardHouseholdSummary>>["summary"];
  warning: string | null;
}) {
  return (
    <section className="rounded-md border border-ledger-line bg-ledger-panel p-5 shadow-panel">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-ledger-teal">小岛资料已连接</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal text-ledger-ink">
            {summary.householdName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ledger-muted">
            账本金额仍使用示例数据，下一步接入真实流水。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
          <SummaryMetric icon={Home} label="共同小岛" value={summary.householdName} />
          <SummaryMetric icon={UsersRound} label="成员" value={`${summary.members.length} 人`} />
          <SummaryMetric icon={Tags} label="分类" value={`${summary.categories.length} 个`} />
        </div>
      </div>

      {warning ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-ledger-line bg-ledger-paper px-4 py-3 text-sm text-ledger-muted">
          <AlertCircle aria-hidden="true" size={17} className="shrink-0 text-ledger-amber" />
          <span>{warning}</span>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-md border border-ledger-line bg-ledger-paper p-4">
          <p className="text-sm font-semibold text-ledger-ink">岛民</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.members.length > 0 ? (
              summary.members.map((member, index) => (
                <span
                  key={member.userId}
                  className="rounded-full border border-ledger-line bg-ledger-panel px-3 py-1 text-xs font-semibold text-ledger-muted"
                >
                  {formatMemberLabel(member, index)}
                </span>
              ))
            ) : (
              <span className="text-sm text-ledger-muted">暂时没有读取到成员资料。</span>
            )}
          </div>
        </div>

        <div className="rounded-md border border-ledger-line bg-ledger-paper p-4">
          <p className="text-sm font-semibold text-ledger-ink">分类</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.categories.length > 0 ? (
              summary.categories.map((category) => (
                <CategoryChip key={category.id} category={category} />
              ))
            ) : (
              <span className="text-sm text-ledger-muted">还没有分类，后续可以再整理小岛账本。</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Home;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-ledger-line bg-ledger-paper p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-ledger-muted">
        <Icon aria-hidden="true" size={17} className="text-ledger-teal" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold tracking-normal text-ledger-ink">{value}</p>
    </div>
  );
}

function CategoryChip({ category }: { category: DashboardCategory }) {
  return (
    <span className="rounded-full border border-ledger-line bg-ledger-panel px-3 py-1 text-xs font-semibold text-ledger-muted">
      {category.icon ? `${category.icon} ` : ""}
      {category.name}
    </span>
  );
}

function formatMemberLabel(member: DashboardHouseholdMember, index: number) {
  const role = formatMemberRole(member.role);
  const name = member.isCurrentUser ? "你" : `成员 ${index + 1}`;

  return `${role} · ${name}`;
}

function formatMemberRole(role: string) {
  return role === "owner" ? "岛主" : "伙伴";
}
