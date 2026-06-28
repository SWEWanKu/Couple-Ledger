"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type IslandLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "children" | "href"
> & {
  href: string;
  children: ReactNode;
  ariaLabel?: string;
  scroll?: boolean;
};

export function IslandLink({
  href,
  children,
  className,
  ariaLabel,
  scroll,
  ...anchorProps
}: IslandLinkProps) {
  const accessibleLabel = ariaLabel ?? anchorProps["aria-label"];

  return (
    <Link {...anchorProps} href={href} prefetch scroll={scroll} aria-label={accessibleLabel} className={className}>
      {children}
    </Link>
  );
}
