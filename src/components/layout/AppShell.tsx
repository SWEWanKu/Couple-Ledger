import { Cursor } from "animal-island-ui";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

type AppShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  compact?: boolean;
};

export function AppShell({ title, subtitle, children, compact = false }: AppShellProps) {
  return (
    <Cursor>
      <div className="min-h-screen overflow-x-hidden bg-[#e7f7ed] text-[#794f27]">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(130,213,187,0.36)_0_92px,transparent_93px),radial-gradient(circle_at_88%_10%,rgba(247,205,103,0.28)_0_78px,transparent_79px),linear-gradient(90deg,rgba(25,200,185,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(25,200,185,0.08)_1px,transparent_1px)] bg-[length:auto,auto,34px_34px,34px_34px]"
        />
        <div className="relative mx-auto flex min-h-screen max-w-[1480px] flex-col px-3 py-4 sm:px-5 lg:grid lg:grid-cols-[164px_minmax(0,1fr)] lg:gap-5 lg:px-6 lg:py-6">
          <Sidebar />

          <section className="relative min-w-0 rounded-[34px] border-2 border-[#d9c49b] bg-[#f7f3df] shadow-[0_24px_60px_rgba(121,79,39,0.16)]">
            <div
              aria-hidden="true"
              className="absolute inset-y-8 left-3 hidden w-3 rounded-full bg-[repeating-linear-gradient(180deg,#d9c49b_0_10px,transparent_10px_22px)] opacity-70 lg:block"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-7 top-0 h-5 rounded-b-[18px] bg-[#f7cd67]/70 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
            />
            <div
              aria-hidden="true"
              className="absolute -right-4 top-28 hidden h-20 w-10 rotate-3 rounded-r-[18px] border-2 border-l-0 border-[#d9c49b] bg-[#fff1ed] shadow-[0_8px_0_rgba(121,79,39,0.08)] xl:block"
            />

            <Topbar compact={compact} title={title} subtitle={subtitle} />

            <main className={`relative z-10 px-4 sm:px-6 lg:px-8 ${compact ? "pb-6 pt-3 lg:pb-7" : "pb-7 pt-4 lg:pb-10"}`}>
              {children}
            </main>
          </section>
        </div>
      </div>
    </Cursor>
  );
}
