import Link from "next/link";
import { ArrowRight, Cloud, Monitor, WalletCards } from "lucide-react";

const pillars = [
  {
    title: "电脑端优先",
    body: "左侧导航、顶部栏和主内容区先成型，适合后续扩展账单流。"
  },
  {
    title: "上云预留",
    body: "仅保留 Supabase 环境变量入口，本轮不连接真实数据库。"
  },
  {
    title: "范围克制",
    body: "先跑通骨架，不实现新增、确认、结算、图表或导出。"
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-ledger-paper text-ledger-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <nav className="flex items-center justify-between border-b border-ledger-line pb-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ledger-ink text-white">
              <WalletCards aria-hidden="true" size={21} />
            </span>
            <span className="text-base font-semibold">Couple Ledger</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden rounded-md border border-ledger-line px-4 py-2 text-sm font-medium text-ledger-muted transition hover:border-ledger-teal hover:text-ledger-teal sm:inline-flex"
            >
              查看看板
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md bg-ledger-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#17665e]"
            >
              登录入口
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-md border border-ledger-line bg-ledger-panel px-3 py-2 text-sm font-medium text-ledger-muted">
              <Cloud aria-hidden="true" size={16} />
              已登录跳转逻辑预留，当前未强制实现
            </p>
            <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-tight tracking-normal text-ledger-ink">
              情侣共同账本的最小可运行骨架
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-ledger-muted">
              先把产品入口、登录占位和电脑端看板搭起来。页面中的账单和金额都是 mock/fallback 数据，后续再替换为 Supabase 数据流。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-md bg-ledger-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#121820]"
              >
                进入登录页
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-md border border-ledger-line bg-ledger-panel px-5 py-3 text-sm font-semibold text-ledger-ink transition hover:border-ledger-teal hover:text-ledger-teal"
              >
                查看 mock 看板
                <Monitor aria-hidden="true" size={17} />
              </Link>
            </div>
          </div>

          <div className="rounded-md border border-ledger-line bg-ledger-panel p-6 shadow-panel">
            <div className="grid gap-4">
              {pillars.map((pillar, index) => (
                <div key={pillar.title} className="grid grid-cols-[44px_1fr] gap-4 rounded-md border border-ledger-line bg-ledger-paper p-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white text-sm font-semibold text-ledger-teal">
                    0{index + 1}
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-ledger-ink">{pillar.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-ledger-muted">{pillar.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
