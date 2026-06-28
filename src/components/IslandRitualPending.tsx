"use client";

import { Loading, type IconName } from "animal-island-ui";

type IslandRitualPendingProps = {
  title: string;
  description: string;
  iconName?: IconName;
  compact?: boolean;
  className?: string;
  dataScope?: string;
};

export function IslandRitualPending({
  title,
  description,
  iconName: _iconName = "icon-chat",
  compact: _compact = false,
  className: _className = "",
  dataScope
}: IslandRitualPendingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-island-ritual-pending={dataScope}
      className="fixed inset-0 z-[100] grid place-items-center bg-[#7DC395]/95 px-6 text-center text-[#794f27]"
    >
      <Loading active className="absolute inset-0" />
      <div className="relative z-10 max-w-sm rounded-[30px] border-2 border-dashed border-[#d9c49b] bg-[#f7f3df]/90 px-6 py-5 shadow-[0_12px_0_rgba(121,79,39,0.12)]">
        <p className="text-lg font-black">{title}</p>
        <p className="mt-2 text-sm font-bold leading-6 text-[#725d42]">{description}</p>
      </div>
    </div>
  );
}
