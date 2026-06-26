"use client";

import { Children, type ReactNode, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MousePointerClick } from "lucide-react";
import { Card } from "animal-island-ui";
import { ImportReviewKeyboardShortcuts } from "./ImportReviewKeyboardShortcuts";

export type ImportReviewLocalWorkspaceItem = {
  id: string;
  href: string;
  label: string;
  canSkip: boolean;
  canMarkNeedDiscussion: boolean;
  canFocusCommonExpense: boolean;
  canSubmitConfirm: boolean;
  confirmFormId: string;
  skipFormId: string;
  needDiscussionFormId: string;
};

type ImportReviewLocalWorkspaceProps = {
  children: ReactNode;
  initialIndex: number;
  items: ImportReviewLocalWorkspaceItem[];
};

export function ImportReviewLocalWorkspace({
  children,
  initialIndex,
  items
}: ImportReviewLocalWorkspaceProps) {
  const cards = Children.toArray(children);
  const safeInitialIndex = getSafeIndex(initialIndex, items.length);
  const [selectedIndex, setSelectedIndex] = useState(safeInitialIndex);
  const current = items[selectedIndex] ?? null;
  const previous = selectedIndex > 0 ? items[selectedIndex - 1] ?? null : null;
  const next = selectedIndex + 1 < items.length ? items[selectedIndex + 1] ?? null : null;
  const visibleCard = useMemo(() => cards[selectedIndex] ?? null, [cards, selectedIndex]);

  useEffect(() => {
    setSelectedIndex(getSafeIndex(initialIndex, items.length));
  }, [initialIndex, items.length]);

  useEffect(() => {
    const position = document.querySelector("[data-import-review-position]");

    if (position && current) {
      position.textContent = `${selectedIndex + 1}/${items.length}`;
      position.setAttribute("data-import-review-position", `${selectedIndex + 1}/${items.length}`);
    }
  }, [current, items.length, selectedIndex]);

  function selectItem(index: number) {
    const target = items[index];

    if (!target) {
      return;
    }

    const beforeTop = getCardTop();
    setSelectedIndex(index);
    window.history.pushState(null, "", target.href);

    window.requestAnimationFrame(() => {
      restoreCardTop(beforeTop);
      window.requestAnimationFrame(() => {
        restoreCardTop(beforeTop);
      });
    });
  }

  function selectPrevious() {
    if (previous) {
      selectItem(selectedIndex - 1);
    }
  }

  function selectNext() {
    if (next) {
      selectItem(selectedIndex + 1);
    }
  }

  if (!current || !visibleCard) {
    return <>{visibleCard}</>;
  }

  return (
    <div data-import-review-local-workspace="true">
      <div id="import-review-card" data-import-review-local-card={current.id}>
        {visibleCard}
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <LocalCardNavigator
          next={next}
          onNext={selectNext}
          onPrevious={selectPrevious}
          previous={previous}
        />
        <ImportReviewKeyboardShortcuts
          canFocusCommonExpense={current.canFocusCommonExpense}
          canMarkNeedDiscussion={current.canMarkNeedDiscussion}
          canSkip={current.canSkip}
          canSubmitConfirm={current.canSubmitConfirm}
          commonExpenseAreaId={current.confirmFormId}
          confirmFormId={current.confirmFormId}
          needDiscussionFormId={current.needDiscussionFormId}
          nextHref={next?.href ?? null}
          onNext={selectNext}
          onPrevious={selectPrevious}
          previousHref={previous?.href ?? null}
          skipFormId={current.skipFormId}
        />
      </div>
    </div>
  );
}

function LocalCardNavigator({
  next,
  onNext,
  onPrevious,
  previous
}: {
  next: ImportReviewLocalWorkspaceItem | null;
  onNext: () => void;
  onPrevious: () => void;
  previous: ImportReviewLocalWorkspaceItem | null;
}) {
  return (
    <Card
      color="default"
      pattern="none"
      className="grid gap-2 rounded-[24px] border-2 border-dashed border-[#d9c49b] bg-white/80 p-3 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
    >
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
        <ChevronRight aria-hidden="true" size={15} />
        翻小纸条
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <LocalPagerButton
          direction="previous"
          item={previous}
          onClick={onPrevious}
        />
        <LocalPagerButton direction="next" item={next} onClick={onNext} />
      </div>
    </Card>
  );
}

function LocalPagerButton({
  direction,
  item,
  onClick
}: {
  direction: "previous" | "next";
  item: ImportReviewLocalWorkspaceItem | null;
  onClick: () => void;
}) {
  const icon =
    direction === "previous" ? (
      <ChevronLeft aria-hidden="true" size={18} />
    ) : (
      <ChevronRight aria-hidden="true" size={18} />
    );
  const title = direction === "previous" ? "上一条" : "下一条";
  const dataAttribute =
    direction === "previous"
      ? { "data-import-review-previous-link": "true" }
      : { "data-import-review-next-link": "true" };

  if (!item) {
    return (
      <div className="rounded-[20px] border-2 border-dashed border-[#e4d6bd] bg-[#fffdf3] px-3 py-2 text-sm font-black text-[#b2a38e]">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <p className="mt-1 text-xs leading-5">这一侧没有更多小纸条了</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      {...dataAttribute}
      className="group rounded-[20px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-3 py-2 text-left text-sm font-black text-[#794f27] shadow-[0_4px_0_rgba(121,79,39,0.1)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
    >
      <span className="flex items-center gap-2">
        {icon}
        {title}
      </span>
      <span className="mt-1 flex items-center gap-1 truncate text-xs leading-5 text-[#725d42]">
        <MousePointerClick aria-hidden="true" size={13} />
        {item.label}
      </span>
    </button>
  );
}

function getSafeIndex(index: number, length: number) {
  if (length <= 0) {
    return -1;
  }

  return Number.isInteger(index) && index >= 0 && index < length ? index : 0;
}

function getCardTop() {
  return document.getElementById("import-review-card")?.getBoundingClientRect().top ?? null;
}

function restoreCardTop(previousTop: number | null) {
  const card = document.getElementById("import-review-card");

  if (previousTop === null || !card) {
    return;
  }

  const nextTop = card.getBoundingClientRect().top;
  window.scrollTo({
    top: window.scrollY + nextTop - previousTop,
    behavior: "auto"
  });
}
