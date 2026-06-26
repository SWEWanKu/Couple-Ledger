"use client";

import type { IconName } from "animal-island-ui";

type IslandRitualPendingProps = {
  title: string;
  description: string;
  iconName?: IconName;
  compact?: boolean;
  className?: string;
  dataScope?: string;
};

export function IslandRitualPending({
  title: _title,
  description: _description,
  iconName: _iconName = "icon-chat",
  compact: _compact = false,
  className: _className = "",
  dataScope: _dataScope
}: IslandRitualPendingProps) {
  return null;
}
