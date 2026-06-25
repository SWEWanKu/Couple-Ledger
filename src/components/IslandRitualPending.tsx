"use client";

import { Card, Icon, type IconName } from "animal-island-ui";

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
  iconName = "icon-chat",
  compact = false,
  className = "",
  dataScope
}: IslandRitualPendingProps) {
  return (
    <Card
      color="default"
      pattern="app-teal"
      role="status"
      aria-live="polite"
      className={`relative overflow-hidden border-2 border-dashed border-[#82d5bb] bg-[#fffdf3] ${
        compact ? "p-3" : "p-4"
      } ${className}`}
      data-ritual-loading-card={dataScope ?? "true"}
    >
      <span
        aria-hidden="true"
        className="absolute -right-5 top-4 h-16 w-16 rounded-full bg-[#82d5bb]/28"
      />
      <div className="relative z-10 grid grid-cols-[auto_1fr] items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#82d5bb] shadow-[0_5px_0_#5fb89f]">
          <Icon name={iconName} size={compact ? 24 : 28} bounce />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black leading-6 text-[#1f7a70]">{title}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-[#725d42]">{description}</p>
          <span className="mt-3 flex items-center gap-1.5" aria-hidden="true">
            {[0, 120, 240].map((delay) => (
              <span
                key={delay}
                className="h-2.5 w-2.5 rounded-full border border-white/80 bg-[#19c8b9] shadow-[0_3px_0_rgba(121,79,39,0.18)] motion-safe:animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        </div>
      </div>
    </Card>
  );
}
