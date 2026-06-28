"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const feedbackSelector =
  'a[href], button, [role="button"], input[type="button"], input[type="submit"]';

function shouldIgnoreClick(event: MouseEvent, element: Element) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return true;
  }

  if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
    return element.disabled;
  }

  if (element instanceof HTMLAnchorElement) {
    return Boolean(element.target || element.download || element.getAttribute("aria-disabled") === "true");
  }

  return element.getAttribute("aria-disabled") === "true";
}

export function InteractionFeedback() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false);
  }, [pathname]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const interactive = target.closest(feedbackSelector);
      if (!interactive || shouldIgnoreClick(event, interactive)) {
        return;
      }

      setActive(true);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => setActive(false), 1800);
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[80] h-1 overflow-hidden bg-transparent transition-opacity duration-150 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-full w-full origin-left animate-pulse bg-[#19c8b9] shadow-[0_0_18px_rgba(25,200,185,0.65)]" />
    </div>
  );
}
