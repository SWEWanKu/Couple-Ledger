"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useIslandTransition } from "./IslandTransitionProvider";

type IslandLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "children" | "href"
> & {
  href: string;
  children: ReactNode;
  ariaLabel?: string;
};

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function IslandLink({
  href,
  children,
  className,
  ariaLabel,
  onClick,
  ...anchorProps
}: IslandLinkProps) {
  const { startIslandTransition, isTransitioning } = useIslandTransition();
  const accessibleLabel = ariaLabel ?? anchorProps["aria-label"];

  return (
    <a
      {...anchorProps}
      href={href}
      aria-label={accessibleLabel}
      aria-disabled={isTransitioning}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || isModifiedClick(event)) return;

        event.preventDefault();
        startIslandTransition(href);
      }}
    >
      {children}
    </a>
  );
}
