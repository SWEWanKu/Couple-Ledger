import type { ReactNode } from "react";
import { Divider, Icon, Title, type IconName, type TitleColor } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";

type NotebookAction = {
  href: string;
  label: string;
  icon?: ReactNode;
  ariaLabel?: string;
};

type NotebookEmptyStateTone = "teal" | "yellow" | "green" | "red";

type NotebookEmptyStateProps = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  iconName?: IconName;
  tone?: NotebookEmptyStateTone;
  action?: NotebookAction;
  secondaryAction?: NotebookAction;
  className?: string;
  dataAttributes?: Record<string, string>;
};

const toneStyles: Record<
  NotebookEmptyStateTone,
  {
    icon: string;
    tape: string;
    action: string;
    titleColor: TitleColor;
  }
> = {
  teal: {
    icon: "bg-[#82d5bb] text-white shadow-[0_6px_0_#5fb89f]",
    tape: "bg-[#82d5bb]/65",
    action: "bg-[#f7cd67] text-[#794f27] shadow-[0_5px_0_#d9a43e]",
    titleColor: "app-yellow"
  },
  yellow: {
    icon: "bg-[#f7cd67] text-[#794f27] shadow-[0_6px_0_#d9a43e]",
    tape: "bg-[#f7cd67]/70",
    action: "bg-[#82d5bb] text-white shadow-[0_5px_0_#5fb89f]",
    titleColor: "app-yellow"
  },
  green: {
    icon: "bg-[#8ac57c] text-white shadow-[0_6px_0_#689b5d]",
    tape: "bg-[#bde8ba]/75",
    action: "bg-[#82d5bb] text-white shadow-[0_5px_0_#5fb89f]",
    titleColor: "app-green"
  },
  red: {
    icon: "bg-[#fc736d] text-white shadow-[0_6px_0_#d65c55]",
    tape: "bg-[#fff1ed]/90",
    action: "bg-[#f7cd67] text-[#794f27] shadow-[0_5px_0_#d9a43e]",
    titleColor: "app-red"
  }
};

export function NotebookEmptyState({
  eyebrow,
  title,
  description,
  iconName = "icon-chat",
  tone = "teal",
  action,
  secondaryAction,
  className = "",
  dataAttributes = {}
}: NotebookEmptyStateProps) {
  const styles = toneStyles[tone];

  return (
    <div
      {...dataAttributes}
      className={`relative overflow-visible rounded-[28px] border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-8 text-center shadow-[0_5px_0_rgba(121,79,39,0.08)] ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute -top-3 left-8 h-7 w-24 -rotate-2 rounded-[10px] ${styles.tape} shadow-[0_5px_0_rgba(121,79,39,0.08)]`}
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#fff1a8]/75 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
      />

      <div className="mx-auto flex max-w-xl flex-col items-center">
        <span className={`flex h-16 w-16 items-center justify-center rounded-full ${styles.icon}`}>
          <Icon name={iconName} size={34} bounce />
        </span>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-[#9f927d]">
          {eyebrow}
        </p>
        <div className="mt-3">
          <Title size="small" color={styles.titleColor}>
            {title}
          </Title>
        </div>
        <div className="mt-4 max-w-lg text-sm font-bold leading-7 text-[#725d42]">
          {description}
        </div>

        {action || secondaryAction ? (
          <>
            <Divider type="wave-yellow" className="my-5 w-full" />
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
              {action ? <NotebookActionLink action={action} className={styles.action} /> : null}
              {secondaryAction ? (
                <NotebookActionLink
                  action={secondaryAction}
                  className="border-2 border-dashed border-[#d9c49b] bg-white/85 text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)]"
                />
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function NotebookActionLink({
  action,
  className
}: {
  action: NotebookAction;
  className: string;
}) {
  return (
    <IslandLink
      href={action.href}
      ariaLabel={action.ariaLabel}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-black transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25 ${className}`}
    >
      {action.icon}
      {action.label}
    </IslandLink>
  );
}
