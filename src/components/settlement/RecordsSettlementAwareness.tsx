import type { ReactNode } from "react";
import {
  ArrowRightLeft,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileText,
  Hourglass,
  ShieldCheck
} from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";
import { IslandLink } from "@/components/IslandLink";
import type { GetSettlementSnapshotStatusResult } from "@/lib/settlement/get-settlement-snapshot-status";

type RecordsSettlementAwarenessContext = "list" | "detail" | "new";

type RecordsSettlementAwarenessProps = {
  statusResult: GetSettlementSnapshotStatusResult;
  context: RecordsSettlementAwarenessContext;
  className?: string;
};

export function RecordsSettlementAwareness({
  statusResult,
  context,
  className = ""
}: RecordsSettlementAwarenessProps) {
  if (statusResult.status === "error" || statusResult.status === "no_snapshot") {
    return null;
  }

  const snapshot = statusResult.snapshot;
  const confirmedCount = new Set(
    statusResult.confirmations.map((confirmation) => confirmation.confirmed_by)
  ).size;
  const progressLabel = `${confirmedCount}/${statusResult.requiredConfirmationCount || "?"}`;
  const statusCopy = getStatusCopy(statusResult.status, progressLabel);
  const contextCopy = getContextCopy(context, statusResult.status);

  return (
    <div
      data-settlement-awareness="records"
      data-settlement-month={statusResult.month.month}
      className={className}
    >
      <Card
        type="dashed"
        color="default"
        className={`relative overflow-visible p-5 sm:p-6 ${statusCopy.panelClassName}`}
      >
        <span
          aria-hidden="true"
          className="absolute -top-3 left-8 h-7 w-24 -rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
        />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#9f927d]">
              <Icon name="icon-diy" size={18} bounce />
              结算便签
            </p>
            <div className="mt-3">
              <Title size="small" color="app-yellow">
                {contextCopy.heading}
              </Title>
            </div>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-[#725d42]">
              {contextCopy.body}
            </p>
          </div>

          <div
            className={`rounded-[26px] border-2 border-dashed px-4 py-3 text-sm font-black leading-6 shadow-[0_5px_0_rgba(121,79,39,0.08)] ${statusCopy.badgeClassName}`}
          >
            <p className="flex items-center gap-2">
              {statusCopy.icon}
              {statusCopy.label}
            </p>
            <p className="mt-1 text-xs text-[#8a7556]">
              {statusResult.month.monthLabel} · {progressLabel} 盖章
            </p>
          </div>
        </div>

        <Divider type="wave-yellow" className="my-5" />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniNote
              icon={<Clock3 aria-hidden="true" size={16} />}
              label="便签月份"
              value={statusResult.month.monthLabel}
            />
            <MiniNote
              icon={<ShieldCheck aria-hidden="true" size={16} />}
              label="账本动作"
              value="只读提醒"
            />
            <MiniNote
              icon={<BadgeCheck aria-hidden="true" size={16} />}
              label="确认进度"
              value={progressLabel}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <IslandLink
              href={`/settlement?month=${statusResult.month.month}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#82d5bb] px-5 py-2 text-sm font-black text-white shadow-[0_5px_0_#5fb89f] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_#5fb89f] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              <ArrowRightLeft aria-hidden="true" size={17} />
              看实时结算
            </IslandLink>
            <IslandLink
              href={`/settlement/history/${snapshot.id}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-dashed border-[#d9c49b] bg-[#fffdf3] px-5 py-2 text-sm font-black text-[#794f27] shadow-[0_5px_0_rgba(121,79,39,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_7px_0_rgba(121,79,39,0.12)] focus:outline-none focus:ring-4 focus:ring-[#19c8b9]/25"
            >
              <FileText aria-hidden="true" size={17} />
              打开归档便签
            </IslandLink>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MiniNote({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] bg-white/80 px-3 py-3 shadow-[inset_0_0_0_2px_rgba(217,196,155,0.68)]">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#9f927d]">
        {icon}
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-[#794f27]">{value}</p>
    </div>
  );
}

function getContextCopy(
  context: RecordsSettlementAwarenessContext,
  status: Exclude<GetSettlementSnapshotStatusResult["status"], "error" | "no_snapshot">
) {
  if (context === "new") {
    return {
      heading: "这月已有结算便签",
      body:
        status === "fully_confirmed"
          ? "进入表单时读取的月份已经双方确认。继续记账不会改写那张归档便签，也不会自动生成新的确认动作。你手动改日期时，这条提示不会实时切换。"
          : "进入表单时读取的月份已经有一张结算便签。继续记账照常保存，不会替你确认、撤回或改写这张便签。你手动改日期时，这条提示不会实时切换。"
    };
  }

  if (context === "detail") {
    return {
      heading: "这张账单所在月份有结算便签",
      body:
        status === "fully_confirmed"
          ? "这个月已经双方确认。当前账单详情仍然只读展示，归档便签保留的是当时保存下来的结算快照。"
          : "这张账单属于一个已经提出结算便签的月份。详情页这里只做提醒，不会新增确认章，也不会更改账本。"
    };
  }

  return {
    heading: "这个月有结算便签",
    body:
      status === "fully_confirmed"
        ? "这个月已经双方确认。之后新增或查看流水，都不会自动改写已归档的结算便签。"
        : "这个月已经有一张结算便签，正在等确认章。流水列表这里只做温柔提醒，记账和查看都不会被拦住。"
  };
}

function getStatusCopy(
  status: Exclude<GetSettlementSnapshotStatusResult["status"], "error" | "no_snapshot">,
  progressLabel: string
) {
  if (status === "fully_confirmed") {
    return {
      label: `双方已确认 · ${progressLabel}`,
      icon: <CheckCircle2 aria-hidden="true" size={16} />,
      panelClassName: "border-[#82d5bb]/75 bg-[#e9fbf4]/85",
      badgeClassName: "border-[#82d5bb] bg-[#e9fbf4] text-[#1f7a70]"
    };
  }

  if (status === "partially_confirmed") {
    return {
      label: `部分确认 · ${progressLabel}`,
      icon: <BadgeCheck aria-hidden="true" size={16} />,
      panelClassName: "border-[#f7cd67]/80 bg-[#fff8da]/88",
      badgeClassName: "border-[#f7cd67] bg-[#fff8da] text-[#8a6420]"
    };
  }

  return {
    label: `等待盖章 · ${progressLabel}`,
    icon: <Hourglass aria-hidden="true" size={16} />,
    panelClassName: "border-[#d9c49b] bg-[#fffdf3]",
    badgeClassName: "border-[#d9c49b] bg-[#fffdf3] text-[#8a7556]"
  };
}
