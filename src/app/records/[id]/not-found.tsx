import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { NotebookEmptyState } from "@/components/NotebookEmptyState";

export default function RecordNotFoundPage() {
  return (
    <AppShell title="账单便签" subtitle="这张账单便签好像不在当前小岛里。">
      <div className="mx-auto max-w-4xl">
        <NotebookEmptyState
          action={{
            href: "/records",
            label: "回到账本列表",
            icon: <ArrowLeft aria-hidden="true" size={17} />
          }}
          dataAttributes={{ "data-record-not-found-state": "true" }}
          description="它可能已经不属于当前小岛，或者这张纸条暂时不可读。这里不会显示任何别人的账本内容。"
          eyebrow="Missing Receipt"
          iconName="icon-map"
          title="没找到这张账单便签"
          tone="yellow"
        />
      </div>
    </AppShell>
  );
}
