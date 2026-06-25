import { HeartHandshake, LockKeyhole } from "lucide-react";
import { Card, Divider, Icon, Title } from "animal-island-ui";

type TopbarProps = {
  title: string;
  subtitle: string;
  compact?: boolean;
};

export function Topbar({ title, subtitle, compact = false }: TopbarProps) {
  if (compact) {
    return (
      <header className="relative z-10 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-5">
        <Card color="default" pattern="app-yellow" className="relative overflow-visible px-4 py-3 sm:px-5">
          <div
            aria-hidden="true"
            className="absolute -top-3 left-8 h-6 w-24 -rotate-2 rounded-[9px] bg-[#f7cd67]/75 shadow-[0_4px_0_rgba(121,79,39,0.08)]"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2">
                <Icon name="icon-map" size={20} bounce />
                <Title size="small" color="app-yellow" style={{ fontSize: 14 }}>
                  小岛账本
                </Title>
              </div>
              <h1 className="mt-2 max-w-3xl text-2xl font-black leading-tight text-[#794f27] sm:text-3xl">
                {title}
              </h1>
              <p className="mt-1 max-w-3xl text-xs font-bold leading-5 text-[#725d42] sm:text-sm">
                {subtitle}
              </p>
            </div>
            <span className="hidden shrink-0 rounded-full bg-[#82d5bb] px-4 py-2 text-xs font-black text-white shadow-[0_4px_0_#5fb89f] md:inline-flex">
              一条流水，一次决定
            </span>
          </div>
        </Card>
      </header>
    );
  }

  return (
    <header className={`relative z-10 px-4 sm:px-6 lg:px-8 ${compact ? "pt-4 lg:pt-5" : "pt-6 lg:pt-8"}`}>
      <Card
        color="default"
        pattern="app-yellow"
        className={`relative overflow-visible px-5 sm:px-6 ${compact ? "py-4" : "py-5"}`}
      >
        <div
          aria-hidden="true"
          className="absolute -top-4 left-8 h-8 w-28 -rotate-2 rounded-[10px] bg-[#f7cd67]/75 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-3 right-10 h-7 w-24 rotate-2 rounded-[10px] bg-[#82d5bb]/65 shadow-[0_5px_0_rgba(121,79,39,0.08)]"
        />

        <div className={`relative grid gap-5 ${compact ? "" : "xl:grid-cols-[1fr_auto] xl:items-start"}`}>
          <div>
            <div className="inline-flex items-center gap-2">
              <Icon name="icon-map" size={24} bounce />
              <Title size="small" color="app-yellow" style={{ fontSize: 16 }}>
                小岛账本
              </Title>
            </div>
            <h1 className={`max-w-3xl font-black leading-tight text-[#794f27] ${compact ? "mt-3 text-2xl sm:text-3xl" : "mt-4 text-3xl sm:text-4xl"}`}>
              {title}
            </h1>
            <p className={`max-w-3xl text-sm font-bold text-[#725d42] sm:text-base ${compact ? "mt-2 leading-6" : "mt-3 leading-7"}`}>
              {subtitle}
            </p>
          </div>

          <div className={`gap-3 sm:grid-cols-2 xl:min-w-[360px] ${compact ? "hidden" : "grid"}`}>
            <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-[#d9c49b] bg-[#fffdf3] px-4 py-2 text-xs font-black text-[#725d42] shadow-[0_5px_0_rgba(121,79,39,0.09)]">
              <HeartHandshake aria-hidden="true" size={15} />
              只给两个人的小岛
            </span>
            <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1f9f8f] px-4 py-2 text-xs font-black text-white shadow-[0_5px_0_#14776c]">
              <LockKeyhole aria-hidden="true" size={15} />
              小岛成员可见
            </span>
          </div>
        </div>

        <Divider type="wave-yellow" className={compact ? "mt-3" : "mt-5"} />
      </Card>
    </header>
  );
}
