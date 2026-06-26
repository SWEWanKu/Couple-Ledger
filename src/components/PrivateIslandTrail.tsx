import type { ReactNode } from "react";
import { Icon } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";

export type PrivateIslandTrailItem = {
  label: ReactNode;
  href?: string | null;
  current?: boolean;
};

export type PrivateIslandTrailProps = {
  items: PrivateIslandTrailItem[];
  className?: string;
};

export const islandTrailLabels = {
  home: "\u5c0f\u5c9b\u9996\u9875",
  records: "\u8d26\u672c",
  newRecord: "\u8bb0\u4e00\u7b14",
  recordDetail: "\u8d26\u5355\u4fbf\u7b7e",
  editRecord: "\u4fee\u6539\u8d26\u5355",
  settlement: "\u7ed3\u7b97",
  settlementHistory: "\u7ed3\u7b97\u624b\u8d26",
  settlementNote: "\u7ed3\u7b97\u4fbf\u7b7e",
  monthlyReport: "\u6708\u62a5"
} as const;

export function PrivateIslandTrail({ items, className = "" }: PrivateIslandTrailProps) {
  return (
    <nav
      aria-label="\u5c0f\u5c9b\u8def\u6807"
      data-private-island-trail="true"
      className={`relative overflow-visible rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-3 py-2 shadow-[0_4px_0_rgba(121,79,39,0.08)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute -top-2 left-8 h-5 w-16 -rotate-2 rounded-[8px] bg-[#82d5bb]/55 shadow-[0_3px_0_rgba(121,79,39,0.08)]"
      />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <p className="hidden shrink-0 items-center gap-2 px-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d] sm:flex">
          <Icon name="icon-map" size={18} bounce />
          <span>{"\u4f60\u5728\u5c0f\u5c9b\u7684\u54ea\u91cc"}</span>
        </p>
        <ol className="flex min-w-0 flex-wrap items-center gap-2">
          {items.map((item, index) => (
            <li key={index} className="flex min-w-0 items-center gap-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-sm font-black text-[#d9c49b]">
                  /
                </span>
              ) : null}
              <TrailItem item={item} />
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

function TrailItem({ item }: { item: PrivateIslandTrailItem }) {
  const className =
    "inline-flex min-h-8 max-w-full items-center justify-center rounded-full px-3 py-1 text-xs font-black shadow-[0_2px_0_rgba(121,79,39,0.1)] transition focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25";
  const label = <span className="truncate">{item.label}</span>;

  if (item.current || !isSafeInternalHref(item.href)) {
    return (
      <span
        aria-current={item.current ? "page" : undefined}
        data-private-island-trail-current={item.current ? "true" : undefined}
        data-private-island-trail-item="true"
        className={`${className} bg-[#f7cd67] text-[#794f27] shadow-[0_3px_0_#d9a43e]`}
      >
        {label}
      </span>
    );
  }

  return (
    <IslandLink
      href={item.href}
      data-private-island-trail-link="true"
      data-private-island-trail-item="true"
      className={`${className} bg-white text-[#794f27] hover:-translate-y-0.5 hover:bg-[#e9fbf4]`}
    >
      {label}
    </IslandLink>
  );
}

function isSafeInternalHref(href: string | null | undefined): href is string {
  return Boolean(href && href.startsWith("/") && !href.startsWith("//"));
}
