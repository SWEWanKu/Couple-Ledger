import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ledger-paper px-6 py-10 text-ledger-ink">
      <section className="w-full max-w-md rounded-md border border-ledger-line bg-ledger-panel p-7 shadow-panel">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-ledger-muted transition hover:text-ledger-teal">
          <ArrowLeft aria-hidden="true" size={16} />
          返回首页
        </Link>

        <div className="mt-8">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-ledger-teal text-white">
            <ShieldCheck aria-hidden="true" size={21} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-normal text-ledger-ink">登录 Couple Ledger</h1>
          <p className="mt-2 text-sm leading-6 text-ledger-muted">
            邮箱登录表单已预留。本轮不接 Supabase Auth，也不提交真实请求。
          </p>
        </div>

        <form className="mt-7 grid gap-4" aria-label="预留邮箱登录表单">
          <label className="grid gap-2 text-sm font-medium text-ledger-ink">
            邮箱
            <span className="relative">
              <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ledger-muted" size={17} />
              <input
                type="email"
                placeholder="you@example.com"
                className="h-11 w-full rounded-md border border-ledger-line bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-ledger-muted/60 focus:border-ledger-teal focus:ring-2 focus:ring-ledger-teal/15"
              />
            </span>
          </label>

          <button
            type="button"
            className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-ledger-ink px-4 text-sm font-semibold text-white transition hover:bg-[#121820]"
          >
            发送登录链接（预留）
          </button>
        </form>

        <p className="mt-5 rounded-md border border-ledger-line bg-ledger-paper px-3 py-2 text-xs leading-5 text-ledger-muted">
          Mock/fallback：这里不会读取 `.env`，也不会调用 Supabase。真实认证将在后续迭代接入。
        </p>
      </section>
    </main>
  );
}
