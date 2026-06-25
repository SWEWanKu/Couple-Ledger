"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, MousePointerClick, Sparkles } from "lucide-react";
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
};

const shortcutCopy = {
  title: "\u5feb\u6377\u952e",
  description:
    "\u5171\u4eab\u5c4f\u5e55\u5bf9\u8d26\u65f6\u53ef\u7528\uff0c\u5149\u6807\u5728\u8f93\u5165\u6846\u91cc\u65f6\u4e0d\u4f1a\u89e6\u53d1\u3002",
  idle: "\u5feb\u6377\u952e\u53ea\u4f1a\u64cd\u4f5c\u5f53\u524d\u53ef\u7528\u7684\u6309\u94ae\u548c\u94fe\u63a5\u3002",
  next: "\u5df2\u6253\u5f00\u4e0b\u4e00\u6761\u5c0f\u7eb8\u6761",
  previous: "\u5df2\u6253\u5f00\u4e0a\u4e00\u6761\u5c0f\u7eb8\u6761",
  skip: "\u5df2\u6309\u73b0\u6709\u5ffd\u7565\u8868\u5355\u63d0\u4ea4",
  needDiscussion: "\u5df2\u6309\u73b0\u6709\u5f85\u786e\u8ba4\u8868\u5355\u63d0\u4ea4",
  focusCommon: "\u5df2\u805a\u7126\u5230\u5171\u540c\u652f\u51fa\u786e\u8ba4\u533a",
  confirm: "\u5df2\u6309\u73b0\u6709\u786e\u8ba4\u5165\u8d26\u8868\u5355\u63d0\u4ea4",
  invalid: "\u8bf7\u5148\u8865\u9f50\u5f53\u524d\u8868\u5355\u9700\u8981\u7684\u5185\u5bb9",
  unavailable: "\u8fd9\u4e2a\u5feb\u6377\u952e\u5728\u5f53\u524d\u5c0f\u7eb8\u6761\u4e0a\u4e0d\u53ef\u7528"
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
  commonExpenseAreaId
}: ImportReviewKeyboardShortcutsProps) {
  const router = useRouter();
  const submitLockRef = useRef(false);
  const [lastMessage, setLastMessage] = useState<string>(shortcutCopy.idle);

  useEffect(() => {
    function announce(message: string) {
      setLastMessage(message);
    }

    function navigate(href: string | null, message: string) {
      if (!href) {
        announce(shortcutCopy.unavailable);
        return;
      }

      announce(message);
      router.push(href);
    }

    function submitForm(formId: string, canSubmit: boolean, successMessage: string) {
      if (!canSubmit || submitLockRef.current) {
        announce(shortcutCopy.unavailable);
        return;
      }

      const form = document.getElementById(formId);

      if (!(form instanceof HTMLFormElement)) {
        announce(shortcutCopy.unavailable);
        return;
      }

      if (!form.checkValidity()) {
        form.reportValidity();
        announce(shortcutCopy.invalid);
        return;
      }

      submitLockRef.current = true;
      window.setTimeout(() => {
        submitLockRef.current = false;
      }, 1500);
      announce(successMessage);
      form.requestSubmit();
    }

    function focusCommonExpenseArea() {
      if (!canFocusCommonExpense) {
        announce(shortcutCopy.unavailable);
        return;
      }

      const area = document.getElementById(commonExpenseAreaId);

      if (!area) {
        announce(shortcutCopy.unavailable);
        return;
      }

      area.scrollIntoView({ behavior: "smooth", block: "center" });
      area.setAttribute("data-import-review-shortcut-highlight", "true");
      window.setTimeout(() => {
        area.removeAttribute("data-import-review-shortcut-highlight");
      }, 850);

      const focusTarget = area.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]'
      );
      focusTarget?.focus({ preventScroll: true });
      announce(shortcutCopy.focusCommon);
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
        navigate(nextHref, shortcutCopy.next);
        return;
      }

      if (key === "k") {
        event.preventDefault();
        navigate(previousHref, shortcutCopy.previous);
        return;
      }

      if (event.key === "4") {
        event.preventDefault();
        submitForm(skipFormId, canSkip, shortcutCopy.skip);
        return;
      }

      if (event.key === "5") {
        event.preventDefault();
        submitForm(needDiscussionFormId, canMarkNeedDiscussion, shortcutCopy.needDiscussion);
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
        submitForm(confirmFormId, canSubmitConfirm, shortcutCopy.confirm);
        return;
      }

      if (event.key === "Escape") {
        blurActiveEditable();
      }
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
    previousHref,
    router,
    skipFormId
  ]);

  return (
    <Card
      color="default"
      pattern="app-teal"
      className="relative overflow-hidden p-3"
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
          <p className="text-xs font-bold leading-5 text-[#725d42]">
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
        <p
          aria-live="polite"
          className="mt-2 flex items-start gap-2 rounded-[16px] bg-white/75 px-3 py-1.5 text-[11px] font-black leading-5 text-[#1f7a70] shadow-[inset_0_0_0_2px_rgba(130,213,187,0.42)]"
          data-import-review-shortcut-status="true"
        >
          <Sparkles aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
          <span>{lastMessage}</span>
        </p>
      </div>
      <style>{`
        [data-import-review-shortcut-highlight="true"] {
          animation: import-review-shortcut-pulse 850ms ease-out;
        }

        @keyframes import-review-shortcut-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(25, 200, 185, 0.42), 0 5px 0 rgba(121, 79, 39, 0.08);
          }
          55% {
            box-shadow: 0 0 0 10px rgba(25, 200, 185, 0.16), 0 5px 0 rgba(121, 79, 39, 0.08);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(25, 200, 185, 0), 0 5px 0 rgba(121, 79, 39, 0.08);
          }
        }
      `}</style>
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
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black shadow-[inset_0_0_0_2px_rgba(217,196,155,0.45)] ${
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
