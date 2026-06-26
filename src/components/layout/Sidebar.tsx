import Link from "next/link";
import { HeartHandshake, Home, LayoutDashboard, LogIn, PlusCircle, ReceiptText } from "lucide-react";
import { Icon } from "animal-island-ui";

const navItems = [
  { href: "/", label: "首页", icon: Home, paper: "bg-[#fffdf3]" },
  { href: "/dashboard", label: "共同看板", icon: LayoutDashboard, paper: "bg-[#e9fbf4]" },
  { href: "/records", label: "流水记录", icon: ReceiptText, paper: "bg-[#fff8da]" },
  { href: "/records/new", label: "记一笔账", icon: PlusCircle, paper: "bg-[#ffe9df]" },
  { href: "/login", label: "登录", icon: LogIn, paper: "bg-[#eef3ff]" }
];

export function Sidebar() {
  return (
    <aside className="relative z-20 lg:pt-16">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-[28px] border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-3 shadow-[0_8px_0_rgba(121,79,39,0.09)] lg:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] text-white shadow-[0_5px_0_#5fb89f]">
            <HeartHandshake aria-hidden="true" size={21} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-black text-[#794f27]">小岛账本</span>
            <span className="mt-0.5 block truncate text-xs font-bold text-[#9f927d]">
              只给两个人的小岛流水
            </span>
          </span>
        </Link>
        <Icon name="icon-map" size={28} bounce />
      </div>

      <nav
        aria-label="小岛账本导航"
        className="mb-3 flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-6 lg:mb-0 lg:-mr-8 lg:flex-col lg:overflow-visible lg:pb-0"
      >
        <p className="hidden px-2 text-xs font-black uppercase tracking-[0.16em] text-[#8a7556] lg:block">
          手账标签
        </p>
        {navItems.map((item, index) => {
          const NavIcon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${item.paper} group relative flex min-h-11 shrink-0 items-center gap-2 rounded-[22px] border-2 border-[#d9c49b] px-3 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25 lg:min-h-[58px] lg:w-[150px] lg:rounded-l-[26px] lg:rounded-r-[14px] lg:pr-8 lg:hover:translate-x-1 lg:hover:translate-y-0`}
              style={{ transform: `rotate(${index % 2 === 0 ? "-1.4deg" : "1.2deg"})` }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#1f7a70] shadow-[inset_0_0_0_2px_rgba(217,196,155,0.6)]">
                <NavIcon aria-hidden="true" size={17} />
              </span>
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hidden rounded-[26px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-4 py-4 text-sm font-bold leading-6 text-[#725d42] shadow-[0_8px_0_rgba(121,79,39,0.08)] lg:block">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
          <Icon name="icon-chat" size={18} bounce />
          便签
        </p>
        <p className="mt-2">这里像一本只给小岛成员翻看的手账，页面会按当前小岛读取账本数据。</p>
      </div>
    </aside>
  );
}
