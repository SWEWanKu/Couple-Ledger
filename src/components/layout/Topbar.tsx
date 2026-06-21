import { Cloud, ShieldCheck } from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";

type TopbarProps = {
  title: string;
  subtitle: string;
};

export function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header className="relative z-10 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
      <Card color="default" pattern="app-yellow" className="relative overflow-visible px-5 py-5 sm:px-6">
        <div
          aria-hidden="true"
          className="absolute -top-4 left-8 h-8 w-28 -rotate-2 rounded-[10px] bg-[#f7cd67]/75 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
        />

        <div className="relative grid gap-5 xl:grid-cols-[1fr_auto] xl:items-start">
          <div>
            <div className="inline-flex items-center gap-2">
              <Icon name="icon-map" size={24} bounce />
              <Title size="small" color="app-yellow" style={{ fontSize: 16 }}>
                小岛账本
              </Title>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-[#794f27] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-[#725d42] sm:text-base">
              {subtitle}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
            <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-2 text-xs font-black text-[#725d42] shadow-[0_5px_0_rgba(121,79,39,0.09)]">
              <Cloud aria-hidden="true" size={15} />
              Supabase Auth/RLS
            </span>
            <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1f9f8f] px-4 py-2 text-xs font-black text-white shadow-[0_5px_0_#14776c]">
              <ShieldCheck aria-hidden="true" size={15} />
              RLS 保护
            </span>
          </div>
        </div>

        <Divider type="wave-yellow" className="mt-5" />
      </Card>
    </header>
  );
}
