"use client";

import type { MouseEvent, ReactNode } from "react";
import { useIslandTransition } from "./IslandTransitionProvider";

type IslandLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
};

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function IslandLink({ href, children, className, ariaLabel }: IslandLinkProps) {
  const { startIslandTransition, isTransitioning } = useIslandTransition();

  return (
    <a
      href={href}
      aria-label={ariaLabel}
      aria-disabled={isTransitioning}
      className={className}
      onClick={(event) => {
        if (event.defaultPrevented || isModifiedClick(event)) return;

        event.preventDefault();
        startIslandTransition(href);
      }}
    >
      {children}
    </a>
  );
}
