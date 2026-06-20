import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, Clock3, LockKeyhole } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/StatCard";
import { dashboardStats, mockDataNotice, pendingBills, recentBills } from "@/lib/dashboard-mock";
import { createClient } from "@/lib/supabase/server";

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
    return <DashboardBlockedState />;
  }

  return (
    <AppShell title="共同账本看板" subtitle={`已通过 99岛 成员检查，当前角色：${membership.role}。`}>
      <div className="grid gap-6">
        <section className="rounded-md border border-ledger-line bg-ledger-panel px-4 py-3 text-sm text-ledger-muted">
          <div className="flex items-center gap-2">
            <AlertCircle aria-hidden="true" size={17} className="text-ledger-coral" />
            <span>{mockDataNotice}</span>
          </div>
        </section>

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

function DashboardBlockedState() {
  return (
    <AppShell title="共同账本看板" subtitle="需要先成为共同小岛成员，才能查看看板。">
      <section className="rounded-md border border-ledger-line bg-ledger-panel p-6 shadow-panel">
        <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-ledger-line bg-ledger-paper text-ledger-teal shadow-panel">
            <LockKeyhole aria-hidden="true" size={30} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ledger-teal">Island Notice</p>
            <h1 className="mt-2 text-2xl font-bold text-ledger-ink">还没有登上共同小岛</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ledger-muted">
              这个账号还没有被加入 99岛，请确认邮箱是否正确，或让管理员完成初始化。
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-md bg-ledger-teal px-4 py-2 text-sm font-semibold text-white shadow-panel transition hover:-translate-y-0.5"
          >
            返回登录页
          </Link>
          <Link
            href="/"
            className="rounded-md border border-ledger-line bg-ledger-paper px-4 py-2 text-sm font-semibold text-ledger-ink transition hover:-translate-y-0.5"
          >
            回到首页
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
