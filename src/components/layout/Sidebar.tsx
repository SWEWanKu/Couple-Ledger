import Link from "next/link";
import { HeartHandshake, Home, LayoutDashboard, LogIn, PlusCircle, ReceiptText } from "lucide-react";

const navItems = [
  { href: "/", label: "首页", icon: Home },
  { href: "/dashboard", label: "共同看板", icon: LayoutDashboard },
  { href: "/records", label: "流水记录", icon: ReceiptText },
  { href: "/records/new", label: "记一笔账", icon: PlusCircle },
  { href: "/login", label: "登录", icon: LogIn }
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-ledger-line bg-ledger-ink text-white lg:flex lg:min-h-screen lg:flex-col">
      <div className="border-b border-white/10 px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ledger-teal text-white">
            <HeartHandshake aria-hidden="true" size={22} />
          </span>
          <span>
            <span className="block text-base font-semibold tracking-normal">小岛账本</span>
            <span className="mt-1 block text-xs text-white/58">只给两个人的小岛流水</span>
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-4 py-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-white/74 transition hover:bg-white/10 hover:text-white"
            >
              <Icon aria-hidden="true" size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="m-4 rounded-md border border-white/12 bg-white/[0.06] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/48">Status</p>
        <p className="mt-2 text-sm text-white/78">Supabase Auth/RLS 已接入，页面按当前小岛读取账本数据。</p>
      </div>
    </aside>
  );
}
