import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type AppShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-ledger-paper text-ledger-ink">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar title={title} subtitle={subtitle} />
          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
