"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, MousePointerClick } from "lucide-react";
import { Card, Icon } from "animal-island-ui";

type ImportReviewKeyboardShortcutsProps = {
  previousHref: string | null;
  nextHref: string | null;
  canSkip: boolean;
  canMarkNeedDiscussion: boolean;
  canFocusCommonExpense: boolean;
  canSubmitConfirm: boolean;
  confirmFormId: string;
  skipFormId: string;
  needDiscussionFormId: string;
  commonExpenseAreaId: string;
  onNext?: () => void;
  onPrevious?: () => void;
};

const shortcutCopy = {
  title: "\u5feb\u6377\u952e",
  description:
    "\u5149\u6807\u5728\u8f93\u5165\u6846\u91cc\u65f6\u4e0d\u4f1a\u89e6\u53d1\u3002"
} as const;

const shortcutRows = [
  { keyName: "J", label: "\u4e0b\u4e00\u6761", action: "next" },
  { keyName: "K", label: "\u4e0a\u4e00\u6761", action: "previous" },
  { keyName: "4", label: "\u5ffd\u7565", action: "skip" },
  { keyName: "5", label: "\u5f85\u786e\u8ba4", action: "need-discussion" },
  { keyName: "1", label: "\u5171\u540c\u652f\u51fa", action: "common-expense" },
  { keyName: "Enter", label: "\u786e\u8ba4\u5165\u8d26", action: "confirm" }
] as const;

export function ImportReviewKeyboardShortcuts({
  previousHref,
  nextHref,
  canSkip,
  canMarkNeedDiscussion,
  canFocusCommonExpense,
  canSubmitConfirm,
  confirmFormId,
  skipFormId,
  needDiscussionFormId,
  commonExpenseAreaId,
  onNext,
  onPrevious
}: ImportReviewKeyboardShortcutsProps) {
  const router = useRouter();
  const submitLockRef = useRef(false);

  useEffect(() => {
    function navigate(href: string | null, onLocalNavigate?: () => void) {
      if (!href) {
        return;
      }

      if (onLocalNavigate) {
        onLocalNavigate();
        return;
      }

      router.push(href, { scroll: false });
    }

    function submitForm(formId: string, canSubmit: boolean) {
      if (!canSubmit || submitLockRef.current) {
        return;
      }

      const form = document.getElementById(formId);

      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      submitLockRef.current = true;
      window.requestAnimationFrame(() => {
        submitLockRef.current = false;
      });
      form.requestSubmit();
    }

    function focusCommonExpenseArea() {
      if (!canFocusCommonExpense) {
        return;
      }

      const area = document.getElementById(commonExpenseAreaId);

      if (!area) {
        return;
      }

      area.scrollIntoView({ behavior: "auto", block: "center" });

      const focusTarget = area.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]'
      );
      focusTarget?.focus({ preventScroll: true });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        if (event.key === "Escape") {
          blurActiveEditable();
        }
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "j") {
        event.preventDefault();
        navigate(nextHref, onNext);
        return;
      }

      if (key === "k") {
        event.preventDefault();
        navigate(previousHref, onPrevious);
        return;
      }

      if (event.key === "4") {
        event.preventDefault();
        submitForm(skipFormId, canSkip);
        return;
      }

      if (event.key === "5") {
        event.preventDefault();
        submitForm(needDiscussionFormId, canMarkNeedDiscussion);
        return;
      }

      if (event.key === "1") {
        event.preventDefault();
        focusCommonExpenseArea();
        return;
      }

      if (event.key === "Enter") {
        if (isNativeEnterTarget(event.target)) {
          return;
        }

        event.preventDefault();
        submitForm(confirmFormId, canSubmitConfirm);
        return;
      }

      if (event.key === "Escape") {
        blurActiveEditable();
      }
    }

    if (!onPrevious && previousHref) {
      router.prefetch(previousHref);
    }

    if (!onNext && nextHref) {
      router.prefetch(nextHref);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    canFocusCommonExpense,
    canMarkNeedDiscussion,
    canSkip,
    canSubmitConfirm,
    commonExpenseAreaId,
    confirmFormId,
    needDiscussionFormId,
    nextHref,
    onNext,
    onPrevious,
    previousHref,
    router,
    skipFormId
  ]);

  return (
    <Card
      color="default"
      pattern="app-teal"
      className="relative overflow-hidden p-2.5"
      data-import-review-shortcuts="true"
    >
      <span
        aria-hidden="true"
        className="absolute -right-5 top-4 h-14 w-14 rounded-full bg-[#82d5bb]/35"
      />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#1f7a70]">
            <Keyboard aria-hidden="true" size={17} />
            {shortcutCopy.title}
          </p>
          <p className="hidden text-xs font-bold leading-5 text-[#725d42] md:block">
            {shortcutCopy.description}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {shortcutRows.map((row) => (
            <ShortcutHint
              key={row.action}
              action={row.action}
              enabled={isShortcutEnabled(row.action, {
                canFocusCommonExpense,
                canMarkNeedDiscussion,
                canSkip,
                canSubmitConfirm,
                nextHref,
                previousHref
              })}
              keyName={row.keyName}
              label={row.label}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

function ShortcutHint({
  action,
  enabled,
  keyName,
  label
}: {
  action: string;
  enabled: boolean;
  keyName: string;
  label: string;
}) {
  return (
    <span
      aria-disabled={!enabled}
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-black shadow-[inset_0_0_0_2px_rgba(217,196,155,0.45)] ${
        enabled ? "bg-[#fffdf3] text-[#794f27]" : "bg-white/55 text-[#b2a38e]"
      }`}
      data-import-review-shortcut-key={action}
    >
      <kbd className="inline-flex min-h-6 min-w-8 items-center justify-center rounded-full bg-[#f7cd67] px-2 text-[10px] text-[#794f27] shadow-[0_2px_0_#d9a43e]">
        {keyName}
      </kbd>
      <span className="flex items-center gap-1 whitespace-nowrap">
        <MousePointerClick aria-hidden="true" size={13} />
        {label}
      </span>
    </span>
  );
}

function isShortcutEnabled(
  action: (typeof shortcutRows)[number]["action"],
  state: {
    previousHref: string | null;
    nextHref: string | null;
    canSkip: boolean;
    canMarkNeedDiscussion: boolean;
    canFocusCommonExpense: boolean;
    canSubmitConfirm: boolean;
  }
) {
  if (action === "next") return Boolean(state.nextHref);
  if (action === "previous") return Boolean(state.previousHref);
  if (action === "skip") return state.canSkip;
  if (action === "need-discussion") return state.canMarkNeedDiscussion;
  if (action === "common-expense") return state.canFocusCommonExpense;
  if (action === "confirm") return state.canSubmitConfirm;

  return false;
}

function isEditableTarget(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;

  return Boolean(
    element?.closest(
      'input, textarea, select, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]'
    )
  );
}

function isNativeEnterTarget(target: EventTarget | null) {
  const element = target instanceof Element ? target : null;

  return Boolean(
    element?.closest(
      'button, a[href], input, textarea, select, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]'
    )
  );
}

function blurActiveEditable() {
  const activeElement = document.activeElement;

  if (activeElement instanceof HTMLElement && isEditableTarget(activeElement)) {
    activeElement.blur();
  }
}
