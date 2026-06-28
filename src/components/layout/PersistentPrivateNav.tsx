"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "animal-island-ui";

type NavKey = "home" | "records" | "imports" | "settlement" | "monthly";

const privatePaths = ["/dashboard", "/records", "/imports", "/settlement", "/reports/monthly"] as const;

const navItems: Array<{
  key: NavKey;
  href: string;
  label: string;
  iconName: IconName;
}> = [
  { key: "home", href: "/dashboard", label: "小岛首页", iconName: "icon-map" },
  { key: "records", href: "/records", label: "账本", iconName: "icon-critterpedia" },
  { key: "imports", href: "/imports", label: "共同对账", iconName: "icon-chat" },
  { key: "settlement", href: "/settlement", label: "结算", iconName: "icon-diy" },
  { key: "monthly", href: "/reports/monthly", label: "月报", iconName: "icon-camera" }
];

export function PersistentPrivateNav() {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = getActiveKey(pathname);
  const [optimisticKey, setOptimisticKey] = useState<NavKey | null>(activeKey);

  useEffect(() => {
    setOptimisticKey(activeKey);
  }, [activeKey]);

  const month = useMemo(() => getMonthKey(new Date()), []);

  useEffect(() => {
    navItems.forEach((item) => router.prefetch(getHref(item.href, month)));
  }, [month, router]);

  if (!activeKey) {
    return null;
  }

  const selectedKey = optimisticKey ?? activeKey;

  return (
    <>
      <div aria-hidden="true" className="h-[118px] sm:h-[96px]" />
      <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-3">
        <nav
          aria-label="小岛手账页面导航"
          className="flex max-w-[min(100%,760px)] flex-wrap justify-center gap-2 rounded-[28px] border-2 border-[#d9c49b] bg-[#fffdf3]/95 p-2 shadow-[0_10px_0_rgba(121,79,39,0.12),0_18px_40px_rgba(121,79,39,0.16)] backdrop-blur"
        >
          {navItems.map((item) => {
            const selected = item.key === selectedKey;
            const href = getHref(item.href, month);

            return (
              <a
                key={item.key}
                href={href}
                aria-current={selected ? "page" : undefined}
                onClick={(event) => navigate(event, item.key, href)}
                className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-black shadow-[0_4px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25 sm:min-h-11 sm:px-4 sm:text-sm ${
                  selected
                    ? "border-[#5fb89f] bg-[#82d5bb] text-white"
                    : "border-[#d9c49b] bg-white text-[#794f27] hover:bg-[#e9fbf4]"
                }`}
                data-persistent-private-nav={item.key}
              >
                <Icon name={item.iconName} size={17} bounce />
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>
    </>
  );

  function navigate(event: MouseEvent<HTMLAnchorElement>, key: NavKey, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }

    event.preventDefault();
    setOptimisticKey(key);
    router.push(href);
  }
}

function getActiveKey(pathname: string): NavKey | null {
  if (!privatePaths.some((path) => pathname === path)) {
    return null;
  }

  if (pathname === "/reports/monthly") {
    return "monthly";
  }

  if (pathname === "/dashboard") {
    return "home";
  }

  return pathname.slice(1) as NavKey;
}

function getHref(baseHref: string, month: string) {
  if (baseHref === "/settlement" || baseHref === "/reports/monthly") {
    return `${baseHref}?month=${month}`;
  }

  return baseHref;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
